"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CircleAlert, Copy, Check, Gift } from "lucide-react";
import { get, post, getErrorMessage } from "@/lib/api-client";
import { logger } from "@/lib/logger";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/clipboard";

interface ReferralStats {
  totalReferrals: number;
  totalEarned: number;
  totalClaimed: number;
  pendingAmount: number;
}

interface Referral {
  id: string;
  referralCode: string;
  status: string;
  createdAt: string;
  completedAt?: string | null;
}

export default function ReferralsPage() {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const [codeRes, statsRes, historyRes] = await Promise.all([
        post<{ referralCode?: string } | { data?: { referralCode?: string } }>("/referral/code", {}).catch(() => null),
        get<{ totalReferrals?: number; totalEarned?: number; totalClaimed?: number; pendingAmount?: number } | { data?: ReferralStats }>("/referral/stats"),
        get<{ referrals?: Referral[] } | { data?: { referrals?: Referral[] } }>("/referral/history"),
      ]);
      const c = codeRes as { referralCode?: string; data?: { referralCode?: string } } | null;
      setCode(c?.referralCode ?? c?.data?.referralCode ?? null);
      const s = statsRes as ReferralStats & { data?: ReferralStats };
      setStats(s?.data ?? (s as ReferralStats));
      const h = historyRes as { referrals?: Referral[]; data?: { referrals?: Referral[] } };
      setReferrals(h?.referrals ?? h?.data?.referrals ?? []);
    } catch (e) {
      logger.error("[referrals] Failed to load:", e);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const inviteLink = code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${encodeURIComponent(code)}`
    : "";

  const handleCopy = useCallback(async () => {
    if (!inviteLink) return;
    if (await copyToClipboard(inviteLink)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Could not copy link");
    }
  }, [inviteLink, toast]);

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="referrals-loading">
        <Skeleton variant="heading" width="40%" height={40} />
        <Skeleton variant="rectangular" height={180} />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<CircleAlert />}
        title="Failed to load referrals"
        description="Unable to load your referral statistics and invited users."
        action={{
          label: "Retry",
          onClick: () => void load(),
        }}
        className="border border-red-400/20"
      />
    );
  }

  return (
    <div className="space-y-8" data-testid="referrals-page">
      <PageHeader
        title="Referrals & Rewards"
        description="Invite friends to Deodes and earn protocol rewards."
      />

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Referrals", value: String(stats.totalReferrals ?? 0) },
            { label: "Earned", value: String(stats.totalEarned ?? 0) },
            { label: "Claimed", value: String(stats.totalClaimed ?? 0) },
            { label: "Pending", value: String(stats.pendingAmount ?? 0) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="font-heading text-2xl font-bold text-foreground mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Invite link */}
      <div className="rounded-2xl border border-aurora-violet/30 border-dashed p-6 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aurora-violet/15 text-aurora-violet shrink-0">
          <Gift className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Your invite link</p>
          <p className="text-xs font-mono text-muted-foreground truncate">{inviteLink || "…"}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!inviteLink}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/[0.05] disabled:opacity-50"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy Invite Link"}
        </button>
      </div>

      {/* History */}
      {referrals.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No referrals yet"
          description="Share your unique invite link with friends and community members to earn bonuses when they join circles."
          className="border border-dashed border-aurora-violet/30"
        />
      ) : (
        <div className="space-y-2">
          {referrals.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/[0.08] p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-mono text-foreground">{r.referralCode}</p>
                <p className="text-xs text-muted-foreground">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  r.status === "completed"
                    ? "text-emerald-400 bg-emerald-500/10"
                    : "text-amber-400 bg-amber-500/10"
                }`}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
