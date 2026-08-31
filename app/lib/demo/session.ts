import { Keypair } from "@stellar/stellar-sdk";

const SESSION_TTL_MS = 10 * 60 * 1000;

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
