import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MedGemma Workspace — Clinical Intelligence UI",
  description:
    "Multimodal Clinical Copilot & Radiological Workspace powered by MedGemma 1.5, Next.js, Tailwind CSS, shadcn, TanStack Query, and Zustand.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased bg-[#fafaf9] text-[#18181b] min-h-screen`}
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
