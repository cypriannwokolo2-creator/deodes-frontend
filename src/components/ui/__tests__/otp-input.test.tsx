import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { OTPInput } from "@/components/ui/otp-input"

function ControlledOTPInput({ error }: { error?: string }) {
  const [value, setValue] = useState("")
  return <OTPInput label="Verification code" value={value} onChange={setValue} error={error} />
}

describe("OTPInput", () => {
  it("uses one labelled transparent input and presentation-only slots", () => {
    const { container } = render(<ControlledOTPInput />)
    const input = screen.getByRole("textbox", { name: "Verification code" })

    expect(input).toHaveAttribute("inputmode", "numeric")
    expect(input).toHaveAttribute("autocomplete", "one-time-code")
    expect(input).toHaveClass("opacity-0")
    expect(container.querySelectorAll("[data-otp-slot]")).toHaveLength(6)
    expect(container.querySelector("[data-otp-slot='0']")).toHaveAttribute("aria-hidden", "true")
  })

  it("accepts a full pasted code and discards non-digits", () => {
    render(<ControlledOTPInput />)
    const input = screen.getByRole("textbox", { name: "Verification code" })

    fireEvent.change(input, { target: { value: "12a34-56" } })

    expect(input).toHaveValue("123456")
  })

  it("supports native backspace behavior across the combined code", async () => {
    const user = userEvent.setup()
    render(<ControlledOTPInput />)
    const input = screen.getByRole("textbox", { name: "Verification code" })

    await user.type(input, "123456")
    await user.keyboard("{Backspace}")

    expect(input).toHaveValue("12345")
  })

  it("keeps focus on the single input while the active slot advances", async () => {
    const user = userEvent.setup()
    const { container } = render(<ControlledOTPInput />)
    const input = screen.getByRole("textbox", { name: "Verification code" })

    await user.click(input)
    await user.type(input, "12")

    expect(input).toHaveFocus()
    // Slot 2 is empty but next-in-line: it carries the focused-next style,
    // not the filled aurora style (slots 0-1 hold the typed digits).
    expect(container.querySelector("[data-otp-slot='2']")).toHaveClass("border-foreground", "ring-1")
    expect(container.querySelector("[data-otp-slot='0']")).toHaveClass("border-aurora-violet/50")
  })

  it("announces errors and marks the input invalid", () => {
    render(<ControlledOTPInput error="That code is invalid" />)
    const input = screen.getByRole("textbox", { name: "Verification code" })
    const alert = screen.getByRole("alert")

    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAttribute("aria-describedby", alert.id)
    expect(alert).toHaveTextContent("That code is invalid")
  })

  it("renders theme-aware slots visible on light and dark cards", () => {
    // Regression: hardcoded bg-white/5 + border-white/10 slots were
    // invisible on the light-theme card, so users typed blind.
    const { container } = render(<ControlledOTPInput />)
    const slots = container.querySelectorAll("[data-otp-slot]")
    expect(slots).toHaveLength(6)
    slots.forEach((slot) => {
      const cls = slot.getAttribute("class") ?? ""
      expect(cls).toContain("border-foreground")
      expect(cls).not.toContain("bg-white/5")
      expect(cls).not.toContain("border-white/10")
    })
  })
})
