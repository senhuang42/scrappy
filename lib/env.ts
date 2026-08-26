const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

/** Documented receive address. Runtime still reads process.env.PAY_TO_EVM. */
export const DOCUMENTED_PAY_TO_EVM =
  "0x356668f1775644237445c811CAd6428e91153ee9" as const;

export function readPayToEvm():
  | { ok: true; payTo: `0x${string}` }
  | { ok: false; error: string } {
  const raw = process.env.PAY_TO_EVM?.trim();
  if (!raw) {
    return {
      ok: false,
      error:
        `PAY_TO_EVM is not set. Set it to Scrappy's Base address (${DOCUMENTED_PAY_TO_EVM}).`,
    };
  }
  if (!EVM_ADDRESS.test(raw)) {
    return {
      ok: false,
      error:
        "PAY_TO_EVM must be a 20-byte hex address (0x followed by 40 hex characters).",
    };
  }
  return { ok: true, payTo: raw as `0x${string}` };
}
