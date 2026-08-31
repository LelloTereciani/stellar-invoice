import { NextResponse } from "next/server.js";
import { createIssuerChallenge } from "../../../lib/auth/issuer-challenge.js";

export const runtime = "nodejs";
export async function POST() { return NextResponse.json(createIssuerChallenge()); }
