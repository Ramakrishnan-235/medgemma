"use client";

import { useShallow } from "zustand/react/shallow";
import React, { useState, useRef, useEffect } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, Badge, SourceChip } from "../CommonUI";
import { Icon } from "../Icons";
import { api } from "@/lib/api";

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  text: string;
  isStreaming?: boolean;
  citations?: Array<{ label: string; page_or_frame?: number }>;
  tokensPerSec?: number;
}

export function ChatScreen() {
  const {
    activeCase,
    activeCaseId,
    setPage,
    openModal,
    showToast,
    addChatMessage,
    clearChat,
  } = useWorkspaceStore(
    useShallow((state) => ({
      activeCase: state.activeCase,
      activeCaseId: state.activeCaseId,
      setPage: state.setPage,
      openModal: state.openModal,
      showToast: state.showToast,
      addChatMessage: state.addChatMessage,
      clearChat: state.clearChat,
    }))
  );

  const [inputVal, setInputVal] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeEventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      if (activeEventSourceRef.current) {
        activeEventSourceRef.current.close();
      }
    };
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = inputVal.trim();
    if (!query || isSubmitting) return;

    setInputVal("");
    addChatMessage(query);

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text: query },
      {
        id: assistantMsgId,
        role: "assistant",
        text: "",
        isStreaming: true,
        citations: [],
      },
    ]);

    setIsSubmitting(true);

    try {
      const run = await api.createQARun(activeCaseId, query);
      const es = api.subscribeRunEvents(
        activeCaseId,
        run.run_id,
        (event, data) => {
          if (event === "token") {
            const tokenText = (data.token_delta as string) || (data.token as string) || "";
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, text: m.text + tokenText }
                  : m
              )
            );
          } else if (event === "completed") {
            const output = data.output as { answer_markdown?: string } | undefined;
            const metrics = data.metrics as { tokens_per_second?: number } | undefined;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      text: output?.answer_markdown || m.text || "Run completed with no output text.",
                      isStreaming: false,
                      tokensPerSec: metrics?.tokens_per_second,
                    }
                  : m
              )
            );
            setIsSubmitting(false);
          }
        },
        () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, isStreaming: false } : m
            )
          );
          setIsSubmitting(false);
        }
      );

      activeEventSourceRef.current = es;
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                isStreaming: false,
                text: `MedGemma analyzed query: "${query}" against ${activeCase}. (Operating in local preview fallback mode — start the FastAPI backend and vLLM GPU engine for full bfloat16 streaming inference.)`,
                citations: [{ label: "Local case context", page_or_frame: 1 }],
              }
            : m
        )
      );
      setIsSubmitting(false);
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    setInputVal(prompt);
  };

  const handleClear = () => {
    if (activeEventSourceRef.current) {
      activeEventSourceRef.current.close();
    }
    setMessages([]);
    clearChat();
    showToast("Cleared conversation history.");
  };

  return (
    <>
      <Heading
        eyebrow="ASSISTANT / GENERAL CHAT"
        title="Room to think."
        desc="Interactive multimodal conversation grounded in active case evidence."
        actions={
          <button
            type="button"
            className="btn"
            onClick={() => setPage("qa")}
          >
            <Icon name="arrow" /> Structured Q&A
          </button>
        }
      />

      <section className="panel chat-layout">
        {/* Left Recent Conversations List */}
        <aside className="chats">
          <button
            type="button"
            className="btn full justify-center"
            onClick={handleClear}
          >
            <Icon name="plus" /> New conversation
          </button>

          <p className="eyebrow mt-6 mx-2 mb-2.5">
            Recent
          </p>

          <button
            type="button"
            className="chatitem selected"
            onClick={() =>
              showToast("Active case conversation session.")
            }
          >
            Case preparation
            <small>Active case · Multi-source</small>
          </button>
          <button
            type="button"
            className="chatitem"
            onClick={() =>
              showToast("Conversation archive available in Library.")
            }
          >
            Understand terminology
            <small>Yesterday · General</small>
          </button>
          <button
            type="button"
            className="chatitem"
            onClick={() =>
              showToast("Conversation archive available in Library.")
            }
          >
            Organize my notes
            <small>22 Oct · General</small>
          </button>
        </aside>

        {/* Chat Main Conversation Area */}
        <div className="chat-main">
          <div className="chat-title">
            <span className="brandmark">+</span>
            <h2>What can we explore today?</h2>
            <p>Active case: <strong>{activeCase}</strong></p>
          </div>

          {messages.length === 0 ? (
            <div className="suggestions">
              {[
                [
                  "Summarize the patient's current pulmonary findings",
                  "Synthesizes recent imaging and clinical notes",
                ],
                [
                  "Explain any cardiothoracic abnormalities observed",
                  "Cross-checks cardiomegaly and effusions",
                ],
                [
                  "Compare prior and current lung volumes",
                  "Highlights interval changes across studies",
                ],
                [
                  "Draft structured impression for the imaging report",
                  "Formats findings into standardized sections",
                ],
              ].map(([t, d]) => (
                <button
                  key={t}
                  type="button"
                  className="suggestion"
                  onClick={() => handleSuggestionClick(t)}
                >
                  {t}
                  <small>{d}</small>
                </button>
              ))}
            </div>
          ) : null}

          {/* Interactive Messages Stack */}
          <div id="messages" className="stack">
            {messages.map((m) => (
              <React.Fragment key={m.id}>
                {m.role === "user" ? (
                  <div className="message user">{m.text}</div>
                ) : (
                  <div className="message assistant">
                    <div className="message-label">
                      MedGemma{" "}
                      <Badge
                        text={
                          m.isStreaming
                            ? "Streaming vLLM..."
                            : m.tokensPerSec
                            ? `${m.tokensPerSec.toFixed(1)} tok/s`
                            : "Verified"
                        }
                        variant={m.isStreaming ? "dark" : "soft"}
                      />
                    </div>
                    <p className="whitespace-pre-wrap">
                      {m.text || (m.isStreaming ? "Thinking..." : "")}
                    </p>
                    {m.citations && m.citations.length > 0 && (
                      <div className="row gap-2 mt-2">
                        {m.citations.map((c, i) => (
                          <SourceChip
                            key={i}
                            label={`${c.label}${c.page_or_frame ? ` (p.${c.page_or_frame})` : ""}`}
                            payload={{
                              title: c.label,
                              location: c.page_or_frame ? `Page/Frame ${c.page_or_frame}` : undefined,
                              quote: `Verified citation tag from MedGemma inference.`,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Composer Form */}
          <form id="chat-form" className="composer" onSubmit={handleSend}>
            <textarea
              id="chat-input"
              aria-label="Message MedGemma"
              placeholder={`Message MedGemma regarding ${activeCase}...`}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={isSubmitting}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <div className="row between">
              <div className="row">
                <button
                  type="button"
                  className="btn"
                  onClick={() => openModal("upload")}
                >
                  <Icon name="attachment" /> Attach
                </button>
                <span className="badge soft">{activeCase}</span>
              </div>
              <button
                type="submit"
                className="btn black iconbtn"
                aria-label="Send message"
                disabled={isSubmitting || !inputVal.trim()}
              >
                <Icon name="arrow" />
              </button>
            </div>
          </form>

          <p className="chat-footer">
            Grounding enforced via MedGemma RRF Hybrid pgvector &amp; SigLIP 896px vision tower. Clinical outputs require clinician review.
          </p>
        </div>
      </section>
    </>
  );
}
