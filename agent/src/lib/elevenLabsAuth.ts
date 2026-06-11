import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify an ElevenLabs webhook signature.
 * Header format: ElevenLabs-Signature: t={unix_ts},v0={hmac_sha256_hex}
 * HMAC payload:  `${timestamp}.${raw_body}`
 */
export function verifyElevenLabsSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): boolean {
  const parts = Object.fromEntries(
    signatureHeader
      .split(",")
      .map((segment) => {
        const idx = segment.indexOf("=");
        return idx === -1
          ? [segment, ""]
          : [segment.slice(0, idx), segment.slice(idx + 1)];
      }),
  );

  const timestamp = parts["t"];
  const receivedSig = parts["v0"];
  if (!timestamp || !receivedSig) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(receivedSig, "hex"),
    );
  } catch {
    return false;
  }
}
