import { Suspense, type CSSProperties } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getClientContext, isDemoMode } from "@/lib/auth-helpers";
import { getAppSettings } from "@/lib/settings/app-settings";
import { ClientPortalNav } from "./_components/client-portal-nav";
import { ClientIdentityNav } from "./_components/client-identity-nav";
import { PLATFORM_NAME, PUBLIC_CONTACT } from "@/lib/public-identity";

export const dynamic = "force-dynamic";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense-in-depth: proxy.ts already gates /client, but the layout must not
  // trust the matcher regex alone. Demo mode keeps its dev-only bypass;
  // getClientContext is request-cached, so pages reusing it pay no extra query.
  if (!(await isDemoMode()) && !(await getClientContext())) {
    redirect("/login");
  }

  const { logoUrl, brandingPrimary, brandingSecondary } =
    await getAppSettings();

  return (
    <div
      data-surface="client"
      style={{
        "--teal": brandingPrimary,
        "--gold": brandingSecondary,
      } as CSSProperties}
      className="min-h-screen bg-background text-foreground font-sans antialiased text-sm"
    >
      <Suspense fallback={<ClientPortalNav orgName="—" userName="—" userRole="—" />}>
        <ClientIdentityNav />
      </Suspense>

      {/* Main Content */}
      <main className="max-w-[1024px] mx-auto px-6 py-8">
        {children}
      </main>

      {/* Portal Footer */}
      <footer className="max-w-[1024px] mx-auto px-6 py-8 mt-6 border-t border-border">
        {logoUrl && (
          <div className="flex justify-center mb-5">
            <Image
              src={logoUrl}
              alt="Provider logo"
              width={160}
              height={40}
              unoptimized
              className="h-10 w-auto object-contain opacity-80"
            />
          </div>
        )}
        <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 font-mono text-[8.5px] tracking-[0.2em] text-muted-foreground uppercase">
          <span>{PLATFORM_NAME}</span>
          <span className="text-muted-foreground font-bold">&middot;</span>
          <span>Your Consultant</span>
          <span className="text-muted-foreground font-bold">&middot;</span>
          <span className="text-muted-foreground font-bold">Matt Robinson</span>
          <span className="text-muted-foreground font-bold">&middot;</span>
          <a className="text-muted-foreground font-bold hover:text-foreground transition-colors" href={PUBLIC_CONTACT.emailHref}>
            {PUBLIC_CONTACT.email}
          </a>
          <span className="text-muted-foreground font-bold">&middot;</span>
          <a className="text-muted-foreground font-bold hover:text-foreground transition-colors" href={PUBLIC_CONTACT.phoneHref}>
            {PUBLIC_CONTACT.phone}
          </a>
        </div>
      </footer>
    </div>
  );
}
