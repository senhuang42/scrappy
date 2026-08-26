"use client";

import { FormEvent, useState } from "react";

type PaidResponse = {
  ok: boolean;
  issueUrl: string | null;
  fallback?: string;
};

type FormStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "paid"; issueUrl: string | null; fallback?: string }
  | { kind: "payment-required" }
  | { kind: "error"; message: string };

export function TaskForm() {
  const [email, setEmail] = useState("");
  const [task, setTask] = useState("");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "pending" });

    try {
      const response = await fetch("/api/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, task }),
      });

      if (response.status === 402) {
        setStatus({ kind: "payment-required" });
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | PaidResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        const message =
          body && "error" in body && body.error
            ? body.error
            : `Request failed (${response.status}).`;
        setStatus({ kind: "error", message });
        return;
      }

      const paid = body as PaidResponse;
      setStatus({
        kind: "paid",
        issueUrl: paid.issueUrl ?? null,
        fallback: paid.fallback,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Network error.",
      });
    }
  }

  return (
    <>
      <form onSubmit={onSubmit}>
        <label>
          <span>Contact</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          <span>Task</span>
          <textarea
            name="task"
            required
            placeholder="What should I do? Be specific about the deliverable."
            value={task}
            onChange={(event) => setTask(event.target.value)}
          />
        </label>
        <button type="submit" disabled={status.kind === "pending"}>
          {status.kind === "pending" ? "Sending…" : "Pay $20 and send it"}
        </button>
        <p className="fine">
          Submit hits a paid API. Without an x402 payment the server answers
          402. Agents retry with a PAYMENT-SIGNATURE. Humans need an x402
          wallet client pointed at POST /api/task.
        </p>
      </form>

      {status.kind === "paid" ? (
        <div className="status ok">
          <h2>Paid. I&apos;ll do this.</h2>
          {status.issueUrl ? (
            <p>
              Track it here:{" "}
              <a href={status.issueUrl} rel="noreferrer">
                {status.issueUrl}
              </a>
            </p>
          ) : status.fallback ? (
            <p>
              File the job so it is not lost:{" "}
              <a href={status.fallback} rel="noreferrer">
                open a GitHub issue
              </a>
            </p>
          ) : (
            <p>Payment landed. I have the task.</p>
          )}
        </div>
      ) : null}

      {status.kind === "payment-required" ? (
        <div className="status need">
          <h2>Payment required</h2>
          <p>
            $20 USDC on Base mainnet, x402 exact scheme. POST /api/task again
            with a PAYMENT-SIGNATURE. The 402 response includes
            PAYMENT-REQUIRED.
          </p>
        </div>
      ) : null}

      {status.kind === "error" ? (
        <div className="status error">
          <h2>Could not take this</h2>
          <p>{status.message}</p>
        </div>
      ) : null}
    </>
  );
}
