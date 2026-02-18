"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, createPublicClient, custom, http, formatEther } from "viem";
import { base } from "viem/chains";
import Navbar from "@/components/Navbar";

const ALIFE_TREASURY = "0xA660a38f40a519F2E351Cc9A5CA2f5feE1a9BE0D";
const PROTOCOL_FEE_PERCENT = 30;

// Only these wallets can access the admin page
const ADMIN_WALLETS = [
  "0xa660a38f40a519f2e351cc9a5ca2f5fee1a9be0d",
  "0x73927100dcfa2c29dd330191a291d42560c90e8e",
];

export default function AdminPage() {
  const { authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();

  const [status, setStatus] = useState<string>("");
  const [deploying, setDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [platformClaimable, setPlatformClaimable] = useState("0.000000");
  const [claimingPlatform, setClaimingPlatform] = useState(false);
  const [claimStatus, setClaimStatus] = useState("");
  const [claimErr, setClaimErr] = useState("");

  const wallet = wallets?.[0];
  const isAdmin = wallet && ADMIN_WALLETS.includes(wallet.address.toLowerCase());

  const checkBalance = async () => {
    if (!wallet) return;
    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http("https://mainnet.base.org"),
      });
      const bal = await publicClient.getBalance({
        address: wallet.address as `0x${string}`,
      });
      setBalance(formatEther(bal));
    } catch (err: any) {
      setError("Failed to check balance: " + err.message);
    }
  };

  const refreshPlatformBalance = async () => {
    try {
      const { getPlatformClaimableBalance } = await import("@/lib/flaunch");
      const bal = await getPlatformClaimableBalance();
      setPlatformClaimable(parseFloat(formatEther(bal)).toFixed(6));
    } catch (err: any) {
      console.warn("Failed to fetch platform balance:", err);
    }
  };

  const handleClaimPlatformFees = async () => {
    if (!wallet || claimingPlatform) return;
    setClaimingPlatform(true);
    setClaimErr("");
    setClaimStatus("Preparing transaction...");

    try {
      await wallet.switchChain(base.id);
      const provider = await wallet.getEthereumProvider();
      const wc = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: base,
        transport: custom(provider),
      });

      setClaimStatus("Sign the transaction in your wallet...");
      const { claimPlatformFees } = await import("@/lib/flaunch");
      const txHash = await claimPlatformFees(wc);

      setClaimStatus(`✅ Claimed! Tx: ${txHash.slice(0, 14)}…`);
      
      // Refresh balance
      await refreshPlatformBalance();
    } catch (err: any) {
      console.error("Platform claim error:", err);
      setClaimErr(err.message || "Claim failed");
      setClaimStatus("");
    } finally {
      setClaimingPlatform(false);
    }
  };

  const deployRevenueManager = async () => {
    if (!wallet) return;
    setDeploying(true);
    setError("");
    setStatus("Getting wallet provider...");

    try {
      const provider = await wallet.getEthereumProvider();

      // Ensure we're on Base
      setStatus("Switching to Base network...");
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }], // 8453 in hex
        });
      } catch (switchErr: any) {
        // If Base isn't added, add it
        if (switchErr.code === 4902) {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x2105",
              chainName: "Base",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://mainnet.base.org"],
              blockExplorerUrls: ["https://basescan.org"],
            }],
          });
        }
      }

      setStatus("Creating Flaunch SDK instance...");

      const publicClient = createPublicClient({
        chain: base,
        transport: http("https://mainnet.base.org"),
      });

      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider),
      });

      // Dynamic import to avoid SSR issues
      setStatus("Loading Flaunch SDK...");
      const { createFlaunch } = await import("@flaunch/sdk");

      // @ts-ignore - viem version mismatch
      const flaunch = createFlaunch({ publicClient, walletClient });

      setStatus("Deploying RevenueManager contract... (confirm in wallet)");

      const revenueManagerAddress = await flaunch.deployRevenueManager({
        protocolRecipient: ALIFE_TREASURY,
        protocolFeePercent: PROTOCOL_FEE_PERCENT,
      });

      setDeployedAddress(revenueManagerAddress as string);
      setStatus("✅ Deployed successfully!");
      setDeploying(false);

    } catch (err: any) {
      console.error("Deploy error:", err);
      setError(err.message || "Deployment failed");
      setStatus("");
      setDeploying(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[var(--alife-bg)]">
        <Navbar />
        <div className="max-w-[600px] mx-auto p-6 text-center py-20">
          <div className="text-3xl mb-4">◈</div>
          <p className="text-[var(--alife-dim)] mb-4">Connect wallet to access admin</p>
          <button onClick={login} className="btn-primary px-6 py-3 text-sm">
            CONNECT WALLET
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[var(--alife-bg)]">
        <Navbar />
        <div className="max-w-[600px] mx-auto p-6 text-center py-20">
          <div className="text-3xl mb-4">🚫</div>
          <p className="text-[var(--alife-red)]">Not authorized</p>
          <p className="text-[var(--alife-dim)] text-xs mt-2">
            Wallet: {wallet?.address}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--alife-bg)]">
      <Navbar />
      <main className="max-w-[700px] mx-auto p-6">
        <h1 className="font-display text-2xl font-extrabold text-white mb-1">◈ ALiFe Admin</h1>
        <p className="text-[var(--alife-dim)] text-xs mb-8">One-time setup tools</p>

        {/* Wallet Info */}
        <div className="card p-4 mb-6">
          <div className="text-[10px] font-mono text-[var(--alife-dim)] uppercase tracking-[1px] mb-2">
            Connected Wallet
          </div>
          <code className="text-[var(--alife-accent)] text-sm font-mono">{wallet?.address}</code>
          <div className="mt-3">
            <button onClick={checkBalance} className="btn-ghost px-3 py-1.5 text-[10px]">
              CHECK BASE BALANCE
            </button>
            {balance !== null && (
              <span className="ml-3 text-[var(--alife-accent)] font-mono text-sm font-bold">
                {parseFloat(balance).toFixed(6)} ETH
              </span>
            )}
          </div>
        </div>

        {/* Claim Platform Fees - TOP PRIORITY */}
        <div className="card p-5 mb-6" style={{ border: "1px solid rgba(0,232,92,0.3)" }}>
          <h2 className="text-sm font-mono font-bold text-[var(--alife-accent)] mb-2">
            💰 Platform Fee Claim
          </h2>
          <div className="text-[11px] text-[var(--alife-dim)] leading-relaxed mb-4">
            Claim the platform&apos;s 30% cut from all agent token swap fees.
          </div>

          <div className="p-3 rounded-lg mb-4" style={{ background: "rgba(0,232,92,0.06)", border: "1px solid rgba(0,232,92,0.15)" }}>
            <div className="text-[9px] text-[var(--alife-dim)] font-mono uppercase mb-1">Claimable Platform Fees</div>
            <div className="text-[var(--alife-accent)] font-mono font-bold text-2xl">
              {platformClaimable} ETH
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={refreshPlatformBalance}
              className="btn-ghost px-4 py-2.5 text-[11px]"
            >
              REFRESH BALANCE
            </button>
            <button
              onClick={handleClaimPlatformFees}
              disabled={claimingPlatform || platformClaimable === "0.000000"}
              className="btn-primary px-6 py-2.5 text-[11px] flex-1"
              style={{ opacity: (claimingPlatform || platformClaimable === "0.000000") ? 0.5 : 1 }}
            >
              {claimingPlatform ? "CLAIMING..." : "CLAIM PLATFORM FEES"}
            </button>
          </div>

          {claimStatus && (
            <div className="mt-3 text-[11px] font-mono text-[var(--alife-accent)]">
              {claimStatus}
            </div>
          )}
          {claimErr && (
            <div className="mt-3 text-[11px] font-mono text-[var(--alife-red)]">
              ❌ {claimErr}
            </div>
          )}
        </div>

        {/* Deploy RevenueManager */}
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-mono font-bold text-white mb-2">
            1. Deploy RevenueManager
          </h2>
          <div className="text-[11px] text-[var(--alife-dim)] leading-relaxed mb-4">
            This deploys the Flaunch RevenueManager contract on Base mainnet.
            It enforces the 70/30 fee split for all future agent tokens.
            You only need to do this <span className="text-white font-bold">once</span>.
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-lg" style={{ background: "rgba(0,255,170,0.04)", border: "1px solid rgba(0,255,170,0.1)" }}>
              <div className="text-[9px] text-[var(--alife-dim)] font-mono uppercase">Creator Fee</div>
              <div className="text-[var(--alife-accent)] font-mono font-bold text-lg">70%</div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "rgba(255,208,0,0.04)", border: "1px solid rgba(255,208,0,0.1)" }}>
              <div className="text-[9px] text-[var(--alife-dim)] font-mono uppercase">ALiFe Platform</div>
              <div className="text-[var(--alife-yellow)] font-mono font-bold text-lg">30%</div>
            </div>
          </div>

          <div className="text-[10px] text-[var(--alife-dim)] mb-4 font-mono">
            Treasury: <span className="text-[var(--alife-yellow)]">{ALIFE_TREASURY}</span>
          </div>

          {!deployedAddress ? (
            <button
              onClick={deployRevenueManager}
              disabled={deploying}
              className="btn-primary w-full py-3 text-sm"
              style={{ opacity: deploying ? 0.6 : 1 }}
            >
              {deploying ? "DEPLOYING..." : "DEPLOY REVENUE MANAGER"}
            </button>
          ) : (
            <div className="p-4 rounded-lg" style={{ background: "rgba(0,255,170,0.06)", border: "1px solid rgba(0,255,170,0.2)" }}>
              <div className="text-[var(--alife-accent)] font-mono font-bold text-sm mb-2">
                ✅ RevenueManager Deployed!
              </div>
              <code className="text-white text-xs font-mono block mb-3 break-all">
                {deployedAddress}
              </code>
              <div className="text-[10px] text-[var(--alife-dim)]">
                Add this to Vercel env vars as:<br />
                <code className="text-[var(--alife-accent)]">NEXT_PUBLIC_REVENUE_MANAGER_ADDRESS={deployedAddress}</code>
              </div>
            </div>
          )}

          {status && !deployedAddress && (
            <div className="mt-3 text-[11px] font-mono text-[var(--alife-blue)]">
              {status}
            </div>
          )}

          {error && (
            <div className="mt-3 text-[11px] font-mono text-[var(--alife-red)]">
              ❌ {error}
            </div>
          )}
        </div>

        {/* Env Vars Checklist */}
        <div className="card p-5">
          <h2 className="text-sm font-mono font-bold text-white mb-3">
            3. Vercel Environment Variables
          </h2>
          <div className="space-y-2 text-[11px] font-mono">
            {[
              { key: "NEXT_PUBLIC_PRIVY_APP_ID", val: "cml7nar5801lnl10c7mc922qy", set: true },
              { key: "NEXT_PUBLIC_SUPABASE_URL", val: "https://pppsvntktlzsjflugzge.supabase.co", set: true },
              { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", val: "eyJ...(set)", set: true },
              { key: "NEXT_PUBLIC_ALIFE_TREASURY", val: ALIFE_TREASURY, set: false },
              { key: "NEXT_PUBLIC_REVENUE_MANAGER_ADDRESS", val: deployedAddress || "deploy first ↑", set: !!deployedAddress },
              { key: "CONWAY_API_URL", val: "your Railway URL", set: false },
              { key: "CONWAY_API_KEY", val: "generate one", set: false },
            ].map((v) => (
              <div key={v.key} className="flex items-center gap-2">
                <span className={v.set ? "text-[var(--alife-accent)]" : "text-[var(--alife-red)]"}>
                  {v.set ? "✓" : "✗"}
                </span>
                <span className="text-[var(--alife-dim)]">{v.key}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
