import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getStandardLimiter, checkRateLimit } from "@/app/lib/rate-limit";
import { queryRelevant } from "@/app/lib/pinecone";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: NextRequest) {
  const rateLimited = await checkRateLimit(getStandardLimiter, request);
  if (rateLimited) return rateLimited;

  try {
    const { messages, profileData, sessionId, summary } = await request.json();

    if (!messages || !Array.isArray(messages) || !profileData) {
      return Response.json(
        { error: "Invalid request. Messages and profile data are required." },
        { status: 400 }
      );
    }

    // Extract the latest user message for RAG query
    const latestUserMsg = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user");

    // Build profile info snippet (always included, small token cost)
    const source = (profileData as { _source?: string })._source || "twitter";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pd = profileData as any;
    let profileSnippet = "";
    if (source === "twitter") {
      const u = pd.user || {};
      profileSnippet = `Name: ${u.name || "unknown"}\nHandle: @${u.screen_name || u.id || "unknown"}\nBio: ${u.desc || "N/A"}\nFollowers: ${u.sub_count || "N/A"}\nFollowing: ${u.friends || "N/A"}\nLocation: ${u.location || "N/A"}`;
    } else {
      profileSnippet = `Name: ${pd.name || "unknown"}\nHandle: ${pd.id || "N/A"}\nHeadline: ${pd.headline || "N/A"}\nAbout: ${pd.about || "N/A"}\nLocation: ${pd.city || pd.location || "N/A"}\nFollowers: ${pd.followers || "N/A"}\nConnections: ${pd.connections || "N/A"}`;
    }

    // RAG retrieval: get relevant posts for the user's question
    let retrievedContext = "";
    if (sessionId && latestUserMsg) {
      try {
        const relevant = await queryRelevant(
          latestUserMsg.content,
          sessionId,
          source as "twitter" | "linkedin",
          5
        );
        if (relevant.length > 0) {
          retrievedContext = relevant
            .map((r, i) => `[${i + 1}] ${r.metadata.text}`)
            .join("\n\n");
        }
      } catch (err) {
        console.warn("RAG retrieval failed, falling back to summary only:", err);
      }
    }

    // Build the system prompt: summary (holistic) + retrieved posts (specific)
    let systemPrompt = `You are a helpful assistant that answers questions about a person based on their public social media data. Be conversational and concise. If something isn't clear from the data, say so honestly.
    ## Profile
    ${profileSnippet}`;

    if (summary) {
      systemPrompt += `\n\n## Summary of their online presence\n${summary}`;
    }

    if (retrievedContext) {
      systemPrompt += `\n\n## Relevant posts/tweets (retrieved for this specific question)\n${retrievedContext}`;
    }

    if (!summary && !retrievedContext) {
      // Fallback: no RAG available, dump a truncated version of profileData
      systemPrompt += `\n\n## Raw profile data\n${JSON.stringify(profileData, null, 2).slice(0, 8000)}`;
    }

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
