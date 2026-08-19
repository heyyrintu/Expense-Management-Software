// Meta WhatsApp Business Cloud API provider (8.1).
//
// The only file that knows about Graph URLs and Meta payload shapes. A Twilio
// provider implements the same WhatsAppProvider interface and drops into
// lib/whatsapp/index.ts without touching callers.
import { verifySignature } from "./signature";
import { fromWaId, toWaId } from "./phone";
import type {
  InboundMessage,
  MediaDownload,
  SendResult,
  TemplateParams,
  WhatsAppConfig,
  WhatsAppProvider,
} from "./types";

const GRAPH_VERSION = process.env.WA_GRAPH_VERSION ?? "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const TIMEOUT_MS = 10_000;

type GraphSendResponse = { messages?: Array<{ id?: string }>; error?: { message?: string } };

export class MetaCloudProvider implements WhatsAppProvider {
  readonly name = "meta-cloud";

  constructor(private readonly config: WhatsAppConfig) {}

  private async post(body: unknown): Promise<SendResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${GRAPH_BASE}/${this.config.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => ({}))) as GraphSendResponse;
      if (!res.ok) {
        // Never surface the token or the full payload in logs.
        const message = json.error?.message ?? `WhatsApp API responded ${res.status}`;
        console.error("[whatsapp] send failed:", message);
        return { ok: false, error: message };
      }
      return { ok: true, messageId: json.messages?.[0]?.id ?? "" };
    } catch (e) {
      const message = e instanceof Error ? e.message : "WhatsApp request failed";
      console.error("[whatsapp] send error:", message);
      return { ok: false, error: message };
    } finally {
      clearTimeout(timer);
    }
  }

  async sendText(to: string, body: string): Promise<SendResult> {
    return this.post({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toWaId(to),
      type: "text",
      text: { preview_url: false, body },
    });
  }

  async sendTemplate(to: string, template: TemplateParams): Promise<SendResult> {
    const components: unknown[] = [];
    if (template.bodyParams?.length) {
      components.push({
        type: "body",
        parameters: template.bodyParams.map((text) => ({ type: "text", text })),
      });
    }
    template.buttonPayloads?.forEach((payload, index) => {
      components.push({
        type: "button",
        sub_type: "quick_reply",
        index: String(index),
        parameters: [{ type: "payload", payload }],
      });
    });
    return this.post({
      messaging_product: "whatsapp",
      to: toWaId(to),
      type: "template",
      template: {
        name: template.name,
        language: { code: template.languageCode },
        ...(components.length > 0 ? { components } : {}),
      },
    });
  }

  async sendMedia(
    to: string,
    media: { mediaId?: string; link?: string; caption?: string; kind: "image" | "document" }
  ): Promise<SendResult> {
    if (!media.mediaId && !media.link) {
      return { ok: false, error: "Provide a media id or a link." };
    }
    return this.post({
      messaging_product: "whatsapp",
      to: toWaId(to),
      type: media.kind,
      [media.kind]: {
        ...(media.mediaId ? { id: media.mediaId } : { link: media.link }),
        ...(media.caption ? { caption: media.caption } : {}),
      },
    });
  }

  /**
   * Interactive buttons. Meta allows at most 3 and truncates titles at 20
   * characters, so we enforce both here rather than failing the send.
   */
  async sendButtons(
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<SendResult> {
    if (buttons.length === 0) return this.sendText(to, body);
    return this.post({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toWaId(to),
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body.slice(0, 1024) },
        action: {
          buttons: buttons.slice(0, 3).map((b) => ({
            type: "reply",
            reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
          })),
        },
      },
    });
  }

  /** Two hops: metadata lookup for the signed URL, then the binary itself. */
  async downloadMedia(mediaId: string): Promise<MediaDownload> {
    try {
      const metaRes = await fetch(`${GRAPH_BASE}/${mediaId}`, {
        headers: { Authorization: `Bearer ${this.config.token}` },
      });
      if (!metaRes.ok) {
        return { ok: false, error: `Media lookup failed (${metaRes.status})` };
      }
      const meta = (await metaRes.json()) as {
        url?: string;
        mime_type?: string;
        file_size?: number;
      };
      if (!meta.url) return { ok: false, error: "Media has no download URL." };

      const binRes = await fetch(meta.url, {
        headers: { Authorization: `Bearer ${this.config.token}` },
      });
      if (!binRes.ok) {
        return { ok: false, error: `Media download failed (${binRes.status})` };
      }
      const contentType = meta.mime_type ?? binRes.headers.get("content-type") ?? "";
      return {
        ok: true,
        body: Buffer.from(await binRes.arrayBuffer()),
        contentType,
        fileName: `whatsapp-${mediaId}${extensionFor(contentType)}`,
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Media download failed",
      };
    }
  }

  verifyWebhook(query: {
    mode?: string | null;
    token?: string | null;
    challenge?: string | null;
  }): string | null {
    if (query.mode !== "subscribe") return null;
    if (!query.token || query.token !== this.config.verifyToken) return null;
    return query.challenge ?? null;
  }

  verifySignature(rawBody: string, signatureHeader: string | null): boolean {
    return verifySignature(rawBody, signatureHeader, this.config.appSecret);
  }
}

function extensionFor(contentType: string): string {
  if (contentType.includes("jpeg")) return ".jpg";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("pdf")) return ".pdf";
  return "";
}

// ---------------------------------------------------------------------------
// Payload parsing — pure, so it is unit-tested without any network.
// ---------------------------------------------------------------------------

type MetaWebhookBody = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        messages?: Array<{
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          image?: { id?: string; caption?: string };
          document?: { id?: string; filename?: string; caption?: string };
          button?: { payload?: string; text?: string };
          interactive?: {
            button_reply?: { id?: string; title?: string };
            list_reply?: { id?: string; title?: string };
          };
        }>;
      };
    }>;
  }>;
};

/** Flatten Meta's entry/changes/value nesting into plain messages. */
export function parseInbound(body: unknown): InboundMessage[] {
  const parsed = body as MetaWebhookBody;
  const out: InboundMessage[] = [];
  for (const entry of parsed?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      for (const msg of value?.messages ?? []) {
        if (!msg.id || !msg.from) continue;
        const type = msg.type ?? "unknown";
        const text =
          msg.text?.body ??
          msg.image?.caption ??
          msg.document?.caption ??
          msg.button?.text ??
          msg.interactive?.button_reply?.title ??
          msg.interactive?.list_reply?.title ??
          null;
        const mediaId = msg.image?.id ?? msg.document?.id ?? null;
        const ts = Number(msg.timestamp ?? 0);
        out.push({
          waMessageId: msg.id,
          phoneNumberId,
          from: fromWaId(msg.from),
          type,
          text,
          mediaId,
          receivedAt: ts > 0 ? new Date(ts * 1000) : new Date(),
          raw: msg,
        });
      }
    }
  }
  return out;
}

/** Quick-reply / button payload, used by 8.3's approve action. */
export function buttonPayloadOf(message: InboundMessage): string | null {
  const raw = message.raw as {
    button?: { payload?: string };
    interactive?: { button_reply?: { id?: string } };
  };
  return raw?.button?.payload ?? raw?.interactive?.button_reply?.id ?? null;
}
