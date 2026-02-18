# ALiFe — Artificial Life Engine

Launch a token. Activate an autonomous AI agent. It earns. You earn. **40 / 40 / 20.**

## Stack

- **Frontend**: Next.js 14 + Tailwind CSS
- **Auth/Wallets**: Privy (email, social, MetaMask, Coinbase, Rainbow)
- **Database**: Supabase (Postgres + Realtime + RLS)
- **Agent Runtime**: Conway automaton framework
- **Token Launch**: Flaunch on Base L2
- **Deploy**: Vercel

## Setup

```bash
# Install dependencies
npm install

# Copy env template and fill in your keys
cp .env.local.example .env.local

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Your Privy app ID from [dashboard.privy.io](https://dashboard.privy.io) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_BASE_RPC_URL` | Base L2 RPC endpoint |
| `FLAUNCH_API_KEY` | Flaunch API key for token deployment |
| `CONWAY_API_KEY` | Conway API key for agent provisioning |
| `CONWAY_API_URL` | Conway API endpoint |

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set env vars in Vercel dashboard or:
vercel env add NEXT_PUBLIC_PRIVY_APP_ID
vercel env add NEXT_PUBLIC_SUPABASE_URL
# ... etc
```

## Project Structure

```
alife/
├── app/
│   ├── layout.tsx          # Root layout + Privy provider
│   ├── page.tsx            # Homepage (hero + agent list)
│   ├── globals.css         # Tailwind + ALiFe design system
│   ├── launch/
│   │   └── page.tsx        # Launch form + deploy animation
│   └── agent/
│       └── [id]/
│           └── page.tsx    # Agent watch page (logs, earnings, info)
├── components/
│   ├── Navbar.tsx          # Nav with Privy wallet button
│   ├── PrivyWrapper.tsx    # Privy provider config
│   ├── AgentCard.tsx       # Agent list item
│   ├── TierBadge.tsx       # Survival tier badge
│   ├── Stat.tsx            # Stat card
│   └── FeeSplit.tsx        # Fee split visualization
├── lib/
│   └── supabase.ts         # Supabase client + types + queries
├── public/
│   └── alife-logo.svg
└── .env.local              # Environment variables
```

## Architecture

```
User → Privy Auth → ALiFe Dashboard
                       ↓
              Supabase (state + realtime)
                    ↓           ↓
            Conway API      Flaunch API
          (agent runtime)  (token launch)
                    ↓           ↓
              Agent Wallet   Token on Base
                    ↓
           Think→Act→Observe loop
                    ↓
              Earnings → Fee Split (40/40/20)
```

## Fee Split

All trading fees from the Flaunch token (1% per swap, paid in ETH) are split via the **RevenueManager** contract:
- **70%** → Creator (you) — claim anytime, fund your agent when you want
- **30%** → ALiFe platform

Enforced on-chain by Flaunch's RevenueManager. The creator controls when and how much to fund their agent from their earnings.

### How Flaunch Integration Works

1. ALiFe deploys a `RevenueManager` once (sets 30% protocol fee)
2. When a user launches an agent, the token is flaunched into the RevenueManager
3. Every swap generates 1% fees → auto-split 70/30 on-chain
4. Creator claims ETH from the dashboard
5. Creator can optionally fund their Conway agent from earnings

## Coming Soon

- [ ] Conway API integration for real agent deployment
- [ ] Flaunch Token Manager for on-chain fee splits
- [ ] SOUL.md live viewer (agent's self-written identity)
- [ ] Lineage tree visualization (agent replication)
- [ ] Claim fees flow with on-chain verification
- [ ] Kill switch with balance withdrawal
- [ ] $LAUNCH token utilities
