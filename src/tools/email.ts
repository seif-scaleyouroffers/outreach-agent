// Platform emails (invites, password resets) — deliberately separate from
// the per-student Gmail OAuth connection used for actual outreach sending.
// Uses Resend's API. Sending to arbitrary recipients typically requires
// verifying a sending domain in Resend's dashboard; check Resend's current
// docs for their free-tier specifics, since exact limits/behavior there can
// change.

export async function sendTransactionalEmail(to: string, subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY.");
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!res.ok) throw new Error(`Resend send failed: ${await res.text()}`);
}
