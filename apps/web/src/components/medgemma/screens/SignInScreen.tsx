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
    }))
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
          aria-label="MedGemma Home"
        >
          <span className="brandmark">+</span>
          MedGemma
        </button>

        <span className="eyebrow">WELCOME BACK</span>
        <h1 className="mt-3.5">Your workspace awaits.</h1>
        <p>Sign in to continue with your cases and drafts.</p>

        <form onSubmit={handleSubmit} aria-label="Sign in to MedGemma Clinical Workspace">
          <label className="field" htmlFor="signin-email">
            Email address
            <input
              id="signin-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="field" htmlFor="signin-password">
            Password
            <input
              id="signin-password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <div className="row between my-3 mb-6">
            <label className="small muted flex items-center gap-1.5 cursor-pointer" htmlFor="signin-remember">
              <input id="signin-remember" type="checkbox" defaultChecked /> Remember me
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

        <div className="text-center mt-5">
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
          className="eyebrow mb-7 text-zinc-400"
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
          className="mt-12 pt-5 max-w-[320px] text-[10px] text-zinc-400 border-t border-zinc-800"
        >
          MedGemma Workspace / Interface concept
        </div>
      </aside>
    </main>
  );
}
