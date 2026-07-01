import { NextRequest, NextResponse } from "next/server"
import { createDueFollowUpReminders } from "@/lib/followup-reminders"

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await createDueFollowUpReminders()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Follow-up reminder cron failed", error)
    return NextResponse.json({ error: "Failed to create follow-up reminders" }, { status: 500 })
  }
}
