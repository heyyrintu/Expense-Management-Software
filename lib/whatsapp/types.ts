// Provider-agnostic WhatsApp channel contract (8.1).
//
// Everything the app calls goes through this interface, so swapping Meta
// Cloud API for Twilio (or a test double) is a one-line change in
// lib/whatsapp/index.ts. Nothing above this layer knows about Graph URLs,
// wa_ids, or Meta's payload shapes.

export type WhatsAppConfig = {
  /** Meta: the phone-number id that owns the business number. */
  phoneNumberId: string;
  /** Permanent access token (decrypted just-in-time, never logged). */
  token: string;
  /** App secret used for X-Hub-Signature-256 payload verification. */
  appSecret: string;
  /** Token echoed back during the GET webhook handshake. */
  verifyToken: string;
  /** Display number, E.164 — never used for routing. */
  businessPhone?: string;
};

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

export type MediaDownload =
  | { ok: true; body: Buffer; contentType: string; fileName: string }
  | { ok: false; error: string };

/** A template parameter — Meta calls these body components. */
export type TemplateParams = {
  name: string;
  languageCode: string;
  bodyParams?: string[];
  /** Quick-reply button payloads, in order (8.3 uses these). */
  buttonPayloads?: string[];
};

export interface WhatsAppProvider {
  readonly name: string;
  sendText(to: string, body: string): Promise<SendResult>;
  sendTemplate(to: string, template: TemplateParams): Promise<SendResult>;
  sendMedia(
    to: string,
    media: { mediaId?: string; link?: string; caption?: string; kind: "image" | "document" }
  ): Promise<SendResult>;
  downloadMedia(mediaId: string): Promise<MediaDownload>;
  /** GET handshake: returns the challenge to echo, or null to reject. */
  verifyWebhook(query: {
    mode?: string | null;
    token?: string | null;
    challenge?: string | null;
  }): string | null;
  /** POST authenticity: raw body + signature header. */
  verifySignature(rawBody: string, signatureHeader: string | null): boolean;
}

/** Normalized inbound message, provider-independent (8.2 consumes these). */
export type InboundMessage = {
  waMessageId: string;
  /** Business number that received it — this is what routes to an org. */
  phoneNumberId: string;
  /** Sender, +E.164. */
  from: string;
  type: string;
  text: string | null;
  mediaId: string | null;
  receivedAt: Date;
  raw: unknown;
};
