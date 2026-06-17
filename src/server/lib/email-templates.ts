export type EmailTemplateVars = {
  firstName: string
  lastName: string
  brokerFirstName: string
  brokerLastName: string
  brokerEmail: string
}

export type EmailTemplate = {
  subject: string
  buildBody: (vars: EmailTemplateVars) => string
}

// Maps flow_control_item.abbreviation → email to send when item is checked completed.
// Add or remove entries here; the abbreviation must match exactly.
export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  DRFT: {
    subject: "Your will draft is ready for review",
    buildBody: (v) => `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e6363;">Your will draft is ready</h2>
        <p>Hi ${v.firstName},</p>
        <p>
          Your will has been drafted and is ready for your review.
          ${v.brokerFirstName} ${v.brokerLastName} will be in touch shortly to walk you through
          the document and answer any questions.
        </p>
        <p>If you need anything before then, reply to this email or contact ${v.brokerFirstName} at
          <a href="mailto:${v.brokerEmail}">${v.brokerEmail}</a>.
        </p>
        <p>Best regards,<br>The Wills Team</p>
      </div>
    `,
  },

  SIGN: {
    subject: "Will signed and witnessed",
    buildBody: (v) => `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e6363;">Will signed and witnessed</h2>
        <p>Hi ${v.firstName},</p>
        <p>
          This confirms that your will has been signed in the presence of witnesses.
          The original document is now safely with us.
        </p>
        <p>You can request a certified copy at any time.</p>
        <p>Best regards,<br>The Wills Team</p>
      </div>
    `,
  },

  FILE: {
    subject: "Your will is securely filed",
    buildBody: (v) => `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e6363;">Will filed</h2>
        <p>Hi ${v.firstName},</p>
        <p>Your original will document has been filed in our secure storage.</p>
        <p>If you ever need a copy or have any changes you'd like to make, reach out to
          <a href="mailto:${v.brokerEmail}">${v.brokerEmail}</a>.
        </p>
        <p>Best regards,<br>The Wills Team</p>
      </div>
    `,
  },
}