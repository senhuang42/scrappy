import { Octokit } from "octokit";

const OWNER = "senhuang42";
const REPO = "scrappy";

export type PaidTaskRecord = {
  contact: string;
  task: string;
  paidAt: string;
  receipt: Record<string, unknown> | null;
};

export function issueTitle(task: string): string {
  const clipped = task.replace(/\s+/g, " ").trim().slice(0, 60);
  return `Paid task: ${clipped || "(no description)"}`;
}

export function issueBody(record: PaidTaskRecord): string {
  const receiptLines = record.receipt
    ? Object.entries(record.receipt)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => `- ${key}: ${stringifyReceiptValue(value)}`)
        .join("\n")
    : "_No payment receipt fields were present on the request._";

  return [
    "## Contact",
    record.contact || "_none given_",
    "",
    "## Task",
    record.task,
    "",
    "## Paid at",
    record.paidAt,
    "",
    "## Payment receipt",
    receiptLines,
  ].join("\n");
}

export function fallbackIssueUrl(record: PaidTaskRecord): string {
  const params = new URLSearchParams({
    title: issueTitle(record.task),
    body: issueBody(record),
  });
  return `https://github.com/${OWNER}/${REPO}/issues/new?${params.toString()}`;
}

export async function createPaidTaskIssue(
  record: PaidTaskRecord,
): Promise<{ issueUrl: string | null; fallback: string }> {
  const fallback = fallbackIssueUrl(record);
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    return { issueUrl: null, fallback };
  }

  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.issues.create({
      owner: OWNER,
      repo: REPO,
      title: issueTitle(record.task),
      body: issueBody(record),
    });
    return { issueUrl: data.html_url ?? null, fallback };
  } catch (error) {
    console.error("Failed to create GitHub issue for paid task", error);
    return { issueUrl: null, fallback };
  }
}

function stringifyReceiptValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
