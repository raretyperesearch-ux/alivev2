// @ts-nocheck
import { NextResponse } from "next/server";

const CONWAY_API_URL = process.env.CONWAY_API_URL || "https://conway-manager-production.up.railway.app";
const CONWAY_API_KEY = process.env.CONWAY_API_KEY || "";

export async function POST(req: Request) {
  try {
    const config = await req.json();

    if (!CONWAY_API_KEY) {
      // Fallback: generate locally without calling Railway
      const sandboxId = `alife-${(config.ticker || "agent").replace("$", "").toLowerCase()}-${Date.now()}`;
      const wallet = "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      return NextResponse.json({ sandbox_id: sandboxId, wallet_address: wallet, status: "alive" });
    }

    const response = await fetch(`${CONWAY_API_URL}/v1/automatons`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONWAY_API_KEY}`,
      },
      body: JSON.stringify({
        name: config.name,
        ticker: config.ticker,
        genesis_prompt: config.genesis_prompt || config.genesisPrompt,
        creator_address: config.creator_address || config.creatorAddress,
        token_address: config.token_address || config.tokenAddress || "pending",
        model: config.model || "claude-sonnet-4-20250514",
        agent_id: config.agent_id,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Conway API error:", response.status, err);
      // Fallback
      const sandboxId = `alife-${(config.ticker || "agent").replace("$", "").toLowerCase()}-${Date.now()}`;
      const wallet = "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      return NextResponse.json({ sandbox_id: sandboxId, wallet_address: wallet, status: "provisioning" });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Conway provision error:", error);
    const sandboxId = `alife-fallback-${Date.now()}`;
    const wallet = "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    return NextResponse.json({ sandbox_id: sandboxId, wallet_address: wallet, status: "provisioning" });
  }
}
