"use client";

import { useRef, useEffect, FormEvent } from "react";
import { useAppDispatch, useAppSelector } from "./store";
import {
  setUsername,
  setPhase,
  setLoadingStatus,
  setProfileData,
  setError,
  resetSession,
} from "./store/slices/sessionSlice";
import {
  setMessages,
  addMessage,
  updateLastMessage,
  setCurrentInput,
  setIsStreaming,
  resetQna,
} from "./store/slices/qnaSlice";
import {
  openPersona,
  closePersona,
  setPersonaProfile,
  setIsPersonaLoading,
  addPersonaMessage,
  setPersonaError,
  resetPersona,
} from "./store/slices/personaSlice";
import PersonaPanel from "./components/PersonaPanel";
import ProfileHeader from "./components/ProfileHeader";
import MarkdownMessage from "./components/MarkdownMessage";

export default function Home() {
  const dispatch = useAppDispatch();

  const username = useAppSelector((s) => s.session.username);
  const phase = useAppSelector((s) => s.session.phase);
  const loadingStatus = useAppSelector((s) => s.session.loadingStatus);
  const profileData = useAppSelector((s) => s.session.profileData);
  const error = useAppSelector((s) => s.session.error);

  const messages = useAppSelector((s) => s.qna.messages);
  const currentInput = useAppSelector((s) => s.qna.currentInput);
  const isStreaming = useAppSelector((s) => s.qna.isStreaming);

  const isPersonaOpen = useAppSelector((s) => s.persona.isPersonaOpen);
  const personaProfile = useAppSelector((s) => s.persona.personaProfile);
  const isPersonaLoading = useAppSelector((s) => s.persona.isPersonaLoading);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (phase === "chat" && !isStreaming) {
      inputRef.current?.focus();
    }
  }, [phase, isStreaming]);

  async function handleStartConvo(e: FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;

    dispatch(setError(""));
    dispatch(setPhase("loading"));
    dispatch(setLoadingStatus("Pulling up their receipts..."));

    try {
      const res = await fetch("/api/start-convo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        dispatch(setError(data.error || "Failed to fetch profile."));
        dispatch(setPhase("input"));
        return;
      }

      dispatch(setProfileData(data.profileData));
      dispatch(
        setMessages([{ role: "assistant", content: data.firstMessage }])
      );
      dispatch(setPhase("chat"));
    } catch {
      dispatch(
        setError("Network error. Please check your connection and try again.")
      );
      dispatch(setPhase("input"));
    }
  }

  async function handleSendMessage(e: FormEvent) {
    e.preventDefault();
    if (!currentInput.trim() || isStreaming) return;

    const userMsg = { role: "user" as const, content: currentInput.trim() };
    const updatedMessages = [...messages, userMsg];
    dispatch(addMessage(userMsg));
    dispatch(setCurrentInput(""));
    dispatch(setIsStreaming(true));

    try {
      const res = await fetch("/api/continue-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, profileData }),
      });

      if (!res.ok) {
        const errData = await res.json();
        dispatch(
          addMessage({
            role: "assistant",
            content: errData.error || "Sorry, something went wrong.",
          })
        );
        dispatch(setIsStreaming(false));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let assistantText = "";

      dispatch(addMessage({ role: "assistant", content: "" }));

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
              dispatch(updateLastMessage(assistantText));
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch {
      dispatch(
        addMessage({
          role: "assistant",
          content: "Sorry, there was an error. Please try again.",
        })
      );
    } finally {
      dispatch(setIsStreaming(false));
    }
  }

  async function handleOpenPersona() {
    dispatch(openPersona());

    if (personaProfile) return;

    dispatch(setIsPersonaLoading(true));
    dispatch(setPersonaError(""));

    try {
      const res = await fetch("/api/persona-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "extract", profileData }),
      });

      if (!res.ok) {
        const errData = await res.json();
        dispatch(
          setPersonaError(errData.error || "Failed to build persona.")
        );
        dispatch(setIsPersonaLoading(false));
        return;
      }

      const data = await res.json();
      dispatch(setPersonaProfile(data.personaProfile));
      dispatch(
        addPersonaMessage({
          role: "assistant",
          content: `Yo, I'm ${username.replace(/^@/, "")}. Ask me anything and I'll give you the real ones, just how they would.`,
        })
      );
    } catch {
      dispatch(setPersonaError("Network error while building persona."));
    } finally {
      dispatch(setIsPersonaLoading(false));
    }
  }

  function handleReset() {
    dispatch(resetSession());
    dispatch(resetQna());
    dispatch(resetPersona());
  }

  return (
    <div className="flex flex-col h-screen bg-[#09090b] font-sans">
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#27272a] bg-[#09090b]/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#6d28d9] flex items-center justify-center" style={{ boxShadow: "0 0 12px rgba(109, 40, 217, 0.4)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-[#fafafa] tracking-tight">
            WhoDis
          </span>
        </div>
        {phase === "chat" && (
          <button
            onClick={handleReset}
            className="text-xs text-[#71717a] hover:text-[#a1a1aa] transition-colors px-3 py-1.5 rounded-md border border-transparent hover:border-[#27272a] hover:bg-[#111113]"
          >
            Stalk someone else
          </button>
        )}
      </header>

      <main className="flex-1 flex flex-col items-center overflow-hidden">

        {phase === "input" && (
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-xl px-6">

            <div
              className="w-16 h-16 rounded-full bg-[#6d28d9] flex items-center justify-center mb-8"
              style={{
                boxShadow: "0 0 40px rgba(109, 40, 217, 0.3), 0 0 80px rgba(109, 40, 217, 0.1)",
                animation: "float 4s ease-in-out infinite",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            <h1 className="text-3xl font-semibold text-[#fafafa] mb-3 tracking-tight text-center">
              Who even is this person?
            </h1>
            <p className="text-sm text-[#71717a] mb-10 text-center max-w-md leading-relaxed">
              Enter a public X (Twitter) username or LinkedIn profile URL.
              Drop a Twitter handle or LinkedIn URL and we&apos;ll do a deep dive on their whole vibe. No cap.
            </p>

            <form onSubmit={handleStartConvo} className="w-full max-w-md">
              <div className="flex items-center gap-2 bg-[#111113] border border-[#27272a] rounded-xl px-4 py-3 transition-all focus-within:border-[#6d28d9] focus-within:shadow-[0_0_20px_rgba(109,40,217,0.15)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => dispatch(setUsername(e.target.value))}
                  placeholder="@username or linkedin.com/in/..."
                  className="flex-1 bg-transparent outline-none text-sm text-[#fafafa] placeholder:text-[#52525b]"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!username.trim()}
                  className="px-4 py-1.5 bg-[#6d28d9] text-white text-sm font-medium rounded-lg hover:bg-[#7c3aed] disabled:opacity-20 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(109,40,217,0.4)]"
                >
                  Let&apos;s go
                </button>
              </div>
            </form>

            {error && (
              <div className="mt-5 px-4 py-3 bg-red-950/20 border border-red-900/30 text-red-400 text-sm rounded-xl max-w-md w-full">
                {error}
              </div>
            )}

            <p className="mt-6 text-[10px] text-[#3f3f46] font-mono tracking-wider uppercase">
              Only public data, we&apos;re nosy not shady
            </p>
          </div>
        )}

        {phase === "loading" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div
              className="relative w-14 h-14 rounded-full"
              style={{ animation: "pulse-glow 2s ease-in-out infinite" }}
            >
              <div className="absolute inset-0 rounded-full border border-[#27272a]" />
              <div
                className="absolute inset-0 rounded-full border border-transparent border-t-[#7c3aed]"
                style={{ animation: "spin 1s linear infinite" }}
              />
              <div className="absolute inset-3 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[#a1a1aa]">
                {loadingStatus}
              </p>
              <p className="text-xs text-[#52525b] mt-2 font-mono">
                Snooping around their profile...
              </p>
            </div>
          </div>
        )}

        {phase === "chat" && (
          <div className="flex w-full flex-1 overflow-hidden">
            <div
              className={`flex flex-col flex-1 overflow-hidden transition-all duration-300 ${
                isPersonaOpen ? "hidden md:flex md:border-r md:border-[#27272a]" : ""
              }`}
            >
              <ProfileHeader profileData={profileData} />

              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                <div className="max-w-2xl mx-auto space-y-4">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-[#6d28d9] text-white rounded-br-md"
                            : "bg-[#111113] border border-[#27272a] text-[#d4d4d8] rounded-bl-md"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <MarkdownMessage content={msg.content} />
                        ) : (
                          msg.content
                        )}
                        {msg.role === "assistant" &&
                          i === messages.length - 1 &&
                          isStreaming &&
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
              </div>

              <div className="border-t border-[#27272a] px-6 py-4 bg-[#09090b]">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                  <button
                    onClick={handleOpenPersona}
                    disabled={isStreaming || isPersonaLoading}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed ${
                      isPersonaOpen
                        ? "bg-[#6d28d9] text-white shadow-[0_0_12px_rgba(109,40,217,0.3)]"
                        : "bg-[#111113] border border-[#27272a] text-[#a78bfa] hover:border-[#6d28d9]/50 hover:shadow-[0_0_12px_rgba(109,40,217,0.15)]"
                    }`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="5" />
                      <path d="M20 21a8 8 0 0 0-16 0" />
                    </svg>
                    {isPersonaLoading ? "Building..." : "Persona"}
                  </button>
                  <form
                    onSubmit={handleSendMessage}
                    className="flex flex-1 items-center gap-3"
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      value={currentInput}
                      onChange={(e) => dispatch(setCurrentInput(e.target.value))}
                      placeholder="Spill the tea on..."
                      disabled={isStreaming}
                      className="flex-1 bg-[#111113] border border-[#27272a] rounded-xl px-4 py-2.5 text-sm text-[#fafafa] placeholder:text-[#52525b] outline-none transition-all disabled:opacity-40 focus:border-[#6d28d9] focus:shadow-[0_0_20px_rgba(109,40,217,0.12)]"
                    />
                    <button
                      type="submit"
                      disabled={!currentInput.trim() || isStreaming}
                      className="px-4 py-2.5 bg-[#6d28d9] text-white text-sm font-medium rounded-xl hover:bg-[#7c3aed] disabled:opacity-20 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(109,40,217,0.4)]"
                    >
                      {isStreaming ? (
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
              </div>
            </div>

            {isPersonaOpen && (
              <>
                <div
                  className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 persona-backdrop-enter"
                  onClick={() => dispatch(closePersona())}
                />
                <div className="fixed md:relative inset-y-0 right-0 z-50 md:z-auto w-full md:w-[420px] lg:w-[480px] persona-panel-enter">
                  <PersonaPanel />
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
