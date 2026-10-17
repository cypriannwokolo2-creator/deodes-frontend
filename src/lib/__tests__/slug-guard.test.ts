import { describe, expect, it } from "vitest"
import { safeSlug, isSafeAppLink } from "@/lib/slug-guard"

describe("safeSlug", () => {
  it("returns index for empty", () => {
    expect(safeSlug()).toBe("index")
    expect(safeSlug([])).toBe("index")
  })

  it("joins normal segments", () => {
    expect(safeSlug(["guide", "start"])).toBe("guide/start")
  })

  it("blocks traversal", () => {
    expect(safeSlug([".."])).toBeNull()
    expect(safeSlug(["a", "..", "b"])).toBeNull()
    expect(safeSlug(["."])).toBeNull()
    expect(safeSlug(["", ""])).toBeNull()
    expect(safeSlug(["/etc/passwd"])).toBeNull()
    expect(safeSlug(["a\\b"])).toBeNull()
    expect(safeSlug(["a%2Fb"])).toBe("a%2Fb")
  })
})

describe("isSafeAppLink", () => {
  it("allows same-origin paths", () => {
    expect(isSafeAppLink("/circles/123")).toBe(true)
    expect(isSafeAppLink("/")).toBe(true)
  })

  it("rejects external and scheme links", () => {
    expect(isSafeAppLink("//evil.test/x")).toBe(false)
    expect(isSafeAppLink("https://evil.test")).toBe(false)
    expect(isSafeAppLink("javascript:alert(1)")).toBe(false)
    expect(isSafeAppLink("/a\\b")).toBe(false)
    expect(isSafeAppLink("")).toBe(false)
  })
})
