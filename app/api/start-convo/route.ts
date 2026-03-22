import { NextRequest } from "next/server";
import { getStrictLimiter, checkRateLimit } from "@/app/lib/rate-limit";

const LINKEDIN_URL_REGEX = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/;

function isLinkedInUrl(input: string): boolean {
  return LINKEDIN_URL_REGEX.test(input.trim());
}

async function fetchTwitterProfile(username: string) {
  const res = await fetch(
    `https://twitter-api45.p.rapidapi.com/timeline.php?screenname=${username}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": "twitter-api45.p.rapidapi.com",
        "x-rapidapi-key":
          process.env.RAPIDAPI_KEY ||
          "78c5c2d058msh6987d7eb329375dp16f268jsnc20910822a05",
      },
    }
  );

  if (!res.ok) {
    if (res.status === 429) {
      throw { status: 429, message: "Rate limit reached. Please try again in a moment." };
    }
    throw { status: res.status, message: "Failed to fetch profile data. The account may be private or not exist." };
  }

  const data = await res.json();
  console.log("Twitter API response keys:", Object.keys(data));
  if (data.user) console.log("User keys:", Object.keys(data.user));
  console.log("Avatar fields:", {
    "user.profile_image_url_https": data.user?.profile_image_url_https,
    "user.profile_image_url": data.user?.profile_image_url,
    "user.avatar": data.user?.avatar,
    "top-level avatar": data.avatar,
  });

  if (!data || data.status === "error" || (data.error && !data.timeline)) {
    throw { status: 404, message: "This user does not exist or their account is private." };
  }

  let repliesData = null;
  try {
    const repliesRes = await fetch(
      `https://twitter-api45.p.rapidapi.com/replies.php?screenname=${username}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-host": "twitter-api45.p.rapidapi.com",
          "x-rapidapi-key":
            process.env.RAPIDAPI_KEY ||
            "78c5c2d058msh6987d7eb329375dp16f268jsnc20910822a05",
        },
      }
    );
    if (repliesRes.ok) {
      repliesData = await repliesRes.json();
      console.log("Replies data:", repliesData);
    }
  } catch (err) {
    console.warn("Failed to fetch replies, continuing without:", err);
  }

  return {
    ...data,
    ...(repliesData ? { replies: repliesData } : {}),
    _source: "twitter",
  };
}

async function fetchLinkedInProfile(url: string) {
  const brightdataKey =
    process.env.BRIGHTDATA_API_KEY ||
    "3a0e3f6d-6e44-4803-a657-c84687de2ee1";

  const scrapeRes = await fetch(
    `https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_l1viktl72bvl7bjuj0&notify=false&include_errors=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${brightdataKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: [{ url }] }),
    }
  );

  if (!scrapeRes.ok) {
    const errText = await scrapeRes.text();
    console.error("BrightData scrape error:", errText);
    if (scrapeRes.status === 429) {
      throw { status: 429, message: "Rate limit reached. Please try again in a moment." };
    }
    throw { status: scrapeRes.status, message: "Failed to fetch LinkedIn profile. Please check the URL and try again." };
  }

  const data = await scrapeRes.json();
  console.log("LinkedIn data:", JSON.stringify(data).slice(0, 500));

  const profile = Array.isArray(data) ? data[0] : data;

  if (!profile || profile.error) {
    throw { status: 404, message: "Could not find this LinkedIn profile. The URL may be incorrect or the profile is private." };
  }

  let postsData = null;
  try {
    const postsRes = await fetch(
      `https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lyy3tktm25m4avu764&notify=false&include_errors=true&type=discover_new&discover_by=url`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${brightdataKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: [{ url, limit: 20 }] }),
      }
    );
    if (postsRes.ok) {
      postsData = await postsRes.json();
      console.log("LinkedIn posts count:", Array.isArray(postsData) ? postsData.length : "non-array");
    }
  } catch (err) {
    console.warn("Failed to fetch LinkedIn posts, continuing without:", err);
  }

  return {
    ...profile,
    ...(postsData ? { posts: Array.isArray(postsData) ? postsData : [postsData] } : {}),
    _source: "linkedin",
  };
}

export async function POST(request: NextRequest) {
  const rateLimited = await checkRateLimit(getStrictLimiter, request);
  if (rateLimited) return rateLimited;

  try {
    const { username } = await request.json();

    if (!username || typeof username !== "string") {
      return Response.json(
        { error: "Please provide a valid Twitter username or LinkedIn profile URL." },
        { status: 400 }
      );
    }

    const input = username.trim();
    console.log("Input:", input);

    let profileData;
    let displayName: string;

    if (isLinkedInUrl(input)) {
      // LinkedIn flow
      profileData = await fetchLinkedInProfile(input);
      displayName = profileData.name || profileData.id || "this person";
    } else {
      // Twitter flow
      profileData = await fetchTwitterProfile(input);
      displayName = `@${input}`;
    }

    return Response.json({
      profileData,
      firstMessage: `I've loaded the profile data for ${displayName}. You can now ask me anything about this person!`,
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && "message" in err) {
      const typedErr = err as { status: number; message: string };
      return Response.json(
        { error: typedErr.message },
        { status: typedErr.status }
      );
    }
    console.error("start-convo error:", err);
    return Response.json(
      { error: "Something went wrong while fetching the profile." },
      { status: 500 }
    );
  }
}
