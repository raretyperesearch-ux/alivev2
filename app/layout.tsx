import type { Metadata } from "next";
import PrivyWrapper from "@/components/PrivyWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALiFe — Artificial Life Engine",
  description: "Launch a token. Activate an autonomous AI agent. It earns. You earn. 40/40/20.",
  openGraph: {
    title: "ALiFe — Artificial Life Engine",
    description: "Launch autonomous AI agents with token-backed economics on Base L2.",
    siteName: "ALiFe",
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
