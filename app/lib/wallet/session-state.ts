import type { ActiveWalletMode } from "./active-mode-client.js";

export type FreighterStatus = "unavailable" | "detected" | "authenticating" | "authenticated" | "rejected" | "failed";

export type WalletSessionState = {
  active: { mode: ActiveWalletMode; publicKey: string } | null;
  freighter: { publicKey?: string; status: FreighterStatus };
  transition: { at?: string; detail?: string; message: string };
};

export type WalletSessionEvent =
  | { at: string; mode: ActiveWalletMode; publicKey: string; type: "session-restored" }
  | { at: string; publicKey: string; type: "freighter-detected" }
  | { at: string; type: "freighter-authentication-started" }
  | { at: string; publicKey: string; type: "freighter-authenticated" }
  | { at: string; detail?: string; message: string; type: "freighter-failed" | "freighter-rejected" }
  | { at: string; publicKey: string; type: "demo-authenticated" }
  | { at: string; type: "logged-out" };

export const initialWalletSessionState: WalletSessionState = {
  active: null,
  freighter: { status: "unavailable" },
  transition: { message: "Nenhuma sessão de carteira está ativa." },
};

export function reduceWalletSession(state: WalletSessionState, event: WalletSessionEvent): WalletSessionState {
  switch (event.type) {
    case "session-restored":
      return {
        active: { mode: event.mode, publicKey: event.publicKey },
        freighter: event.mode === "freighter"
          ? { publicKey: event.publicKey, status: "authenticated" }
          : state.freighter,
        transition: { at: event.at, message: event.mode === "demo" ? "Sessão de demonstração restaurada." : "Sessão Freighter restaurada." },
      };
    case "freighter-detected":
      return { ...state, freighter: { publicKey: event.publicKey, status: "detected" }, transition: { at: event.at, message: "Freighter detectada, mas ainda não autenticada." } };
    case "freighter-authentication-started":
      return { ...state, freighter: { ...state.freighter, status: "authenticating" }, transition: { at: event.at, message: "Aguardando autenticação na Freighter." } };
    case "freighter-authenticated":
      return { active: { mode: "freighter", publicKey: event.publicKey }, freighter: { publicKey: event.publicKey, status: "authenticated" }, transition: { at: event.at, message: "Freighter autenticada e ativa." } };
    case "freighter-failed":
    case "freighter-rejected":
      return { ...state, freighter: { ...state.freighter, status: event.type === "freighter-rejected" ? "rejected" : "failed" }, transition: { at: event.at, detail: event.detail, message: event.message } };
    case "demo-authenticated":
      return { ...state, active: { mode: "demo", publicKey: event.publicKey }, transition: { at: event.at, message: "Demonstração autenticada e ativa." } };
    case "logged-out":
      return {
        active: null,
        freighter: state.freighter.publicKey ? { publicKey: state.freighter.publicKey, status: "detected" } : { status: "unavailable" },
        transition: { at: event.at, message: "Sessão encerrada. Nenhuma carteira está ativa." },
      };
  }
}
