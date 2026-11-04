"use client";

import React from "react";
import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { MasterOnly } from "@/components/lab/MasterOnly";
import { FlaskConical, Palette, Shapes, QrCode, Layers, ArrowRight, KeyRound } from "lucide-react";

const TOOLS = [
  {
    href: "/admin/laboratorio/plaquinha",
    title: "Plaquinha de Colorir",
    description:
      "Arraste um SVG ou uma ilustração colorida e gere o 3MF da plaquinha: base branca com contorno em relevo.",
    icon: Palette,
    ready: true,
  },
  {
    href: "/admin/laboratorio/chaveiro",
    title: "Chaveiro de Nome Articulado",
    description:
      "Digite os nomes, escolha a fonte e gere o 3MF do chaveiro com letras que giram, impresso já montado.",
    icon: KeyRound,
    ready: true,
  },
  {
    href: "#",
    title: "Conversor SVG",
    description: "Transforme logos, desenhos e silhuetas em SVG com medida em mm.",
    icon: Shapes,
    ready: false,
  },
  {
    href: "#",
    title: "Gerador de QR Code",
    description: "QR Code de Pix, link ou Wi-Fi em SVG para placas e etiquetas.",
    icon: QrCode,
    ready: false,
  },
  {
    href: "#",
    title: "Separador de 3MF",
    description: "Separe as cores de um 3MF em partes independentes.",
    icon: Layers,
    ready: false,
  },
];

export default function LaboratorioPage() {
  return (
    <MasterOnly>
      <div className="min-h-screen bg-linho flex flex-col">
        <AdminNav />
        <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
          <header className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-musgo text-linho flex items-center justify-center shrink-0">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold text-musgo">Laboratório</h1>
              <p className="text-sm text-oliva mt-1">
                Ferramentas pessoais de produção. Tudo roda no seu navegador: os arquivos não
                saem do computador.
              </p>
            </div>
          </header>

          <div className="grid sm:grid-cols-2 gap-4">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const card = (
                <div
                  className={`h-full rounded-3xl border p-6 space-y-3 transition ${
                    tool.ready
                      ? "bg-areia border-borda shadow-atelier hover:border-musgo"
                      : "bg-linho border-dashed border-borda opacity-70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-terracota/15 text-terracota flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    {tool.ready ? (
                      <ArrowRight className="w-5 h-5 text-oliva" />
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-oliva bg-borda/50 px-2 py-1 rounded-full">
                        Em breve
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-serif font-bold text-musgo">{tool.title}</h2>
                  <p className="text-sm text-oliva">{tool.description}</p>
                </div>
              );
              return tool.ready ? (
                <Link key={tool.title} href={tool.href}>
                  {card}
                </Link>
              ) : (
                <div key={tool.title}>{card}</div>
              );
            })}
          </div>
        </main>
      </div>
    </MasterOnly>
  );
}
