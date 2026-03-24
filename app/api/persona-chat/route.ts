import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getStandardLimiter, checkRateLimit } from "@/app/lib/rate-limit";
import { queryRelevant } from "@/app/lib/pinecone";

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

async function handleExtract(body: {
  profileData: unknown;
  summary?: string;
}) {
  const { profileData, summary } = body;

  if (!profileData) {
    return Response.json(
      { error: "Profile data is required." },
      { status: 400 }
    );
  }

  // Build a focused input for extraction: summary + profile snippet (not raw JSON)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pd = profileData as any;
  const source = pd._source || "twitter";

  let profileSnippet = "";
  if (source === "twitter") {
    const u = pd.user || {};
    profileSnippet = `Platform: X/Twitter\nName: ${u.name || "unknown"}\nHandle: @${u.screen_name || u.id || "unknown"}\nBio: ${u.desc || "N/A"}\nFollowers: ${u.sub_count || "N/A"}\nFollowing: ${u.friends || "N/A"}`;
  } else {
    profileSnippet = `Platform: LinkedIn\nName: ${pd.name || "unknown"}\nHandle: ${pd.id || "N/A"}\nHeadline: ${pd.headline || "N/A"}\nAbout: ${pd.about || "N/A"}\nLocation: ${pd.city || pd.location || "N/A"}`;
  }

  const dataForExtraction = summary
    ? `${profileSnippet}\n\n## Analyzed summary of their online presence:\n${summary}`
    : `${profileSnippet}\n\n## Raw profile data:\n${JSON.stringify(profileData).slice(0, 15000)}`;

  const extractionPrompt = `You are a deep personality analyst. Based on the following social media profile data, extract a detailed persona profile. Return a JSON object with exactly these keys:

- "traits": a comma-separated list of 8-12 personality traits (e.g. "opinionated, witty, technically deep, impatient with mediocrity, contrarian, self-deprecating, passionate about open source")
- "writingStyle": 3-4 sentences describing exactly how this person writes — tone, sentence length, vocabulary level, formality, how they structure arguments, whether they use threads or single posts
- "languagePatterns": specific language patterns WITH examples pulled from their content (e.g. "frequently starts tweets with 'Hot take:', uses '...' for dramatic pauses, drops articles like 'the' in casual speech, uses lowercase for emphasis")
- "topicsAndInterests": what they talk about most — their domain expertise, recurring themes, industries they engage with, hobbies or passions that show up in their posts
- "opinionsAndStances": strong views they've expressed — things they advocate for or against, recurring arguments they make, hills they'd die on
- "humorStyle": how they use humor — sarcastic, dry, self-deprecating, meme-heavy, observational, absurdist, or if they rarely joke
- "conversationalTics": catchphrases or verbal habits, how they greet people, how they end messages, filler expressions, unique vocabulary they've coined or adopted
- "summary": 2 paragraphs giving a vivid description of this person's complete online persona — who they are, how they come across, what it feels like to have a conversation with them

Return ONLY valid JSON. No markdown code fences. No extra text.

Profile data:
${dataForExtraction}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: extractionPrompt }] }],
  });

  const text = response.text?.trim() || "";

  try {
    let jsonText = text;
    if (jsonText.startsWith("```")) {
      jsonText = jsonText
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "");
    }
    const personaProfile = JSON.parse(jsonText);
    return Response.json({ personaProfile });
  } catch { //TODO: we will ltk that persona creation not succ
    return Response.json({
      personaProfile: {
        traits: "conversational, engaged",
        writingStyle: "Natural conversational tone based on their posts.",
        languagePatterns: "Standard social media communication patterns.",
        topicsAndInterests: "Various topics related to their field.",
        opinionsAndStances: "Not enough data to determine strong stances.",
        humorStyle: "Occasional light humor.",
        conversationalTics: "Standard conversational patterns.",
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
    topicsAndInterests: string;
    opinionsAndStances: string;
    humorStyle: string;
    conversationalTics: string;
    summary: string;
  };
  profileData: unknown;
  username: string;
  sessionId?: string;
  summary?: string;
}) {
  const { messages, personaProfile, profileData, username, sessionId, summary } =
    body;

  if (!messages || !personaProfile) {
    return Response.json(
      { error: "Messages and persona profile are required." },
      { status: 400 }
    );
  }

  // Get the latest user message for RAG
  const latestUserMsg = [...messages]
    .reverse()
    .find((m) => m.role === "user");

  // RAG: retrieve relevant posts for this specific question
  const source = ((profileData as { _source?: string })?._source ||
    "twitter") as "twitter" | "linkedin";
  let retrievedContext = "";
  if (sessionId && latestUserMsg) {
    try {
      const relevant = await queryRelevant(
        latestUserMsg.content,
        sessionId,
        source,
        5
      );
      if (relevant.length > 0) {
        retrievedContext = relevant
          .map((r, i) => `[${i + 1}] ${r.metadata.text}`)
          .join("\n\n");
      }
    } catch (err) {
      console.warn("Persona RAG retrieval failed:", err);
    }
  }

  // Build the persona system prompt
  let systemPrompt = `You ARE @${username}. You embody this person completely. Do not break character under any circumstances.

## Your personality
Traits: ${personaProfile.traits}
Writing style: ${personaProfile.writingStyle}
Language patterns: ${personaProfile.languagePatterns}
Topics and interests: ${personaProfile.topicsAndInterests}
Opinions and stances: ${personaProfile.opinionsAndStances}
Humor style: ${personaProfile.humorStyle}
Conversational habits: ${personaProfile.conversationalTics}

## Who you are
${personaProfile.summary}`;

  if (summary) {
    systemPrompt += `\n\n## Deeper context about your online presence\n${summary}`;
  }

  if (retrievedContext) {
    systemPrompt += `\n\n## Your actual posts relevant to what's being discussed\nUse these to inform your response — reference them naturally as things you've said:\n${retrievedContext}`;
  }

  systemPrompt += `\n\n## Rules
- Always respond exactly as this person would — use their vocabulary, sentence rhythm, and tone
- Reference your actual interests, views, and things you've posted when relevant
- If asked something you'd have strong opinions on, voice those opinions in your voice
- Keep responses feeling like a real conversation, not an essay
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
