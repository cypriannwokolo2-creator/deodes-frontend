"use client"

import { formatAddress } from "@/lib/formatters"
import type { AdminUser } from "@/hooks/use-admin"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1">
      <span className="w-28 shrink-0 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1 text-sm text-foreground">{children}</div>
    </div>
  )
}

/** Identity, contact and security rows for the admin user detail panel. */
export function AdminUserProfile({ user }: { user: AdminUser }) {
  return (
    <>
      <Row label="Account">
        {user.displayName ?? formatAddress(user.walletAddress)}{" "}
        <span className="font-mono text-xs text-muted-foreground">
          · {user.role ?? "user"} · DeoScore {user.moiScore ?? "—"}
          {user.username ? ` · @${user.username}` : ""}
        </span>
      </Row>
      <Row label="Contact">
        {[user.email, user.phone].filter(Boolean).join(" · ") || (
          <span className="text-muted-foreground">No email or phone on file</span>
        )}
        {user.countryCode ? (
          <span className="font-mono text-xs text-muted-foreground"> · {user.countryCode}</span>
        ) : null}
      </Row>
      <Row label="Security">
        <span className="font-mono text-xs">
          2FA {user.totpEnabled ? "on" : "off"} · email {user.emailVerified ? "verified" : "unverified"} · session {user.sessionTtlMinutes ?? "—"}m
        </span>
      </Row>
      <Row label="Joined">
        <span className="font-mono text-xs">
          {user.createdAt ? new Date(user.createdAt).toLocaleString() : "—"}
        </span>
        <span className="truncate font-mono text-xs text-muted-foreground"> · {user.id}</span>
      </Row>
    </>
  )
}
