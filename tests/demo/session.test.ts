import { describe, expect, it } from "vitest";

import { createDemoSession, consumeDemoSession, resetDemoSessions } from "../../app/lib/demo/session.js";

const customerPublicKey = "GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY";

describe("Testnet demo sessions", () => {
  it("creates a short-lived session for a Stellar public key without accepting a seed", () => {
    resetDemoSessions();

    const session = createDemoSession(customerPublicKey, 1_000);

    expect(session.customerPublicKey).toBe(customerPublicKey);
    expect(session.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(() => createDemoSession("SABC", 1_000)).toThrow("valid Stellar public key");
  });

  it("allows one distribution only and rejects expired or unknown sessions", () => {
    resetDemoSessions();
    const session = createDemoSession(customerPublicKey, 1_000);

    expect(consumeDemoSession(session.id, 1_001)).toMatchObject({ customerPublicKey });
    expect(() => consumeDemoSession(session.id, 1_001)).toThrow("already been used");
    expect(() => consumeDemoSession("00000000-0000-0000-0000-000000000000", 1_001)).toThrow("not found");
  });
});
