import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Plus_Jakarta_Sans,
  Fredoka,
  Montserrat,
  Pacifico,
} from "next/font/google";
import "./globals.css";
import { CMLabProvider } from "@/lib/store";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cormorant",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-fredoka",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-montserrat",
});

const pacifico = Pacifico({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-pacifico",
});

export const metadata: Metadata = {
  title: "CM Casa Criativa | Atelier & Feira TCE (Bambu Lab A1)",
  description:
    "Sistema Kiosk de Encomendas para iPad, Simulador de Chaveiros 2.5D, ERP de Custos, Estoque de Filamentos e Agendador Inteligente Bambu Lab A1.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CM Kiosk",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${cormorant.variable} ${jakarta.variable} ${fredoka.variable} ${montserrat.variable} ${pacifico.variable}`}
    >
      <body className="min-h-screen bg-linho text-musgo selection:bg-argila/30 selection:text-musgo">
        <CMLabProvider>{children}</CMLabProvider>
      </body>
    </html>
  );
}
