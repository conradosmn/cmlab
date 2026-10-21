"use client";

import React, { useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { useCMLabStore } from "@/lib/store";
import { AdminUser } from "@/lib/types";
import {
  Users,
  UserPlus,
  Mail,
  Phone,
  KeyRound,
  User,
  Trash2,
  Edit3,
  ShieldCheck,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";

export default function AdminUsuariosPage() {
  const {
    adminUsers,
    currentAdminUser,
    addOrUpdateAdminUser,
    deleteAdminUser,
  } = useCMLabStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [feedback, setFeedback] = useState<string>("");

  const resetForm = () => {
    setEditingId(null);
    setFullName("");
    setEmail("");
    setPhone("");
    setUsername("");
    setPassword("");
  };

  const handleEditUser = (u: AdminUser) => {
    setEditingId(u.id);
    setFullName(u.full_name);
    setEmail(u.email);
    setPhone(u.phone);
    setUsername(u.username);
    setPassword(u.password);
    setFeedback("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      return;
    }

    const derivedUsername =
      username.trim() ||
      email
        .trim()
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "");

    const existing = editingId
      ? adminUsers.find((u) => u.id === editingId)
      : undefined;

    const payload: AdminUser = {
      id: editingId || `usr-${Date.now()}`,
      username: existing?.is_master ? "conradosmn" : derivedUsername,
      email: email.trim(),
      password: password,
      full_name: fullName.trim(),
      phone: phone.trim(),
      is_master: existing?.is_master || false,
      created_at: existing?.created_at || new Date().toISOString(),
    };

    await addOrUpdateAdminUser(payload);
    setFeedback(
      editingId
        ? `Usuário "${payload.full_name}" atualizado com sucesso!`
        : `Novo usuário "${payload.full_name}" cadastrado com sucesso!`
    );
    resetForm();
  };

  return (
    <div className="min-h-screen bg-linho flex flex-col">
      <AdminNav />

      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8 flex-1">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-widest text-terracota font-bold">
              Controle de Acesso Administrativo
            </span>
            <h1 className="text-3xl font-serif font-bold text-musgo mt-0.5">
              Usuários do Painel Admin
            </h1>
            <p className="text-xs sm:text-sm text-oliva mt-1">
              Cadastre novos usuários para acessar a área administrativa (a loja Kiosk{" "}
              <code>/feira</code> permanece livre para clientes).
            </p>
          </div>

          {currentAdminUser && (
            <div className="bg-areia px-4 py-2.5 rounded-2xl border border-borda text-xs flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-terracota" />
              <div>
                <span className="text-oliva block leading-none">Logado como:</span>
                <strong className="text-musgo">
                  {currentAdminUser.full_name} ({currentAdminUser.username})
                </strong>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Formulário Simples de Cadastro / Edição */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-5 bg-areia border border-borda rounded-3xl p-6 shadow-atelier space-y-4"
          >
            <div className="flex items-center justify-between border-b border-borda pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-terracota" />
                <h2 className="text-xl font-serif font-bold text-musgo">
                  {editingId ? "Editar Usuário" : "Cadastrar Novo Usuário"}
                </h2>
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-oliva hover:text-musgo underline"
                >
                  Cancelar edição
                </button>
              )}
            </div>

            {feedback && (
              <div className="p-3 rounded-xl bg-emerald-600/10 border border-emerald-600/30 text-emerald-900 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{feedback}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-oliva mb-1">
                Nome Completo *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-oliva absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Maria Clara Sampaio"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-linho border border-borda text-sm text-musgo focus:outline-none focus:ring-2 focus:ring-argila"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-oliva mb-1">
                E-mail *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-oliva absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: maria@email.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-linho border border-borda text-sm text-musgo focus:outline-none focus:ring-2 focus:ring-argila"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-oliva mb-1">
                Número do Telefone / WhatsApp *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-oliva absolute left-3.5 top-3" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: (86) 99999-9999"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-linho border border-borda text-sm text-musgo focus:outline-none focus:ring-2 focus:ring-argila"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-oliva mb-1">
                Usuário de Login (Opcional — ou usa o e-mail)
              </label>
              <input
                type="text"
                value={username}
                disabled={Boolean(
                  editingId &&
                    adminUsers.find((u) => u.id === editingId)?.is_master
                )}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Deixe em branco p/ gerar do e-mail"
                className="w-full px-3.5 py-2.5 rounded-xl bg-linho border border-borda text-sm text-musgo focus:outline-none focus:ring-2 focus:ring-argila disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-oliva mb-1">
                Senha de Acesso *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-oliva absolute left-3.5 top-3" />
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Defina a senha"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-linho border border-borda text-sm text-musgo focus:outline-none focus:ring-2 focus:ring-argila"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3 top-2.5 text-oliva hover:text-musgo p-0.5"
                >
                  {showPass ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-terracota hover:bg-terracota-hover text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>
                {editingId ? "Salvar Alterações" : "Cadastrar Usuário Admin"}
              </span>
            </button>
          </form>

          {/* Lista de Usuários Cadastrados */}
          <div className="lg:col-span-7 bg-areia border border-borda rounded-3xl p-6 shadow-atelier space-y-4">
            <div className="flex items-center justify-between border-b border-borda pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-musgo" />
                <h2 className="text-xl font-serif font-bold text-musgo">
                  Equipe Cadastrada ({adminUsers.length})
                </h2>
              </div>
            </div>

            <div className="space-y-3">
              {adminUsers.map((u) => (
                <div
                  key={u.id}
                  className="bg-linho border border-borda rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-serif font-bold text-lg text-musgo">
                        {u.full_name}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-areia border border-borda text-musgo">
                        @{u.username}
                      </span>
                      {u.is_master && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-terracota text-white">
                          Admin Principal
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-oliva">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-terracota" />
                        {u.email}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-terracota" />
                        {u.phone}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditUser(u)}
                      className="px-3 py-2 rounded-xl bg-areia hover:bg-borda/50 border border-borda text-xs font-semibold text-musgo flex items-center gap-1.5 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    {!u.is_master && u.username !== "conradosmn" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              `Deseja remover o acesso de "${u.full_name}"?`
                            )
                          ) {
                            deleteAdminUser(u.id);
                          }
                        }}
                        className="p-2 rounded-xl bg-areia hover:bg-red-500/10 border border-borda text-red-700 transition"
                        title="Remover usuário"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
