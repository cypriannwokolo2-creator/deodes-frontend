"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ShieldCheck, ShieldOff, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TOTPSetup } from "@/components/auth/totp-setup"
import { useAuth } from "@/hooks/use-auth"
import { post, getErrorMessage } from "@/lib/api-client"
import { logger } from "@/lib/logger"
import { useToast } from "@/hooks/use-toast"

type Phase = "status" | "enroll" | "recovery"

export default function SecuritySettingsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [enabled, setEnabled] = useState(user?.totpEnabled ?? false)
  const [phase, setPhase] = useState<Phase>("status")
  const [totpUri, setTotpUri] = useState("")
  const [totpSecret, setTotpSecret] = useState("")
  const [confirmError, setConfirmError] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [working, setWorking] = useState(false)
  const [showDisable, setShowDisable] = useState(false)
  const [disableCode, setDisableCode] = useState("")

  const startEnroll = async () => {
    setWorking(true)
    try {
      const res = await post<{ uri?: string; secret?: string; data?: { uri?: string; secret?: string } }>(
        "/auth/totp/enroll",
        {},
      )
      const data = (res as { data?: { uri?: string; secret?: string } })?.data ?? res
      if (!data?.uri || !data?.secret) throw new Error("Enrollment failed. Please try again.")
      setTotpUri(data.uri)
      setTotpSecret(data.secret)
      setConfirmError("")
      setPhase("enroll")
    } catch (e) {
      logger.error("[security] TOTP enroll failed:", e)
      toast.error(getErrorMessage(e))
    } finally {
      setWorking(false)
    }
  }

  const confirmEnable = async (code: string) => {
    setConfirming(true)
    setConfirmError("")
    try {
      const res = await post<{ recoveryCodes?: string[]; data?: { recoveryCodes?: string[] } }>(
        "/auth/totp/enable",
        { code },
      )
      const codes =
        (res as { recoveryCodes?: string[] })?.recoveryCodes ??
        (res as { data?: { recoveryCodes?: string[] } })?.data?.recoveryCodes ??
        []
      setRecoveryCodes(codes)
      setEnabled(true)
      setPhase("recovery")
      toast.success("Two-factor authentication enabled")
    } catch (e) {
      setConfirmError(getErrorMessage(e))
    } finally {
      setConfirming(false)
    }
  }

  const disable = async () => {
    if (disableCode.trim().length < 6) return
    setWorking(true)
    try {
      // Disable requires proof of possession (current code or recovery code).
      await post("/auth/totp/disable", { code: disableCode.trim() })
      setEnabled(false)
      setPhase("status")
      setShowDisable(false)
      setDisableCode("")
      toast.success("Two-factor authentication disabled")
    } catch (e) {
      logger.error("[security] TOTP disable failed:", e)
      toast.error(getErrorMessage(e))
    } finally {
      setWorking(false)
    }
  }

  const regenerate = async () => {
    setWorking(true)
    try {
      const res = await post<{ recoveryCodes?: string[]; data?: { recoveryCodes?: string[] } }>(
        "/auth/totp/recovery-codes",
        {},
      )
      const codes =
        (res as { recoveryCodes?: string[] })?.recoveryCodes ??
        (res as { data?: { recoveryCodes?: string[] } })?.data?.recoveryCodes ??
        []
      setRecoveryCodes(codes)
      setPhase("recovery")
    } catch (e) {
      logger.error("[security] Recovery codes failed:", e)
      toast.error(getErrorMessage(e))
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Back to settings">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Security</h1>
          <p className="text-sm text-muted-foreground">Authenticator-app two-factor authentication</p>
        </div>
      </div>

      {phase === "status" && (
        <div className="glass-premium rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            {enabled ? (
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            ) : (
              <ShieldOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-heading text-base font-semibold text-foreground">
                {enabled ? "Two-factor is on" : "Two-factor is off"}
              </p>
              <p className="text-xs text-muted-foreground">
                {enabled
                  ? "Logins ask for a code from your authenticator app."
                  : "Add an authenticator app for extra protection."}
              </p>
            </div>
          </div>
          {!enabled ? (
            <Button variant="primary" size="md" onClick={startEnroll} isLoading={working} className="w-full">
              Set up authenticator app
            </Button>
          ) : (
            <div className="space-y-3">
              <Button variant="outline" size="md" onClick={regenerate} isLoading={working} leftIcon={<RefreshCw className="h-4 w-4" />} className="w-full">
                New recovery codes
              </Button>
              {!showDisable ? (
                <Button variant="destructive" size="md" onClick={() => setShowDisable(true)} className="w-full">
                  Disable
                </Button>
              ) : (
                <div className="rounded-xl border border-red-500/20 p-4 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Enter a current code from your authenticator app to confirm disabling.
                  </p>
                  <Input
                    label="Current code"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="6-digit code"
                    maxLength={8}
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setShowDisable(false); setDisableCode("") }} className="flex-1">
                      Cancel
                    </Button>
                    <Button variant="destructive" size="sm" onClick={disable} isLoading={working} disabled={disableCode.trim().length < 6} className="flex-1">
                      Confirm disable
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {phase === "enroll" && (
        <div className="glass-premium rounded-2xl p-6">
          <TOTPSetup
            totpUri={totpUri}
            totpSecret={totpSecret}
            onConfirm={confirmEnable}
            error={confirmError || undefined}
            isLoading={confirming}
          />
        </div>
      )}

      {phase === "recovery" && (
        <div className="glass-premium rounded-2xl p-6 space-y-4">
          <h3 className="font-heading text-base font-semibold text-foreground">Recovery codes</h3>
          <p className="text-xs text-muted-foreground">
            Save these somewhere safe — each works once, and they are never shown again.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {recoveryCodes.map((c) => (
              <code key={c} className="rounded-lg bg-white/5 px-3 py-2 font-mono text-sm text-foreground select-all">
                {c}
              </code>
            ))}
          </div>
          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => {
              setPhase("status")
              setRecoveryCodes([])
            }}
          >
            Done
          </Button>
        </div>
      )}

    </div>
  )
}
