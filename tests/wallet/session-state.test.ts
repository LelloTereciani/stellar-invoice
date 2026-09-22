import { describe, expect, it } from "vitest";

import {
  initialWalletSessionState,
  reduceWalletSession,
} from "../../app/lib/wallet/session-state.js";

const demo = "GDEMO";
const freighter = "GFREIGHTER";
const at = "2030-01-01T00:00:00.000Z";

describe("wallet session state", () => {
  it("keeps demo active while Freighter is detected and authenticating", () => {
    const demoActive = reduceWalletSession(initialWalletSessionState, {
      at,
      mode: "demo",
      publicKey: demo,
      type: "session-restored",
    });
    const detected = reduceWalletSession(demoActive, { at, publicKey: freighter, type: "freighter-detected" });
    const authenticating = reduceWalletSession(detected, { at, type: "freighter-authentication-started" });

    expect(authenticating.active).toEqual({ mode: "demo", publicKey: demo });
    expect(authenticating.freighter).toEqual({ publicKey: freighter, status: "authenticating" });
  });

  it("atomically replaces demo only after Freighter authentication succeeds", () => {
    const demoActive = reduceWalletSession(initialWalletSessionState, {
      at,
      mode: "demo",
      publicKey: demo,
      type: "session-restored",
    });
    const detected = reduceWalletSession(demoActive, { at, publicKey: freighter, type: "freighter-detected" });
    const authenticated = reduceWalletSession(detected, { at, publicKey: freighter, type: "freighter-authenticated" });

    expect(authenticated.active).toEqual({ mode: "freighter", publicKey: freighter });
    expect(authenticated.freighter.status).toBe("authenticated");
  });

  it("retains demo when Freighter authentication fails", () => {
    const demoActive = reduceWalletSession(initialWalletSessionState, {
      at,
      mode: "demo",
      publicKey: demo,
      type: "session-restored",
    });
    const detected = reduceWalletSession(demoActive, { at, publicKey: freighter, type: "freighter-detected" });
    const failed = reduceWalletSession(detected, {
      at,
      detail: "Wallet challenge signature is invalid",
      message: "Não foi possível ativar a Freighter. Tente novamente.",
      type: "freighter-failed",
    });

    expect(failed.active).toEqual({ mode: "demo", publicKey: demo });
    expect(failed.freighter).toMatchObject({ publicKey: freighter, status: "failed" });
    expect(failed.transition.detail).toContain("signature");
  });

  it("clears every active identity on logout", () => {
    const active = reduceWalletSession(initialWalletSessionState, {
      at,
      mode: "freighter",
      publicKey: freighter,
      type: "session-restored",
    });
    const loggedOut = reduceWalletSession(active, { at, type: "logged-out" });

    expect(loggedOut.active).toBeNull();
    expect(loggedOut.freighter.status).toBe("detected");
  });
});
