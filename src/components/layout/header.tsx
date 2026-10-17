"use client";

import { memo, useEffect, useState } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  Bell,
} from "lucide-react";
import { useAppHost } from "@/hooks/use-app-host";
import { cn } from "@/lib/cn";
import { formatAddress } from "@/lib/formatters";
import { Routes } from "@/lib/constants";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { useUnreadCount } from "@/hooks/use-notifications";

interface HeaderProps {
  onToggleMobileMenu: () => void;
  isMobileMenuOpen: boolean;
}

function HeaderComponent({ onToggleMobileMenu, isMobileMenuOpen }: HeaderProps) {
  const unreadCount = useUnreadCount();
  const isAppHost = useAppHost();
  const [hostedAddress, setHostedAddress] = useState<string | null>(null);

  // Header pill shows the hosted wallet — the account's one true address.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { get } = await import("@/lib/api-client");
        const res = (await get("/wallets")) as Record<string, unknown>;
        const data = (res?.data as Record<string, unknown> | undefined) ?? res;
        const list = (data?.wallets ?? []) as { publicKey?: unknown; walletType?: unknown }[];
        const hosted = list.find((w) => w.walletType === "hosted");
        if (!cancelled && typeof hosted?.publicKey === "string") {
          setHostedAddress(hosted.publicKey);
        }
      } catch {
        // Pill simply stays hidden when the list is unreachable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <header
        className={cn(
          // `top-header-safe` replaces the former `top-3`: with
          // statusBarStyle=black-translucent the document starts underneath the
          // iOS status bar, so the bar's existing 0.75rem offset is added to
          // env(safe-area-inset-top) rather than standing in for it.
          "lg:hidden sticky top-header-safe mx-3 z-50 h-14",
          "rounded-2xl",
          "glass-strong backdrop-blur-2xl",
          "border border-white/[0.06] dark:border-white/[0.08]",
        )}
      >
        <div className="relative flex h-full items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 select-none">
              <span className="gradient-text-extended font-heading font-bold text-lg tracking-tight">
                Deodes
              </span>
              {isAppHost && (
                <span className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-widest text-white gradient-bg-extended">
                  APP
                </span>
              )}
            </Link>
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <LocaleSwitcher />

            <button
              type="button"
              onClick={onToggleMobileMenu}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-xl",
                "text-muted-foreground",
                "hover:text-foreground hover:glass-whisper",
                "lg:hidden",
              )}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-dashboard-menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <div>
              {hostedAddress ? (
                <Link
                  href="/wallet"
                  aria-label="View wallet"
                  className={cn(
                    "flex items-center gap-2 glass-whisper px-3 py-1.5 rounded-full",
                  )}
                >
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="font-mono text-xs text-foreground tracking-tight">
                    {formatAddress(hostedAddress)}
                  </span>
                </Link>
              ) : null}
            </div>

            <div>
              <Link href={Routes.NOTIFICATIONS} className="relative inline-flex" aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}>
                <div
                  className={cn(
                    "relative inline-flex h-9 w-9 items-center justify-center rounded-full",
                    "glass-whisper text-muted-foreground",
                    "hover:text-foreground",
                  )}
                >
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span
                      className={cn(
                        "absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full",
                        "bg-destructive text-[9px] font-bold flex items-center justify-center",
                        "text-white ring-2 ring-[rgb(var(--background))]",
                      )}
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
              </Link>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

export const Header = memo(HeaderComponent);
