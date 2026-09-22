type AccountSummaryConfig = {
  assetCode: string;
  horizonUrl: string;
  issuerPublicKey: string;
};

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type AccountSummaryErrorCode =
  | "ACCOUNT_NOT_FOUND"
  | "HORIZON_UNAVAILABLE"
  | "MALFORMED_HORIZON_RESPONSE";

export class AccountSummaryError extends Error {
  constructor(
    public readonly code: AccountSummaryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AccountSummaryError";
  }
}

export type AccountSummary = {
  publicKey: string;
  xlmBalance: string;
  brlt: {
    authorized: boolean | null;
    balance: string;
    limit: string | null;
    trustlinePresent: boolean;
  };
  refreshedAt: string;
};

const STELLAR_AMOUNT = /^(?:0|[1-9]\d*)\.\d{7}$/;

function malformedResponse(): AccountSummaryError {
  return new AccountSummaryError(
    "MALFORMED_HORIZON_RESPONSE",
    "Horizon returned an invalid account response",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireAmount(value: unknown): string {
  if (typeof value !== "string" || !STELLAR_AMOUNT.test(value)) {
    throw malformedResponse();
  }
  return value;
}

function parseAccount(
  value: unknown,
  publicKey: string,
  config: AccountSummaryConfig,
  refreshedAt: string,
): AccountSummary {
  if (!isRecord(value) || value.account_id !== publicKey || !Array.isArray(value.balances)) {
    throw malformedResponse();
  }

  let xlmBalance: string | undefined;
  let brlt: AccountSummary["brlt"] | undefined;

  for (const candidate of value.balances) {
    if (!isRecord(candidate) || typeof candidate.asset_type !== "string") {
      throw malformedResponse();
    }

    if (candidate.asset_type === "native") {
      if (xlmBalance !== undefined) throw malformedResponse();
      xlmBalance = requireAmount(candidate.balance);
      continue;
    }

    const isConfiguredAsset = candidate.asset_code === config.assetCode
      && candidate.asset_issuer === config.issuerPublicKey;
    if (!isConfiguredAsset) continue;

    if (
      brlt !== undefined
      || !["credit_alphanum4", "credit_alphanum12"].includes(candidate.asset_type)
      || typeof candidate.is_authorized !== "boolean"
    ) {
      throw malformedResponse();
    }

    brlt = {
      authorized: candidate.is_authorized,
      balance: requireAmount(candidate.balance),
      limit: requireAmount(candidate.limit),
      trustlinePresent: true,
    };
  }

  if (xlmBalance === undefined) throw malformedResponse();

  return {
    publicKey,
    xlmBalance,
    brlt: brlt ?? {
      authorized: null,
      balance: "0.0000000",
      limit: null,
      trustlinePresent: false,
    },
    refreshedAt,
  };
}

export async function loadAccountSummary(
  publicKey: string,
  config: AccountSummaryConfig,
  fetchImpl: FetchImplementation = fetch,
  now: () => Date = () => new Date(),
): Promise<AccountSummary> {
  let response: Response;
  try {
    response = await fetchImpl(
      `${config.horizonUrl.replace(/\/$/, "")}/accounts/${encodeURIComponent(publicKey)}`,
      { headers: { accept: "application/json" }, cache: "no-store" },
    );
  } catch {
    throw new AccountSummaryError(
      "HORIZON_UNAVAILABLE",
      "Horizon is temporarily unavailable",
    );
  }

  if (response.status === 404) {
    throw new AccountSummaryError("ACCOUNT_NOT_FOUND", "Stellar account was not found");
  }
  if (!response.ok) {
    throw new AccountSummaryError(
      "HORIZON_UNAVAILABLE",
      "Horizon is temporarily unavailable",
    );
  }

  let account: unknown;
  try {
    account = await response.json();
  } catch {
    throw malformedResponse();
  }

  let refreshedAt: string;
  try {
    refreshedAt = now().toISOString();
  } catch {
    throw malformedResponse();
  }

  return parseAccount(account, publicKey, config, refreshedAt);
}
