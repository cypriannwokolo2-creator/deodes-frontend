"use client"

import { useQuery } from "@tanstack/react-query"
import { Trophy } from "lucide-react"
import { get } from "@/lib/api-client"
import { displayNameOf, avatarInitialOf } from "@/lib/profile/names"

interface Leader {
  userId: string
  username?: string | null
  displayName?: string | null
  score: number
  level: string
}

const MEDAL = ["text-amber-400", "text-slate-300", "text-amber-700"] as const

export function Leaderboard() {
  const { data: leaders = [], isLoading } = useQuery({
    queryKey: ["reputation-leaderboard"],
    queryFn: async () => {
      const res = await get<{ leaders?: Leader[] } | Leader[]>("/reputation/leaderboard?limit=10")
      if (Array.isArray(res)) return res
      return (res as { leaders?: Leader[] })?.leaders ?? []
    },
    staleTime: 300_000,
  })

  return (
    <section aria-label="DeoScore leaderboard" className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-400" />
        <h2 className="font-heading text-lg font-bold text-foreground">Top DeoScores</h2>
      </div>
      {isLoading ? (
        <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
      ) : leaders.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-white/10 p-6 text-center">
          No ranked members yet — scores appear after the first contributions settle.
        </p>
      ) : (
        <ol className="divide-y divide-white/[0.06] rounded-2xl border border-white/10 overflow-hidden">
          {leaders.map((entry, i) => (
            <li key={entry.userId} className="flex items-center gap-4 px-5 py-3.5">
              <span className={`font-mono text-sm font-bold w-6 ${MEDAL[i] ?? "text-muted-foreground"}`}>
                {i + 1}
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-aurora-violet/15 font-heading text-sm font-bold text-aurora-violet shrink-0">
                {avatarInitialOf(entry)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {displayNameOf(entry) ?? "Circle member"}
                </p>
                <p className="text-xs text-muted-foreground capitalize">{entry.level}</p>
              </div>
              <span className="font-mono text-sm font-bold text-foreground">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
