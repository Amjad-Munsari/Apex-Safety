import { createClient } from "@/lib/supabase/server";
import { getClientContext, getUser } from "@/lib/auth-helpers";
import { ClientDashboard } from "./dashboard-client";

export const dynamic = "force-dynamic";

interface DocumentRow {
  id: string;
  filename: string;
  expiry_date: string | null;
}

export interface AttentionDoc {
  id: string;
  title: string;
  status: "EXPIRED" | "EXPIRING";
  /** ISO 8601 date string used for chronological sorting (never displayed). */
  rawDate: string;
  /** Pre-formatted display string, e.g. "12 Feb 2025". Never used for sorting. */
  date: string;
  type: "expired" | "expiring";
}

export interface DashboardData {
  greetingName: string;
  clientName: string;
  todayLabel: string;
  current: number;
  expiring: number;
  expired: number;
  total: number;
  hoursBalance: number;
  attentionDocs: AttentionDoc[];
}

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", DATE_FMT);
}

function formatToday(now: Date): string {
  return now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function timeOfDayGreeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function ClientDashboardPage() {
  const ctx = await getClientContext();
  if (!ctx) {
    return (
      <div className="space-y-4">
        <h2 className="font-serif text-[30px] text-foreground">Sign in to continue.</h2>
        <p className="text-muted-foreground text-[13px]">Your dashboard appears once your account is linked to a client.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const user = await getUser();

  const [{ data: client }, { data: clientUser }, { data: docs }] = await Promise.all([
    supabase
      .from("clients")
      .select("name, hours_balance")
      .eq("id", ctx.client_id)
      .single(),
    user
      ? supabase
          .from("client_users")
          .select("name")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("documents")
      .select("id, filename, expiry_date")
      .eq("client_id", ctx.client_id)
      .is("deleted_at", null)
      .order("expiry_date", { ascending: true, nullsFirst: false }),
  ]);

  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let current = 0;
  let expiring = 0;
  let expired = 0;
  const attentionDocs: AttentionDoc[] = [];

  for (const d of (docs ?? []) as DocumentRow[]) {
    if (!d.expiry_date) {
      current += 1;
      continue;
    }
    const exp = new Date(d.expiry_date);
    if (exp < now) {
      expired += 1;
      attentionDocs.push({
        id: d.id,
        title: d.filename,
        status: "EXPIRED",
        rawDate: d.expiry_date,
        date: formatDate(d.expiry_date),
        type: "expired",
      });
    } else if (exp < thirtyDays) {
      expiring += 1;
      attentionDocs.push({
        id: d.id,
        title: d.filename,
        status: "EXPIRING",
        rawDate: d.expiry_date,
        date: formatDate(d.expiry_date),
        type: "expiring",
      });
    } else {
      current += 1;
    }
  }

  // Surface up to 6 most urgent — expired first, then expiring soonest.
  // Sort on rawDate (ISO 8601) so the comparison is chronological, not
  // alphabetical. The formatted `date` string ("12 Feb 2025") sorts incorrectly
  // by day-of-month rather than by calendar order.
  attentionDocs.sort((a, b) => {
    if (a.type !== b.type) return a.type === "expired" ? -1 : 1;
    return a.rawDate < b.rawDate ? -1 : a.rawDate > b.rawDate ? 1 : 0;
  });
  const trimmedAttention = attentionDocs.slice(0, 6);

  const data: DashboardData = {
    greetingName: clientUser?.name?.split(" ")[0] ?? "there",
    clientName: client?.name ?? "your organisation",
    todayLabel: formatToday(now),
    current,
    expiring,
    expired,
    total: current + expiring + expired,
    hoursBalance: Number(client?.hours_balance ?? 0),
    attentionDocs: trimmedAttention,
  };

  return <ClientDashboard data={data} greeting={timeOfDayGreeting(now)} />;
}
