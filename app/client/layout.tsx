import { createClient } from "@/lib/supabase/server";
import { getClientContext, getUser } from "@/lib/auth-helpers";
import { ClientNav, type ClientIdentity } from "./nav-client";

export const dynamic = "force-dynamic";

// Derive a stable, per-tenant reference from the client UUID. There is no
// dedicated reference column on `clients`, so we surface a deterministic slug
// (CL-<first 4 hex of id>) instead of a hardcoded fixture value.
function clientRefFromId(id: string | undefined): string {
  if (!id) return "CL-····";
  return `CL-${id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

// client_users.role is a slug (e.g. "member", "admin"). Humanise it for display.
function humaniseRole(role: string | undefined): string {
  if (!role) return "Member";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

async function resolveIdentity(): Promise<ClientIdentity> {
  const ctx = await getClientContext();
  if (!ctx) {
    return {
      orgName: "Your organisation",
      userName: "Account",
      userRole: "Member",
      clientRef: clientRefFromId(undefined),
    };
  }

  const supabase = await createClient();
  const user = await getUser();

  const [{ data: client }, { data: clientUser }] = await Promise.all([
    supabase
      .from("clients")
      .select("name")
      .eq("id", ctx.client_id)
      .maybeSingle(),
    user
      ? supabase
          .from("client_users")
          .select("name")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    orgName: client?.name ?? "Your organisation",
    userName: clientUser?.name ?? "Account",
    userRole: humaniseRole(ctx.role),
    clientRef: clientRefFromId(ctx.client_id),
  };
}

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await resolveIdentity();

  return (
    <div data-surface="client" className="min-h-screen bg-[#fbfaf5] text-[#1a1a1a] font-sans antialiased text-sm">
      {/* Top Navigation */}
      <ClientNav identity={identity} />

      {/* Main Content */}
      <main className="max-w-[1024px] mx-auto px-6 py-8">
        {children}
      </main>

      {/* Portal Footer */}
      <footer className="max-w-[1024px] mx-auto px-6 py-8 mt-6 border-t border-[#e5e1d8]">
        <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 font-mono text-[8.5px] tracking-[0.2em] text-[#8a857f] uppercase">
          <span>Your Consultant</span>
          <span className="text-[#6b6560] font-bold">&middot;</span>
          <span className="text-[#6b6560] font-bold">Matt Robinson</span>
          <span className="text-[#6b6560] font-bold">&middot;</span>
          <span className="text-[#6b6560] font-bold">888FST@proton.me</span>
          <span className="text-[#6b6560] font-bold">&middot;</span>
          <span className="text-[#6b6560] font-bold">0161 552 0918</span>
        </div>
      </footer>
    </div>
  );
}
