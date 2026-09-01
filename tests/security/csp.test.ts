import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "../../proxy.js";

describe("strict browser content security policy", () => {
  it("uses a per-request script nonce and forbids unsafe inline production scripts", () => {
    const policy = buildContentSecurityPolicy("unique-nonce", false);
    expect(policy).toContain("script-src 'self' 'nonce-unique-nonce' 'strict-dynamic'");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
  });
});
