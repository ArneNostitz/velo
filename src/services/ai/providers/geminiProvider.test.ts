import { describe, it, expect, beforeEach, vi } from "vitest";

const generateContent = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(function () {
    return { models: { generateContent } };
  }),
}));

import { GoogleGenAI } from "@google/genai";
import { createGeminiProvider, clearGeminiProvider } from "./geminiProvider";

describe("geminiProvider", () => {
  beforeEach(() => {
    generateContent.mockReset();
    vi.mocked(GoogleGenAI).mockClear();
    clearGeminiProvider();
  });

  it("sends the system prompt as systemInstruction and returns the text", async () => {
    generateContent.mockResolvedValue({ text: "hello back" });
    const provider = createGeminiProvider("key", "gemini-3.8-flash");

    const out = await provider.complete({ systemPrompt: "Be brief", userContent: "Hi" });

    expect(out).toBe("hello back");
    expect(generateContent).toHaveBeenCalledWith({
      model: "gemini-3.8-flash",
      contents: "Hi",
      config: { systemInstruction: "Be brief" },
    });
  });

  it("returns an empty string when the response carries no text", async () => {
    generateContent.mockResolvedValue({ text: undefined });
    const provider = createGeminiProvider("key", "gemini-3.8-flash");
    expect(await provider.complete({ systemPrompt: "", userContent: "Hi" })).toBe("");
  });

  it("reports a failed call as a failed connection test", async () => {
    generateContent.mockRejectedValue(new Error("404 model not found"));
    const provider = createGeminiProvider("key", "gemini-2.5-flash-preview-05-20");
    expect(await provider.testConnection()).toBe(false);
  });

  it("reuses one client per api key", () => {
    createGeminiProvider("key", "a");
    createGeminiProvider("key", "b");
    expect(GoogleGenAI).toHaveBeenCalledTimes(1);
    createGeminiProvider("other", "a");
    expect(GoogleGenAI).toHaveBeenCalledTimes(2);
    expect(GoogleGenAI).toHaveBeenLastCalledWith({ apiKey: "other" });
  });
});
