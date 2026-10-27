"use client";

import { useShallow } from "zustand/react/shallow";

import React, { useState } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Heading, Badge, SourceChip } from "../CommonUI";
import { Icon } from "../Icons";

export function ChatScreen() {
  const { chatMessages, addChatMessage, clearChat, setPage, openModal, showToast } = useWorkspaceStore(
    useShallow((state) => ({
      chatMessages: state.chatMessages,
      addChatMessage: state.addChatMessage,
      clearChat: state.clearChat,
      setPage: state.setPage,
      openModal: state.openModal,
      showToast: state.showToast,
    })),
  );

  const [inputVal, setInputVal] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    addChatMessage(inputVal.trim());
    setInputVal("");
  };

  const handleSuggestionClick = (prompt: string) => {
    setInputVal(prompt);
  };

  return (
    <>
      <Heading
        eyebrow="ASSISTANT / GENERAL"
        title="Room to think."
        desc="A conversation with optional case context."
        actions={
          <button
            type="button"
            className="btn"
            onClick={() => setPage("qa")}
          >
            <Icon name="arrow" /> Medical Q&A
          </button>
        }
      />

      <section className="panel chat-layout">
        {/* Left Recent Conversations List */}
        <aside className="chats">
          <button
            type="button"
            className="btn w-full"
            onClick={() => {
              clearChat();
              showToast("New demo conversation.");
            }}
          >
            <Icon name="plus" /> New conversation
          </button>

          <p className="eyebrow" style={{ margin: "24px 8px 10px" }}>
            Recent
          </p>

          <button
            type="button"
            className="chatitem selected"
            onClick={() =>
              showToast(
                "Conversation history is illustrative in this design preview."
              )
            }
          >
            Case preparation
            <small>Today · General</small>
          </button>
          <button
            type="button"
            className="chatitem"
            onClick={() =>
              showToast(
                "Conversation history is illustrative in this design preview."
              )
            }
          >
            Understand terminology
            <small>Yesterday · General</small>
          </button>
          <button
            type="button"
            className="chatitem"
            onClick={() =>
              showToast(
                "Conversation history is illustrative in this design preview."
              )
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
            <p>Ask a question, attach a file, or bring in a case.</p>
          </div>

          {chatMessages.length === 0 ? (
            <div className="suggestions">
              {[
                [
                  "Summarize an attached note",
                  "A clear starting point for your case",
                ],
                [
                  "Explain a medical term",
                  "Turn complex language into clarity",
                ],
                [
                  "Organize a case overview",
                  "Bring the important details together",
                ],
                [
                  "Help me draft a report",
                  "Start with structure, then review",
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
            {chatMessages.map((m, idx) => (
              <React.Fragment key={idx}>
                <div className="message user">{m}</div>
                <div className="message assistant">
                  <div className="message-label">
                    MedGemma <Badge text="UI demo" />
                  </div>
                  <p>
                    This preview shows the conversation layout. In the
                    implemented workspace, the response appears here with the
                    selected case context, attached sources and any missing
                    information.
                  </p>
                  <SourceChip label="Attached context" />
                  <SourceChip label="Evidence panel" />
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Composer Form */}
          <form id="chat-form" className="composer" onSubmit={handleSend}>
            <textarea
              id="chat-input"
              aria-label="Message MedGemma"
              placeholder="Message MedGemma..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
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
                <span className="badge soft">Case 024</span>
              </div>
              <button
                type="submit"
                className="btn black iconbtn"
                aria-label="Send demo message"
              >
                <Icon name="arrow" />
              </button>
            </div>
          </form>

          <p className="chat-footer">
            Demo conversation. Clinical outputs need source verification and
            review.
          </p>
        </div>
      </section>
    </>
  );
}
