import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getStandardLimiter, checkRateLimit } from "@/app/lib/rate-limit";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: NextRequest) {
  const rateLimited = await checkRateLimit(getStandardLimiter, request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const { mode } = body;

    if (mode === "extract") {
      return handleExtract(body);
    } else if (mode === "chat") {
      return handleChat(body);
    }

    return Response.json({ error: "Invalid mode." }, { status: 400 });
  } catch (err) {
    console.error("persona-chat error:", err);
    return Response.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}

async function handleExtract(body: { profileData: unknown }) {
  const { profileData } = body;

  if (!profileData) {
    return Response.json(
      { error: "Profile data is required." },
      { status: 400 }
    );
  }

  const extractionPrompt = `You are a personality analyst. Given raw Twitter/X profile JSON data, extract and return a JSON object with exactly these keys:
- "traits": a comma-separated list of 5-8 personality traits in plain English (e.g. "opinionated, witty, technical, passionate")
- "writingStyle": 2-3 sentences describing how this person writes (tone, sentence length, vocabulary level, use of humour, formality)
- "languagePatterns": specific patterns (e.g. "uses rhetorical questions often, starts tweets with lowercase, heavy use of ellipsis")
- "summary": one paragraph description of this person's communication persona

Return ONLY valid JSON. No markdown code fences. No extra text.

Profile data:
${JSON.stringify(profileData)}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: extractionPrompt }] }],
  });

  const text = response.text?.trim() || "";

  try {
    let jsonText = text;
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const personaProfile = JSON.parse(jsonText);
    return Response.json({ personaProfile });
  } catch {
   
    return Response.json({
      personaProfile: {
        traits: "conversational, engaged",
        writingStyle: "Natural conversational tone based on their posts.",
        languagePatterns: "Standard social media communication patterns.",
        summary: text || "A social media user with a unique voice.",
      },
    });
  }
}

async function handleChat(body: {
  messages: { role: string; content: string }[];
  personaProfile: {
    traits: string;
    writingStyle: string;
    languagePatterns: string;
    summary: string;
  };
  profileData: unknown;
  username: string;
}) {
  const { messages, personaProfile, profileData, username } = body;

  if (!messages || !personaProfile) {
    return Response.json(
      { error: "Messages and persona profile are required." },
      { status: 400 }
    );
  }

  const systemPrompt = `You ARE @${username}. You embody this person completely. Do not break character under any circumstances.

Your personality traits: ${personaProfile.traits}
Your writing style: ${personaProfile.writingStyle}
Your language patterns: ${personaProfile.languagePatterns}
Your persona summary: ${personaProfile.summary}

Here is the raw profile data for additional context on your views, interests, and recent activity:
${JSON.stringify(profileData, null, 2)}

Rules:
- Always respond exactly as this person would — use their vocabulary, sentence rhythm, and tone
- Reference their actual interests and views when relevant
- If asked something they'd have strong opinions on, voice those opinions in their voice
- Keep responses feeling like a real social media conversation, not an essay
- Never say you are an AI or break character
- Be concise and natural
- Do not go too overboard with the use of emojis`;

  const contents = messages.map(
    (msg: { role: string; content: string }) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    })
  );

  const stream = await ai.models.generateContentStream({
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
        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        console.error("Persona stream error:", err);
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
}
