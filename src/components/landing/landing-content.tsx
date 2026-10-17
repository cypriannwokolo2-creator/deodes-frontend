"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Shield,
  Globe,
  Award,
  Zap,
  Shuffle,
  Coins,
  ArrowRight,
  Search,
  Users,
  Lock,
  Crown,
  Dices,
  ListOrdered,
  Gavel,
  Vote,
  Wallet,
  HandCoins,
  Trophy,
  BadgeCheck,
  FileLock2,
} from "lucide-react"
import { Routes } from "@/lib/constants"
import { useTranslate } from "@/lib/locale/context"
import { MemberDot } from "@/components/payouts/round-simulator"
import { Reveal } from "@/components/shared/reveal"

// ── DEODES landing: dense marketplace-style page ─────────────────────────────
// Structure references: sckoll.com (two-sided paths, search, stats strip,
// category grid, numbered flow, trust layer) + agentsdb apps/web (black hero,
// trust strip, top-cards band, CTA band). Content is DEODES: ROSCA savings
// circles on Arc with USDC + DeoScore reputation.

const stats = [
  { value: "1.7B+", label: "unbanked adults served" },
  { value: "4", label: "payout modes" },
  { value: "0.5%", label: "protocol fee on payouts" },
  { value: "1000", label: "max DeoScore reputation" },
]

const circleTypes = [
  {
    icon: Globe,
    name: "Public circles",
    desc: "Anyone meeting the minimum DeoScore can join. Permissionless.",
    meta: "Permissionless",
    join: "Join from the app — pick an open round and lock your first contribution.",
    colSpan: "lg:col-span-2",
    featured: true,
  },
  {
    icon: Lock,
    name: "Private circles",
    desc: "Invite-only via link or code. Save with people you trust.",
    meta: "Invite-only",
    join: "Ask your organizer for a link, redeem it, contribute on schedule.",
    colSpan: "lg:col-span-1",
  },
  {
    icon: Users,
    name: "Community circles",
    desc: "Token-gated for DAOs and holder communities. Multi-sig guarded.",
    meta: "Token-gated",
    join: "Hold the community token, verify once, save with your people.",
    colSpan: "lg:col-span-1",
  },
  {
    icon: Crown,
    name: "Premium circles",
    desc: "Higher limits, priority support, collateralized. Permissioned.",
    meta: "Collateralized",
    join: "Bring a strong DeoScore and collateral for bigger pools.",
    colSpan: "lg:col-span-2",
    featured: true,
  },
]

const steps = [
  {
    n: "01",
    title: "Bring any identity",
    desc: "Google, email, Face ID or your own wallet. DEODES meets you where you are — no seed phrases, no KYC.",
  },
  {
    n: "02",
    title: "Join or start a circle",
    desc: "Browse public circles, redeem an invite code, or spin up your own with daily, weekly or monthly rounds.",
  },
  {
    n: "03",
    title: "Contribute USDC",
    desc: "Lock in your contribution each round on Arc. Sub-cent fees, enforced on-chain — late fees and grace periods up front.",
  },
  {
    n: "04",
    title: "Receive your payout",
    desc: "Random draw, fixed order, auction win or community vote — the pool lands in your wallet when your turn comes.",
  },
  {
    n: "05",
    title: "Grow your DeoScore",
    desc: "Every on-time payment builds portable 0–1000 reputation that unlocks bigger circles and lower collateral.",
  },
]

const scoreWeights = [
  { label: "Streak — consecutive on-time payments", pct: 35 },
  { label: "Completions — successful circles", pct: 30 },
  { label: "Volume — total contributed", pct: 20 },
  { label: "Recency — recent activity", pct: 15 },
]
const trustItems = [
  {
    icon: FileLock2,
    title: "Enforced on-chain",
    desc: "Arc smart contracts hold contributions and release payouts. No custodian, no middleman to trust.",
    points: [
      "Money locks in audited contracts — organizers can never touch the pool",
      "Late fees and grace periods execute as code, not negotiations",
      "Payouts release automatically when rounds close",
    ],
  },
  {
    icon: BadgeCheck,
    title: "Portable reputation",
    desc: "DeoScore follows your wallet for life — across every circle, community and app on DEODES.",
    points: [
      "0–1000 score from streaks, completions, volume and recency",
      "High scores unlock premium circles and lower collateral",
      "Your history travels with your wallet, not a platform account",
    ],
  },
  {
    icon: HandCoins,
    title: "Sub-cent economics",
    desc: "Arc settles for fractions of a cent with USDC. A flat 0.5% protocol fee only on payouts.",
    points: [
      "Contributions cost ~$0.001 to settle — no ETH needed, USDC is gas",
      "0.5% applies once, on payouts: a $500 pool costs $2.50 total",
      "Zero fees to join, contribute, or build score",
    ],
  },
]

