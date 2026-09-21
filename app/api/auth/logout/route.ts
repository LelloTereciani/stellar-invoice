import { NextResponse } from "next/server.js";

import { assertTrustedOrigin } from "../../../lib/auth/request-origin.js";
import { WALLET_SESSION_COOKIE } from "../../../lib/auth/wallet-session.js";
import { requireServerEnv } from "../../../lib/config.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const origin = requireServerEnv("APP_ORIGIN", process.env);
    assertTrustedOrigin(request, origin);

    const response = NextResponse.json({ authenticated: false });
    response.cookies.set(WALLET_SESSION_COOKIE, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "strict",
      secure: new URL(origin).protocol === "https:",
    });
    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Wallet logout failed" },
      { status: 400 },
    );
  }
}
