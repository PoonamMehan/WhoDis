import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getStandardLimiter, checkRateLimit } from "@/app/lib/rate-limit";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: NextRequest) {
  const rateLimited = await checkRateLimit(getStandardLimiter, request);
  if (rateLimited) return rateLimited;

  try {
    const { messages, profileData } = await request.json();

    if (!messages || !Array.isArray(messages) || !profileData) {
      return Response.json(
        { error: "Invalid request. Messages and profile data are required." },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a helpful assistant that answers questions about a person based on their public X (Twitter) profile data. Below is the JSON data collected from their profile. Use ONLY this data to answer questions. If the answer isn't available in the data, say so honestly. Be conversational and concise.

Here is the profile data:
${JSON.stringify(profileData, null, 2)}`;

    const contents = messages.map(
      (msg: { role: string; content: string }) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })
    );

    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ text })}\n\n`
                )
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream interrupted." })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("continue-conversation error:", err);
    return Response.json(
      { error: "Something went wrong while generating a response." },
      { status: 500 }
    );
  }
}
