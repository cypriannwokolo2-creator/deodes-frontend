import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { User } from "@/types"

const { mockPost, mockGet, mockClearApiClientState } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(),
  mockClearApiClientState: vi.fn(),
}))

vi.mock("@/lib/api-client", () => ({
  post: mockPost,
  get: mockGet,
  clearApiClientState: mockClearApiClientState,
}))

vi.mock("@/lib/wallet/registry", () => ({
  getWalletRegistry: () => ({
    getAdapter: () => undefined,
  }),
}))

import { useAuthStore } from "@/stores/auth-store"
import { decryptFromStorage } from "@/lib/security/encryption"
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/lib/auth/token-store"

const USER_DATA_KEY = "deodes_user"
const getPassphrase = () =>
  `deodes-user-v1:${window.navigator.userAgent}-${window.screen.width}x${window.screen.height}`
const LEGACY_KEYS = [
  "deodes_token",
  "deodes_refresh",
  "deodes_access_token",
  "deodes_refresh_token",
]

const user: User = {
  id: "user-123",
  walletAddress: "GBD7M3GZ6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z6Z",
  preferredLanguage: "en",
  moiScore: 250,
  createdAt: "2026-01-01T00:00:00.000Z",
}

/** Build a JWT-shaped token whose payload carries the given `exp` (seconds). */
function makeToken(expSeconds?: number): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }))
  const payload = btoa(JSON.stringify(expSeconds === undefined ? {} : { exp: expSeconds }))
  return `${header}.${payload}.signature`
}

