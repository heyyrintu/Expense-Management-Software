// Email stub (PLAN 2.3): console transport by default; real SMTP when
// SMTP_URL is set (e.g. smtp://user:pass@localhost:1025). Never throws.
export type Email = { to: string; subject: string; text: string };

export async function sendEmail(email: Email): Promise<void> {
  try {
    const smtpUrl = process.env.SMTP_URL;
    if (smtpUrl) {
      const { createTransport } = await import("nodemailer");
      const transport = createTransport(smtpUrl);
      await transport.sendMail({
        from: process.env.SMTP_FROM ?? "expenses@localhost",
        to: email.to,
        subject: email.subject,
        text: email.text,
      });
    } else {
      console.log(
        `[email stub] to=${email.to} subject="${email.subject}"\n${email.text}`
      );
    }
  } catch (e) {
    // notifications must never break the workflow
    console.error("[email] send failed:", e);
  }
}
