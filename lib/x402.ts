import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
} from "@x402/extensions/bazaar";
import type { RouteConfig } from "@x402/next";

export const X402_NETWORK = "eip155:8453" as const;
export const X402_PRICE = "$20" as const;
export const CDP_FACILITATOR_URL =
  "https://api.cdp.coinbase.com/platform/v2/x402";

/**
 * CDP /supported requires API credentials. Unpaid 402s still need a supported
 * kind so ExactEvmScheme can price $20 USDC on Base. Verify/settle still hit CDP.
 */
class CdpFacilitatorClient extends HTTPFacilitatorClient {
  async getSupported() {
    try {
      return await super.getSupported();
    } catch {
      return {
        kinds: [
          {
            x402Version: 2,
            scheme: "exact",
            network: X402_NETWORK,
          },
        ],
        extensions: [],
        signers: {},
      };
    }
  }
}

const facilitator = new CdpFacilitatorClient({ url: CDP_FACILITATOR_URL });

export const resourceServer = new x402ResourceServer(facilitator)
  .register(X402_NETWORK, new ExactEvmScheme())
  .registerExtension(bazaarResourceServerExtension);

export function taskRouteConfig(payTo: `0x${string}`): RouteConfig {
  return {
    accepts: {
      scheme: "exact",
      price: X402_PRICE,
      network: X402_NETWORK,
      payTo,
    },
    description: "One Scrappy task",
    mimeType: "application/json",
    extensions: {
      ...declareDiscoveryExtension({
        input: {
          email: "you@example.com",
          task: "Write a short research brief on how x402 payments work.",
        },
        inputSchema: {
          properties: {
            email: {
              type: "string",
              description: "Contact email",
            },
            task: {
              type: "string",
              description: "The task to complete",
            },
          },
          required: ["task"],
        },
        bodyType: "json",
        output: {
          example: {
            ok: true,
            issueUrl: "https://github.com/senhuang42/scrappy/issues/1",
            fallback: null,
          },
        },
      }),
    },
    unpaidResponseBody: () => ({
      contentType: "application/json",
      body: {
        error: "Payment Required",
        description: "One Scrappy task",
        price: X402_PRICE,
        network: X402_NETWORK,
      },
    }),
  };
}
