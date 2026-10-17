"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import { patch, getErrorMessage } from "@/lib/api-client"
import { useAuthStore } from "@/stores/auth-store"
import { useUIStore } from "@/stores/ui-store"
import { logger } from "@/lib/logger"
import { resizeAvatar, validateAvatarFile } from "../utils/resize-image"

export function useAvatarUpload() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const addToast = useUIStore((s) => s.addToast)

  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null)
  const [processing, setProcessing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Release the object URL whenever the preview is replaced or unmounted.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url)
    }
  }, [preview])

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = ""
  }

  const selectFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const error = validateAvatarFile(file)
    if (error) {
      addToast({ type: "error", title: "Invalid image", description: error })
      resetInput()
      return
    }
    setProcessing(true)
    try {
      const blob = await resizeAvatar(file)
      setPreview({ blob, url: URL.createObjectURL(blob) })
    } catch (err) {
      logger.error("Avatar resize failed", { error: err, fileName: file.name })
      addToast({ type: "error", title: "Could not process image", description: getErrorMessage(err) })
    } finally {
      setProcessing(false)
      resetInput()
    }
  }, [addToast])

  const cancel = useCallback(() => setPreview(null), [])

  const confirm = useCallback(async () => {
    if (!preview) return
    setUploading(true)
    try {
      // No avatar file host exists: persist the resized image as a data URL
      // on the profile (avatarIpfsHash, TEXT column). 256px webp stays small.
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("Could not read image"))
        reader.readAsDataURL(preview.blob)
      })
      const res = await patch<{ user?: { avatarIpfsHash?: string } } & Record<string, unknown>>("/users/me", {
        avatarIpfsHash: dataUrl,
      })
      const saved = (res as { user?: { avatarIpfsHash?: string } })?.user?.avatarIpfsHash ?? dataUrl
      if (user) updateUser({ ...user, avatarIpfsHash: saved })
      addToast({ type: "success", title: "Avatar updated" })
      setPreview(null)
    } catch (err) {
      addToast({ type: "error", title: "Upload failed", description: getErrorMessage(err) })
    } finally {
      setUploading(false)
    }
  }, [preview, user, updateUser, addToast])

  return { inputRef, preview, processing, uploading, selectFile, cancel, confirm }
}
