"use client";

import { useRef, useEffect, FormEvent } from "react";
import Image from "next/image";
import { useAppDispatch, useAppSelector } from "../store";
import MarkdownMessage from "./MarkdownMessage";
import {
  closePersona,
  addPersonaMessage,
  updateLastPersonaMessage,
  setPersonaInput,
  setIsPersonaStreaming,
} from "../store/slices/personaSlice";

export default function PersonaPanel() {
  const dispatch = useAppDispatch();

  const username = useAppSelector((s) => s.session.username);
  const profileData = useAppSelector((s) => s.session.profileData);
  const personaProfile = useAppSelector((s) => s.persona.personaProfile);
  const isPersonaLoading = useAppSelector((s) => s.persona.isPersonaLoading);
  const personaMessages = useAppSelector((s) => s.persona.personaMessages);
  const personaInput = useAppSelector((s) => s.persona.personaInput);
  const isPersonaStreaming = useAppSelector((s) => s.persona.isPersonaStreaming);
  const personaError = useAppSelector((s) => s.persona.personaError);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [personaMessages]);

  useEffect(() => {
    if (!isPersonaLoading && !isPersonaStreaming && personaProfile) {
      inputRef.current?.focus();
    }
  }, [isPersonaLoading, isPersonaStreaming, personaProfile]);

  async function handleSendMessage(e: FormEvent) {
    e.preventDefault();
    if (!personaInput.trim() || isPersonaStreaming || !personaProfile) return;

    const userMsg = { role: "user" as const, content: personaInput.trim() };
    const updatedMessages = [...personaMessages, userMsg];
    dispatch(addPersonaMessage(userMsg));
    dispatch(setPersonaInput(""));
    dispatch(setIsPersonaStreaming(true));

    try {
      const res = await fetch("/api/persona-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          messages: updatedMessages,
          personaProfile,
          profileData,
          username: username.replace(/^@/, ""),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        dispatch(
          addPersonaMessage({
            role: "assistant",
            content: errData.error || "Something went wrong.",
          })
        );
        dispatch(setIsPersonaStreaming(false));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let assistantText = "";

      dispatch(addPersonaMessage({ role: "assistant", content: "" }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) {
              assistantText += parsed.text;
              dispatch(updateLastPersonaMessage(assistantText));
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch {
      dispatch(
        addPersonaMessage({
          role: "assistant",
          content: "Sorry, there was an error. Please try again.",
        })
      );
    } finally {
      dispatch(setIsPersonaStreaming(false));
    }
  }

  // Extract a short display name: for LinkedIn URLs grab the slug, for Twitter strip @
  const cleanUsername = username.includes("linkedin.com/in/")
    ? username.replace(/\/+$/, "").split("/").pop() || username
    : username.replace(/^@/, "");

  // Extract avatar URL from profileData (Twitter or LinkedIn)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pd = profileData as any;
  const isLinkedin = pd?._source === "linkedin";
  const rawAvatar = isLinkedin
    ? pd?.avatar
    : pd?.user?.profile_image_url_https || pd?.user?.profile_image_url || pd?.user?.avatar;
  const avatarUrl = rawAvatar?.replace(/_normal\./, "_400x400.") || null;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-[#fafafa]">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e1b2e]">
        <div className="flex items-center gap-2.5">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={cleanUsername}
              width={28}
              height={28}
              className="rounded-full border border-[#27272a]"
            />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-[#18181b] border border-[#27272a] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="5" />
                <path d="M20 21a8 8 0 0 0-16 0" />
              </svg>
            </div>
          )}
          <span className="text-sm font-semibold shimmer-text">
            {cleanUsername}&apos;s Persona
          </span>
        </div>
        <button
          onClick={() => dispatch(closePersona())}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#18181b] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Loading State */}
      {isPersonaLoading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <div className="persona-loading-card w-full max-w-xs rounded-2xl p-6 flex flex-col items-center gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border border-[#27272a]" />
              <div
                className="absolute inset-0 rounded-full border border-transparent border-t-[#a1a1aa]"
                style={{ animation: "spin 1s linear infinite" }}
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[#e4e4e7]">
                Cooking up their persona
              </p>
              <p className="text-xs text-[#52525b] mt-1">
                Reading {cleanUsername}&apos;s energy rn
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {personaError && !isPersonaLoading && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="px-4 py-3 bg-red-950/20 border border-red-900/30 text-red-400 text-sm rounded-xl max-w-sm w-full text-center">
            {personaError}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      {!isPersonaLoading && !personaError && (
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {personaMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-[#6d28d9] text-white rounded-br-md"
                    : "bg-[#12101f] border border-[#1e1b2e] text-[#c4b5fd] rounded-bl-md"
                }`}
              >
                {msg.role === "assistant" ? (
                  <MarkdownMessage content={msg.content} />
                ) : (
                  msg.content
                )}
                {msg.role === "assistant" &&
                  i === personaMessages.length - 1 &&
                  isPersonaStreaming &&
                  (msg.content === "" ? (
                    <span className="inline-flex items-center gap-1.5 ml-1">
                      <span className="dot-1 w-2 h-2 bg-[#7c3aed] rounded-full" />
                      <span className="dot-2 w-2 h-2 bg-[#7c3aed] rounded-full" />
                      <span className="dot-3 w-2 h-2 bg-[#7c3aed] rounded-full" />
                    </span>
                  ) : (
                    <span className="streaming-cursor" />
                  ))}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input bar */}
      {personaProfile && !isPersonaLoading && (
        <div className="border-t border-[#1e1b2e] px-5 py-4 bg-[#0a0a0f]">
          <form onSubmit={handleSendMessage} className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={personaInput}
              onChange={(e) => dispatch(setPersonaInput(e.target.value))}
              placeholder={`Chat with ${cleanUsername}...`}
              disabled={isPersonaStreaming}
              className="flex-1 bg-[#12101f] border border-[#1e1b2e] rounded-xl px-4 py-2.5 text-sm text-[#e4e4e7] placeholder:text-[#3f3f46] outline-none transition-all disabled:opacity-40 focus:border-[#6d28d9] focus:shadow-[0_0_16px_rgba(109,40,217,0.15)]"
            />
            <button
              type="submit"
              disabled={!personaInput.trim() || isPersonaStreaming}
              className="px-4 py-2.5 bg-[#6d28d9] text-white text-sm font-medium rounded-xl hover:bg-[#7c3aed] disabled:opacity-20 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(109,40,217,0.4)]"
            >
              {isPersonaStreaming ? (
                <span
                  className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full"
                  style={{ animation: "spin 0.8s linear infinite" }}
                />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
