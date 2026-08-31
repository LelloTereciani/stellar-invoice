import { NextResponse } from "next/server.js";

import { verifyAndConsumeWalletChallenge } from "../../../lib/auth/persistent-wallet-challenge.js";
import { assertTrustedOrigin } from "../../../lib/auth/request-origin.js";
import { createWalletSession, WALLET_SESSION_COOKIE } from "../../../lib/auth/wallet-session.js";
import { createWalletChallengeStore } from "../../../lib/auth/wallet-challenge-store.js";
import { requireServerEnv } from "../../../lib/config.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const origin = requireServerEnv("APP_ORIGIN", process.env);
    assertTrustedOrigin(request, origin);
    const body = (await request.json()) as {
      expiresAt?: string;
      id?: string;
      message?: string;
      signature?: string;
      walletPublicKey?: string;
    };
    if (!body.expiresAt || !body.id || !body.message || !body.signature || !body.walletPublicKey) {
      throw new Error("Incomplete wallet authentication request");
    }
    await verifyAndConsumeWalletChallenge({
      expiresAt: body.expiresAt,
      id: body.id,
      message: body.message,
      signature: body.signature,
    }, {
      origin,
      walletPublicKey: body.walletPublicKey,
    }, createWalletChallengeStore());

    const session = createWalletSession(
      body.walletPublicKey,
      requireServerEnv("SESSION_SECRET", process.env),
    );
    const response = NextResponse.json({ authenticated: true, walletPublicKey: body.walletPublicKey });
    response.cookies.set(WALLET_SESSION_COOKIE, session, {
      httpOnly: true,
      maxAge: 60 * 60,
      path: "/",
      sameSite: "strict",
      secure: new URL(origin).protocol === "https:",
    });
    return response;
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wallet authentication failed" }, { status: 400 });
  }
}
