"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CreateGoalInput, SavingsGoal, UpdateGoalInput } from "@/hooks/use-savings"
import { SAVINGS_LIMITS, validateGoalFormFields } from "@/lib/validators"

interface GoalFormProps {
  initial?: SavingsGoal | null
  pending: boolean
  /** Server-side field errors (mapped from a 400 VALIDATION_ERROR response). */
  serverFieldErrors?: Record<string, string>
  /** Server-side top-level message (shown above the actions). */
  serverError?: string | null
  onCreate?: (input: CreateGoalInput) => void
  onUpdate?: (id: string, patch: UpdateGoalInput) => void
  onCancel: () => void
}

type FieldErrors = { name?: string; target?: string; deadline?: string; description?: string }

/** Map API field names (name/targetAmount/targetDate/description) to form fields. */
function mapServerFields(fields: Record<string, string>): FieldErrors {
  const out: FieldErrors = {}
  const pick = (keys: string[]): string | undefined => {
    for (const k of keys) {
      const hit = Object.entries(fields).find(
        ([field]) => field.toLowerCase() === k.toLowerCase(),
      )
      if (hit?.[1]) return hit[1]
    }
    return undefined
  }
  const name = pick(["name"])
  const target = pick(["targetamount", "target"])
  const deadline = pick(["targetdate", "deadline"])
  const description = pick(["description", "note"])
  if (name) out.name = name
  if (target) out.target = target
  if (deadline) out.deadline = deadline
  if (description) out.description = description
  return out
}

