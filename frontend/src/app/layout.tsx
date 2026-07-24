import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/components/providers/QueryProvider";
import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-inter",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"]
});

export const metadata: Metadata = {
  title: "Disaster Alert Pakistan",
  description: "Unofficial alert dashboard using publicly available official sources",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <QueryProvider>
          <AppHeader />
          <main className="flex-1 flex flex-col">
            {children}
          </main>
          <AppFooter />
        </QueryProvider>
      </body>
    </html>
  );
}
