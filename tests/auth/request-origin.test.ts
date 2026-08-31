import { describe, expect, it } from "vitest";

import { assertTrustedOrigin } from "../../app/lib/auth/request-origin.js";

describe("mutable request origin", () => {
  it("accepts only the configured application origin", () => {
    expect(() => assertTrustedOrigin(new Request("https://invoice.example/api", { headers: { origin: "https://invoice.example" } }), "https://invoice.example")).not.toThrow();
    expect(() => assertTrustedOrigin(new Request("https://invoice.example/api", { headers: { origin: "https://evil.example" } }), "https://invoice.example")).toThrow("Untrusted request origin");
    expect(() => assertTrustedOrigin(new Request("https://invoice.example/api"), "https://invoice.example")).toThrow("Untrusted request origin");
  });
});