/** Create/edit vault form. Backend model: name, target USDC, optional deadline, no frequency. */
export function GoalForm({
  initial,
  pending,
  serverFieldErrors,
  serverError,
  onCreate,
  onUpdate,
  onCancel,
}: GoalFormProps) {
  const [name, setName] = useState(initial?.name ?? "")
  const [target, setTarget] = useState(initial ? String(initial.targetAmount) : "")
  const [deadline, setDeadline] = useState(initial?.targetDate ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [autoReserve, setAutoReserve] = useState(initial?.autoReserve ?? false)
  const [autoAmount, setAutoAmount] = useState(initial?.autoAmount ? String(initial.autoAmount) : "")
  const [autoFrequency, setAutoFrequency] = useState(initial?.autoFrequency ?? "monthly")
  const [touched, setTouched] = useState({ name: false, target: false, deadline: false, description: false })
  const touch = (field: keyof typeof touched) =>
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }))
  const touchAll = () => setTouched({ name: true, target: true, deadline: true, description: true })

  const clientErrors = useMemo<FieldErrors>(
    () => validateGoalFormFields({ name, target, deadline, description }),
    [name, target, deadline, description],
  )

  const mappedServerErrors = useMemo<FieldErrors>(
    () => (serverFieldErrors ? mapServerFields(serverFieldErrors) : {}),
    [serverFieldErrors],
  )

  // Show a field's client error once the user has edited that field or
  // attempted submit; server errors always show so 400s are never silent.
  const visibleErrors: FieldErrors = useMemo(() => {
    return {
      name: (touched.name ? clientErrors.name : undefined) ?? mappedServerErrors.name,
      target: (touched.target ? clientErrors.target : undefined) ?? mappedServerErrors.target,
      deadline:
        (touched.deadline ? clientErrors.deadline : undefined) ?? mappedServerErrors.deadline,
      description:
        (touched.description ? clientErrors.description : undefined) ??
        mappedServerErrors.description,
    }
  }, [touched, clientErrors, mappedServerErrors])

  const isValid = Object.keys(clientErrors).length === 0
  const unmappedServerMessages = useMemo(() => {
    if (!serverFieldErrors) return []
    const mapped = new Set(
      ["name", "targetamount", "target", "targetdate", "deadline", "description", "note"].map((s) =>
        s.toLowerCase(),
      ),
    )
    return Object.entries(serverFieldErrors)
      .filter(([field]) => !mapped.has(field.toLowerCase()))
      .map(([, message]) => message)
  }, [serverFieldErrors])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    touchAll()
    const next = validateGoalFormFields({ name, target, deadline, description })
    if (Object.keys(next).length > 0) return
    const amount = Number(target)
    const schedule = autoReserve
      ? {
          autoAmount: Math.max(0, Number(autoAmount) || 0),
          autoFrequency,
        }
      : { autoAmount: 0, autoFrequency: "monthly" }
    if (initial) {
      onUpdate?.(initial.id, {
        name: name.trim(),
        description: description.trim(),
        targetAmount: amount,
        targetDate: deadline.trim() ? deadline.trim() : null,
        autoReserve,
        ...schedule,
      })
    } else {
      onCreate?.({
        name: name.trim(),
        description: description.trim() || undefined,
        targetAmount: amount,
        targetDate: deadline.trim() || null,
        autoReserve,
        ...schedule,
      })
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <form onSubmit={submit} className="space-y-5" data-testid="goal-form" noValidate>
      <Input
        label="Vault name"
        placeholder="e.g. Emergency fund"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          touch("name")
        }}
        error={visibleErrors.name}
        maxLength={SAVINGS_LIMITS.NAME_MAX}
        aria-invalid={visibleErrors.name ? true : undefined}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Target (USDC on Arc)"
          placeholder="500.00"
          inputMode="decimal"
          value={target}
          onChange={(e) => {
            setTarget(e.target.value)
            touch("target")
          }}
          error={visibleErrors.target}
          hint={`Up to 1,000,000 USDC.`}
          aria-invalid={visibleErrors.target ? true : undefined}
        />
        <Input
          label="Deadline (optional)"
          type="date"
          min={today}
          value={deadline}
          onChange={(e) => {
            setDeadline(e.target.value)
            touch("deadline")
          }}
          error={visibleErrors.deadline}
          hint="Must be a future date."
          aria-invalid={visibleErrors.deadline ? true : undefined}
        />
      </div>
      <Input
        label="Note (optional)"
        placeholder="What is this vault for?"
        value={description}
        onChange={(e) => {
          setDescription(e.target.value)
          touch("description")
        }}
        error={visibleErrors.description}
        maxLength={SAVINGS_LIMITS.NOTE_MAX}
        hint={`${description.length}/${SAVINGS_LIMITS.NOTE_MAX}`}
        aria-invalid={visibleErrors.description ? true : undefined}
      />
      <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-dotted border-white/15 pt-4">
        <span>
          <span className="block font-heading text-sm text-foreground">Auto-reserve</span>
          <span className="block text-xs text-muted-foreground">
            Automatically set aside a fixed amount on schedule while your balance covers it.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={autoReserve}
          aria-label="Auto-reserve"
          onClick={() => setAutoReserve((v) => !v)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${autoReserve ? "bg-emerald-400" : "bg-white/15"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${autoReserve ? "left-[22px]" : "left-0.5"}`}
          />
        </button>
      </label>
      {autoReserve && (
        <div className="flex flex-wrap items-end gap-3 pl-1">
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Amount (USDC)</span>
            <input
              aria-label="Auto-save amount in USDC"
              type="number"
              min={0}
              step="any"
              value={autoAmount}
              onChange={(e) => setAutoAmount(e.target.value)}
              placeholder="25"
              className="w-28 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Every</span>
            <select
              aria-label="Auto-save frequency"
              value={autoFrequency}
              onChange={(e) => setAutoFrequency(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-none"
            >
              {["daily", "weekly", "biweekly", "monthly"].map((f) => (
                <option key={f} value={f} className="bg-card">{f}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {(serverError || unmappedServerMessages.length > 0) && (
        <div
          role="alert"
          data-testid="goal-form-server-error"
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          {serverError ?? unmappedServerMessages.join(" ")}
          {serverError && unmappedServerMessages.length > 0 && (
            <span className="mt-1 block">{unmappedServerMessages.join(" ")}</span>
          )}
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          type="submit"
          isLoading={pending}
          disabled={!isValid || pending}
          title={!isValid ? "Fix the highlighted fields to continue." : undefined}
        >
          {initial ? "Save changes" : "Create vault"}
        </Button>
      </div>
    </form>
  )
}
