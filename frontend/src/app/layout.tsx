import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import CapacitorProvider from "@/components/CapacitorProvider";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Placement Prep",
  description: "AI-Powered Placement Preparation Platform",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Placement Prep",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-slate-950 text-slate-100`}>
        <AuthProvider>
          <CapacitorProvider>
            <div className="flex flex-col min-h-screen">
              {children}
            </div>
          </CapacitorProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
