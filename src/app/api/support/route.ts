import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, message, requestId, errorType } = body

    // Validate input
    if (!email || !message) {
      return NextResponse.json(
        { error: "Email and message are required" },
        { status: 400 }
      )
    }

    // Support triage channel: tickets land in the server log until the
    // ticket store exists. The reporter email is intentionally retained
    // (plaintext) — it is the reply path, and this route is the product's
    // only inbound support contact. Revisit when tickets gain storage.
    console.log("[Support Request]", {
      email,
      message,
      requestId,
      errorType,
      timestamp: new Date().toISOString(),
    })

    // Return success
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Support API] Error:", error)
    return NextResponse.json(
      { error: "Failed to process support request" },
      { status: 500 }
    )
  }
}
