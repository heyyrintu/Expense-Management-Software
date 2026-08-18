// Provider-agnostic inbound email (PLAN 6.6).
export type InboundAttachment = {
  fileName: string;
  contentType: string;
  content: Buffer;
};

export type InboundEmail = {
  from: string; // sender address, lowercased
  to: string[]; // all recipient addresses, lowercased
  subject: string;
  attachments: InboundAttachment[];
};