function okJson(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

function resetState() {
  useAuthStore.setState({
    isAuthenticated: false,
    user: null,
    token: null,
    isLoading: false,
    tokenExpiresAt: null,
  })
  clearAccessToken()
  localStorage.clear()
  mockPost.mockReset()
  mockPost.mockResolvedValue({ success: true })
  mockGet.mockReset()
  mockClearApiClientState.mockReset()
  // Pass through to the real token store: the mock replaces
  // clearApiClientState (which also resets the refresh latch), but tests
  // still need the in-memory access token actually cleared on logout.
  mockClearApiClientState.mockImplementation(() => {
    clearAccessToken()
  })
}

import { _setHmacKeyForTest } from "@/lib/wallet/hmac"

describe("useAuthStore", () => {
  beforeEach(() => {
    resetState()
    _setHmacKeyForTest("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetState()
  })

  describe("setTokens", () => {
    it("marks the session authenticated and stores the token", async () => {
      const future = Math.floor(Date.now() / 1000) + 3600
      await useAuthStore.getState().setTokens(makeToken(future), "refresh-123", user)

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.token).toBe(makeToken(future))
      expect(state.tokenExpiresAt).toBe(future * 1000)
      expect(state.user).toEqual(user)
    })

    it("persists the token pair to the HttpOnly session cookie endpoint", async () => {
      await useAuthStore.getState().setTokens(makeToken(), "refresh-123")

      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe("/api/auth/session")
      expect(init.method).toBe("POST")
      expect(JSON.parse(init.body as string)).toEqual({
        token: makeToken(),
        refreshToken: "refresh-123",
      })
    })

    it("does not mark the session authenticated when cookie persistence fails", async () => {
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      fetchMock.mockResolvedValue(new Response("{}", { status: 403 }))

      await expect(useAuthStore.getState().setTokens(makeToken(), "refresh-123")).rejects.toThrow(
        "Failed to persist session cookies",
      )
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
      expect(useAuthStore.getState().token).toBeNull()
    })

    it("persists the user profile with an HMAC signature", async () => {
      await useAuthStore.getState().setTokens(makeToken(), "refresh-123", user)
      await new Promise((r) => setTimeout(r, 50))

      const stored =
        (await decryptFromStorage<{ user: User; hmac: string }>(USER_DATA_KEY, getPassphrase())) ??
        JSON.parse(localStorage.getItem(USER_DATA_KEY) ?? "null")
      expect(stored.user).toEqual(user)
      expect(typeof stored.hmac).toBe("string")
    })

    it("falls back to a 15-minute expiry when the token has no exp", async () => {
      vi.useFakeTimers()
      vi.setSystemTime(1_700_000_000_000)

      await useAuthStore.getState().setTokens(makeToken(undefined), "refresh-123")
      expect(useAuthStore.getState().tokenExpiresAt).toBe(1_700_000_000_000 + 15 * 60 * 1000)
      vi.useRealTimers()
    })
  })

  describe("checkAuth", () => {
    it("restores an unexpired token with a cached profile without touching the network", async () => {
      const future = Math.floor(Date.now() / 1000) + 3600
      // Seed the HMAC-signed profile cache directly (setTokens persistence
      // goes through async encryption which is env-sensitive in tests).
      const { computeHmacSha256Sync } = await import("@/lib/wallet/hmac")
      const hmac = computeHmacSha256Sync(JSON.stringify(user))
      localStorage.setItem(USER_DATA_KEY, JSON.stringify({ user, hmac }))
      mockPost.mockClear()
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      fetchMock.mockClear()
      // No session-cookie round trip: token already in memory.
      setAccessToken(makeToken(future))

      await useAuthStore.getState().checkAuth()

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.token).toBe(makeToken(future))
      expect(state.user).toEqual(user)
      expect(state.isLoading).toBe(false)
      // Hosted-wallet ensure is fire-and-forget; only the profile fetch matters here.
      expect(mockGet.mock.calls.some(([url]) => url === "/me")).toBe(false)
    })

    it("fetches the profile via GET /me when the token is valid but the cache is empty", async () => {
      const future = Math.floor(Date.now() / 1000) + 3600
      setAccessToken(makeToken(future))
      mockGet.mockResolvedValue({ data: { user } })

      await useAuthStore.getState().checkAuth()

      expect(mockGet).toHaveBeenCalledWith("/me")
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.user).toEqual(user)
      expect(state.isLoading).toBe(false)
    })

    it("rehydrates the access token from the session cookie when memory is empty", async () => {
      const future = Math.floor(Date.now() / 1000) + 3600
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      fetchMock.mockResolvedValue(okJson({ authenticated: true, token: makeToken(future) }))
      // Empty profile cache → falls through to GET /me for the user.
      mockGet.mockResolvedValue({ data: { user } })

      await useAuthStore.getState().checkAuth()

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.token).toBe(makeToken(future))
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/auth/session")
      expect(mockGet).toHaveBeenCalledWith("/me")
      expect(state.user).toEqual(user)
    })

    it("logs out when the session cookie yields no token", async () => {
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
      fetchMock.mockResolvedValue(new Response("{}", { status: 401 }))

      await useAuthStore.getState().checkAuth()

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.token).toBeNull()
      expect(state.isLoading).toBe(false)
    })

    it("refreshes the profile via GET /me when the token has expired", async () => {
      const expired = Math.floor(Date.now() / 1000) - 3600
      setAccessToken(makeToken(expired))
      mockGet.mockResolvedValue({ data: { user } })

      await useAuthStore.getState().checkAuth()

      const state = useAuthStore.getState()
      expect(mockGet).toHaveBeenCalledWith("/me")
      expect(state.isAuthenticated).toBe(true)
      expect(state.user).toEqual(user)
      // The refreshed profile is persisted with its HMAC signature.
      await new Promise((r) => setTimeout(r, 50))
      const stored =
        (await decryptFromStorage<{ user: User; hmac: string }>(USER_DATA_KEY, getPassphrase())) ??
        JSON.parse(localStorage.getItem(USER_DATA_KEY) ?? "null")
      expect(stored.user).toEqual(user)
    })

    it("logs the user out when the token refresh fails", async () => {
      const expired = Math.floor(Date.now() / 1000) - 3600
      setAccessToken(makeToken(expired))
      mockGet.mockRejectedValue(
        Object.assign(new Error("refresh failed"), { response: { status: 401 } }),
      )

      await useAuthStore.getState().checkAuth()

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(getAccessToken()).toBeNull()
    })

    it("keeps the session on transient checkAuth failures", async () => {
      const expired = Math.floor(Date.now() / 1000) - 3600
      setAccessToken(makeToken(expired))
      // No status: network blip / backend restart, not an auth rejection.
      mockGet.mockRejectedValue(new Error("network down"))

      await useAuthStore.getState().checkAuth()

      // Not bounced to a logged-out state by a transient failure.
      expect(useAuthStore.getState().isLoading).toBe(false)
    })
  })

  describe("logout", () => {
    it("clears auth state and asks the server to drop the session", async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user,
        token: makeToken(),
        tokenExpiresAt: Date.now() + 1000,
      })
      localStorage.setItem(USER_DATA_KEY, JSON.stringify({ user, hmac: "x" }))
      localStorage.setItem("deodes_token", "legacy")
      mockPost.mockResolvedValue({ success: true })

      useAuthStore.getState().logout()

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(mockPost).toHaveBeenCalledWith("/auth/logout")
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/auth/session", expect.objectContaining({ method: "DELETE" }))
      expect(localStorage.getItem(USER_DATA_KEY)).toBeNull()
      expect(localStorage.getItem("deodes_token")).toBeNull()
    })
  })

  describe("clearTokens", () => {
    it("removes the in-memory token, stored user and legacy credential keys", async () => {
      setAccessToken(makeToken())
      useAuthStore.setState({ token: makeToken(), tokenExpiresAt: Date.now() + 1000 })
      localStorage.setItem(USER_DATA_KEY, JSON.stringify({ user, hmac: "x" }))
      for (const key of LEGACY_KEYS) localStorage.setItem(key, "legacy")

      await useAuthStore.getState().clearTokens()

      expect(getAccessToken()).toBeNull()
      expect(useAuthStore.getState().token).toBeNull()
      expect(useAuthStore.getState().tokenExpiresAt).toBeNull()
      expect(localStorage.getItem(USER_DATA_KEY)).toBeNull()
      for (const key of LEGACY_KEYS) expect(localStorage.getItem(key)).toBeNull()
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/auth/session", expect.objectContaining({ method: "DELETE" }))
    })
  })
})