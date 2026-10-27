"use client";

import { useShallow } from "zustand/react/shallow";

import React, { useState } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Icon } from "../Icons";

export function SignInScreen() {
  const { setPage, showToast } = useWorkspaceStore(
    useShallow((state) => ({
      setPage: state.setPage,
      showToast: state.showToast,
    })),
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast("This is a sign-in design. No credentials were submitted or stored.");
    setPage("overview");
  };

  return (
    <main className="auth">
      <section className="authform">
        <button
          type="button"
          onClick={() => setPage("landing")}
          className="brand text-left cursor-pointer"
          style={{ background: "none", border: 0, padding: 0 }}
        >
          <span className="brandmark">+</span>
          MedGemma
        </button>

        <span className="eyebrow">WELCOME BACK</span>
        <h1 style={{ marginTop: "13px" }}>Your workspace awaits.</h1>
        <p>Sign in to continue with your cases and drafts.</p>

        <form onSubmit={handleSubmit}>
          <label className="field">
            Email address
            <input
              type="email"
              placeholder="you@example.com"
              autoComplete="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="field">
            Password
            <input
              type="password"
              placeholder="Enter your password"
              autoComplete="off"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <div className="row between" style={{ margin: "12px 0 23px" }}>
            <label className="small muted flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" defaultChecked /> Remember me
            </label>
            <button
              type="button"
              className="linkbutton"
              onClick={() =>
                showToast("Password recovery is a utility screen for implementation. Use Explore the demo here.")
              }
            >
              Forgot password?
            </button>
          </div>

          <button type="submit" className="btn black full">
            Sign in <Icon name="arrow" />
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button
            type="button"
            className="btn"
            onClick={() => setPage("overview")}
          >
            Explore the demo <Icon name="arrow" />
          </button>
        </div>

        <div className="footnote">
          Design only. Use the demo entry to explore.
        </div>
      </section>

      <aside className="authaside">
        <span
          className="eyebrow"
          style={{ color: "#99999f", marginBottom: "28px" }}
        >
          CLARITY, BY DESIGN
        </span>
        <h2>
          A calmer space
          <br />
          for complex
          <br />
          clinical work.
        </h2>
        <p>
          Medical images. Clinical records. Thoughtful conversations.
          Connected by the case.
        </p>
        <div
          style={{
            borderTop: "1px solid #414145",
            marginTop: "50px",
            paddingTop: "20px",
            maxWidth: "320px",
            fontSize: "10px",
            color: "#a5a5ad",
          }}
        >
          MedGemma Workspace / Interface concept
        </div>
      </aside>
    </main>
  );
}
