import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;

function getAI() {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }
  return _ai;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const ai = getAI();

  // Gemini embedding API has a batch limit, process in chunks of 100
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const result = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: batch.map((t) => ({ parts: [{ text: t }] })),
      config: { outputDimensionality: 768 },
    });

    if (result.embeddings) {
      for (const emb of result.embeddings) {
        allEmbeddings.push(emb.values as number[]);
      }
    }
  }

  return allEmbeddings;
}

export async function embedText(text: string): Promise<number[]> {
  const results = await embedTexts([text]);
  return results[0];
}
