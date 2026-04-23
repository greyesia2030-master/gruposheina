import { createSupabaseServer } from "@/lib/supabase/server";
import { ThreadClient } from "./thread-client";
import type {
  CommunicationDirection,
  CommunicationChannel,
  CommunicationCategory,
} from "@/lib/types/database";

export default async function ThreadPage({
  params,
}: {
  params: { threadId: string };
}) {
  const supabase = await createSupabaseServer();

  const { data: thread } = await supabase
    .from("communication_threads")
    .select(`
      id, subject, status, category, organization_id,
      organizations(id, name, primary_contact_email, email),
      communications(id, body, subject, direction, channel, status, created_at, sent_at)
    `)
    .eq("id", params.threadId)
    .single();

  if (!thread) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center text-gray-400">
        Conversación no encontrada.
      </div>
    );
  }

  const raw = thread as unknown as {
    id: string;
    subject: string | null;
    status: string;
    category: CommunicationCategory;
    organization_id: string | null;
    organizations: {
      id: string;
      name: string;
      primary_contact_email: string | null;
      email: string | null;
    } | null;
    communications: Array<{
      id: string;
      body: string;
      subject: string | null;
      direction: CommunicationDirection;
      channel: CommunicationChannel;
      status: string;
      created_at: string;
      sent_at: string | null;
    }>;
  };

  const messages = [...raw.communications].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Mark thread as read (fire-and-forget)
  supabase
    .from("communication_threads")
    .update({ unread_count: 0 })
    .eq("id", params.threadId)
    .then(() => {});

  return (
    <ThreadClient
      thread={{
        id: raw.id,
        subject: raw.subject,
        status: raw.status,
        category: raw.category,
        organization_id: raw.organization_id,
        organizations: raw.organizations,
      }}
      messages={messages}
    />
  );
}
