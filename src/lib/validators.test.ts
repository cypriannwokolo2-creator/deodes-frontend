import { describe, expect, it } from "vitest"
import {
  CIRCLE_LIMITS,
  SAVINGS_LIMITS,
  createCircleSchema,
  createGoalSchema,
  isFutureDateTime,
  isFutureYyyyMmDd,
  parseApiErrorMessage,
  parseApiFieldErrors,
  safeParse,
  validateGoalFormFields,
} from "./validators"

function tomorrowYmd(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function yesterdayYmd(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

describe("SAVINGS_LIMITS", () => {
  it("requires a min name length, a sane target max, and a note cap", () => {
    expect(SAVINGS_LIMITS.NAME_MIN).toBe(3)
    expect(SAVINGS_LIMITS.TARGET_MAX).toBe(1_000_000)
    expect(SAVINGS_LIMITS.NOTE_MAX).toBe(280)
  })
})

describe("validateGoalFormFields", () => {
  const valid = {
    name: "Emergency fund",
    target: "500",
    deadline: "",
    description: "buffer",
  }

  it("accepts a fully valid form", () => {
    expect(validateGoalFormFields(valid)).toEqual({})
  })

  it("requires a name of at least 3 characters", () => {
    expect(validateGoalFormFields({ ...valid, name: "" }).name).toMatch(/name/i)
    expect(validateGoalFormFields({ ...valid, name: "  " }).name).toBeDefined()
    expect(validateGoalFormFields({ ...valid, name: "AB" }).name).toContain("3")
    expect(validateGoalFormFields({ ...valid, name: "a".repeat(101) }).name).toContain("100")
  })

  it("requires a target above 0 with a sane max", () => {
    expect(validateGoalFormFields({ ...valid, target: "" }).target).toContain("0 USDC")
    expect(validateGoalFormFields({ ...valid, target: "0" }).target).toContain("0 USDC")
    expect(validateGoalFormFields({ ...valid, target: "-5" }).target).toContain("0 USDC")
    expect(validateGoalFormFields({ ...valid, target: "abc" }).target).toContain("0 USDC")
    expect(validateGoalFormFields({ ...valid, target: "1000001" }).target).toContain("1,000,000")
    expect(validateGoalFormFields({ ...valid, target: "1000000" }).target).toBeUndefined()
  })

  it("requires the deadline to be a valid future date", () => {
    expect(validateGoalFormFields({ ...valid, deadline: "not-a-date" }).deadline).toContain(
      "YYYY-MM-DD",
    )
    expect(validateGoalFormFields({ ...valid, deadline: yesterdayYmd() }).deadline).toContain(
      "future",
    )
    expect(
      validateGoalFormFields({ ...valid, deadline: tomorrowYmd() }).deadline,
    ).toBeUndefined()
  })

  it("caps the note length", () => {
    expect(
      validateGoalFormFields({ ...valid, description: "a".repeat(281) }).description,
    ).toContain("280")
  })
})

describe("createGoalSchema", () => {
  it("accepts a valid payload", () => {
    const result = safeParse(createGoalSchema, {
      name: "Emergency fund",
      targetAmount: 500,
      targetDate: null,
    })
    expect(result.success).toBe(true)
  })

  it("rejects short names, bad targets, past deadlines, and long notes", () => {
    expect(
      safeParse(createGoalSchema, { name: "AB", targetAmount: 10 }).success,
    ).toBe(false)
    expect(
      safeParse(createGoalSchema, { name: "Valid name", targetAmount: 0 }).success,
    ).toBe(false)
    expect(
      safeParse(createGoalSchema, { name: "Valid name", targetAmount: 2_000_000 }).success,
    ).toBe(false)
    const past = safeParse(createGoalSchema, {
      name: "Valid name",
      targetAmount: 10,
      targetDate: yesterdayYmd(),
    })
    expect(past.success).toBe(false)
    if (!past.success) expect(past.errors.targetDate).toContain("future")
  })
})

describe("isFutureYyyyMmDd / isFutureDateTime", () => {
  it("distinguishes past from future dates", () => {
    expect(isFutureYyyyMmDd(tomorrowYmd())).toBe(true)
    expect(isFutureYyyyMmDd(yesterdayYmd())).toBe(false)
    expect(isFutureYyyyMmDd("not-a-date")).toBe(false)
    expect(isFutureDateTime(new Date(Date.now() + 60_000).toISOString())).toBe(true)
    expect(isFutureDateTime(new Date(Date.now() - 60_000).toISOString())).toBe(false)
    expect(isFutureDateTime("garbage")).toBe(false)
  })
})

describe("createCircleSchema", () => {
  const valid = {
    name: "My Savings Circle",
    circleType: "public",
    payoutType: "random",
    contributionAmount: 100,
    currency: "USDC",
    frequency: "monthly",
    maxMembers: 10,
    lateFeePercent: 5,
    gracePeriodHours: 24,
    maxStrikes: 3,
    autoDebit: false,
  }

  it("accepts a valid payload", () => {
    expect(safeParse(createCircleSchema, valid).success).toBe(true)
  })

  it("enforces name/description lengths", () => {
    const short = safeParse(createCircleSchema, { ...valid, name: "AB" })
    expect(short.success).toBe(false)
    const longDesc = safeParse(createCircleSchema, {
      ...valid,
      description: "a".repeat(CIRCLE_LIMITS.DESCRIPTION_MAX + 1),
    })
    expect(longDesc.success).toBe(false)
  })

  it("requires contribution > 0 with a max", () => {
    expect(safeParse(createCircleSchema, { ...valid, contributionAmount: 0 }).success).toBe(false)
    expect(safeParse(createCircleSchema, { ...valid, contributionAmount: -1 }).success).toBe(false)
    const over = safeParse(createCircleSchema, {
      ...valid,
      contributionAmount: CIRCLE_LIMITS.CONTRIBUTION_MAX + 1,
    })
    expect(over.success).toBe(false)
  })

  it("fixes currency to USDC", () => {
    const nonUsdc = safeParse(createCircleSchema, { ...valid, currency: "EUR" })
    expect(nonUsdc.success).toBe(false)
    if (!nonUsdc.success) expect(nonUsdc.errors.currency).toContain("USDC")
  })

  it("bounds members, scores, fees, grace, and strikes", () => {
    expect(safeParse(createCircleSchema, { ...valid, maxMembers: 1 }).success).toBe(false)
    expect(safeParse(createCircleSchema, { ...valid, maxMembers: 101 }).success).toBe(false)
    expect(safeParse(createCircleSchema, { ...valid, maxMembers: 2.5 }).success).toBe(false)
    expect(safeParse(createCircleSchema, { ...valid, minMoiScore: 1001 }).success).toBe(false)
    expect(safeParse(createCircleSchema, { ...valid, collateralPercent: 101 }).success).toBe(false)
    expect(safeParse(createCircleSchema, { ...valid, lateFeePercent: 51 }).success).toBe(false)
    expect(safeParse(createCircleSchema, { ...valid, gracePeriodHours: 0 }).success).toBe(false)
    expect(safeParse(createCircleSchema, { ...valid, gracePeriodHours: 169 }).success).toBe(false)
    expect(safeParse(createCircleSchema, { ...valid, maxStrikes: 0 }).success).toBe(false)
    expect(safeParse(createCircleSchema, { ...valid, maxStrikes: 11 }).success).toBe(false)
  })

  it("requires a valid future start date when provided", () => {
    const past = safeParse(createCircleSchema, {
      ...valid,
      startDate: new Date(Date.now() - 86_400_000).toISOString(),
    })
    expect(past.success).toBe(false)
    const future = safeParse(createCircleSchema, {
      ...valid,
      startDate: new Date(Date.now() + 86_400_000).toISOString(),
    })
    expect(future.success).toBe(true)
    expect(safeParse(createCircleSchema, { ...valid, startDate: "" }).success).toBe(true)
  })
})

describe("parseApiFieldErrors / parseApiErrorMessage", () => {
  it("reads array-style details", () => {
    const err = {
      response: { data: { details: [{ field: "name", message: "Too short" }] } },
    }
    expect(parseApiFieldErrors(err)).toEqual({ name: "Too short" })
  })

  it("reads map-style details and nested data envelopes", () => {
    const err = {
      response: { data: { data: null, details: { targetAmount: "Must be positive" } } },
    }
    expect(parseApiFieldErrors(err)).toEqual({ targetAmount: "Must be positive" })
  })

  it("returns {} for unknown shapes", () => {
    expect(parseApiFieldErrors(new Error("boom"))).toEqual({})
    expect(parseApiFieldErrors(null)).toEqual({})
  })

  it("prefers envelope messages with a fallback", () => {
    expect(
      parseApiErrorMessage({ response: { data: { message: "Bad input" } } }, "fallback"),
    ).toBe("Bad input")
    expect(parseApiErrorMessage(new Error("plain"), "fallback")).toBe("plain")
    expect(parseApiErrorMessage({}, "fallback")).toBe("fallback")
  })
})
