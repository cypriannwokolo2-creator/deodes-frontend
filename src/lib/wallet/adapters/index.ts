import { getWalletRegistry } from "../registry"
import { isPasskeyEnabled } from "../features"

export { createPasskeyAdapter } from "./passkey"

let initialized = false

/**
 * Registers the passkey adapter (the only remaining wallet adapter —
 * external wallet connection was removed; passkey is auth infrastructure
 * used by passkey setup and logout cleanup).
 */
export async function initializeWalletAdapters(): Promise<void> {
  if (initialized) return
  const registry = getWalletRegistry()

  // Passkey: gated by feature flag
  if (isPasskeyEnabled()) {
    const { createPasskeyAdapter } = await import("./passkey")
    registry.register(createPasskeyAdapter())
  }

  initialized = true
}
