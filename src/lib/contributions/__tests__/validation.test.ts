import { describe, expect, it } from "vitest";
import {
  buildContributionIntentMessage,
  isArcAddress,
  isArcTxHash,
  toWeiHex,
  unwrapContributionResponse,
  validateArcAddress,
  validateArcTxHash,
  validateContributeInput,
  validateContributionAmount,
  validateCurrency,
  validateRoundNumber,
} from "../validation";

const ADDR = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

describe("contribution validation (Arc USDC only)", () => {
  it("accepts valid 0x addresses and hashes", () => {
    expect(isArcAddress(ADDR)).toBe(true);
    expect(isArcTxHash(HASH)).toBe(true);
    expect(validateArcAddress(ADDR)).toBeNull();
    expect(validateArcTxHash(HASH)).toBeNull();
  });

  it("rejects legacy G... addresses with a wrong-rail message", () => {
    const legacy = "G" + "A".repeat(55);
    expect(isArcAddress(legacy)).toBe(false);
    expect(validateArcAddress(legacy)).toMatch(/Arc \(0x\)/);
    expect(validateArcAddress("0x123")).toMatch(/40 hex/);
    expect(validateArcAddress("")).toMatch(/Connect an Arc wallet/);
  });

  it("rejects malformed tx hashes", () => {
    expect(validateArcTxHash("txn-abc")).toMatch(/0x followed by 64 hex/);
    expect(validateArcTxHash("0x123")).toMatch(/0x followed by 64 hex/);
    expect(validateArcTxHash("")).toMatch(/required/);
  });

  it("enforces USDC-only currency", () => {
    expect(validateCurrency("USDC")).toBeNull();
    expect(validateCurrency("EUR")).toMatch(/Only USDC/);
    expect(validateCurrency("USD")).toMatch(/Only USDC/);
  });

  it("validates amounts (positive, finite, bounded, exact)", () => {
    expect(validateContributionAmount(100, { expectedAmount: 100 })).toBeNull();
    expect(validateContributionAmount(0)).toMatch(/greater than 0/);
    expect(validateContributionAmount(-5)).toMatch(/greater than 0/);
    expect(validateContributionAmount(NaN)).toMatch(/must be a number/);
    expect(validateContributionAmount(Infinity)).toMatch(/finite/);
    expect(validateContributionAmount(2_000_000)).toMatch(/must not exceed/);
    expect(validateContributionAmount(50, { expectedAmount: 100 })).toMatch(/must equal/);
    expect(validateContributionAmount(10, { isPremium: true })).toMatch(/Premium circles/);
    expect(validateContributionAmount(0.123456789)).toMatch(/6 decimal/);
  });

  it("validates round numbers", () => {
    expect(validateRoundNumber(1)).toBeNull();
    expect(validateRoundNumber(0)).toMatch(/at least 1/);
    expect(validateRoundNumber(1.5)).toMatch(/integer/);
  });

  it("pre-flights a full contribute input", () => {    expect(
      validateContributeInput({
        amount: 100,
        currency: "USDC",
        walletAddress: ADDR,
        roundNumber: 2,
        expectedAmount: 100,
      }),
    ).toBeNull();
    expect(
      validateContributeInput({
        amount: 100,
        currency: "EUR",
        walletAddress: ADDR,
        roundNumber: 2,
      }),
    ).toMatch(/Only USDC/);
  });

  it("accepts a missing wallet address (manual-hash contributions)", () => {
    expect(
      validateContributeInput({
        amount: 100,
        currency: "USDC",
        roundNumber: 2,
        expectedAmount: 100,
      }),
    ).toBeNull();
  });

  it("builds a replay-resistant intent message", () => {
    const msg = buildContributionIntentMessage({
      amount: 100,
      circleName: "Savers",
      circleId: "circle-1",
      roundNumber: 2,
      walletAddress: ADDR,
    });
    expect(msg).toContain("100 USDC");
    expect(msg).toContain("circle-1");
    expect(msg).toContain("round: 2");
    expect(msg).toContain(ADDR);
  });

  it("converts USDC to wei hex without float drift", () => {
    expect(toWeiHex(1)).toBe(`0x${(BigInt(1_000_000) * BigInt(1_000_000_000_000)).toString(16)}`);
    expect(toWeiHex(0.000001)).toBe(`0x${BigInt(1_000_000_000_000).toString(16)}`);
  });

  it("unwraps both backend response shapes", () => {
    const c = { id: "c-1" };
    expect(unwrapContributionResponse({ contribution: c })).toEqual(c);
    expect(unwrapContributionResponse(c)).toEqual(c);
  });
});
