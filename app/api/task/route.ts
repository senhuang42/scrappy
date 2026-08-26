import { withX402FromHTTPServer, x402HTTPResourceServer } from "@x402/next";
import { NextRequest, NextResponse } from "next/server";
import { readPayToEvm } from "@/lib/env";
import { createPaidTaskIssue } from "@/lib/github";
import { paymentReceiptFields } from "@/lib/payment";
import { resourceServer, taskRouteConfig } from "@/lib/x402";

export const runtime = "nodejs";

type TaskBody = {
  email?: unknown;
  contact?: unknown;
  task?: unknown;
};

function asNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function handlePaidTask(request: NextRequest): Promise<NextResponse> {
  let body: TaskBody;
  try {
    body = (await request.json()) as TaskBody;
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON with a task." },
      { status: 400 },
    );
  }

  const task = asNonEmptyString(body.task);
  if (!task) {
    return NextResponse.json(
      { error: "task is required." },
      { status: 400 },
    );
  }

  const contact =
    asNonEmptyString(body.email) || asNonEmptyString(body.contact);
  const paidAt = new Date().toISOString();
  const receipt = paymentReceiptFields(request);

  const { issueUrl, fallback } = await createPaidTaskIssue({
    contact,
    task,
    paidAt,
    receipt,
  });

  return NextResponse.json({
    ok: true,
    issueUrl,
    fallback: issueUrl ? null : fallback,
  });
}

let cachedPayTo: `0x${string}` | null = null;
let cachedHandler:
  | ((request: NextRequest) => Promise<NextResponse>)
  | null = null;

function paidHandler(payTo: `0x${string}`) {
  if (cachedHandler && cachedPayTo === payTo) {
    return cachedHandler;
  }
  const httpServer = new x402HTTPResourceServer(resourceServer, {
    "POST /api/task": taskRouteConfig(payTo),
  });
  cachedPayTo = payTo;
  // Same settlement rule as withX402: charge only after status < 400.
  // Explicit route key so Bazaar indexes POST /api/task.
  cachedHandler = withX402FromHTTPServer(handlePaidTask, httpServer);
  return cachedHandler;
}

export async function POST(request: NextRequest) {
  const payTo = readPayToEvm();
  if (!payTo.ok) {
    return NextResponse.json({ error: payTo.error }, { status: 500 });
  }

  return paidHandler(payTo.payTo)(request);
}
