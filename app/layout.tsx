import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Hamton Inn",
  description: "Next.js Application for Hamton Inn",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full overflow-hidden`}>
      <body className="h-full flex flex-col bg-neutral-50 font-sans antialiased text-neutral-900 overflow-hidden" suppressHydrationWarning={true}>
        <Header />
        <main className="flex-1 overflow-auto">
           {children}
        </main>
      </body>
    </html>
  );
}
