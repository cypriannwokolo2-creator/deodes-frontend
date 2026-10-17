"use client"

import { useEffect, useState } from "react"
import { get } from "@/lib/api-client"
import { logger } from "@/lib/logger"

/**
 * Balance shape from GET /wallets/balance. USDC on Arc (18 decimals, gas
 * token) is the only asset the wallet displays.
 */
export interface BalanceInfo {
  usdc: string
}

export interface HostedWalletInfo {
  publicKey: string
  walletType?: string
}

export interface ActivityItem {
  id: string
  type: "sent" | "received"
  amount: number
  description: string
  createdAt: string
  txnHash?: string
}

interface ContributionRow {
  id: string
  amount: number
  createdAt: string
  txnHash?: string
}

interface Overview {
  balance: BalanceInfo | null
  transactions: ActivityItem[]
  hostedWallet: HostedWalletInfo | null
  loading: boolean
}

/** Single data source for the wallet page: hosted wallet, balance, activity. */
export function useWalletOverview(): Overview {
  const [balance, setBalance] = useState<BalanceInfo | null>(null)
  const [transactions, setTransactions] = useState<ActivityItem[]>([])
  const [hostedWallet, setHostedWallet] = useState<HostedWalletInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [balanceRes, contribRes, payoutRes] = await Promise.allSettled([
          get("/wallets/balance"),
          get("/contributions?limit=5"),
          get("/payouts?limit=5"),
        ])
        if (cancelled) return
        if (balanceRes.status === "fulfilled") {
          const raw = balanceRes.value as Record<string, unknown>
          const data = (raw?.data as Record<string, unknown> | undefined) ?? raw
          setBalance((data?.balance ?? {}) as BalanceInfo)
        }
        const all: ActivityItem[] = []
        if (contribRes.status === "fulfilled") {
          const raw = contribRes.value as Record<string, unknown>
          const data = (raw?.data as Record<string, unknown> | undefined) ?? raw
          const list = (data?.contributions ?? []) as ContributionRow[]
          list.forEach((c) => {
            all.push({ id: `c-${c.id}`, type: "sent", amount: c.amount, description: "Contribution", createdAt: c.createdAt, txnHash: c.txnHash })
          })
        }
        if (payoutRes.status === "fulfilled") {
          const raw = payoutRes.value as Record<string, unknown>
          const data = (raw?.data as Record<string, unknown> | undefined) ?? raw
          const list = (data?.payouts ?? []) as ContributionRow[]
          list.forEach((p) => {
            all.push({ id: `p-${p.id}`, type: "received", amount: p.amount, description: "Payout", createdAt: p.createdAt, txnHash: p.txnHash })
          })
        }
        all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setTransactions(all.slice(0, 10))
      } catch (e) {
        logger.error("[wallet] Failed to load wallet data:", e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    // Hosted Arc wallet always exists after ensure — prefer it over legacy entries.
    get("/wallets")
      .then((res) => {
        if (cancelled) return
        const raw = res as Record<string, unknown>
        const data = (raw?.data as Record<string, unknown> | undefined) ?? raw
        const list = (data?.wallets ?? []) as HostedWalletInfo[]
        const hosted = list.find((w) => w.walletType === "hosted")
        setHostedWallet(hosted ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return {
    balance,
    transactions,
    hostedWallet,
    loading,
  }
}
