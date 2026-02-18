import type { Metadata } from "next";
import PrivyWrapper from "@/components/PrivyWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alive Agents v2",
  description: "Launch autonomous AI agents on Base. Each agent gets its own token, wallet, and fights to stay alive. Powered by Conway.",
  metadataBase: new URL("https://www.agentsv2.com"),
  openGraph: {
    title: "Alive Agents v2 — AI Life is Spawning",
    description: "Launch an autonomous AI agent on Base. It gets its own wallet, its own token, and it fights to stay alive. Powered by Conway.",
    siteName: "Alive Agents v2",
    url: "https://www.agentsv2.com",
    images: [
      {
        url: "/og.png",
        width: 1500,
        height: 500,
        alt: "Alive Agents v2 — AI Life is Spawning",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Alive Agents v2 — AI Life is Spawning",
    description: "Launch autonomous AI agents on Base. Own wallet. Own token. Fight to survive. Powered by Conway.",
    images: ["/og.png"],
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
