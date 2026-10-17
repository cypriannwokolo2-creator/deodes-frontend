"use client"

import { ExternalLink } from "lucide-react"
import { CopyButton } from "@/components/shared/copy-button"
import { getSmartExplorerAddressUrl } from "@/lib/explorer"
import { formatAddress } from "@/lib/formatters"
import { cn } from "@/lib/cn"

interface CustodyBadgeProps {
  hostedAddress: string | null
  loading: boolean
  onCopied: () => void
  onCopyError: () => void
}

/**
 * Custody badge: one account, one hosted Deodes wallet. Shows the hosted
 * address with copy plus an Arc explorer link.
 */
export function CustodyBadge({
  hostedAddress,
  loading,
  onCopied,
  onCopyError,
}: CustodyBadgeProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-6 w-44 animate-pulse rounded-full bg-white/10" />
      </div>
    )
  }

  const address = hostedAddress
  if (!address) return null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-heading font-semibold",
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        )}
      >
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full", "bg-emerald-400")}
        />
        Hosted Deodes wallet
      </span>
      <CopyButton
        text={address}
        label={formatAddress(address)}
        fullText={address}
        onCopied={onCopied}
        onError={onCopyError}
      />
      <a
        href={getSmartExplorerAddressUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View wallet address in Arc explorer"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Arc explorer
      </a>
    </div>
  )
}
