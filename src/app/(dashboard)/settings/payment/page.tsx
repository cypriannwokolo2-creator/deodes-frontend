"use client"

import { logger } from "@/lib/logger"
import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, CreditCard, Landmark } from "lucide-react"
import { Select } from "@/components/ui/select"
import { patch, getErrorMessage } from "@/lib/api-client"
import { useTranslate } from "@/lib/locale/context"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

export default function PaymentSettingsPage() {
  const { t } = useTranslate()
  const toast = useToast()
  const { user } = useAuth()
  const [currency, setCurrency] = useState("NGN")

  useEffect(() => {
    if (user?.preferredCurrency) setCurrency(user.preferredCurrency)
  }, [user?.preferredCurrency])

  const handleCurrencyChange = useCallback(
    async (code: string) => {
      setCurrency(code)
      try {
        await patch("/users/me", { preferredCurrency: code })
      } catch (e) {
        logger.error("[payment] Failed to save currency preference:", e)
        toast.error(getErrorMessage(e))
      }
    },
    [toast],
  )

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Back to settings">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">{t("settings.payment")}</h1>
          <p className="text-sm text-muted-foreground">{t("payment.desc")}</p>
        </div>
      </div>

      {/* Currency Preference */}
      <div className="glass-premium rounded-2xl p-6 space-y-4">
        <h3 className="font-heading text-sm font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-aurora-violet" />
          {t("payment.currencyPreference")}
        </h3>
        <Select
          label={t("payment.preferredCurrency")}
          options={[
            { value: "NGN", label: "NGN - Nigerian Naira" },
            { value: "USDC", label: "USDC - Arc USD" },
          ]}
          value={currency}
          onChange={handleCurrencyChange}
        />
        <p className="text-xs text-muted-foreground">{t("payment.currencyHint")}</p>
      </div>

      {/* Saved Bank Accounts — coming soon */}
      <div className="glass-premium rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Landmark className="h-4 w-4 text-aurora-violet" />
          <h3 className="font-heading text-sm font-semibold text-foreground">{t("payment.bankAccounts")}</h3>
        </div>
        <div className="border-l-4 border-l-aurora-violet pl-4 py-1">
          <p className="font-mono text-xs uppercase tracking-widest text-aurora-violet">Coming soon</p>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {t("payment.comingSoon")}
          </p>
        </div>
      </div>
    </div>
  )
}
