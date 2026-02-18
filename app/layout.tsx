import type { Metadata } from "next";
import PrivyWrapper from "@/components/PrivyWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alive Agents v2",
  description: "Launch a token. Activate an autonomous AI agent. Powered by Conway.",
  openGraph: {
    title: "Alive Agents v2",
    description: "Launch autonomous AI agents with token-backed economics on Base L2.",
    siteName: "Alive Agents",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="noise">
        <PrivyWrapper>{children}</PrivyWrapper>
      </body>
    </html>
  );
}
