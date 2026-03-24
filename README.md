# WhoDis

A chatbot that lets you look up someone's public X (Twitter) or LinkedIn profile and have a conversation about them. Paste a handle or profile URL, and it pulls their posts, bio, stats — then you can ask questions about the person or even talk to an AI that mimics their personality.

## What it does

- **Profile lookup** — Enter an X username (`elonmusk`) or a LinkedIn URL (`linkedin.com/in/someone`). The app fetches their public profile data, posts, and engagement.
- **Q&A chat** — Ask anything about the person. The AI answers based on the fetched data with streamed responses.
- **Persona mode** — Click "Persona" to open a side panel where the AI *becomes* that person. It extracts their personality traits, writing style, and language patterns, then responds in character.

## App Architecture
<img width="1303" height="768" alt="image" src="https://github.com/user-attachments/assets/466b20ee-0d47-4622-b32b-8ec71f7b73f7" />

## Scalable Architecture
<img width="1384" height="712" alt="image" src="https://github.com/user-attachments/assets/df50f272-8fa1-4c25-b235-c0e6868c2934" />
<img width="1381" height="250" alt="image" src="https://github.com/user-attachments/assets/ad72c6b2-0017-43fa-989b-d5f3adb6c893" />




## Tech stack

- **Next.js 16** (App Router) with TypeScript
- **Gemini 2.5 Flash** for chat and persona extraction (streamed via SSE)
- **Redux Toolkit** for state management across Q&A and persona conversations
- **Tailwind CSS v4** — dark theme, custom animations
- **Upstash Redis** for API rate limiting
- **RapidAPI** (twitter-api45) for X data
- **BrightData** for LinkedIn scraping

## Getting started

### Prerequisites

- Node.js 20+
- pnpm

### 1. Clone and install

```bash
git clone <repo-url>
cd WhoDis
pnpm install
```

### 2. Set up environment variables

Copy the sample env file and fill in your keys:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your actual keys (see the section below for where to get them).

### 3. Run it

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create a `.env.local` file in the project root:

```env
# Google Gemini — get from https://aistudio.google.com/apikey
GEMINI_API_KEY=

# RapidAPI — for X/Twitter data — get from https://rapidapi.com/alexanderxbx/api/twitter-api45
RAPIDAPI_KEY=

# BrightData — for LinkedIn scraping — get from https://brightdata.com/
BRIGHTDATA_API_KEY=

# Upstash Redis — for rate limiting — get from https://console.upstash.com/
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Pinecone - vector database to store data embeddings and retrieve relevant data to the current user query
PINECONE_API_KEY=
PINECONE_INDEX=
```

All seven are required for the full experience. If the Upstash vars are missing, rate limiting is simply skipped (useful for local dev). If Pinecone vars are missing then RAG system is simply skipped.

## Rate limits

To protect the external APIs:

| Endpoint | Limit | Why |
|---|---|---|
| `/api/start-convo` | 5 req/min per IP | Triggers external scraping (expensive) |
| `/api/continue-conversation` | 20 req/min per IP | Gemini API calls |
| `/api/persona-chat` | 20 req/min per IP | Gemini API calls |
