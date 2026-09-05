import { GoogleGenAI } from "@google/genai";
import type { AiProviderClient, AiCompletionRequest } from "../types";
import { createProviderFactory } from "../providerFactory";

// `@google/genai` replaced `@google/generative-ai`, which Google stopped
// supporting in 2025 and never taught the Gemini 3 request shape.
const factory = createProviderFactory(
  (apiKey) => new GoogleGenAI({ apiKey }),
);

export function createGeminiProvider(apiKey: string, modelId: string): AiProviderClient {
  const client = factory.getClient(apiKey);

  return {
    async complete(req: AiCompletionRequest): Promise<string> {
      // No maxOutputTokens: on Gemini 3 the model's own thinking counts
      // against it, so a cap sized for the answer truncates the answer.
      const response = await client.models.generateContent({
        model: modelId,
        contents: req.userContent,
        config: { systemInstruction: req.systemPrompt },
      });
      return response.text ?? "";
    },

    async testConnection(): Promise<boolean> {
      try {
        await client.models.generateContent({
          model: modelId,
          contents: "Say hi",
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function clearGeminiProvider(): void {
  factory.clear();
}
