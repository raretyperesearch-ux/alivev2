"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";

export default function Navbar() {
  const { login, logout, authenticated, user, ready } = usePrivy();

  const walletAddress = user?.wallet?.address;
  const truncated = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : null;

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4" style={{
      background: "rgba(6, 8, 7, 0.85)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderBottom: "1px solid var(--border)",
    }}>
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 no-underline">
        <span className="font-display text-xl tracking-[-0.01em]" style={{ color: "var(--text)" }}>
          Alive <span style={{ color: "var(--accent)" }}>Agents</span>
        </span>
      </Link>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <Link href="/launch" className="btn-primary px-5 py-2.5 text-[13px] no-underline">
          Launch
        </Link>

        {ready && (
          authenticated && truncated ? (
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] cursor-pointer transition-all"
              style={{
                background: "rgba(184, 240, 196, 0.06)",
                border: "1px solid var(--border)",
                color: "var(--accent)",
              }}
            >
              <span className="status-alive" />
              {truncated}
            </button>
          ) : (
            <button
              onClick={login}
              className="btn-ghost px-5 py-2.5 text-[13px]"
            >
              Connect
            </button>
          )
        )}
      </div>
    </nav>
  );
}
