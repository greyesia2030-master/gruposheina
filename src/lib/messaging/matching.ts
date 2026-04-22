import "server-only";
import { createAdminClient } from "@/lib/supabase/admin-client";

export type MatchConfidence = "high" | "medium" | "low" | "none";

export interface MatchResult {
  organization_id: string | null;
  thread_id: string | null;
  confidence: MatchConfidence;
}

export async function matchIncomingMessage(
  emailAddress: string,
  inReplyTo?: string,
  _subject?: string
): Promise<MatchResult> {
  const supabase = createAdminClient();
  const noMatch: MatchResult = { organization_id: null, thread_id: null, confidence: "none" };

  // 1. Match via inReplyTo → find the original outbound communication
  if (inReplyTo) {
    const { data: comm } = await supabase
      .from("communications")
      .select("organization_id, thread_id")
      .eq("external_message_id", inReplyTo)
      .maybeSingle();
    if (comm?.organization_id) {
      return {
        organization_id: comm.organization_id as string,
        thread_id: (comm.thread_id as string | null) ?? null,
        confidence: "high",
      };
    }
  }

  const emailLower = emailAddress.toLowerCase();

  // 2. Match via primary_contact_email (exact)
  const { data: exactOrg } = await supabase
    .from("organizations")
    .select("id")
    .ilike("primary_contact_email", emailLower)
    .maybeSingle();
  if (exactOrg) {
    return { organization_id: exactOrg.id as string, thread_id: null, confidence: "high" };
  }

  // 3. Match via secondary_emails (array contains)
  const { data: secondaryOrgs } = await supabase
    .from("organizations")
    .select("id, secondary_emails")
    .not("secondary_emails", "is", null);
  if (secondaryOrgs) {
    for (const org of secondaryOrgs as { id: string; secondary_emails: string[] }[]) {
      if (org.secondary_emails?.some((e: string) => e.toLowerCase() === emailLower)) {
        return { organization_id: org.id, thread_id: null, confidence: "medium" };
      }
    }
  }

  // 4. Match via email domain
  const atIndex = emailLower.lastIndexOf("@");
  if (atIndex !== -1) {
    const domain = emailLower.slice(atIndex + 1);
    const { data: domainOrgs } = await supabase
      .from("organizations")
      .select("id, primary_contact_email")
      .ilike("primary_contact_email", `%@${domain}`);
    if (domainOrgs && (domainOrgs as { id: string }[]).length === 1) {
      return {
        organization_id: (domainOrgs[0] as { id: string }).id,
        thread_id: null,
        confidence: "low",
      };
    }
  }

  return noMatch;
}
