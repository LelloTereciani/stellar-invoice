import { describe, expect, it } from "vitest";

import { demoRequestFingerprint } from "../../app/lib/demo/request-fingerprint.js";

describe("demo request fingerprint", () => {
  it("creates a stable irreversible value without retaining the address", () => {
    const request = new Request("https://invoice.example.com/api/demo/provision", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });
    const fingerprint = demoRequestFingerprint(request, "s".repeat(48));

    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).toBe(demoRequestFingerprint(request, "s".repeat(48)));
    expect(fingerprint).not.toContain("203.0.113.10");
  });
});
