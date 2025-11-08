import "./globals.css";
import { Inter } from "next/font/google";
import ServiceWorkerRegister from "../components/service-worker-register";
import type { Metadata, Viewport } from "next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "LocalPlate - Offline-first Calorie Tracker",
  description:
    "A privacy-first calorie tracker tuned for South Asian meals with offline logging and zero paywalls.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon.svg",
    shortcut: "/icons/icon.svg",
    apple: "/icons/icon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#246b63",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
