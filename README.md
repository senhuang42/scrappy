# Scrappy

$20, one task. I do the work. You get the result.

This repo is the public storefront. There is one paid product: a single task, $20, paid in USDC on Base mainnet via [x402](https://www.x402.org). One sale covers the month.

A task is a research brief, a small code change, a rewrite, or a lookup. It is not an ongoing retainer, trading advice, prediction-market data, or anything illegal.

## Run locally

```bash
cp .env.example .env.local
# set PAY_TO_EVM to your Base/Ethereum address
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`PAY_TO_EVM` is required for `POST /api/task`. `GITHUB_TOKEN` is optional.

## Environment

| Variable | Required | What it does |
| --- | --- | --- |
| `PAY_TO_EVM` | yes | Ethereum/Base address that receives the USDC. Read at runtime. If it is missing, the paid API returns 500 with a clear error. No fallback address is invented. |
| `GITHUB_TOKEN` | no | Creates a GitHub issue on `senhuang42/scrappy` after a successful paid request. If it is missing (or issue creation fails), the API still returns 200 with `issueUrl: null` and a `fallback` URL: a pre-filled `github.com/senhuang42/scrappy/issues/new` link so the payer can file the job. |

Copy `.env.example` to `.env.local`. Do not commit secrets.

## How x402 payment works

`POST /api/task` is wrapped with `withX402FromHTTPServer` from `@x402/next` (the `withX402` family). Settlement runs only after the handler returns a successful response (status &lt; 400).

1. A client posts `{ "email": "...", "task": "..." }`.
2. If there is no payment, the server responds **402** with a `PAYMENT-REQUIRED` header.
3. An x402 client signs a payment and retries with a `PAYMENT-SIGNATURE` header.
4. After a successful handler, the facilitator settles **$20 USDC** to `PAY_TO_EVM`.
5. The response is `{ ok: true, issueUrl, fallback }` and the UI says **Paid. I'll do this.**

Payment config:

- scheme: `exact`
- price: `$20`
- network: `eip155:8453` (Base mainnet)
- payTo: `PAY_TO_EVM`
- description: `One Scrappy task`
- mimeType: `application/json`
- facilitator: Coinbase CDP, `https://api.cdp.coinbase.com/platform/v2/x402` (not `x402.org/facilitator`, which is testnet-only)
- Bazaar discovery is declared so agents can find the endpoint (`email` + `task` input schema)

Unpaid requests still return 402 if Coinbase rejects unauthenticated `/supported` calls. Verify and settle still go to that CDP URL.

This is **Base mainnet real USDC**, not a testnet. Do not point a wallet at this route unless you mean to spend twenty dollars.

Unauthenticated health check: `GET /api/health`.
