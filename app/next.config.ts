import type { NextConfig } from "next";

/**
 * Nonce-less CSP that Next 16 can ship. Browser traffic needs Supabase (auth +
 * storage) and Vercel live preview; Green Invoice / Twilio / OpenAI / ElevenLabs
 * are server-side but listed so a future client call is not blocked.
 * next/font self-hosts Noto, so Google Fonts origins are omitted.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://vercel.live",
    "wss://vercel.live",
    "https://api.greeninvoice.co.il",
    "https://sandbox.d.greeninvoice.co.il",
    "https://api.morning.co",
    "https://api.sandbox.morning.dev",
    "https://api.twilio.com",
    "https://api.openai.com",
    "https://api.elevenlabs.io",
  ].join(" "),
  "media-src 'self' blob: https://*.supabase.co",
  "worker-src 'self' blob:",
  "frame-src https://vercel.live",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