// ── Zero-lag rotating hero word ──────────────────────────────────────────────
// Compositor-only animation (transform + opacity): no layout, no paint, no
// gradient re-raster. Each word carries its own static gradient, painted
// once — the swap animation never touches pixels. No glow: the words stay
// crisp at display sizes.
const GROW_WORDS = [
  { word: "Grow.", gradient: "gradient-text-extended" },
  { word: "Earn.", gradient: "gradient-text-gold" },
  { word: "Rise.", gradient: "gradient-text-cyan" },
  { word: "Win.", gradient: "gradient-text" },
]

function RotatingGrow() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % GROW_WORDS.length)
    }, 2600)
    return () => clearInterval(id)
  }, [])

  const current = GROW_WORDS[index]

  return (
    <span className="block text-left" aria-live="polite">
      <span
        key={index}
        className={`grow-word ${current.gradient} font-display text-5xl md:text-7xl xl:text-8xl font-black tracking-tight`}
      >
        {current.word}
      </span>
    </span>
  )
}

// ── Round-ledger motif ───────────────────────────────────────────────────────
// The page's signature device: member dots marching across rounds. Thin
// divider variant between sections; full interactive strip in the payout band.
// Static markup + instant state only — zero animation cost.
const LEDGER_MEMBERS = ["Ada", "Bola", "Chidi", "Dara", "Emeka", "Funke"] as const

function LedgerDivider({ caption }: { caption: string }) {
  return (
    <div className="relative z-10 py-10" aria-hidden="true">
      <div className="container-premium flex items-center gap-4">
        <span className="h-px flex-1 bg-white/[0.08]" />
        <span className="flex items-center gap-1.5">
          {LEDGER_MEMBERS.slice(0, 5).map((m, i) => (
            <span key={m} className="flex items-center gap-1.5">
              <span
                className={
                  i === 2
                    ? "flex h-2.5 w-2.5 rounded-full gradient-bg-extended"
                    : "flex h-2 w-2 rounded-full bg-white/15"
                }
              />
              {i < 4 && <span className="h-px w-4 bg-white/15" />}
            </span>
          ))}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">
          {caption}
        </span>
        <span className="h-px flex-1 bg-white/[0.08]" />
      </div>
    </div>
  )
}

// ── Section rule: hard demarcation between landing sections ─────────────────
// A visible gradient hairline (violet core fading to transparent) with a
// center diamond. LedgerDivider stays the captioned motif for payout-adjacent
// breaks; SectionRule is the plain full stop everywhere else.
function SectionRule() {
  return (
    <div className="relative z-10" aria-hidden="true">
      <div className="container-premium flex items-center gap-3 py-2">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-aurora-violet/50 to-aurora-violet/10" />
        <span className="h-1.5 w-1.5 rotate-45 bg-aurora-violet/70" />
        <span className="h-px flex-1 bg-gradient-to-l from-transparent via-aurora-violet/50 to-aurora-violet/10" />
      </div>
    </div>
  )
}

const STRIP_MODES = [
  { id: "random", icon: Dices, name: "Random", order: [2, 5, 0, 3], note: "VRF draw" },
  { id: "fixed", icon: ListOrdered, name: "Fixed", order: [0, 1, 2, 3], note: "Locked seats" },
  { id: "auction", icon: Gavel, name: "Auction", order: [4, 1, 3, 0], note: "Top discount" },
  { id: "vote", icon: Vote, name: "Vote", order: [5, 2, 4, 1], note: "Majority" },
] as const

