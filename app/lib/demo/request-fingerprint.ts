import { createHmac } from "node:crypto";

export function demoRequestFingerprint(request: Request, secret: string): string {
  if (secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  // Caddy is the only public entrypoint and replaces the forwarding chain before the app sees it.
  // O Caddy é a única entrada pública e substitui a cadeia de encaminhamento antes de chegar ao app.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip")?.trim() || "unavailable";
  return createHmac("sha256", secret).update(`demo-rate-limit:${address.slice(0, 128)}`).digest("hex");
}
