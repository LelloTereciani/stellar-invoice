import { describe, expect, it } from "vitest";

describe("demo session errors", () => {
  it("maps an existing BRLT allowance to a recoverable resume action", async () => {
    const { mapDemoSessionError } = await import("../../app/lib/demo/persistent-session.js");

    const error = mapDemoSessionError({ message: "Demo wallet has already received its BRLT allowance" });

    expect(error).toMatchObject({
      code: "DEMO_ALREADY_PROVISIONED",
      message: "Esta carteira demo já recebeu BRLT. Use Continuar demonstração.",
    });
  });

  it("maps per-origin and global limits to the same safe public error", async () => {
    const { mapDemoSessionError } = await import("../../app/lib/demo/persistent-session.js");

    expect(mapDemoSessionError({ message: "Demo request limit exceeded" })).toMatchObject({
      code: "DEMO_RATE_LIMIT",
      message: "O limite diário de demonstrações foi atingido. Tente novamente após a renovação do limite.",
    });
    expect(mapDemoSessionError({ message: "Daily demo session limit exceeded" })).toMatchObject({
      code: "DEMO_RATE_LIMIT",
      message: "O limite diário de demonstrações foi atingido. Tente novamente após a renovação do limite.",
    });
  });
});
