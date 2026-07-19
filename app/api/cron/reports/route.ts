import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { adminDb } from "@/lib/firebase/admin";
import { loadTrackerStateAdmin } from "@/lib/firebase/load-tracker-state-admin";
import { buildReportHtml } from "@/lib/report-email";

export const runtime = "nodejs";

type ScheduledKind = "fortnightly" | "month-end";

function isLastDayInIndia() {
  const indiaNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const tomorrow = new Date(indiaNow);
  tomorrow.setUTCDate(indiaNow.getUTCDate() + 1);
  return tomorrow.getUTCMonth() !== indiaNow.getUTCMonth();
}

function isScheduledKind(value: string | null): value is ScheduledKind {
  return value === "fortnightly" || value === "month-end";
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json({ error: "Gmail configuration is missing." }, { status: 503 });
  }

  const requestedKind = new URL(request.url).searchParams.get("kind");
  const kind: ScheduledKind = isScheduledKind(requestedKind) ? requestedKind : "fortnightly";

  if (kind === "month-end" && !isLastDayInIndia()) {
    return NextResponse.json({ ok: true, skipped: "Not the last day of the month in India." });
  }

  try {
    const db = adminDb();
    const users = await db.collection("users").where("reportAutomationEnabled", "==", true).get();
    let sent = 0;
    const failures: string[] = [];

    for (const user of users.docs) {
      try {
        const settingsSnapshot = await user.ref.collection("reports").doc("settings").get();
        if (!settingsSnapshot.exists) continue;
        const settings = settingsSnapshot.data() as { email?: string; fortnightly?: boolean; monthEnd?: boolean; enabled?: boolean };
        if (!settings.enabled || !settings.email) continue;
        if (kind === "fortnightly" && !settings.fortnightly) continue;
        if (kind === "month-end" && !settings.monthEnd) continue;

        const state = await loadTrackerStateAdmin(user.id);
        if (!state) continue;

        await sendEmail({
          to: settings.email,
          subject: kind === "month-end" ? "Your TrackBetter monthly review" : "Your TrackBetter 15-day review",
          html: buildReportHtml(state, kind),
          text: kind === "month-end" ? "Your TrackBetter monthly review is ready." : "Your TrackBetter 15-day review is ready."
        });
        sent += 1;
      } catch (error) {
        failures.push(`${user.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return NextResponse.json({ ok: failures.length === 0, users: users.size, sent, failures });
  } catch (error) {
    console.error("Scheduled report job failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Scheduled report job failed." }, { status: 500 });
  }
}
