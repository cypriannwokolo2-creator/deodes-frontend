"use client"

import { createContext, useContext, useEffect, type ReactNode } from "react"
import {
  useAuthFlowStore,
  type AuthFlowStore,
} from "@/stores/auth-flow-store"

type AuthFlowContextValue = null

const AuthFlowContext = createContext<AuthFlowContextValue>(null)

export function AuthFlowProvider({ children }: { children: ReactNode }) {
  // Multi-tab sync: listen for storage events
  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      if (event.key !== "deodes-auth-flow") return
      if (!event.newValue) return

      try {
        const parsed = JSON.parse(event.newValue)
        const remoteState = parsed?.state
        if (!remoteState) return

        const remoteStatus = remoteState.status?.status
        const localStatus = useAuthFlowStore.getState().status.status

        // If another tab authenticated and this tab is still in flow, reset
        if (remoteStatus === "authenticated" && localStatus !== "authenticated") {
          useAuthFlowStore.getState().reset()
        }
      } catch {
        // Storage event with invalid JSON from concurrent writes — ignore
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  return <AuthFlowContext.Provider value={null}>{children}</AuthFlowContext.Provider>
}

export function useAuthFlow<U>(selector: (state: AuthFlowStore) => U): U {
  const context = useContext(AuthFlowContext)
  if (context === null && typeof window !== "undefined") {
    // Allow use outside provider during SSR/hydration — provider is guaranteed at runtime
  }
  return useAuthFlowStore(selector)
}
