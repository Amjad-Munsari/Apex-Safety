import type { Metadata } from "next";
import { Playfair_Display, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";


const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const serif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dineen Fire & Safety Admin",
  description: "Dashboard for Dineen Fire & Safety.",
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
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>

    </html>
  );
}
