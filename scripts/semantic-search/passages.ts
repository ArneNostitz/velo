import { createHash } from "node:crypto";
import type { UniversalDocument } from "./types";

export const SEMANTIC_MODEL = "ts/multilingual-e5-small";
export const SEMANTIC_VERSION = "e5-small-384-byte320-title32-overlap96-v2";

// XLMRoberta in Typesense 30.2 truncates at 128 tokens. Short natural-language
// windows retain useful context, but a byte budget is NOT an exact token bound:
// dense code, unusual words, and some languages can still be truncated by the
// server. Do not assume the model card's 512-token limit applies here.
const CONTENT_BYTES = 320;
const TITLE_BYTES = 32;
const OVERLAP_BYTES = 96;

function prefixLength(text: string, bytes: number): number {
  let length = 0;
  let used = 0;
  for (const character of text) {
    const size = Buffer.byteLength(character, "utf8");
    if (used + size > bytes) break;
    used += size;
    length += character.length;
  }
  return length;
}

export interface PassageDocument {
  id: string;
  document_id: string;
  source: string;
  app: string;
  content: string;
  passage: string;
  title_context: string;
  passage_index: number;
  index_generation: string;
  updated_at: number;
}

// Yield one short record at a time: never materialize a long mail's chunks,
// embeddings, or the entire corpus in the Raycast process.
export function* documentPassages(document: UniversalDocument, generation: string): Generator<PassageDocument> {
  const title = document.title.replace(/\s+/g, " ").trim();
  const context = title.slice(0, prefixLength(title, TITLE_BYTES));
  const text = document.content?.trim() || [document.snippet, document.subtitle, ...(document.tags || []), title].filter(Boolean).join("\n");
  const budget = CONTENT_BYTES - Buffer.byteLength(context, "utf8") - 1;
  let start = 0;
  let index = 0;
  while (start < text.length) {
    let end = start + prefixLength(text.slice(start), budget);
    if (end < text.length) {
      const window = text.slice(start, end);
      // Prefer the last sentence/paragraph end in the latter third, keeping
      // windows substantial. Otherwise end at a word boundary in the latter
      // half; long unbroken strings fall back to the UTF-8-safe byte boundary.
      let sentenceEnd = 0;
      for (const match of window.matchAll(/[.!?]["')\]]?\s+|\n\s*\n/g)) {
        const boundary = match.index! + match[0].length;
        if (boundary >= window.length * 2 / 3) sentenceEnd = boundary;
      }
      const wordEnd = Math.max(window.lastIndexOf(" "), window.lastIndexOf("\n"), window.lastIndexOf("\t"));
      if (sentenceEnd) end = start + sentenceEnd;
      else if (wordEnd > window.length / 2) end = start + wordEnd;
    }
    if (end <= start) throw new Error("Unable to split a semantic passage.");
    const passage = text.slice(start, end).trim();
    if (passage) {
      yield {
        id: createHash("sha256").update(JSON.stringify([document.id, generation, index])).digest("hex"),
        document_id: document.id, source: document.source, app: document.app,
        content: context ? context + "\n" + passage : passage, passage, title_context: context,
        passage_index: index++, index_generation: generation, updated_at: document.updated_at,
      };
    }
    if (end === text.length) break;
    const window = text.slice(start, end);
    let advance = prefixLength(window, Math.max(1, Buffer.byteLength(window, "utf8") - OVERLAP_BYTES));
    // Start the overlap on a whole word when one is nearby. Alignment can
    // reduce the overlap slightly; it never leaves a gap between windows.
    const nextSpace = window.slice(advance).search(/\s/);
    if (nextSpace >= 0 && Buffer.byteLength(window.slice(advance, advance + nextSpace + 1), "utf8") <= 24) {
      advance += nextSpace + 1;
    }
    start += Math.max(advance, 1);
  }
}
