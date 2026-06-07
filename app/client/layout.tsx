import { BrandingProvider } from "@/components/branding-provider";
import { getClientContextWithIdentity } from "@/lib/auth-helpers";
import { ClientPortalNav } from "./_components/client-portal-nav";

export const dynamic = "force-dynamic";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getClientContextWithIdentity();

  return (
    <div data-surface="client" className="min-h-screen bg-[#fbfaf5] text-[#1a1a1a] font-sans antialiased text-sm">
      <BrandingProvider />
      <ClientPortalNav
        orgName={identity?.orgName ?? "—"}
        userName={identity?.userName ?? "—"}
        userRole={identity?.role ?? "—"}
      />

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
