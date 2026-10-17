import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminDeleted } from "../AdminDeleted"
import { AdminAuditLog } from "../AdminAuditLog"
import { AdminFlags } from "../AdminFlags"
import { AdminJobs } from "../AdminJobs"
import { AdminInspect } from "../AdminInspect"
import { AdminUsers } from "../AdminUsers"
import { AdminUserActivity } from "../AdminUserActivity"

const mutate = vi.fn()

vi.mock("@/hooks/use-admin", () => ({
  useAdminDeletedUsers: () => ({
    data: {
      users: [{ id: "u-del-1", walletAddress: "0xabc", displayName: null, role: "user" }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    },
    isLoading: false,
  }),
  useAdminRestoreUser: () => ({ mutate, isPending: false }),
  useAdminAuditLog: () => ({
    data: {
      entries: [
        { id: "a1", actorId: "11111111-1111-1111-1111-111111111111", action: "user.restored", resourceType: "user", resourceId: "u-1", createdAt: new Date().toISOString() },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    },
    isLoading: false,
  }),
  useAdminFeatureFlags: () => ({
    data: [
      { flag: "premium_circles", enabled: true, description: "gate" },
      { flag: "old_flag", enabled: false },
    ],
    isLoading: false,
  }),
  useAdminFlagAction: () => ({
    set: { mutate, isPending: false },
    remove: { mutate, isPending: false },
  }),
  useAdminDeadLetterJobs: () => ({
    data: [{ id: "job-1", queue_name: "sends", status: "dead_letter", created_at: new Date().toISOString() }],
    isLoading: false,
  }),
  useAdminRetryJob: () => ({ mutate, isPending: false }),
  useAdminCircleInspect: () => ({ data: null, isLoading: false, isError: false }),
  useAdminAuditLog: () => ({
    data: {
      entries: [
        { id: "a9", actorId: "u-1", action: "circle.inspected", resourceType: "circle", createdAt: new Date().toISOString() },
      ],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    },
    isLoading: false,
  }),
}))

describe("Admin ops sections", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("restores a deleted user", () => {
    render(<AdminDeleted enabled />)
    fireEvent.click(screen.getByText("Restore"))
    expect(mutate).toHaveBeenCalledWith({ userId: "u-del-1" })
  })

  it("renders audit timeline entries", () => {
    render(<AdminAuditLog enabled />)
    expect(screen.getByText("circle.inspected")).toBeInTheDocument()
    expect(screen.getByText("circle")).toBeInTheDocument()
  })

  it("toggles a flag off", () => {
    render(<AdminFlags enabled />)
    const switches = screen.getAllByRole("switch")
    expect(switches).toHaveLength(2)
    fireEvent.click(switches[0])
    expect(mutate).toHaveBeenCalledWith(
      { flag: "premium_circles", value: false, description: undefined },
    )
  })

  it("retries a dead-letter job", () => {
    render(<AdminJobs enabled />)
    fireEvent.click(screen.getByText("Retry"))
    expect(mutate).toHaveBeenCalledWith({ jobId: "job-1" })
  })

  it("prompts for a circle id when nothing inspected", () => {
    render(<AdminInspect enabled />)
    expect(screen.getByText(/Paste a circle ID above/i)).toBeInTheDocument()
  })

  it("selects a user by clicking anywhere on the row", () => {
    const onSelect = vi.fn()
    render(
      <AdminUsers
        users={[{ id: "u-7", walletAddress: "0xabc", displayName: "Zed", role: "user", moiScore: 10 }]}
        total={1}
        loading={false}
        search=""
        onSearch={() => {}}
        page={1}
        onPage={() => {}}
        limit={20}
        selectedId={null}
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Inspect Zed/i }))
    expect(onSelect).toHaveBeenCalledWith("u-7")
  })

  it("shows a selected user's audit activity", () => {
    render(<AdminUserActivity userId="u-1" enabled />)
    expect(screen.getByText("circle.inspected")).toBeInTheDocument()
  })

  it("renders nothing for activity without a selected user", () => {
    const { container } = render(<AdminUserActivity userId={null} enabled />)
    expect(container.textContent).toBe("")
  })
})
