# Card funding on Deodes — how users fund with a card

Date: 2026-10-15. Status: LIVE in production (Circle production key, Arc mainnet).

## Short answer

Users fund with a card via the **Circle Onramp widget**: Wallet → Deposit →
**“Buy USDC with card or bank (Circle)”** → Circle iframe (card/bank/Apple
Pay/Google Pay) → USDC settles **on Arc directly into the user's own 0x
wallet**. No Deodes-side deposit ledger is involved — the next balance read
picks the funds up automatically. Deodes charges nothing; Circle/the rail
takes its own fee inside the widget.

## The path, step by step

1. **Deposit page** (`src/app/(dashboard)/wallet/deposit/page.tsx`) shows the
   Circle card button whenever the build-time flag
   `NEXT_PUBLIC_ONRAMP_ENABLED=true` (baked at `npm run build`; currently
   true in `.env.production.local`).
2. Tapping it opens a modal with a **LIVE vs TESTNET badge** (from
   `GET /api/onramp/sessions` env probe) plus an Arc-testnet mismatch
   warning. It requires a signed-in user **and** a connected Arc (0x) wallet —
   otherwise it explains what to do instead.
3. **`OnrampWidget`** (`src/components/onramp/onramp-widget.tsx`) mounts the
   Circle iframe (fixed 720px container — Circle hosting requirement) and mints
   a session via **`POST /api/onramp/sessions`** scoped to
   `{ tokens: ["USDC"], chains: ["arc"] }`.
4. The sessions route (`src/app/api/onramp/sessions/route.ts`) is authenticated
   (HttpOnly session cookie, `appUserId` must equal the token subject,
   destination must be 0x) and **fail-closed: 503 when no Circle key is set**.
   The API key never reaches the browser.
5. `onDepositSettled` → success toast; `onNotCompleted` → info toast with the
   Circle code. Expired sessions auto-remount once.

## Environments (fail-closed by design)

- `CIRCLE_ENV` (`sandbox`|`production`, default sandbox) selects the key:
  `CIRCLE_TEST_API_KEY` vs `CIRCLE_API_KEY`, the Circle API base, and the
  widget origin. There is **no runtime toggle** — restart to change envs.
- Current production: `CIRCLE_ENV=production`, live key set, Arc mainnet.
- `ONRAMP_REFERRER_DOMAIN` **must be the host the widget is embedded on**
  (`app.deodes.com`) — card/Apple Pay/Google Pay 403 otherwise. Same-origin
  fallback exists but explicit config is required in prod.

## What is NOT card funding (don't confuse)

- **Bank / mobile-money rails** (NGN bank, KES M-Pesa, GHS): coming-soon
  buttons on the same page. No quote/payment state, no backend.
- **Withdraw to bank**: coming-soon page. Fiat off-ramp has no provider yet.
- **Circle payouts / contributions / transfers**: pure on-chain USDC between
  Arc wallets — no fiat involved.

## Settlement & reconciliation

- Settlement is on-chain USDC to the user's 0x address; `GET /v1/wallets/balance`
  reflects it on the next read. Nothing else must happen for funds to show.
- `POST /api/onramp/webhook` exists but reconciliation against a deposits
  ledger is an open TODO (`src/app/api/onramp/webhook/route.ts`) — acceptable
  today because there is no ledger to reconcile against; revisit if
  deposit-history UI is ever built.

## Operator checklist (if card funding ever looks dead)

1. Button missing? `NEXT_PUBLIC_ONRAMP_ENABLED` is build-time — rebuild.
2. Modal errors immediately? `GET /api/onramp/sessions` probe: 503 = key
   missing for the active `CIRCLE_ENV`; 401 = session cookie problem.
3. Widget opens but card declined/403? Check `ONRAMP_REFERRER_DOMAIN`
   matches the embedding host; check Circle dashboard (key, referrer
   allowlist, region/card support).
4. Settled but balance unchanged? Wait for Arc finality, then check the
   destination address on the Arc explorer — the widget sends to the
   connected 0x wallet, not to Deodes.
