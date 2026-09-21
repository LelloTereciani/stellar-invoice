import { Keypair } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWalletSession, WALLET_SESSION_COOKIE } from "../../app/lib/auth/wallet-session.js";

const appOrigin = "https://invoice.example.com";
const sessionSecret = "session-secret-at-least-32-characters";

function requestWithSession(token: string, query = ""): Request {
  return new Request(`${appOrigin}/api/auth/session${query}`, {
    headers: { cookie: `${WALLET_SESSION_COOKIE}=${token}` },
  });
}

beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", appOrigin);
  vi.stubEnv("SESSION_SECRET", sessionSecret);
});

afterEach(() => vi.unstubAllEnvs());

describe("wallet authentication session API", () => {
  it("returns the public key from a valid signed session cookie", async () => {
    const walletPublicKey = Keypair.random().publicKey();
    const token = createWalletSession(walletPublicKey, sessionSecret);
    const { GET } = await import("../../app/api/auth/session/route.js");

    const response = await GET(requestWithSession(token));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: true, publicKey: walletPublicKey });
  });

  it("does not treat a client-supplied public key as authentication", async () => {
    const authenticatedPublicKey = Keypair.random().publicKey();
    const suppliedPublicKey = Keypair.random().publicKey();
    const token = createWalletSession(authenticatedPublicKey, sessionSecret);
    const { GET } = await import("../../app/api/auth/session/route.js");

    const response = await GET(requestWithSession(token, `?publicKey=${suppliedPublicKey}`));

    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      publicKey: authenticatedPublicKey,
    });
  });

  it("returns unauthenticated when the session cookie is missing", async () => {
    const { GET } = await import("../../app/api/auth/session/route.js");

    const response = await GET(new Request(`${appOrigin}/api/auth/session`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
  });

  it("returns unauthenticated when the session cookie is invalid", async () => {
    const { GET } = await import("../../app/api/auth/session/route.js");

    const response = await GET(requestWithSession("invalid.session"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
  });

  it("returns unauthenticated when the session cookie is expired", async () => {
    const walletPublicKey = Keypair.random().publicKey();
    const expiredToken = createWalletSession(
      walletPublicKey,
      sessionSecret,
      new Date("2020-01-01T00:00:00.000Z"),
    );
    const { GET } = await import("../../app/api/auth/session/route.js");

    const response = await GET(requestWithSession(expiredToken));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
  });

  it("returns a generic server error when the session secret is missing", async () => {
    const walletPublicKey = Keypair.random().publicKey();
    const token = createWalletSession(walletPublicKey, sessionSecret);
    vi.stubEnv("SESSION_SECRET", "");
    const { GET } = await import("../../app/api/auth/session/route.js");

    const response = await GET(requestWithSession(token));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Wallet session inspection failed" });
    expect(JSON.stringify(body)).not.toContain("SESSION_SECRET");
    expect(JSON.stringify(body)).not.toContain("Missing required environment variable");
  });
});

describe("wallet authentication logout API", () => {
  it("clears the wallet session cookie and returns unauthenticated", async () => {
    const { POST } = await import("../../app/api/auth/logout/route.js");
    const request = new Request(`${appOrigin}/api/auth/logout`, {
      headers: { origin: appOrigin },
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(`${WALLET_SESSION_COOKIE}=`);
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=strict");
  });

  it("rejects logout from an untrusted origin without clearing the cookie", async () => {
    const { POST } = await import("../../app/api/auth/logout/route.js");
    const request = new Request(`${appOrigin}/api/auth/logout`, {
      headers: { origin: "https://evil.example" },
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Untrusted request origin" });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects logout without an Origin header without clearing the cookie", async () => {
    const { POST } = await import("../../app/api/auth/logout/route.js");
    const request = new Request(`${appOrigin}/api/auth/logout`, { method: "POST" });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Untrusted request origin" });
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
