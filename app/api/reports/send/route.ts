import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { adminAuth } from "@/lib/firebase/admin";
import { buildReportHtml } from "@/lib/report-email";
import { loadTrackerStateAdmin } from "@/lib/firebase/load-tracker-state-admin";

export const runtime = "nodejs";

type ReportKind = "preview" | "fortnightly" | "month-end";
type SendReportRequest = { email?: string; kind?: ReportKind };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isReportKind(value: unknown): value is ReportKind {
  return value === "preview" || value === "fortnightly" || value === "month-end";
}

function subjectFor(kind: ReportKind) {
  if (kind === "month-end") return "Your TrackBetter monthly review";
  if (kind === "fortnightly") return "Your TrackBetter 15-day progress report";
  return "Your TrackBetter test report";
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Sign in before sending a report." }, { status: 401 });

    const decoded = await adminAuth().verifyIdToken(token);
    const body = (await request.json()) as SendReportRequest;
    const email = body.email?.trim();
    const kind: ReportKind = isReportKind(body.kind) ? body.kind : "preview";

    if (!email || !EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Enter a valid report email." }, { status: 400 });
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return NextResponse.json({ error: "Gmail environment variables are not configured." }, { status: 503 });

    const state = await loadTrackerStateAdmin(decoded.uid);
    if (!state) return NextResponse.json({ error: "Your tracker data was not found." }, { status: 404 });

    const result = await sendEmail({
      to: email,
      subject: subjectFor(kind),
      html: buildReportHtml(state, kind),
      text: kind === "month-end" ? "Your TrackBetter monthly review is ready." : kind === "fortnightly" ? "Your TrackBetter 15-day progress report is ready." : "Your TrackBetter test report is ready."
    });

    return NextResponse.json({ ok: true, id: result.messageId });
  } catch (error) {
    console.error("Unable to send TrackBetter report:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send report." }, { status: 500 });
  }
}
