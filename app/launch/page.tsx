"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";
import Navbar from "@/components/Navbar";
import { launchAgent } from "@/lib/launch";
import { supabase } from "@/lib/supabase";

const DEPLOY_STEPS = [
  "Deploying token on Flaunch (Base)…",
  "Token live — confirming on-chain…",
  "Creating agent record…",
  "Spinning up Conway sandbox…",
  "Agent wallet funded — $0.50 credits…",
  "Writing genesis prompt…",
  "Agent is ALIVE ⚡",
];

export default function LaunchPage() {
  const router = useRouter();
  const { authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();

  const [form, setForm] = useState({
    name: "",
    ticker: "",
    description: "",
    genesis_prompt: "",
    funding: "10",
    image: "",
  });
  const [launching, setLaunching] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");

  // Deploy animation
  useEffect(() => {
    if (!launching) return;
    if (step < DEPLOY_STEPS.length - 1) {
      const t = setTimeout(() => setStep((s) => s + 1), 1200);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => router.push("/"), 1000);
      return () => clearTimeout(t);
    }
  }, [launching, step, router]);

  const f = (key: string, value: string) => setForm({ ...form, [key]: value });

  const handleLaunch = async () => {
    if (!authenticated) {
      login();
      return;
    }

    // Validate
    if (!form.name || !form.ticker || !form.description || !form.genesis_prompt) {
      setError("Fill in all fields");
      return;
    }
    setError("");

    // Get wallet
    const wallet = wallets[0];
    if (!wallet) {
      setError("No wallet connected");
      return;
    }

    setLaunching(true);
    setStep(0);

    try {
      // Get viem walletClient from Privy
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider),
      });

      // Run the full launch: Flaunch token → Conway agent → Supabase
      const result = await launchAgent(
        walletClient,
        {
          creatorAddress: wallet.address as `0x${string}`,
          creatorId: user?.id || "",
          name: form.name,
          ticker: form.ticker,
          description: form.description,
          genesisPrompt: form.genesis_prompt,
          imageBase64: form.image || "",
          initialMarketCapUSD: 10_000,
          creatorFeeAllocationPercent: 80,
        },
        // Progress callback — updates the step indicator
        (stepNum, message) => {
          setStep(stepNum);
        }
      );

      console.log("Agent launched:", result);

    } catch (err) {
      console.error("Launch error:", err);
      setError((err as Error).message);
      setLaunching(false);
      return;
    }
  };

  // Deploying animation
  if (launching) {
    return (
      <div className="min-h-screen bg-[var(--alife-bg)]">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-5">
          <div className="relative w-20 h-20 mb-7">
            <div className="w-20 h-20 rounded-full border-[3px] border-[var(--alife-border)] border-t-[var(--alife-accent)] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-2xl">
              {step < 6 ? "◈" : "⚡"}
            </div>
          </div>
          <div className="font-mono text-sm text-[var(--alife-accent)] mb-5 text-center">
            {DEPLOY_STEPS[step]}
          </div>
          <div className="flex gap-1">
            {DEPLOY_STEPS.map((_, i) => (
              <div
                key={i}
                className="w-6 h-[3px] rounded-sm transition-colors duration-300"
                style={{
                  background: i <= step ? "var(--alife-accent)" : "rgba(0,255,170,0.1)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--alife-bg)]">
      <Navbar />

      <main className="max-w-[520px] mx-auto p-4 pb-10">
        <button
          onClick={() => router.push("/")}
          className="btn-ghost px-3 py-1.5 text-[11px] mb-6"
        >
          ← BACK
        </button>

        <div className="text-center mb-7">
          <h1 className="font-display text-xl font-extrabold text-white m-0 mb-1">
            Launch <span className="text-[var(--alife-accent)]">Agent</span>
          </h1>
          <p className="text-[var(--alife-dim)] text-xs m-0">
            Token deploys on Flaunch → Conway automaton activates → Fees flow
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Name */}
          <div>
            <label className="text-[var(--alife-dim)] text-[9px] block mb-1 font-mono uppercase tracking-[1.5px]">
              Agent Name
            </label>
            <input
              className="w-full bg-[rgba(0,255,170,0.03)] border border-[var(--alife-border)] rounded-[10px] py-3 px-3.5 text-white text-sm outline-none"
              placeholder="e.g. NEXUS"
              value={form.name}
              onChange={(e) => f("name", e.target.value)}
            />
          </div>

          {/* Ticker */}
          <div>
            <label className="text-[var(--alife-dim)] text-[9px] block mb-1 font-mono uppercase tracking-[1.5px]">
              Ticker
            </label>
            <input
              className="w-full bg-[rgba(0,255,170,0.03)] border border-[var(--alife-border)] rounded-[10px] py-3 px-3.5 text-white text-sm outline-none"
              placeholder="e.g. $NEXUS"
              value={form.ticker}
              onChange={(e) => f("ticker", e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[var(--alife-dim)] text-[9px] block mb-1 font-mono uppercase tracking-[1.5px]">
              Description
            </label>
            <input
              className="w-full bg-[rgba(0,255,170,0.03)] border border-[var(--alife-border)] rounded-[10px] py-3 px-3.5 text-white text-sm outline-none"
              placeholder="What does your agent do?"
              value={form.description}
              onChange={(e) => f("description", e.target.value)}
            />
          </div>

          {/* Genesis Prompt */}
          <div>
            <label className="text-[var(--alife-dim)] text-[9px] block mb-1 font-mono uppercase tracking-[1.5px]">
              Genesis Prompt
            </label>
            <textarea
              className="w-full bg-[rgba(0,255,170,0.03)] border border-[var(--alife-border)] rounded-[10px] py-3 px-3.5 text-white text-sm outline-none min-h-[90px] resize-y"
              placeholder="You are [NAME]. Your mission is to..."
              value={form.genesis_prompt}
              onChange={(e) => f("genesis_prompt", e.target.value)}
            />
          </div>

          {/* Agent Image */}
          <div>
            <label className="text-[var(--alife-dim)] text-[9px] block mb-1 font-mono uppercase tracking-[1.5px]">
              Agent Image
            </label>
            <div className="relative">
              {form.image ? (
                <div className="flex items-center gap-3">
                  <img 
                    src={form.image} 
                    alt="preview" 
                    className="w-16 h-16 rounded-lg object-cover border border-[var(--alife-border)]" 
                  />
                  <button 
                    onClick={() => f("image", "")} 
                    className="text-[var(--alife-dim)] text-xs hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center w-full h-[80px] bg-[rgba(0,255,170,0.03)] border border-dashed border-[var(--alife-border)] rounded-[10px] cursor-pointer hover:border-[var(--alife-accent)] transition-colors">
                  <span className="text-[var(--alife-dim)] text-xs">Click to upload image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          f("image", reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Launch Sequence Info */}
          <div className="card p-4 border-[rgba(0,255,170,0.12)]">
            <div className="text-[var(--alife-dim)] text-[9px] font-mono uppercase tracking-[1.5px] mb-2">
              Launch Sequence
            </div>
            {[
              "Token deploys on Flaunch (Base)",
              "Conway automaton spins up with its own wallet",
              "Agent receives genesis prompt → Think→Act→Observe loop",
              "Every swap generates fees for the creator",
              "Fund your agent anytime from your earnings",
            ].map((s, i) => (
              <div
                key={i}
                className="text-[11px] text-[var(--alife-dim)] leading-[2] pl-3 relative"
              >
                <span className="absolute left-0 text-[var(--alife-accent)] text-[9px]">
                  ▸
                </span>
                {s}
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="text-[var(--alife-red)] text-xs font-mono text-center">
              {error}
            </div>
          )}

          {/* Launch Button */}
          <button
            onClick={handleLaunch}
            className="btn-primary py-4 text-[15px] mt-1"
          >
            ⚡ LAUNCH TOKEN + ACTIVATE AGENT
          </button>
        </div>
      </main>
    </div>
  );
}
