"use client";

import React from "react";
import { useShallow } from "zustand/react/shallow";
import { Icon } from "./Icons";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export interface SourcePayload {
  quote?: string;
  title?: string;
  source?: string;
  date?: string;
  location?: string;
}

export function SourceChip({
  label = "Source note · p. 1",
  className = "",
  payload,
}: {
  label?: string;
  className?: string;
  payload?: SourcePayload;
}) {
  const openModal = useWorkspaceStore((state) => state.openModal);

  const handleClick = () => {
    openModal(
      "source",
      payload || {
        title: label,
        location: label,
        quote: `Authoritative evidence chunk verified in active case storage: ${label}`,
      }
    );
  };

  return (
    <button
      type="button"
      className={`source ${className}`}
      onClick={handleClick}
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
  variant?: "dark" | "soft" | "dash" | "default" | "secondary" | "outline" | "";
  className?: string;
}) {
  const variantClass =
    variant === "secondary" ? "soft" : variant === "outline" ? "dash" : variant === "default" ? "dark" : variant;
  return (
    <span className={`badge ${variantClass} ${className}`.trim()}>
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
  const { setPage, activeCase } = useWorkspaceStore(
    useShallow((state) => ({
      setPage: state.setPage,
      activeCase: state.activeCase,
    }))
  );

  const casePart1 = activeCase?.includes(" · ")
    ? activeCase.split(" · ")[0]
    : activeCase || "Case 024";
  const casePart2 = activeCase?.includes(" · ")
    ? activeCase.split(" · ")[1]
    : "Chest follow-up";

  return (
    <div className="context">
      <div>
        <p>
          <b>{casePart1}</b> &nbsp; / &nbsp; {casePart2}{" "}
          <Badge text="Demo" variant="soft" />
        </p>
        <small>Chest follow-up · 2 imaging studies · 1 clinical note · Updated today</small>
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
