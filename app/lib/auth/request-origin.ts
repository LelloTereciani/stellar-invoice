export function assertTrustedOrigin(request: Request, allowedOrigin: string) {
  let normalizedAllowedOrigin: string;
  try {
    normalizedAllowedOrigin = new URL(allowedOrigin).origin;
  } catch {
    throw new Error("APP_ORIGIN must be a valid origin");
  }
  if (request.headers.get("origin") !== normalizedAllowedOrigin) {
    throw new Error("Untrusted request origin");
  }
}
