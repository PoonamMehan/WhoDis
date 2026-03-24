import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;

function getAI() {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }
  return _ai;
}

/**
 * Generate a holistic summary of a person from all their posts/tweets.
 * Called once at profile load time. The summary covers personality,
 * recurring topics, communication style, and notable opinions —
 * everything that broad questions ("what kind of person is this?") need.
 */
export async function generateProfileSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profileData: any
): Promise<string> {
  const source = profileData._source;

  let postsText = "";
  let profileInfo = "";

  if (source === "twitter") {
    const screenName = profileData.user?.screen_name || "unknown";
    profileInfo = `Name: ${profileData.user?.name || "unknown"}\nBio: ${profileData.user?.desc || "N/A"}\nFollowers: ${profileData.user?.sub_count || "N/A"}\nFollowing: ${profileData.user?.friends || "N/A"}`;

    // Collect tweets
    const tweets = Array.isArray(profileData.timeline)
      ? profileData.timeline
          .filter((t: { text?: string }) => t.text)
          .map((t: { text: string; created_at?: string }) => `[${t.created_at || ""}] ${t.text}`)
      : [];

    // Collect replies
    const replies = Array.isArray(profileData.replies?.timeline)
      ? profileData.replies.timeline
          .filter((t: { text?: string }) => t.text)
          .map((t: { text: string; created_at?: string }) => `[Reply, ${t.created_at || ""}] ${t.text}`)
      : [];

    postsText = `@${screenName}'s tweets:\n${tweets.join("\n")}\n\n@${screenName}'s replies:\n${replies.join("\n")}`;
  } else if (source === "linkedin") {
    profileInfo = `Name: ${profileData.name || "unknown"}\nHeadline: ${profileData.headline || "N/A"}\nAbout: ${profileData.about || "N/A"}\nLocation: ${profileData.city || profileData.location || "N/A"}`;

    const posts = Array.isArray(profileData.posts)
      ? profileData.posts
          .filter((p: { post_text?: string }) => p.post_text)
          .map((p: { post_text: string; date_posted?: string }) => `[${p.date_posted || ""}] ${p.post_text}`)
      : [];

    postsText = `LinkedIn posts:\n${posts.join("\n")}`;
  }

  // If no posts to summarize, return a minimal summary from profile info
  if (!postsText.trim()) {
    return `Profile info: ${profileInfo}\nNo posts available for deeper analysis.`;
  }

  const prompt = `You are analyzing a person's public social media presence. Based on their profile info and all their posts below, write a comprehensive summary covering:

1. **Key topics and interests** — What do they mostly talk about?
2. **Personality traits** — Are they opinionated, funny, technical, casual, formal?
3. **Communication style** — Short tweets or long threads? Use emojis? Hashtags? Rhetorical questions?
4. **Notable opinions or stances** — Any strong views they've expressed?
5. **Professional focus** — What field/industry are they in?
6. **Engagement patterns** — Do they reply a lot? Retweet? Original content mostly?

Keep it factual and based only on what's in the data. Write 3-5 paragraphs. No bullet points — flowing prose that gives a complete picture of who this person is online.

Profile info:
${profileInfo}

Their posts and activity:
${postsText}`;

  const ai = getAI();
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  return result.text?.trim() || `Profile info: ${profileInfo}`;
}
