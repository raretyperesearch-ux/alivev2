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
    <nav className="sticky top-0 z-50 flex items-center justify-between px-5 py-3 border-b border-[var(--alife-border)] bg-[var(--alife-bg)]/90 backdrop-blur-xl">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 no-underline">
        <div className="w-8 h-8 rounded-lg bg-[rgba(0,255,170,0.12)] border border-[rgba(0,255,170,0.25)] flex items-center justify-center text-sm font-extrabold font-mono text-[var(--alife-accent)]">
          ◈
        </div>
        <span className="font-display font-extrabold text-base text-white tracking-[3px]">
          Alive <span className="text-[var(--alife-accent)]">Agents</span> v2
        </span>
      </Link>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <Link href="/launch" className="btn-primary px-4 py-2 text-xs no-underline">
          ⚡ LAUNCH
        </Link>

        {ready && (
          authenticated && truncated ? (
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(0,255,170,0.06)] border border-[rgba(0,255,170,0.15)] text-xs font-mono text-[var(--alife-accent)] cursor-pointer hover:border-[rgba(0,255,170,0.3)] transition-colors"
            >
              <span className="w-[6px] h-[6px] rounded-full bg-[var(--alife-accent)] shadow-[0_0_4px_var(--alife-accent)]" />
              {truncated}
            </button>
          ) : (
            <button
              onClick={login}
              className="btn-ghost px-3 py-2 text-xs"
            >
              CONNECT
            </button>
          )
        )}
      </div>
    </nav>
  );
}
