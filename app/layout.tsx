import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Hampton Inn",
  description: "Next.js Application for Hampton Inn",
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Audiowide&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Lobster&family=Quicksand:wght@300..700&display=swap" rel="stylesheet" />
      </head>
      <body className="h-full flex flex-col bg-neutral-50 font-sans antialiased text-neutral-900 overflow-hidden" suppressHydrationWarning={true}>
        <Header />
        <main className="flex-1 overflow-auto">
           {children}
        </main>
      </body>
    </html>
  );
}
