import { DEFAULT_LOCALE } from "@/lib/formatters"

/**
 * USDC on Arc uses 18 decimals natively and is the gas token — native and
 * ERC-20 USDC are the SAME balance, so the wallet renders one row only.
 * Balances arrive from GET /wallets/balance as decimal strings.
 *
 * String-safe: never round-trips through float64, so 18-decimal dust and
 * large pools keep full precision (truncated, never rounded up).
 */
export function formatUsdc(
  value?: string | null,
  _locale: string = DEFAULT_LOCALE,
): string {
  if (!value) return "0.00"
  const [rawInt = "0", rawFrac = ""] = String(value).trim().split(".")
  if (!/^-?\d+$/.test(rawInt) || (rawFrac && !/^\d+$/.test(rawFrac))) return "0.00"
  const sign = rawInt.startsWith("-") ? "-" : ""
  const digits = rawInt.replace(/^-/, "").replace(/^0+(?=\d)/, "")
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  const frac = `${rawFrac}00`.slice(0, 2)
  return `${sign}${grouped || "0"}.${frac}`
}

export function formatActivityAmount(
  value: number,
  locale: string = DEFAULT_LOCALE,
): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Arc addresses are 0x hex; anything else is not an Arc address. */
export function isArcAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address.trim())
}
