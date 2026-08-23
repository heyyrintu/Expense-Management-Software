// Email stub (PLAN 2.3): console transport by default; real SMTP when
// SMTP_URL is set (e.g. smtp://user:pass@localhost:1025). Never throws.

/** A real file attachment. Added in G3 so the monthly summary could stop
 *  pasting a CSV into the message body. */
export type EmailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType: string;
};

export type Email = {
  to: string;
  subject: string;
  text: string;
  attachments?: EmailAttachment[];
};

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
        attachments: email.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
    } else {
      // The stub logs attachment NAMES AND SIZES rather than contents: a
      // 300-row CSV or a PDF's binary in the dev console buries every other
      // line of output, which is the same mistake putting it in the body was.
      const files = email.attachments?.length
        ? `\n[attachments] ${email.attachments
            .map((a) => `${a.filename} (${a.contentType}, ${byteLength(a.content)} bytes)`)
            .join(", ")}`
        : "";
      console.log(
        `[email stub] to=${email.to} subject="${email.subject}"\n${email.text}${files}`
      );
    }
  } catch (e) {
    // notifications must never break the workflow
    console.error("[email] send failed:", e);
  }
}

function byteLength(content: Buffer | string): number {
  return typeof content === "string" ? Buffer.byteLength(content, "utf8") : content.length;
}
