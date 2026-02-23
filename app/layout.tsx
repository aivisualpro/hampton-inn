import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Hampton by Hilton",
  description: "Hampton by Hilton - Manassas",
  manifest: "/manifest.json",
  themeColor: "#003087",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Hampton Inn",
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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Audiowide&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Lobster&family=Quicksand:wght@300..700&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="h-full flex flex-col bg-neutral-50 font-sans antialiased text-neutral-900 overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]" suppressHydrationWarning={true} style={{backgroundColor: 'white'}}>
        <Header />
        <main className="flex-1 overflow-auto">
           {children}
        </main>
        <Toaster />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.log('SW registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
