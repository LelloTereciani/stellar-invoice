import { Keypair } from "@stellar/stellar-sdk";

const SESSION_TTL_MS = 10 * 60 * 1000;
const MAX_ACTIVE_SESSIONS = 100;

type DemoSession = {
  customerPublicKey: string;
  expiresAt: number;
  id: string;
  usedAt?: number;
};

const sessions = new Map<string, DemoSession>();

function assertPublicKey(publicKey: string) {
  try {
    Keypair.fromPublicKey(publicKey);
  } catch {
    throw new Error("A valid Stellar public key is required");
  }
}

export function createDemoSession(customerPublicKey: string, now = Date.now()): DemoSession {
  assertPublicKey(customerPublicKey);
  for (const [id, existing] of sessions) if (existing.expiresAt <= now || existing.usedAt) sessions.delete(id);
  if ([...sessions.values()].some((session) => session.customerPublicKey === customerPublicKey)) throw new Error("Demo wallet already has an active session");
  if (sessions.size >= MAX_ACTIVE_SESSIONS) throw new Error("Demo provisioning is temporarily at capacity");
  const session: DemoSession = {
    customerPublicKey,
    expiresAt: now + SESSION_TTL_MS,
    id: crypto.randomUUID(),
  };
  sessions.set(session.id, session);
  return session;
}

export function consumeDemoSession(sessionId: string, now = Date.now()): DemoSession {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("Demo session was not found");
  if (session.expiresAt <= now) {
    sessions.delete(sessionId);
    throw new Error("Demo session has expired");
  }
  if (session.usedAt) throw new Error("Demo session has already been used");

  session.usedAt = now;
  return session;
}

export function resetDemoSessions() {
  sessions.clear();
}
