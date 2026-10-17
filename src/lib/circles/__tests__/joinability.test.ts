import { describe, expect, it } from "vitest"
import {
  getJoinBlockMessage,
  getJoinBlockReason,
  isFull,
  isJoinable,
  meetsScore,
  needsInvite,
  requiredScore,
} from "@/lib/circles/joinability"
import type { Circle } from "@/types"

function circle(overrides: Partial<Circle> = {}): Circle {
  return {
    id: "c1",
    name: "Open Savers",
    description: null,
    circleType: "public",
    payoutType: "fixed",
    contributionAmount: 25,
    currency: "USDC",
    frequency: "weekly",
    maxMembers: 10,
    minMoiScore: 0,
    collateralPercent: 0,
    lateFeePercent: 5,
    gracePeriodHours: 24,
    maxStrikes: 3,
    autoDebit: false,
    requiresInvite: false,
    status: "pending",
    currentRound: 0,
    totalContributions: 0,
    organizerId: "org-1",
    memberCount: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("requiredScore", () => {
  it("is the circle floor for public circles", () => {
    expect(requiredScore(circle({ minMoiScore: 100 }))).toBe(100)
  })

  it("floors premium circles at 50 even with no minMoiScore", () => {
    expect(requiredScore(circle({ circleType: "premium", minMoiScore: 0 }))).toBe(50)
  })

  it("takes the max of the premium floor and the circle floor", () => {
    expect(requiredScore(circle({ circleType: "premium", minMoiScore: 600 }))).toBe(600)
  })
})

describe("needsInvite / isFull / meetsScore", () => {
  it("flags private circles regardless of the invite flag", () => {
    expect(needsInvite(circle({ circleType: "private" }))).toBe(true)
  })

  it("flags public circles with requiresInvite set", () => {
    expect(needsInvite(circle({ requiresInvite: true }))).toBe(true)
  })

  it("does not flag open public circles", () => {
    expect(needsInvite(circle())).toBe(false)
  })

  it("is full exactly at capacity", () => {
    expect(isFull(circle({ memberCount: 10, maxMembers: 10 }))).toBe(true)
    expect(isFull(circle({ memberCount: 9, maxMembers: 10 }))).toBe(false)
  })

  it("treats a missing score as 0", () => {
    expect(meetsScore(circle({ minMoiScore: 10 }), undefined)).toBe(false)
    expect(meetsScore(circle({ minMoiScore: 0 }), undefined)).toBe(true)
  })
})

describe("getJoinBlockReason", () => {
  it("is null for an open public circle", () => {
    expect(getJoinBlockReason(circle(), { moiScore: 0 })).toBeNull()
    expect(isJoinable(circle(), { moiScore: 0 })).toBe(true)
  })

  it("blocks ended statuses first", () => {
    for (const status of ["completed", "cancelled", "disputed"] as const) {
      expect(getJoinBlockReason(circle({ status }), { moiScore: 999 })).toBe("ended")
    }
  })

  it("blocks legacy-rail circles even when open", () => {
    // Legacy rows from before the USDC-only migration carry a non-USDC code.
    expect(getJoinBlockReason(circle({ currency: "EUR" as never }), { moiScore: 999 })).toBe(
      "legacy-rail",
    )
  })

  it("blocks full circles before the score check", () => {
    const c = circle({ memberCount: 10, minMoiScore: 500 })
    expect(getJoinBlockReason(c, { moiScore: 0 })).toBe("full")
  })

  it("blocks invite-only circles for the direct-join path", () => {
    expect(getJoinBlockReason(circle({ circleType: "private" }), { moiScore: 999 })).toBe(
      "invite-only",
    )
  })

  it("blocks low DeoScore with the circle floor", () => {
    expect(getJoinBlockReason(circle({ minMoiScore: 100 }), { moiScore: 20 })).toBe("score")
  })

  it("blocks premium below the 50 floor", () => {
    const c = circle({ circleType: "premium", minMoiScore: 0 })
    expect(getJoinBlockReason(c, { moiScore: 49 })).toBe("score")
    expect(getJoinBlockReason(c, { moiScore: 50 })).toBeNull()
  })

  it("reports already-member before anything else", () => {
    const c = circle({ status: "completed", memberCount: 10 })
    expect(getJoinBlockReason(c, { isMember: true })).toBe("already-member")
  })

  it("honours a fresher roster count override", () => {
    const c = circle({ memberCount: 10 })
    expect(getJoinBlockReason(c, { memberCount: 4, moiScore: 0 })).toBeNull()
  })
})

describe("getJoinBlockMessage", () => {
  it("names the score gap with have/need figures", () => {
    const msg = getJoinBlockMessage("score", circle({ minMoiScore: 100 }), { moiScore: 20 })
    expect(msg).toMatch(/DeoScore 100/)
    expect(msg).toMatch(/you have 20/)
  })

  it("states seats for full circles", () => {
    const msg = getJoinBlockMessage("full", circle({ memberCount: 10, maxMembers: 10 }), {})
    expect(msg).toMatch(/full \(10\/10\)/)
  })

  it("points invite-only viewers at the organizer", () => {
    expect(getJoinBlockMessage("invite-only", circle(), {})).toMatch(/invite code/i)
  })

  it("is empty when joinable", () => {
    expect(getJoinBlockMessage(null, circle(), {})).toBe("")
  })
})
