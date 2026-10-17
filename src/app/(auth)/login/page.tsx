"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { loginSchema, zodResolver, type LoginInput } from "@/lib/validation"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"
import { getErrorMessage } from "@/lib/api-client"
import { navigatePostAuth } from "@/lib/app-host"
import { post } from "@/lib/api-client"
import type { User } from "@/types"
import { AuthLayout } from "@/components/auth/auth-layout"
import { GoogleButton } from "@/components/auth/google-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface LoginEnvelope {
  success?: boolean
  data?: {
    token?: string
    refreshToken?: string
    csrfToken?: string
    user?: User
  }
  token?: string
  refreshToken?: string
  csrfToken?: string
  user?: User
  error?: string
  message?: string
}

export default function LoginPage() {
  const router = useRouter()
  const setTokens = useAuthStore((s) => s.setTokens)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  // Already signed in → the app host, not the login form again.
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigatePostAuth(router.replace.bind(router), "/")
    }
  }, [isAuthenticated, isLoading, router])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
  })

  const onSubmit = useCallback(
    async (values: LoginInput) => {
      setLoading(true)
      try {
        const res = await post<LoginEnvelope>("/auth/login", values)
        const data = res?.data ?? res
        const token = data?.token
        if (res?.success === false) {
          throw new Error(res.error || res.message || "Login failed")
        }
        if (token) {
          // setTokens persists the HttpOnly session cookie the middleware gates
          // on, so navigation must wait for it to resolve. Apex logins land
          // on the app host (dashboard lives there only).
          await setTokens(token, data?.refreshToken ?? token, data?.user, data?.csrfToken)
          toast.success("Welcome back!")
          navigatePostAuth(router.replace.bind(router), "/")
        } else {
          throw new Error("Invalid login response")
        }
      } catch (err: unknown) {
        toast.error(getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [setTokens, toast, router],
  )

  return (
    <AuthLayout title="Sign in to Deodes">
      <div className="space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate aria-label="Email login form">
          <Input
            id="email"
            type="email"
            label="Email Address"
            placeholder="you@example.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            id="password"
            type="password"
            label="Password"
            placeholder="••••••••"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={loading}>
            Sign In with Email
          </Button>
        </form>

        <GoogleButton mode="signin" />

        <div className="flex items-center justify-between text-sm">
          <span />
          <Link href="/forgot-password" className="text-aurora-violet hover:underline focus:outline-none focus:ring-2 focus:ring-foreground">
            Forgot password?
          </Link>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-aurora-violet hover:underline focus:outline-none focus:ring-2 focus:ring-foreground">
            Register
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
