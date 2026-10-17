"use client"

import dynamic from "next/dynamic"
import { useEffect } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { PublicLayout } from "@/components/layout/public-layout"
import { LandingHeroSkeleton } from "@/components/skeletons"
import { DashboardSkeleton } from "@/components/skeletons"
import { isApexHost, redirectToApp } from "@/lib/app-host"

const LandingContent = dynamic(
  () => import("@/components/landing/landing-content").then((m) => m.LandingContent),
  {
    ssr: true,
    // Without this, the resolved-auth tree renders an empty shell while the
    // landing chunk downloads — the footer jumps to the top on slow networks.
    loading: () => (
      <PublicLayout>
        <LandingHeroSkeleton />
      </PublicLayout>
    ),
  }
)

const DashboardLayout = dynamic(
  () => import("@/components/layout/dashboard-layout").then((m) => m.DashboardLayout),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen" aria-busy="true" aria-label="Loading" />
    ),
  }
)

const DashboardContent = dynamic(
  () => import("@/components/dashboard/dashboard-content").then((m) => m.DashboardContent),
  {
    ssr: false,
    loading: () => <DashboardSkeleton />,
  }
)

export function HomeContent({ isAppHost = false }: { isAppHost?: boolean }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)
  const token = useAuthStore((s) => s.token)

  // App host never shows marketing: loading, token-pending, or even the
  // (middleware-should-have-redirected) resolved-unauthenticated state all
  // render the dashboard shell. Landing belongs to the apex host only.
  if (isAppHost) {
    if (isAuthenticated) {
      return (
        <DashboardLayout>
          <DashboardContent />
        </DashboardLayout>
      )
    }
    return (
      <DashboardLayout>
        <DashboardSkeleton />
      </DashboardLayout>
    )
  }

  // If we have a token but auth hasn't resolved yet, hold the dashboard-shaped
  // shell instead of nothing — collapsing to zero height is what flashed the
  // footer to the top of the viewport on slow loads.
  if (token && isLoading) {
    return (
      <DashboardLayout>
        <DashboardSkeleton />
      </DashboardLayout>
    )
  }

  // Auth resolved and user is authenticated. The dashboard lives on the
  // app host only: apex renders a holding skeleton while the hard
  // navigation to app.deodes.com completes (middleware covers full page
  // loads; this covers client-side auth transitions that never hit it).
  useEffect(() => {
    if (isAuthenticated && !isAppHost && isApexHost()) {
      redirectToApp(window.location.pathname + window.location.search)
    }
  }, [isAuthenticated, isAppHost])

  if (isAuthenticated) {
    if (!isAppHost && typeof window !== "undefined" && isApexHost()) {
      return (
        <DashboardLayout>
          <DashboardSkeleton />
        </DashboardLayout>
      )
    }
    return (
      <DashboardLayout>
        <DashboardContent />
      </DashboardLayout>
    )
  }

  // Auth resolved and user is NOT authenticated — only then show landing page
  if (!isLoading) {
    return (
      <PublicLayout>
        <LandingContent />
      </PublicLayout>
    )
  }

  // Still loading with no token — hold the hero-shaped shell so the footer
  // stays below the fold instead of jumping to the top.
  return (
    <PublicLayout>
      <LandingHeroSkeleton />
    </PublicLayout>
  )
}
