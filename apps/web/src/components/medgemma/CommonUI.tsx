"use client";

import React from "react";
import { Icon } from "./Icons";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export function SourceChip({
  label = "Source note · p. 1",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const { openModal } = useWorkspaceStore();

  return (
    <button
      type="button"
      className={`source ${className}`}
      onClick={() => openModal("source")}
      title="View source context"
    >
      <Icon name="link" />
      <span>{label}</span>
    </button>
  );
}

export function Badge({
  text,
  variant = "",
  className = "",
}: {
  text: string;
  variant?: "dark" | "soft" | "dash" | "";
  className?: string;
}) {
  return (
    <span className={`badge ${variant} ${className}`}>
      {text}
    </span>
  );
}

export function Heading({
  eyebrow,
  title,
  desc,
  actions,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function ContextBar() {
  const { setPage } = useWorkspaceStore();

  return (
    <div className="context">
      <div>
        <p>
          <b>Case 024</b> &nbsp; / &nbsp; Chest follow-up{" "}
          <Badge text="Demo" variant="soft" />
        </p>
        <small>2 imaging studies · 1 clinical note · Updated today</small>
      </div>
      <div className="row">
        <Badge text="Needs review" variant="dark" />
        <button
          type="button"
          className="btn tiny ghost"
          onClick={() => setPage("case")}
        >
          Case details <Icon name="chevron" />
        </button>
      </div>
    </div>
  );
}

export function Footnote() {
  return (
    <div className="footnote">
      <Icon name="shield" />
      <span>Design prototype · Fictional case data · Outputs require review</span>
    </div>
  );
}
