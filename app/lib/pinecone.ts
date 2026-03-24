import { Pinecone } from "@pinecone-database/pinecone";
import { embedTexts, embedText } from "./embeddings";

let _pc: Pinecone | null = null;

function getPinecone() {
  if (!_pc) {
    _pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  }
  return _pc;
}

function getIndex() {
  const indexName = process.env.PINECONE_INDEX || "whodis";
  return getPinecone().index(indexName);
}

// ─── Chunking helpers ───

interface ChunkItem {
  id: string;
  text: string;
  metadata: Record<string, string>;
}

function chunkTwitterTimeline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timeline: any[],
  screenName: string
): ChunkItem[] {
  if (!Array.isArray(timeline)) return [];

  return timeline
    .filter((t) => t.text && typeof t.text === "string")
    .map((tweet, i) => ({
      id: `tweet-${i}-${tweet.tweet_id || i}`,
      text: `[@${tweet.author?.screen_name || screenName}, ${tweet.created_at || "unknown date"}]: ${tweet.text}`,
      metadata: {
        type: "tweet",
        tweet_id: tweet.tweet_id || String(i),
        date: tweet.created_at || "",
        author: tweet.author?.screen_name || screenName,
        text: tweet.text,
      },
    }));
}

function chunkTwitterReplies(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repliesData: any,
  screenName: string
): ChunkItem[] {
  const timeline = repliesData?.timeline;
  if (!Array.isArray(timeline)) return [];

  return timeline
    .filter((t) => t.text && typeof t.text === "string")
    .map((reply, i) => ({
      id: `reply-${i}-${reply.tweet_id || i}`,
      text: `[Reply by @${reply.author?.screen_name || screenName}, ${reply.created_at || "unknown date"}]: ${reply.text}`,
      metadata: {
        type: "reply",
        tweet_id: reply.tweet_id || String(i),
        date: reply.created_at || "",
        author: reply.author?.screen_name || screenName,
        text: reply.text,
        reply_to: reply.in_reply_to_status_id_str || "",
      },
    }));
}

function chunkLinkedInPosts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  posts: any[]
): ChunkItem[] {
  if (!Array.isArray(posts)) return [];

  return posts
    .filter((p) => p.post_text && typeof p.post_text === "string")
    .map((post, i) => ({
      id: `lipost-${i}-${post.id || i}`,
      text: `[LinkedIn post, ${post.date_posted || "unknown date"}]: ${post.post_text}`,
      metadata: {
        type: "linkedin_post",
        post_id: post.id || String(i),
        date: post.date_posted || "",
        text: post.post_text,
        likes: String(post.num_likes || 0),
        comments: String(post.num_comments || 0),
      },
    }));
}

// ─── Index functions ───

async function upsertChunks(
  chunks: ChunkItem[],
  namespace: string
): Promise<number> {
  if (chunks.length === 0) return 0;

  const texts = chunks.map((c) => c.text);
  const embeddings = await embedTexts(texts);

  const index = getIndex();
  const ns = index.namespace(namespace);

  // Upsert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const batchEmbeddings = embeddings.slice(i, i + batchSize);

    const vectors = batch.map((chunk, j) => ({
      id: chunk.id,
      values: batchEmbeddings[j],
      metadata: chunk.metadata,
    }));

    await ns.upsert({ records: vectors });
  }

  return chunks.length;
}

/**
 * Index a Twitter profile's posts and replies into Pinecone.
 * Uses separate namespaces for tweets vs replies.
 */
export async function indexTwitterProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profileData: any,
  sessionId: string
): Promise<{ tweetsIndexed: number; repliesIndexed: number }> {
  const screenName = profileData.user?.screen_name || profileData.user?.name || "unknown";

  const tweetChunks = chunkTwitterTimeline(profileData.timeline, screenName);
  const replyChunks = chunkTwitterReplies(profileData.replies, screenName);

  const [tweetsIndexed, repliesIndexed] = await Promise.all([
    upsertChunks(tweetChunks, `${sessionId}:tweets`),
    upsertChunks(replyChunks, `${sessionId}:replies`),
  ]);

  console.log(`Indexed ${tweetsIndexed} tweets, ${repliesIndexed} replies for session ${sessionId}`);
  return { tweetsIndexed, repliesIndexed };
}

/**
 * Index a LinkedIn profile's posts into Pinecone.
 * Only posts go into Pinecone (profile info stays in system prompt).
 */
export async function indexLinkedInProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profileData: any,
  sessionId: string
): Promise<{ postsIndexed: number }> {
  const postChunks = chunkLinkedInPosts(profileData.posts);

  const postsIndexed = await upsertChunks(postChunks, `${sessionId}:posts`);

  console.log(`Indexed ${postsIndexed} LinkedIn posts for session ${sessionId}`);
  return { postsIndexed };
}

// ─── Query function ───

export interface RetrievedChunk {
  text: string;
  score: number;
  metadata: Record<string, string>;
}

/**
 * Query relevant posts/tweets across all namespaces for a session.
 */
export async function queryRelevant(
  query: string,
  sessionId: string,
  source: "twitter" | "linkedin",
  topK: number = 5
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedText(query);
  const index = getIndex();

  // Determine which namespaces to query
  const namespaces =
    source === "twitter"
      ? [`${sessionId}:tweets`, `${sessionId}:replies`]
      : [`${sessionId}:posts`];

  // Query all namespaces in parallel
  const results = await Promise.all(
    namespaces.map((ns) =>
      index.namespace(ns).query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
      })
    )
  );

  // Merge and sort by score
  const allMatches: RetrievedChunk[] = [];
  for (const result of results) {
    for (const match of result.matches || []) {
      if (match.metadata) {
        allMatches.push({
          text: (match.metadata as Record<string, string>).text || "",
          score: match.score || 0,
          metadata: match.metadata as Record<string, string>,
        });
      }
    }
  }

  // Sort by score descending and take topK
  allMatches.sort((a, b) => b.score - a.score);
  return allMatches.slice(0, topK);
}

/**
 * Delete all vectors for a session (cleanup on reset).
 */
export async function deleteSession(
  sessionId: string,
  source: "twitter" | "linkedin"
): Promise<void> {
  const index = getIndex();
  const namespaces =
    source === "twitter"
      ? [`${sessionId}:tweets`, `${sessionId}:replies`]
      : [`${sessionId}:posts`];

  await Promise.all(
    namespaces.map((ns) => index.namespace(ns).deleteAll())
  );
}
