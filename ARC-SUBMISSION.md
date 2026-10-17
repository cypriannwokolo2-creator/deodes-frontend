# Arc Microgrants Submission Pack (DoraHacks)

> Deadline: Oct 14, 2026 23:59 ET · Prize: 500 USDC on Arc · Status: READY

## Links (paste into the form)
- Live deployment (Arc mainnet): https://deodes.com
- Frontend repo (public): https://github.com/cypriannwokolo2-creator/deodes-frontend
- Backend repo (public): https://github.com/cypriannwokolo2-creator/deodes-backend
- Contracts repo (public): https://github.com/cypriannwokolo2-creator/deodes-contracts
- DeodesCircle on Arc mainnet: https://explorer.arc.io/address/0x70A7CCB7b5fe856384Aab3aAF553E09A10AF14A4
- Logo: https://deodes.com/logo.jpg
- Payout wallet (receives USDC on Arc): `0x81e877e2d21ec187994ed4ae1fafb36d529bacb1

## Short description (paste)
Deodes digitizes rotating savings circles (esusu, tontine, chit funds) on Arc
mainnet: members contribute USDC on schedule, one member takes the pool each
round, and every on-time payment builds a portable 0–1000 DeoScore reputation.
One invisible hosted wallet per user (auto-created at signup); external wallets
are link-and-sweep funding only; auto-pay vs manual is chosen per circle.

## What it uses Arc for (paste)
- Native USDC as gas + savings asset (18 decimals, sub-cent fees, sub-second finality).
- DeodesCircle + Factory + Treasury + Reputation + Governance contracts deployed
  and verified on Arc mainnet (chain 5042).
- Backend EVM indexer tails circle events (dedup on tx+logIndex, reorg window,
  receipt-gated verification) and fans them to the app over WebSockets.
- Fiat onramp via Circle App Kit (production keys) so new savers buy USDC
  without leaving the app.
- Enforcement on-chain where it matters: 50 bps protocol fee
  (`fee = pool * 50 / 10000`), rotation-without-repeat payouts, exact fee math
  mirrored bit-for-bit in the backend.

## Community & growth (paste)
Deodes doesn't acquire users one by one — every circle is a viral cell. A
10-member circle is 10 people with a shared financial stake who each know 10
more people they trust with money; invites travel over WhatsApp and Telegram
through the existing share flows, and each completed payout is a public proof
that recruits the next circle. Community circles (token-gated, DAO-run) let
cooperatives, campuses, and trade associations run their own programs with
their own rules, while DeoScore gives savers a status worth showing off —
reputation is the retention engine. Growth compounds circle by circle:
payouts prove, members invite, new circles form, scores deepen. The builder
side stays open: public repos, documented event schema, and Arc office hours
turn integrators into contributors.

## Checklist
- [x] Live on Arc mainnet (https://deodes.com, chain 5042)
- [x] Public repos (frontend, backend, contracts)
- [x] Contracts deployed + verified on mainnet
- [x] Description + Arc-usage text (above)
- [ ] Builder profile (GitHub/X/Farcaster) — operator action
- [ ] Submit the form — operator action
