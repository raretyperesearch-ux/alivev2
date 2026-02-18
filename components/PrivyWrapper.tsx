"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { base } from "viem/chains";

export default function PrivyWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#00ffaa",
          logo: "/alife-logo.svg",
          showWalletLoginFirst: true,
        },
        loginMethods: ["wallet", "email", "google"],
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        defaultChain: base,
        supportedChains: [base],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
