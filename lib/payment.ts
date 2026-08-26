import type { NextRequest } from "next/server";

function readPaymentHeader(request: NextRequest): string | null {
  return (
    request.headers.get("PAYMENT-SIGNATURE") ??
    request.headers.get("payment-signature") ??
    request.headers.get("X-PAYMENT") ??
    request.headers.get("x-payment")
  );
}

function decodeBase64Json(value: string): unknown {
  const json = Buffer.from(value, "base64").toString("utf8");
  return JSON.parse(json) as unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function paymentReceiptFields(
  request: NextRequest,
): Record<string, unknown> | null {
  const header = readPaymentHeader(request);
  if (!header) {
    return null;
  }

  try {
    const payload = asRecord(decodeBase64Json(header));
    if (!payload) {
      return { headerPresent: true };
    }

    const accepted = asRecord(payload.accepted);
    const nestedPayload = asRecord(payload.payload);
    const authorization = asRecord(nestedPayload?.authorization);

    const fields: Record<string, unknown> = {};
    if (payload.x402Version !== undefined) {
      fields.x402Version = payload.x402Version;
    }
    if (accepted?.network) fields.network = accepted.network;
    if (accepted?.asset) fields.asset = accepted.asset;
    if (accepted?.amount) fields.amount = accepted.amount;
    if (accepted?.payTo) fields.payTo = accepted.payTo;
    if (accepted?.scheme) fields.scheme = accepted.scheme;
    if (authorization?.from) fields.from = authorization.from;
    if (authorization?.to) fields.to = authorization.to;
    if (authorization?.value) fields.value = authorization.value;
    if (nestedPayload?.transaction) {
      fields.transaction = nestedPayload.transaction;
    }

    return Object.keys(fields).length > 0 ? fields : { headerPresent: true };
  } catch {
    return { headerPresent: true, decodeError: true };
  }
}
