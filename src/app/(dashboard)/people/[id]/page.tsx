"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function PersonProfilePage() {
  return (
    <div className="space-y-8" data-testid="person-profile-page">
      <Link
        href="/people"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to People Directory
      </Link>
      <div className="border border-white/10 rounded-2xl py-12 text-center space-y-4">
        <h1 className="font-heading text-xl font-bold text-foreground">Member profiles coming soon</h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Public member profiles ship with the directory backend — meanwhile, meet people inside your circles.
        </p>
      </div>
    </div>
  )
}

