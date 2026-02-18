import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) { console.error("Missing PRIVATE_KEY"); process.exit(1); }

  const acct = privateKeyToAccount(pk);
  const pub = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });
  const wal = createWalletClient({ account: acct, chain: base, transport: http("https://mainnet.base.org") });

  const bal = await pub.getBalance({ address: acct.address });
  console.log("Deployer:", acct.address);
  console.log("Balance:", formatEther(bal), "ETH\n");

  const txHash = await wal.sendTransaction({
    to: "0x48af8b28DDC5e5A86c4906212fc35Fa808CA8763",
    data: "0xb78a7fd6000000000000000000000000712fa8ddc7347b4b6b029aa21710f365cd02d898000000000000000000000000a660a38f40a519f2e351cc9a5ca2f5fee1a9be0d00000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000040000000000000000000000000a660a38f40a519f2e351cc9a5ca2f5fee1a9be0d0000000000000000000000000000000000000000000000000000000000000bb8",
  });

  console.log("TX sent:", txHash);
  console.log("Waiting...\n");

  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status === "reverted") {
    console.error("Reverted! https://basescan.org/tx/" + txHash);
    process.exit(1);
  }

  let addr = null;
  for (const log of receipt.logs) {
    for (const t of (log.topics || [])) {
      if (t.length === 66) {
        const a = "0x" + t.slice(26);
        if (a.length === 42 && !a.startsWith("0x000000000000000000000000000000000000")) { addr = a; }
      }
    }
  }

  console.log("Done! https://basescan.org/tx/" + txHash);
  if (addr) console.log("RevenueManager:", addr);
  console.log("\nVercel env vars:");
  if (addr) console.log("  NEXT_PUBLIC_REVENUE_MANAGER_ADDRESS=" + addr);
  console.log("  NEXT_PUBLIC_ALIFE_TREASURY=0xA660a38f40a519F2E351Cc9A5CA2f5feE1a9BE0D");
}

main().catch(e => { console.error("Failed:", e.message); process.exit(1); });
