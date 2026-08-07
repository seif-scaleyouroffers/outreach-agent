import { redirect } from "next/navigation";

// The agent's root link now redirects straight to the Email channel — the
// only channel that's actually built out. Other channels will get their own
// /agent/[id]/<channel> page as they're built.
export default async function AgentIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/agent/${id}/email`);
}
