import React from "react";

export function ScanSVG({ type = "axial" }: { type?: "axial" | "volume" }) {
  if (type === "volume") {
    return (
      <svg
        viewBox="0 0 440 340"
        role="img"
        aria-label="Schematic volume rendering placeholder"
        className="w-[95%] max-h-[360px]"
      >
        <g stroke="#a4a4ac" fill="#343438" strokeWidth="1">
          <path d="M220 40c-48 8-65 55-60 110l-35 96 55 41 40-39 40 39 55-41-35-96c5-55-12-102-60-110Z" />
          <path
            d="M220 85c-35 0-65 30-68 76l-21 70 60 27 29-44 29 44 60-27-21-70c-3-46-33-76-68-76Z"
            fill="#616168"
          />
          <path d="M220 110v124M140 170l80 40 80-40M130 220l90 40 90-40" fill="none" />
          <path
            d="m95 100 125-65 125 65v150l-125 65-125-65zM95 100l125 65 125-65M220 165v150"
            fill="none"
            strokeDasharray="4 5"
            stroke="#d4d4da"
          />
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 440 340"
      role="img"
      aria-label="Schematic axial chest illustration, not a medical scan"
      className="w-[95%] max-h-[360px]"
    >
      <g transform="translate(220 172)">
        <ellipse rx="157" ry="132" fill="#56565c" />
        <ellipse rx="146" ry="120" fill="#a1a1a7" />
        <ellipse rx="134" ry="109" fill="#74747b" />
        <path
          d="M-25-100C-95-113-139-58-122 15c10 45 47 80 78 63 29-15 25-63 24-95s18-54-5-83Z"
          fill="#212125"
        />
        <path
          d="M25-100c70-13 114 42 97 115-10 45-47 80-78 63-29-15-25-63-24-95s-18-54 5-83Z"
          fill="#212125"
        />
        <path
          d="M-18-56c-30 20-25 75 14 96 40-8 51-46 26-74Z"
          fill="#b5b5bc"
        />
        <ellipse cy="83" rx="22" ry="20" fill="#d6d6dc" />
        <ellipse cy="83" rx="10" ry="10" fill="#77777e" />
        <g fill="#d2d2d9">
          {[-1, 1].map((side) =>
            [-70, -35, 0, 35, 65].map((y, j) => (
              <ellipse
                key={`${side}-${y}`}
                cx={side * (136 - Math.abs(y) * 0.25)}
                cy={y}
                rx={7}
                ry={10 - j * 0.5}
                transform={`rotate(${side * 15} ${
                  side * (136 - Math.abs(y) * 0.25)
                } ${y})`}
              />
            ))
          )}
        </g>
        <g stroke="#696970" strokeWidth="2" fill="none">
          <path d="M-75-70l-8 45-22 32m22-32 21 8m-16 6-10 40M75-70l8 45 22 32m-22-32-21 8m16 6 10 40" />
        </g>
      </g>
      <text x="36" y="174" fill="#9999a2" fontSize="10">
        R
      </text>
      <text x="399" y="174" fill="#9999a2" fontSize="10">
        L
      </text>
    </svg>
  );
}
