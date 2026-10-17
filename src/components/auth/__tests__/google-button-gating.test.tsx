import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import {
  fetchBackendConfig,
  resetBackendConfigCache,
} from "@/hooks/use-backend-config"
import { GoogleButton } from "@/components/auth/google-button"

const CONFIG_URL_SUFFIX = "/config"

function mockConfigOnce(payload: unknown, ok = true) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok,
    json: () => Promise.resolve(payload),
  } as Response)
}

beforeEach(() => {
  resetBackendConfigCache()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Phase 2.3: the button must vanish on explicit google_enabled:false (the
// backend 503s without GOOGLE_CLIENT_ID), and stay put otherwise.
describe("fetchBackendConfig", () => {
  it("reports disabled on explicit false", async () => {
    mockConfigOnce({ data: { google_enabled: false } })
    await expect(fetchBackendConfig()).resolves.toEqual({ googleEnabled: false, emailConfigured: true })
    expect(globalThis.fetch).toHaveBeenCalledOnce()
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0][0])).toContain(
      CONFIG_URL_SUFFIX
    )
  })

  it("reports enabled on explicit true", async () => {
    mockConfigOnce({ data: { google_enabled: true } })
    await expect(fetchBackendConfig()).resolves.toEqual({ googleEnabled: true, emailConfigured: true })
  })

  it("fail-open on HTTP error", async () => {
    mockConfigOnce({ error: "down" }, false)
    await expect(fetchBackendConfig()).resolves.toEqual({ googleEnabled: true, emailConfigured: true })
  })

  it("fail-open on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("down"))
    await expect(fetchBackendConfig()).resolves.toEqual({ googleEnabled: true, emailConfigured: true })
  })

  it("fail-open on missing flag", async () => {
    mockConfigOnce({ data: {} })
    await expect(fetchBackendConfig()).resolves.toEqual({ googleEnabled: true, emailConfigured: true })
  })

  it("warns on explicit email unconfigured", async () => {
    mockConfigOnce({ data: { email: { configured: false } } })
    await expect(fetchBackendConfig()).resolves.toEqual({ googleEnabled: true, emailConfigured: false })
  })

  it("fetches once for many callers (module cache)", async () => {
    const spy = mockConfigOnce({ data: { google_enabled: true } })
    await Promise.all([fetchBackendConfig(), fetchBackendConfig()])
    expect(spy).toHaveBeenCalledOnce()
  })
})

describe("GoogleButton gating", () => {
  it("renders nothing when the backend disables Google", async () => {
    mockConfigOnce({ data: { google_enabled: false } })
    const { container } = render(<GoogleButton mode="signin" />)
    await waitFor(() => {
      expect(screen.queryByTestId("google-button")).not.toBeInTheDocument()
    })
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the link when the backend enables Google", async () => {
    mockConfigOnce({ data: { google_enabled: true } })
    render(<GoogleButton mode="signup" />)
    const link = await screen.findByTestId("google-button")
    expect(link).toHaveAttribute("href", "/api/auth/google/start")
    expect(link).toHaveTextContent(/sign up with google/i)
  })

  it("renders while the config is unreachable (fail-open)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("down"))
    render(<GoogleButton mode="signin" />)
    // Initial state shows the button; the failed fetch keeps it that way.
    expect(await screen.findByTestId("google-button")).toBeInTheDocument()
  })
})
