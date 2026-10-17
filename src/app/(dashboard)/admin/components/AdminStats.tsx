"use client"

import { Users, CircleDot, Activity, Coins } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { AdminMetrics } from "@/hooks/use-admin"

interface AdminStatsProps {
  metrics: AdminMetrics | null | undefined
  loading: boolean
}

function formatVolume(value: number | undefined): string {
  if (value === undefined || value === null) return "—"
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

export function AdminStats({ metrics, loading }: AdminStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Loading platform stats">
        {[1, 2, 3, 4].map((n) => <Skeleton key={n} variant="card" className="h-28 rounded-xl" />)}
      </div>
    )
  }

  const cards = [
    { label: "Total users", value: String(metrics?.totalUsers ?? "—"), accent: "border-l-emerald-400", text: "text-emerald-400", icon: Users },
    { label: "Total circles", value: String(metrics?.totalCircles ?? "—"), accent: "border-l-aurora-violet", text: "text-aurora-violet", icon: CircleDot },
    { label: "Active circles", value: String(metrics?.activeCircles ?? "—"), accent: "border-l-amber-400", text: "text-amber-400", icon: Activity },
    { label: "Volume (USDC)", value: formatVolume(metrics?.totalVolumeUSD), accent: "border-l-emerald-400", text: "text-emerald-400", icon: Coins },
  ]

  return (
    <section aria-label="Platform stats">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className={`border border-border border-l-4 ${card.accent} bg-card px-4 py-4`}>
              <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                <Icon className="h-3.5 w-3.5" /> {card.label}
              </p>
              <p className={`mt-2 font-mono text-4xl font-black tabular-nums ${card.text}`}>
                {card.value}
              </p>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Secondary totals">
        {[
          `Contributions ${metrics?.totalContributions ?? "—"}`,
          `Payouts ${metrics?.totalPayouts ?? "—"}`,
          `Active users ${metrics?.activeUsers ?? "—"}`,
          `New (30d) ${metrics?.newUsers30d ?? "—"}`,
        ].map((pill) => (
          <span key={pill} className="rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
            {pill}
          </span>
        ))}
      </div>
    </section>
  )
}
