import type { Metadata } from "next";
import { Outfit, Reenie_Beanie } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const reenieBeanie = Reenie_Beanie({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-reenie",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MedGemma 1.5 — 3D Volumetric MRI & CT Diagnostic Workspace",
  description:
    "Calm volumetric clarity for multi-sequence 3D MRI & CT diagnostics with sparse z-axis attention and MedGemma 1.5 reasoning.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${reenieBeanie.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#FDFCF8] text-[#292524] selection:bg-[#FFB7B2]/40 selection:text-[#292524]">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
