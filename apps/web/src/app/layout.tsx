import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";

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
    <html lang="en" className="dark">
      <body
        className="font-sans antialiased bg-background text-foreground min-h-screen"
        style={{
          fontFamily:
            "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
