"use client";

import React from "react";
import { FlaskConical } from "lucide-react";
import { AdminNav } from "@/components/AdminNav";
import { useCMLabStore } from "@/lib/store";

/** Segunda tranca do Laboratório (a primeira é o middleware). */
export function MasterOnly({ children }: { children: React.ReactNode }) {
  const { currentAdminUser } = useCMLabStore();
  if (currentAdminUser?.is_master) return <>{children}</>;
  return (
    <div className="min-h-screen bg-linho flex flex-col">
      <AdminNav />
      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-16">
        <div className="bg-areia border border-borda rounded-3xl p-8 shadow-atelier text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-terracota/15 text-terracota flex items-center justify-center mx-auto">
            <FlaskConical className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-musgo">Laboratório restrito</h1>
          <p className="text-sm text-oliva max-w-md mx-auto">
            As ferramentas do Laboratório são de uso pessoal do administrador master.
          </p>
        </div>
      </main>
    </div>
  );
}
