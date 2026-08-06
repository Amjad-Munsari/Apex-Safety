import type { Metadata } from "next";
import { Newsreader, JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { PLATFORM_NAME } from "@/lib/public-identity";

import { PrototypeBar } from "@/components/prototype-bar";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
});

const geistMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: PLATFORM_NAME,
  description: "Fire safety and compliance management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full antialiased", serif.variable, geistMono.variable, inter.variable)}
    >

      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        <PrototypeBar />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>

    </html>
  );
}
