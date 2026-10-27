"use client";

import { useShallow } from "zustand/react/shallow";

import React from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Icon } from "./Icons";
import { type PageId } from "@/types/workspace";

export function Sidebar() {
  const { page, setPage, cases } = useWorkspaceStore(
    useShallow((state) => ({
      page: state.page,
      setPage: state.setPage,
      cases: state.cases,
    })),
  );

  const isAssistant = ["chat", "qa"].includes(page);
  const isImaging = ["imaging", "compare"].includes(page);
  const isClinical = ["reasoning", "ehr"].includes(page);

  const navButton = (
    label: string,
    targetPage: PageId,
    iconName: string,
    isActive: boolean,
    count?: string
  ) => (
    <button
      type="button"
      className={isActive ? "active" : ""}
      onClick={() => setPage(targetPage)}
    >
      <Icon name={iconName} />
      <span>{label}</span>
      {count && <span className="count">{count}</span>}
    </button>
  );

  return (
    <aside className="sidebar">
      <button
        type="button"
        className="brand text-left"
        onClick={() => setPage("overview")}
        style={{ background: "none", border: 0, padding: 0 }}
      >
        <span className="brandmark">+</span>
        <span>
          MedGemma
          <small>CLINICAL WORKSPACE</small>
        </span>
      </button>

      <div className="workspace">
        <span className="square">M</span>
        <span>
          My workspace
          <br />
          <small className="muted">Personal · Demo</small>
        </span>
        <span style={{ marginLeft: "auto", color: "#888" }}>⌄</span>
      </div>

      <div>
        <p className="navlabel">Workspace</p>
        <nav className="nav" aria-label="Primary navigation">
          {navButton("Overview", "overview", "home", page === "overview")}
          {navButton(
            "Cases",
            "cases",
            "folder",
            ["cases", "case"].includes(page),
            String(cases.length).padStart(2, "0")
          )}

          {navButton("Assistant", "chat", "chat", isAssistant)}
          {isAssistant && (
            <>
              <button
                type="button"
                className={`subnav ${page === "chat" ? "active" : ""}`}
                onClick={() => setPage("chat")}
              >
                General chat
              </button>
              <button
                type="button"
                className={`subnav ${page === "qa" ? "active" : ""}`}
                onClick={() => setPage("qa")}
              >
                Medical Q&A
              </button>
            </>
          )}

          {navButton("Medical imaging", "imaging", "scan", isImaging)}
          {isImaging && (
            <>
              <button
                type="button"
                className={`subnav ${page === "imaging" ? "active" : ""}`}
                onClick={() => setPage("imaging")}
              >
                Image workspace
              </button>
              <button
                type="button"
                className={`subnav ${page === "compare" ? "active" : ""}`}
                onClick={() => setPage("compare")}
              >
                Longitudinal tracking
              </button>
            </>
          )}

          {navButton("Clinical text", "reasoning", "text", isClinical)}
          {isClinical && (
            <>
              <button
                type="button"
                className={`subnav ${page === "reasoning" ? "active" : ""}`}
                onClick={() => setPage("reasoning")}
              >
                Clinical reasoning
              </button>
              <button
                type="button"
                className={`subnav ${page === "ehr" ? "active" : ""}`}
                onClick={() => setPage("ehr")}
              >
                EHR summary
              </button>
            </>
          )}

          {navButton("Documents", "extraction", "file", page === "extraction")}
          {navButton("Reports", "report", "report", page === "report")}
          {navButton("Library", "library", "library", page === "library")}
        </nav>
      </div>

      <div className="sidebar-bottom">
        <button
          type="button"
          className="model w-full text-left cursor-pointer"
          onClick={() => {
            setPage("settings");
          }}
          style={{ background: "none" }}
        >
          <div className="row">
            <Icon name="volume" />
            <span>Model connection</span>
          </div>
          <p>Configure in workspace settings</p>
        </button>

        <nav className="nav">
          {navButton("Settings", "settings", "settings", page === "settings")}
        </nav>

        <div className="profile">
          <span className="avatar">DM</span>
          <span>
            Dr. Morgan
            <small className="muted" style={{ display: "block", fontSize: "9px" }}>
              Demo account
            </small>
          </span>
        </div>
      </div>
    </aside>
  );
}
