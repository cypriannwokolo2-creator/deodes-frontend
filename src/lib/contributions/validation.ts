/**
 * Contribution validation — Arc USDC only.
 *
 * Pure functions with no React so they can be unit-tested directly and reused
 * by the contribute form, the circle detail modal, and the contributions page.
 * The backend contract is POST /v1/circles/:id/contribute with
 * `{ amount, txnHash, roundNumber }` where txnHash is an Arc EVM hash
 * (0x + 64 hex). Non-Arc addresses and invalid signatures are rejected here
 * so a wrong-rail submission fails fast in the UI instead of as a 422.
 */

export const ARC_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
export const ARC_TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;

/** Upper bound guarding against fat-finger transfers (1M USDC). */
export const MAX_CONTRIBUTION_AMOUNT = 1_000_000;

/** Backend premium floor for USDC circles (mirrors circle_handler.go). */
export const PREMIUM_MIN_USDC = 50;

export function isArcAddress(address: unknown): address is string {
  return typeof address === "string" && ARC_ADDRESS_REGEX.test(address.trim());
}

export function isArcTxHash(hash: unknown): hash is string {
  return typeof hash === "string" && ARC_TX_HASH_REGEX.test(hash.trim());
}

export function validateArcAddress(address: unknown): string | null {
  if (typeof address !== "string" || address.trim() === "") {
    return "Connect an Arc wallet to contribute.";
  }
  const trimmed = address.trim();
  if (trimmed.startsWith("G") || trimmed.length === 56) {
    return "Only Arc (0x) addresses are supported for contributions. Connect an Arc wallet.";
  }
  if (!ARC_ADDRESS_REGEX.test(trimmed)) {
    return "Invalid Arc address. Expected a 0x address with 40 hex characters.";
  }
  return null;
}

export function validateArcTxHash(hash: unknown): string | null {
  if (typeof hash !== "string" || hash.trim() === "") {
    return "Transaction hash is required.";
  }
  if (!ARC_TX_HASH_REGEX.test(hash.trim())) {
    return "Invalid transaction hash. Expected 0x followed by 64 hex characters (Arc EVM hash).";
  }
  return null;
}

export function validateCurrency(currency: unknown): string | null {
  if (currency !== "USDC") {
    return "Only USDC on Arc is supported for contributions.";
  }
  return null;
}

export interface AmountValidationOptions {
  /** Circle's configured amount — when set, the payment must equal it. */
  expectedAmount?: number;
  /** Premium circles enforce a 50 USDC floor (backend mirrors this). */
  isPremium?: boolean;
}

export function validateContributionAmount(
  amount: unknown,
  opts: AmountValidationOptions = {},
): string | null {
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return "Contribution amount must be a number.";
  }
  if (!Number.isFinite(amount)) {
    return "Contribution amount must be finite.";
  }
  if (amount <= 0) {
    return "Contribution amount must be greater than 0.";
  }
  if (amount > MAX_CONTRIBUTION_AMOUNT) {
    return `Contribution amount must not exceed ${MAX_CONTRIBUTION_AMOUNT.toLocaleString()} USDC.`;
  }
  // Guard against float dust beyond 6 display decimals (Arc shows max 6).
  const rounded = Math.round(amount * 1e6) / 1e6;
  if (Math.abs(amount - rounded) > 1e-9) {
    return "Contribution amount supports at most 6 decimal places.";
  }
  if (opts.isPremium && amount < PREMIUM_MIN_USDC) {
    return `Premium circles require a minimum of ${PREMIUM_MIN_USDC} USDC.`;
  }
  if (
    opts.expectedAmount !== undefined &&
    Math.abs(amount - opts.expectedAmount) > 0.0000001
  ) {
    return `Amount must equal the circle contribution of ${opts.expectedAmount} USDC.`;
  }
  return null;
}

export function validateRoundNumber(round: unknown): string | null {
  if (typeof round !== "number" || !Number.isInteger(round)) {
    return "Round number must be an integer.";
  }
  if (round < 1) {
    return "Round number must be at least 1.";
  }
  if (round > 10_000) {
    return "Round number is out of range.";
  }
  return null;
}

export interface ContributeInput {
  amount: number;
  currency: string;
  /** Optional: with no connected wallet there is no address to check. */
  walletAddress?: string;
  roundNumber: number;
  txnHash?: string;
  expectedAmount?: number;
  isPremium?: boolean;
}

/** Full pre-flight check before submitting. Returns first error. */
export function validateContributeInput(input: ContributeInput): string | null {
  return (
    (input.walletAddress ? validateArcAddress(input.walletAddress) : null) ??
    validateCurrency(input.currency) ??
    validateContributionAmount(input.amount, {
      expectedAmount: input.expectedAmount,
      isPremium: input.isPremium,
    }) ??
    validateRoundNumber(input.roundNumber) ??
    (input.txnHash !== undefined ? validateArcTxHash(input.txnHash) : null)
  );
}

/**
 * Canonical personal_sign intent. The wallet address, circle, round and amount
 * are all bound into the message so a signature cannot be replayed for a
 * different round or circle. The backend does not verify this signature
 * (it verifies txnHash on-chain); the signature proves wallet control in the
 * UI before the EVM transfer is sent.
 */
export function buildContributionIntentMessage(args: {
  amount: number;
  circleName: string;
  circleId: string;
  roundNumber: number;
  walletAddress: string;
}): string {
  return (
    `Deodes Contribution: ${args.amount} USDC to ${args.circleName} ` +
    `(circle: ${args.circleId}, round: ${args.roundNumber}, wallet: ${args.walletAddress})`
  );
}

/**
 * Convert a USDC amount to wei hex for eth_sendTransaction (18 decimals).
 * Uses integer math on micro-units (6 decimals) then scales by 1e12 so float
 * error cannot drift the transferred value.
 */
export function toWeiHex(amount: number): string {
  const micros = BigInt(Math.round(amount * 1_000_000));
  const wei = micros * BigInt(1_000_000_000_000);
  return `0x${wei.toString(16)}`;
}

/**
 * Unwrap the backend contribute response. The API returns
 * `{ success, contribution }` inside `data`; older mocks return the
 * contribution directly. Accepts both so the hook works against either.
 */
export function unwrapContributionResponse<T>(data: unknown): T {
  if (
    data !== null &&
    typeof data === "object" &&
    "contribution" in (data as Record<string, unknown>)
  ) {
    return (data as Record<string, T>).contribution;
  }
  return data as T;
}
