import { Resend } from "resend"

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"

if (!RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY must be set")
}

const resend = new Resend(RESEND_API_KEY)

export async function sendEmail({
  to,
  subject,
  htmlBody,
}: {
  to: string
  subject: string
  htmlBody: string
}): Promise<{ id: string }> {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html: htmlBody,
  })

  if (error) {
    throw new Error(`Resend error: ${error.message ?? JSON.stringify(error)}`)
  }
  if (!data) {
    throw new Error("Resend returned no data")
  }
  return { id: data.id }
}