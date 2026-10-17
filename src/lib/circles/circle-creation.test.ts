import { describe, expect, it } from "vitest"
import {
  formatSubmitErrors,
  initialCircleForm,
  validateCircleStep,
} from "./circle-creation"

function futureIso(): string {
  const d = new Date(Date.now() + 86_400_000)
  // datetime-local shape, as stored in form state before buildCircleFormData
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function pastIso(): string {
  const d = new Date(Date.now() - 86_400_000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

describe("validateCircleStep — step 1 (Details)", () => {
  it("requires a name of 3–100 characters", () => {
    expect(validateCircleStep(1, initialCircleForm(), 500).errors.name).toBeDefined()
    expect(
      validateCircleStep(1, { ...initialCircleForm(), name: "AB" }, 500).errors.name,
    ).toContain("3")
    expect(
      validateCircleStep(1, { ...initialCircleForm(), name: "a".repeat(101) }, 500).errors.name,
    ).toContain("100")
    expect(
      validateCircleStep(1, { ...initialCircleForm(), name: "Valid Name" }, 500).success,
    ).toBe(true)
  })

  it("caps description at 500 characters", () => {
    const result = validateCircleStep(
      1,
      { ...initialCircleForm(), name: "Valid Name", description: "a".repeat(501) },
      500,
    )
    expect(result.success).toBe(false)
    expect(result.errors.description).toContain("500")
  })

  it("bounds maxMembers to whole numbers 2–100", () => {
    const base = { ...initialCircleForm(), name: "Valid Name" }
    expect(validateCircleStep(1, { ...base, maxMembers: 1 }, 500).errors.maxMembers).toBeDefined()
    expect(validateCircleStep(1, { ...base, maxMembers: 101 }, 500).errors.maxMembers).toBeDefined()
    expect(
      validateCircleStep(1, { ...base, maxMembers: 2.5 }, 500).errors.maxMembers,
    ).toBeDefined()
    expect(validateCircleStep(1, { ...base, maxMembers: 100 }, 500).success).toBe(true)
  })

  it("requires a valid future start date when set", () => {
    const base = { ...initialCircleForm(), name: "Valid Name" }
    expect(
      validateCircleStep(1, { ...base, startDate: "not-a-date" }, 500).errors.startDate,
    ).toBeDefined()
    expect(validateCircleStep(1, { ...base, startDate: pastIso() }, 500).errors.startDate).toContain(
      "future",
    )
    expect(validateCircleStep(1, { ...base, startDate: futureIso() }, 500).success).toBe(true)
    expect(validateCircleStep(1, { ...base, startDate: "" }, 500).success).toBe(true)
  })

  it("collects every step-1 error instead of stopping at the first", () => {
    const result = validateCircleStep(
      1,
      { ...initialCircleForm(), name: "x", maxMembers: 1, startDate: pastIso() },
      500,
    )
    expect(result.success).toBe(false)
    expect(result.errors.name).toBeDefined()
    expect(result.errors.maxMembers).toBeDefined()
    expect(result.errors.startDate).toBeDefined()
  })
})

describe("validateCircleStep — step 2 (Financials)", () => {
  const base = { ...initialCircleForm(), name: "Valid Name" }

  it("requires contribution > 0 with a max", () => {
    expect(
      validateCircleStep(2, { ...base, contributionAmount: 0 }, 500).errors.contributionAmount,
    ).toBeDefined()
    expect(
      validateCircleStep(2, { ...base, contributionAmount: -5 }, 500).errors.contributionAmount,
    ).toBeDefined()
    expect(
      validateCircleStep(2, { ...base, contributionAmount: 1_000_001 }, 500).errors
        .contributionAmount,
    ).toContain("1,000,000")
    expect(validateCircleStep(2, { ...base, contributionAmount: 100 }, 500).success).toBe(true)
  })

  it("fixes currency to USDC", () => {
    const result = validateCircleStep(
      2,
      { ...base, contributionAmount: 100, currency: "EUR" as never },
      500,
    )
    expect(result.success).toBe(false)
    expect(result.errors.currency).toContain("USDC")
  })

  it("bounds late fee, grace period, and strikes", () => {
    expect(
      validateCircleStep(2, { ...base, lateFeePercent: 51 }, 500).errors.lateFeePercent,
    ).toBeDefined()
    expect(
      validateCircleStep(2, { ...base, gracePeriodHours: 0 }, 500).errors.gracePeriodHours,
    ).toBeDefined()
    expect(validateCircleStep(2, { ...base, gracePeriodHours: 169 }, 500).errors.gracePeriodHours).toBeDefined()
    expect(validateCircleStep(2, { ...base, maxStrikes: 0 }, 500).errors.maxStrikes).toBeDefined()
    expect(validateCircleStep(2, { ...base, maxStrikes: 11 }, 500).errors.maxStrikes).toBeDefined()
  })
})

describe("validateCircleStep — step 3 (Payout)", () => {
  it("bounds collateral and min DeoScore", () => {
    expect(
      validateCircleStep(3, { ...initialCircleForm(), collateralPercent: 101 }, 500).errors
        .collateralPercent,
    ).toBeDefined()
    expect(
      validateCircleStep(3, { ...initialCircleForm(), collateralPercent: -1 }, 500).errors
        .collateralPercent,
    ).toBeDefined()
    expect(
      validateCircleStep(3, { ...initialCircleForm(), minMoiScore: 1001 }, 500).errors.minMoiScore,
    ).toBeDefined()
    expect(
      validateCircleStep(3, { ...initialCircleForm(), minMoiScore: 1.5 }, 500).errors.minMoiScore,
    ).toBeDefined()
    expect(validateCircleStep(3, initialCircleForm(), 500).success).toBe(true)
  })
})

describe("validateCircleStep — step 4 (Review)", () => {
  it("returns field errors plus a readable submit summary", () => {
    const result = validateCircleStep(4, initialCircleForm(), 500)
    expect(result.success).toBe(false)
    expect(result.errors.name).toBeDefined()
    expect(result.errors.submit).toContain("name")
  })

  it("passes with fully valid form data", () => {
    const data = {
      ...initialCircleForm(),
      name: "My Savings Circle",
      contributionAmount: 100,
      maxMembers: 5,
    }
    expect(validateCircleStep(4, data, 500).success).toBe(true)
  })
})

describe("formatSubmitErrors", () => {
  it("joins field errors into a one-liner and handles empty input", () => {
    expect(formatSubmitErrors({})).toContain("highlighted fields")
    expect(formatSubmitErrors({ name: "Too short" })).toContain("name: Too short")
  })
})
