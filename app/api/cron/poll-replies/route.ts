import { NextRequest, NextResponse } from "next/server";
import { listStudentAgents } from "../../../../src/agentStore";
import { listLeads, updateLead } from "../../../../src/leadStore";
import { getGmailAccount, updateGmailAccountTokens } from "../../../../src/gmailAccountStore";
import { addSuppression } from "../../../../src/suppressionStore";
import { updateOutcome } from "../../../../src/tools/outreachMemory";
import {
  getValidAccessToken,
  getThread,
  threadHasReplyFrom,
  latestReplyText,
  searchMessages,
  getMessageFull,
  extractMessageText,
  BOUNCE_SEARCH_QUERY,
} from "../../../../src/tools/gmail";

// Not webhook-driven — Gmail doesn't offer a simple per-message webhook for
// this. Instead this re-checks each sent email's thread for a reply, and
// separately searches each connected inbox for bounce-shaped messages,
// matching them back to the right lead. Ported from the reference
// cold-email-sequencer tool's cron.py polling approach.
//
// Triggered by an external scheduler (e.g. cron-job.org) sending
// `Authorization: Bearer $CRON_SECRET` on a GET request — see the README's
// "Reply/bounce tracking" section for setup. Can also be triggered manually
// with the same header, for testing.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const results = {
    repliesChecked: 0,
    replied: [] as string[],
    unsubscribed: [] as string[],
    bouncesChecked: 0,
    bounced: [] as string[],
  };

  const agents = await listStudentAgents();

  for (const { id: agentId } of agents) {
    const account = await getGmailAccount(agentId);
    if (!account) continue;

    let accessToken: string;
    try {
      const auth = await getValidAccessToken(account);
      accessToken = auth.accessToken;
      if (auth.refreshed) await updateGmailAccountTokens(agentId, auth.refreshed);
    } catch {
      continue; // this agent's token is broken — skip, don't fail the whole run
    }

    const leads = await listLeads(agentId);
    const sentEmailLeads = leads.filter((l) => l.channel === "email" && l.status === "sent" && l.threadId && l.email);

    // --- Replies (+ STOP-based unsubscribe detection) ---
    for (const lead of sentEmailLeads) {
      try {
        const thread = await getThread(accessToken, lead.threadId!);
        results.repliesChecked++;
        if (!threadHasReplyFrom(thread, lead.email!, account.email)) continue;

        const replyText = latestReplyText(thread, lead.email!, account.email).toLowerCase();
        const isUnsubscribe = /\bstop\b/.test(replyText);

        if (isUnsubscribe) {
          await updateLead(agentId, lead.id, { status: "unsubscribed" });
          await addSuppression(agentId, lead.email!, "unsubscribed");
          if (lead.outreachMessageId) await updateOutcome(agentId, lead.outreachMessageId, "unsubscribed");
          results.unsubscribed.push(lead.email!);
        } else {
          if (lead.outreachMessageId) await updateOutcome(agentId, lead.outreachMessageId, "replied");
          results.replied.push(lead.email!);
        }
      } catch {
        continue; // one bad thread lookup shouldn't stop the rest
      }
    }

    // --- Bounces ---
    const activeSentEmails = new Set(sentEmailLeads.map((l) => l.email!.toLowerCase()));
    if (activeSentEmails.size > 0) {
      try {
        const candidates = await searchMessages(accessToken, BOUNCE_SEARCH_QUERY);
        for (const stub of candidates) {
          try {
            const full = await getMessageFull(accessToken, stub.id);
            const headers = full.payload.headers ?? [];
            const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
            const haystack = `${subject}\n${extractMessageText(full.payload)}`.toLowerCase();
            const matches = [...activeSentEmails].filter((e) => haystack.includes(e));
            if (matches.length !== 1) continue; // no match, or ambiguous — don't guess

            results.bouncesChecked++;
            const bouncedEmail = matches[0];
            const bouncedLead = sentEmailLeads.find((l) => l.email!.toLowerCase() === bouncedEmail);
            if (!bouncedLead) continue;

            await updateLead(agentId, bouncedLead.id, { status: "bounced" });
            await addSuppression(agentId, bouncedEmail, "bounced");
            if (bouncedLead.outreachMessageId) await updateOutcome(agentId, bouncedLead.outreachMessageId, "bounced");
            results.bounced.push(bouncedEmail);
          } catch {
            continue;
          }
        }
      } catch {
        // this account's bounce search failed — don't stop other agents
      }
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
