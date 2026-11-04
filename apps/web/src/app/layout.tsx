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
  title: "MedGemma RadStudio — STATION-04 HRCT",
  description:
    "Next-generation clinical radiology workstation for multi-slice CT/MPR diagnosis, automated Lung-RADS assessment, and real-time report synthesis.",
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
      <body className="h-full w-full overflow-hidden font-sans bg-[#F3F4F6] text-[#1E293B]">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
