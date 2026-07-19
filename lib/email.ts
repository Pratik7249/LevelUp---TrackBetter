import nodemailer from "nodemailer";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getTransporter() {
  if (transporter) return transporter;

  const gmailUser = getRequiredEnv("GMAIL_USER");
  const gmailAppPassword = getRequiredEnv("GMAIL_APP_PASSWORD").replace(/\s+/g, "");

  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: gmailUser,
      pass: gmailAppPassword
    }
  });

  return transporter;
}

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  const gmailUser = getRequiredEnv("GMAIL_USER");
  const from = process.env.REPORT_FROM_EMAIL?.trim() || `TrackBetter <${gmailUser}>`;

  const result = await getTransporter().sendMail({
    from,
    to,
    subject,
    html,
    text,
    replyTo: gmailUser
  });

  if (!result.accepted?.length) {
    throw new Error("Gmail did not accept the report email.");
  }

  return {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected
  };
}
