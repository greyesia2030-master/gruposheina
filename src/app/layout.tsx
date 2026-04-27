import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { SWRegister } from "@/components/sw-register";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Grupo Sheina - Gestión de Viandas",
  description: "Sistema de gestión de viandas corporativas",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Grupo Sheina",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#D4622B",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="antialiased">
        <SWRegister />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
