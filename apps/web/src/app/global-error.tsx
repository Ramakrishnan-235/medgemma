"use client";

import React from "react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ padding: "40px", fontFamily: "sans-serif" }}>
          <h2>Application Error</h2>
          <p>An unexpected error occurred in MedGemma workspace.</p>
          <button type="button" onClick={() => reset()} style={{ padding: "8px 16px" }}>
            Reload Workspace
          </button>
        </div>
      </body>
    </html>
  );
}