function RoundStrip() {
  const [modeId, setModeId] = useState<(typeof STRIP_MODES)[number]["id"]>("random")
  const mode = STRIP_MODES.find((m) => m.id === modeId) ?? STRIP_MODES[0]

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Preview a payout mode">
        {STRIP_MODES.map((m) => {
          const Icon = m.icon
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={modeId === m.id}
              onClick={() => setModeId(m.id)}
              className={
                modeId === m.id
                  ? "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-heading font-semibold text-white gradient-bg-extended"
                  : "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-heading font-medium text-muted-foreground glass-whisper hover:text-foreground transition-colors"
              }
            >
              <Icon className="h-4 w-4" />
              {m.name}
            </button>
          )
        })}
      </div>
      <div key={mode.id} className="mt-8 rounded-2xl border border-white/[0.08] bg-card p-6 md:p-8">
        <div className="space-y-3">
          {[0, 1, 2, 3].map((ri) => (
            <div key={ri} className="flex items-center gap-3">
              <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">R{ri + 1}</span>
              <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
                {LEDGER_MEMBERS.map((m, mi) => (
                  <MemberDot key={m} name={m} paid={mi === mode.order[ri]} isNext={false} />
                ))}
              </div>
              <span className="hidden sm:block w-28 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                {mode.note}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Same six savers, different rule. Full round-by-round simulation:
          </p>
          <Link
            href="/payout-modes"
            className="inline-flex items-center gap-2 text-sm font-heading font-semibold hover:opacity-80 transition-all"
          >
            Open the simulator <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Circle type list: static editorial rows ────────────────────────────────────
// One row per type: number, icon, name, copy, join line, deep link. No timers,
// no autoplay — every row is always visible and every link works first try.
const TYPE_ANCHORS: Record<string, string> = {
  "Public circles": "public",
  "Private circles": "private",
  "Community circles": "community",
  "Premium circles": "premium",
}

function CircleTypeList() {
  return (
    <div className="mt-10 overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.08]">
      {circleTypes.map((c, i) => {
        const Icon = c.icon
        const anchor = TYPE_ANCHORS[c.name] ?? ""
        return (
          <Link
            key={c.name}
            href={`/explore#${anchor}`}
            scroll={false}
            className="group flex flex-col sm:flex-row sm:items-center gap-5 p-6 md:p-8 border-b border-black/[0.06] dark:border-white/[0.06] last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
          >
            <span className="font-mono text-sm text-muted-foreground w-10 shrink-0">
              0{i + 1}
            </span>
            <span className="w-12 h-12 shrink-0 rounded-2xl gradient-bg-extended flex items-center justify-center text-white">
              <Icon className="h-5 w-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex flex-wrap items-center gap-3">
                <span className="font-heading text-lg md:text-xl font-semibold">{c.name}</span>
                <span className="rounded-full px-3 py-0.5 text-[11px] font-mono border border-white/10 text-muted-foreground">
                  {c.meta}
                </span>
              </span>
              <span className="block text-muted-foreground text-sm leading-relaxed mt-1">{c.desc}</span>
              <span className="block mt-1 text-[13px] text-foreground/80">{c.join}</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
          </Link>
        )
      })}
    </div>
  )
}

export function LandingContent() {
  const { t } = useTranslate()

  return (
    <>
      <div className="auroral-mesh min-h-screen">
        {/* ═══ HERO — left-aligned, zero-lag rotating word ═══ */}
        <section className="relative z-10 min-h-[92vh] flex flex-col justify-center overflow-hidden">
          {/* Compressed aurora backdrop (1280px, ~4KB): plain <img> so it
              paints on first paint with zero JS cost. object-cover lets the
              720p file fill any viewport — pure blur upscales invisibly.
              Dark theme only: light theme gets a clean pastel gradient. */}
          <img
            src="/images/hero-bg.webp"
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            decoding="async"
            className="pointer-events-none absolute inset-0 hidden h-full w-full object-cover dark:block"
          />
          {/* Dark scrim: deepens the mesh and keeps headline/CTA contrast
              high no matter where the aurora blobs land on wide viewports. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-black/60 via-black/10 to-black/30 dark:block"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-100 via-cyan-50 to-amber-50 dark:hidden"
          />
          <div
            aria-hidden="true"
            className="grain-overlay pointer-events-none absolute inset-0"
          />
          <div className="container-premium relative">
            <p className="font-heading text-xs tracking-[0.3em] uppercase text-muted-foreground mb-6">
              {t("landing.badge")}
            </p>
            <h1>
              <span className="font-display text-5xl md:text-7xl xl:text-8xl font-black tracking-tighter block">
                {t("landing.saveTogether")}
              </span>
              <RotatingGrow />
              <span className="font-display text-5xl md:text-7xl xl:text-8xl font-black tracking-tighter block gradient-text">
                {t("landing.together")}
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mt-8">{t("landing.heroDesc")}</p>

            {/* Dual CTAs: savers + organizers (sckoll two-sided pattern) */}
            <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                href={Routes.REGISTER}
                className="gradient-bg-premium h-14 px-10 rounded-2xl text-lg font-heading font-semibold text-white inline-flex items-center justify-center gap-2 holo-glow hover:opacity-90 transition-all shadow-[0_0_40px_rgb(var(--premium-gold)/0.25)]"
              >
                {t("landing.launchApp")} <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/explore"
                className="holo-border h-14 px-10 rounded-2xl text-lg font-heading font-medium text-foreground inline-flex items-center justify-center glass-strong hover:bg-white/[0.06] transition-all"
              >
                Explore circles
              </Link>
            </div>

            {/* Invite-code search (sckoll search-bar analog) */}
            <form
              className="mt-8 flex max-w-xl items-center gap-2"
              action="/invite"
              method="get"
              onSubmit={(e) => {
                const input = (e.currentTarget.elements as unknown as { code?: { value: string } })
                  .code
                if (!input?.value?.trim()) {
                  // Empty submit would GET /invite (no such route, only
                  // /invite/[code]) — stay put instead of 404ing.
                  e.preventDefault()
                  return
                }
                e.preventDefault()
                window.location.href = `/invite/${encodeURIComponent(input.value.trim())}`
              }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  name="code"
                  aria-label="Invite code"
                  required
                  placeholder="Have an invite code? Paste it here…"
                  className="h-12 w-full rounded-2xl glass-strong pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:holo-border"
                />
              </div>
              <button
                type="submit"
                className="h-12 shrink-0 rounded-2xl px-6 text-sm font-heading font-semibold glass-strong hover:bg-white/[0.06] transition-all"
              >
                Join
              </button>
            </form>

            {/* Settlement trust strip (arc.io logo-wall pattern) */}
            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                Settles on
              </span>
              <span className="flex items-center gap-2">
                <img src="/arc-logo.svg" alt="Arc" className="h-6 w-6" />
                <span className="font-heading font-bold tracking-tight">Arc</span>
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                USDC gas
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                Sub-second finality
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                Predictable fees
              </span>
            </div>
          </div>
        </section>

        <SectionRule />

        {/* ═══ TRUST STRIP (agentsdb stat-band pattern) ═══ */}
        <section className="relative z-10 border-y border-white/[0.06]">          <div className="container-premium grid grid-cols-2 gap-6 py-12 text-center sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="font-heading text-3xl md:text-4xl font-black tracking-tight gradient-text">
                  {s.value}
                </p>
                <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        <SectionRule />

        {/* ═══ CIRCLE TYPES — numbered index rows ═══ */}
        <section className="relative z-10 py-24 md:py-32 overflow-hidden">
          <div className="container-premium">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Find your circle</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-heading text-4xl md:text-5xl gradient-text-extended max-w-xl">
                Every kind of saver has a circle here.
              </h2>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 text-sm font-heading font-semibold hover:opacity-80 transition-all"
              >
                Browse all circles <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
          </div>
          <CircleTypeList />
        </section>

        <LedgerDivider caption="Round ledger — R1 → R5" />

        {/* ═══ PAYOUT — interactive round strip (no cards) ═══ */}
        <section className="relative z-10 border-t border-white/[0.06]">
          <div className="container-premium py-16 md:py-24">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Payout modes</p>
            <h2 className="mt-2 font-heading text-3xl md:text-4xl font-semibold tracking-tight max-w-2xl">
              Four rules. One ledger. Pick a mode, watch the rounds.
            </h2>
          </Reveal>
            <div className="mt-8">
              <RoundStrip />
            </div>
          </div>
        </section>

        <LedgerDivider caption="Round ledger — enforced on-chain" />

        {/* ═══ HOW IT WORKS — numbered flow (sckoll 01–05 pattern) ═══ */}
        <section className="relative z-10 py-24 md:py-32 border-t border-white/[0.06]">
          <div className="container-premium">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">How DEODES works</p>
            <h2 className="mt-2 font-heading text-4xl md:text-5xl gradient-text-extended max-w-3xl">
              From passkey to payout in five moves.
            </h2>
          </Reveal>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] md:grid-cols-5">
              {steps.map((s) => (
                <div key={s.n} className="bg-[rgb(var(--background))] p-6">
                  <p className="font-mono text-2xl font-bold gradient-text">{s.n}</p>
                  <h3 className="mt-4 font-heading font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ DEOSCORE BAND ═══ */}
        <section className="relative z-10 py-24 md:py-32 border-t border-white/[0.06]">
          <div className="container-premium grid gap-12 lg:grid-cols-2 lg:items-center">
            <Reveal>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">DeoScore reputation</p>
              <h2 className="mt-2 font-heading text-4xl md:text-5xl font-black tracking-tight">
                <span className="gradient-text">Good saving follows you.</span>
              </h2>
              <p className="mt-4 text-muted-foreground max-w-lg">
                Every on-time contribution builds a portable 0–1000 score on your wallet — across
                every circle and community. High scores unlock bigger circles and lower collateral.
              </p>
              <Link
                href="/deoscore"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-heading font-semibold glass-strong hover:bg-white/[0.06] transition-all"
              >
                <Trophy className="h-4 w-4" /> Check your DeoScore
              </Link>
            </div>
            </Reveal>
            <div className="space-y-4">
              {scoreWeights.map((w) => (
                <div key={w.label} className="glass-premium rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span>{w.label}</span>
                    <span className="font-mono font-bold gradient-text">{w.pct}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full gradient-bg-extended"
                      style={{ width: `${w.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <SectionRule />

        {/* ═══ TRUST — alternating Z rows (no cards) ═══ */}
        <section className="relative z-10 py-24 border-t border-white/[0.06]">
          <div className="container-premium">
          <Reveal className="text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
              The trust layer
            </p>
            <h2 className="mt-2 font-heading text-3xl md:text-4xl font-semibold tracking-tight">
              Move money without stepping into the dark.
            </h2>
          </Reveal>
            <div className="mt-12 space-y-10 max-w-4xl mx-auto">
              {trustItems.map((item, i) => {
                const Icon = item.icon
                const flip = i % 2 === 1
                return (
                  <div
                    key={item.title}
                    className={`flex flex-col sm:flex-row items-start gap-6 ${flip ? "sm:flex-row-reverse sm:text-right" : ""}`}
                  >
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl gradient-bg text-white">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="flex-1">
                      <span className="font-mono text-[11px] text-muted-foreground">0{i + 1}</span>
                      <h3 className="mt-1 font-heading text-xl md:text-2xl font-semibold">{item.title}</h3>
                      <p className="mt-2 text-muted-foreground leading-relaxed max-w-xl">{item.desc}</p>
                      <ul className="mt-4 space-y-2">
                        {item.points.map((p) => (
                          <li key={p} className="flex items-start gap-2.5 text-sm">
                            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-aurora-cyan" />
                            <span className="text-foreground/90">{p}</span>
                          </li>
                        ))}
                      </ul>
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4" /> Non-custodial by design
              </span>
              <span className="flex items-center gap-1.5">
                <Wallet className="h-4 w-4" /> USDC on Arc
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-4 w-4" /> Sub-cent settlement
              </span>
              <span className="flex items-center gap-1.5">
                <Award className="h-4 w-4" /> Portable DeoScore
              </span>
            </div>
          </div>
        </section>

        <SectionRule />

        {/* ═══ FINAL CTA — sckoll "simple by design" pattern, DEODES phrase ═══ */}
        <section className="relative z-10 py-24 text-center border-t border-white/[0.06]">
          <div className="container-premium">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Simple by design</p>
            <h2 className="mt-3 font-heading text-4xl md:text-6xl gradient-text-extended max-w-4xl mx-auto">
              Start with the circle. Stay for the momentum.
            </h2>
          </Reveal>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
              Join your first round, skip the bank queue, or organize savers without becoming a
              treasurer.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={Routes.REGISTER}
                className="gradient-bg-premium h-14 px-10 rounded-2xl text-lg font-heading font-semibold text-white inline-flex items-center justify-center gap-2 holo-glow hover:opacity-90 transition-all shadow-[0_0_40px_rgb(var(--premium-gold)/0.25)]"
              >
                Start saving free <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/contact"
                className="h-14 px-10 rounded-2xl text-lg font-heading font-medium inline-flex items-center justify-center glass-strong hover:bg-white/[0.06] transition-all"
              >
                Talk to the team
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
