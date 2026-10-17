"use client"

import React, { useState, useDeferredValue } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { motion } from "framer-motion"
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from "lucide-react"
import { useCircles } from "@/hooks/use-circles"
import { useAuth } from "@/hooks/use-auth"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState, CircleListEmptyState } from "@/components/shared/empty-state"
import { Button, ButtonLink } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/cn"
import type { Currency } from "@/types"
import { useTranslate } from "@/lib/locale/context"
import { CircleBrowseCard } from "./components/circle-browse-card"
import { CirclesFilterBar } from "./components/circles-filter-bar"
import { SORT_OPTIONS } from "./components/circles-filter-options"

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

export default function CirclesBrowsePage() {
  const { t } = useTranslate()
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialType = searchParams.get("tab") || "all"

  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const [typeFilter, setTypeFilter] = useState(initialType)
  const [currencyFilter, setCurrencyFilter] = useState<Currency | null>(null)
  const [openOnly, setOpenOnly] = useState(true)
  const [sortValue, setSortValue] = useState("date-desc")
  const [page, setPage] = useState(1)
  // 3-col grid × 4 rows by design (backend honors any limit ≤ 100).
  const limit = 12

  const updateTypeFilter = (newType: string) => {
    setTypeFilter(newType)
    setPage(1)
    const params = new URLSearchParams(searchParams)
    if (newType === "all") {
      params.delete("tab")
    } else {
      params.set("tab", newType)
    }
    router.replace(`${pathname}?${params.toString()}`)
  }

  const selectedSort = SORT_OPTIONS.find((s) => s.value === sortValue) ?? SORT_OPTIONS[0]
  // "My Circles" is an organizer scope, not a circle_type — the API has no
  // membership filter, so resolve it to organizerId here. Anything else maps
  // straight to the backend `type` filter.
  const isMine = typeFilter === "my-circles"

  const filters = {
    search: deferredSearch || undefined,
    type: !isMine && typeFilter !== "all" ? typeFilter : undefined,
    organizerId: isMine ? user?.id : undefined,
    currency: currencyFilter ?? undefined,
    openOnly,
    sort: selectedSort.value,
    sortBy: selectedSort.sortBy,
    sortOrder: selectedSort.sortOrder,
    page,
    limit,
  }

  const { data, isLoading, isError, refetch } = useCircles(filters)
  const circles = data?.circles ?? []
  const meta = data?.meta

  const hasNext = meta ? meta.page < meta.totalPages : false
  const hasPrev = page > 1

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("circles.title")}
        description="Browse and join savings circles on the Arc network."
        action={
          <ButtonLink href="/circles/create" variant="premium" size="md" leftIcon={<Plus className="h-4 w-4" />}>
            {t("circles.create")}
          </ButtonLink>
        }
      />

      <div className="relative">
        <Input
          placeholder={t("circles.search")}
          leftIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>

      <CirclesFilterBar
        typeFilter={typeFilter}
        onTypeChange={updateTypeFilter}
        currencyFilter={currencyFilter}
        onCurrencyChange={(v) => {
          setCurrencyFilter(v)
          setPage(1)
        }}
        sortValue={sortValue}
        onSortChange={(v) => {
          setSortValue(v)
          setPage(1)
        }}
        openOnly={openOnly}
        onOpenOnlyChange={(v) => {
          setOpenOnly(v)
          setPage(1)
        }}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="Failed to load circles"
          description="Something went wrong. Please try again later."
          action={{
            label: "Retry",
            onClick: () => void refetch(),
          }}
        />
      ) : circles.length === 0 ? (
        <CircleListEmptyState
          onAction={() => router.push("/circles/create")}
        />
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {circles.map((circle) => (
            <CircleBrowseCard key={circle.id} circle={circle} moiScore={user?.moiScore} />
          ))}
        </motion.div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground font-body">
            Page {meta.page} of {meta.totalPages} ({meta.total} circles)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              leftIcon={<ChevronLeft className="h-4 w-4" />}
            >
              Previous
            </Button>
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: Math.min(meta.totalPages, 5) }).map((_, i) => {
                const pageNum = i + 1
                return (
                  <motion.button
                    key={pageNum}
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "w-8 h-8 rounded-full text-xs font-body font-medium transition-all",
                      meta.page === pageNum
                        ? "gradient-bg-extended text-white"
                        : "glass-whisper text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {pageNum}
                  </motion.button>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
              rightIcon={<ChevronRight className="h-4 w-4" />}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
