import { splitSearchMatches } from "@/utils/searchHighlight";

interface HighlightedTextProps {
  text: string | null | undefined;
  terms?: readonly string[];
}

const EMPTY_TERMS: readonly string[] = [];

export function HighlightedText({ text, terms = EMPTY_TERMS }: HighlightedTextProps) {
  return splitSearchMatches(text ?? "", terms).map((segment, index) =>
    segment.matched ? (
      <mark
        key={`${segment.text}-${index}`}
        className="rounded-sm bg-yellow-200/90 px-px text-inherit dark:bg-yellow-500/35"
      >
        {segment.text}
      </mark>
    ) : (
      segment.text
    ),
  );
}
