import { getClientContextWithIdentity } from "@/lib/auth-helpers";
import { ClientPortalNav } from "./client-portal-nav";

export async function ClientIdentityNav() {
  const identity = await getClientContextWithIdentity();

  return (
    <ClientPortalNav
      orgName={identity?.orgName ?? "—"}
      userName={identity?.userName ?? "—"}
      userRole={identity?.role ?? "—"}
    />
  );
}
