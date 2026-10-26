import React from "react";

export const ICONS: Record<string, React.ReactNode> = {
  home: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3z" />,
  chat: (
    <>
      <path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  scan: (
    <>
      <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 7v10M7 12h10" />
    </>
  ),
  file: <path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6" />,
  text: <path d="M4 5h16M12 5v15M8 20h8" />,
  report: <path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h4M16 15v3" />,
  library: <path d="M4 3v18M9 3v18M14 3v18M18 3l4 18" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="m10 3-1 3-3 1-3 3v4l3 3 3 1 1 3h4l1-3 3-1 3-3v-4l-3-3-3-1-1-3z" />
    </>
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  upload: <path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  link: <path d="m10 13 4-4m-6 8-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 0 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" />,
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
      <path d="m8 11 3 3 5-5" />
    </>
  ),
  volume: (
    <>
      <path d="m12 2 10 5v10l-10 5-10-5V7zM2 7l10 5 10-5M12 12v10" />
    </>
  ),
  compare: <path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" />,
  send: <path d="m3 3 19 9-19 9 4-9zM7 12h15" />,
  attachment: <path d="m8 14 8-8a3 3 0 0 1 4 4l-10 10a5 5 0 0 1-7-7L13 3" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3M12 17h.01" />
    </>
  ),
  download: <path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};

export function Icon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {ICONS[name] || ICONS.file}
    </svg>
  );
}
