import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CircleContributeForm } from "../circle-contribute-form";

const TREASURY = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

const mockMutateAsync = vi.fn();

vi.mock("@/hooks/use-circles", () => ({
  useContribute: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

vi.mock("@/lib/clipboard", () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));

function renderForm(props: Partial<React.ComponentProps<typeof CircleContributeForm>> = {}) {
  return render(
    <CircleContributeForm
      circleId="circle-1"
      circleName="Savers"
      contributionAmount={100}
      currency="USDC"
      roundNumber={2}
      onSuccess={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />,
  );
}

describe("CircleContributeForm (Arc USDC, manual hash)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ id: "c-1" });
  });

  it("rejects non-USDC currency without submitting", async () => {
    const user = userEvent.setup();
    renderForm({ currency: "EUR" });
    await user.click(screen.getByRole("button", { name: /Submit contribution/ }));
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toMatch(/Only USDC on Arc/i);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("requires an Arc transaction hash", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /Submit contribution/ }));
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toMatch(/Transaction hash is required/i);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("submits amount/round/txnHash without any wallet connection", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    renderForm({ onSuccess });
    await user.type(screen.getByLabelText(/Arc transaction hash/i), HASH);
    await user.click(screen.getByRole("button", { name: /Submit contribution/ }));
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({ amount: 100, roundNumber: 2, txnHash: HASH }),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("shows the treasury address to pay when provided", async () => {
    renderForm({ treasuryAddress: TREASURY });
    expect(await screen.findByText("Treasury address")).toBeDefined();
    expect(screen.getByText(TREASURY)).toBeDefined();
  });

  it("surfaces backend submission errors", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce(new Error("Round closed."));
    renderForm();
    await user.type(screen.getByLabelText(/Arc transaction hash/i), HASH);
    await user.click(screen.getByRole("button", { name: /Submit contribution/ }));
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toMatch(/Round closed/i);
  });
});
