import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui/toast";
import { SWRegister } from "@/components/sw-register";
import "./globals.css";

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
    <html lang="es">
      <body className="antialiased">
        <SWRegister />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
