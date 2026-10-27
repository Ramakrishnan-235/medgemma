"use client";

import { useShallow } from "zustand/react/shallow";

import React from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { PAGES, type PageId } from "@/types/workspace";

export function ReviewBar() {
  const { page, setPage } = useWorkspaceStore(
    useShallow((state) => ({
      page: state.page,
      setPage: state.setPage,
    })),
  );

  return (
    <div className="reviewbar">
      <span>
        <b>MedGemma</b>
        <span className="dot" />
        <span className="review-note">UI concept · </span>
        15 screens
      </span>
      <label>
        <span className="review-note">Preview </span>
        <select
          id="screen-picker"
          aria-label="Choose a page design"
          value={page}
          onChange={(e) => setPage(e.target.value as PageId)}
        >
          {PAGES.map(([id, label], i) => (
            <option key={id} value={id}>
              {String(i + 1).padStart(2, "0")} / {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
