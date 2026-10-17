import { describe, expect, it, vi, beforeEach } from "vitest"
import { savePendingInvite, takePendingInvite } from "@/lib/app-host"

describe("pending invite handoff", () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it("remembers an invite link across the auth detour", () => {
    savePendingInvite("/invite/ABC123")
    expect(takePendingInvite("/")).toBe("/invite/ABC123")
    // Consumed exactly once.
    expect(takePendingInvite("/")).toBe("/")
  })

  it("ignores non-invite paths", () => {
    savePendingInvite("/wallet")
    expect(takePendingInvite("/")).toBe("/")
  })
})
