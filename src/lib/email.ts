import nodemailer from "nodemailer"

type PasswordResetEmailInput = {
  to: string
  firstName?: string | null
  resetUrl: string
}

function getSmtpPort() {
  const port = Number(process.env.SMTP_PORT || 587)
  return Number.isFinite(port) ? port : 587
}

function requireSmtpConfig() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD

  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured")
  }

  return { host, user, pass, port: getSmtpPort() }
}

export function getAppBaseUrl() {
  return process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
}

export async function sendPasswordResetEmail({ to, firstName, resetUrl }: PasswordResetEmailInput) {
  const smtp = requireSmtpConfig()
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  })

  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Quotetion"
  const from = process.env.SMTP_FROM || `"${appName}" <${smtp.user}>`
  const greeting = firstName ? `Hi ${firstName},` : "Hi,"

  await transporter.sendMail({
    from,
    to,
    subject: `Reset your ${appName} password`,
    text: `${greeting}\n\nUse this secure link to reset your password. It expires in 30 minutes:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:Inter,Segoe UI,sans-serif;line-height:1.6;color:#191919">
        <p>${greeting}</p>
        <p>Use this secure link to reset your password. It expires in 30 minutes.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none">Reset password</a></p>
        <p style="color:#6b7280;font-size:14px">If you did not request this, you can ignore this email.</p>
      </div>
    `,
  })
}
