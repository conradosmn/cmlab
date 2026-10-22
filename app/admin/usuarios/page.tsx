"use client";

import React, { useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { useCMLabStore } from "@/lib/store";
import { AdminUser, AdminUserRole } from "@/lib/types";
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
  RotateCcw,
} from "lucide-react";

function buildDefaultPasswordFromFullName(fullName: string): string {
  const firstName = (fullName || "")
    .trim()
    .split(/\s+/)[0]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `${firstName || "nome"}@12345`;
}

function formatBrazilPhone(raw: string): string {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

const ROLE_LABELS: Record<AdminUserRole, string> = {
  admin: "Admin (Acesso Total & Custos)",
  gerente: "Gerente (Catálogo, Fotos & Estoque)",
  vendedor: "Vendedor (Caixa & Pedidos)",
};

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
  const [role, setRole] = useState<AdminUserRole>("gerente");
  const [feedback, setFeedback] = useState<string>("");

  const previewDefaultPassword = buildDefaultPasswordFromFullName(fullName);

  const isAdminRole =
    !currentAdminUser ||
    currentAdminUser.is_master ||
    currentAdminUser.username.toLowerCase() === "conradosmn" ||
    currentAdminUser.role === "admin";

  const resetForm = () => {
    setEditingId(null);
    setFullName("");
    setEmail("");
    setPhone("");
    setUsername("");
    setRole("gerente");
  };

  const handleEditUser = (u: AdminUser) => {
    setEditingId(u.id);
    setFullName(u.full_name);
    setEmail(u.email);
    setPhone(formatBrazilPhone(u.phone));
    setUsername(u.username);
    setRole(
      u.is_master || u.username === "conradosmn"
        ? "admin"
        : u.role || "gerente"
    );
    setFeedback("");
  };

  const handleResetUserPasswordToDefault = async (u: AdminUser) => {
    const defaultPass = buildDefaultPasswordFromFullName(u.full_name);
    if (
      !confirm(
        `Resetar a senha de "${u.full_name}" para a senha padrão de 1º acesso "${defaultPass}"?`
      )
    ) {
      return;
    }
    await addOrUpdateAdminUser({
      ...u,
      password: defaultPass,
      must_change_password: true,
    });
    setFeedback(
      `Senha de "${u.full_name}" redefinida para "${defaultPass}" (troca obrigatória no próximo login).`
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
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

    const generatedDefaultPassword = buildDefaultPasswordFromFullName(fullName);
    const isMaster = Boolean(
      existing?.is_master || existing?.username === "conradosmn"
    );

    const payload: AdminUser = {
      id: editingId || `usr-${Date.now()}`,
      username: isMaster ? "conradosmn" : derivedUsername,
      email: email.trim(),
      password: existing ? existing.password : generatedDefaultPassword,
      full_name: fullName.trim(),
      phone: formatBrazilPhone(phone),
      role: isMaster ? "admin" : role,
      is_master: isMaster,
      must_change_password: existing ? existing.must_change_password : true,
      created_at: existing?.created_at || new Date().toISOString(),
    };

    await addOrUpdateAdminUser(payload);
    setFeedback(
      editingId
        ? `Dados e perfil de "${payload.full_name}" atualizados com sucesso!`
        : `Usuário "${payload.full_name}" (${payload.role?.toUpperCase()}) cadastrado! Senha inicial: ${generatedDefaultPassword}.`
    );
    resetForm();
  };

  if (!isAdminRole) {
    return (
      <div className="min-h-screen bg-linho flex flex-col">
        <AdminNav />
        <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-16">
          <div className="bg-areia border border-borda rounded-3xl p-8 shadow-atelier text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-terracota/15 text-terracota flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-musgo">
              Gerenciamento de Usuários Restrito ao Admin
            </h1>
            <p className="text-sm text-oliva max-w-md mx-auto">
              Apenas usuários com perfil <strong>Admin</strong> podem cadastrar, editar
              ou alterar perfis de acesso no sistema.
            </p>
            <div className="pt-2">
              <a
                href="/admin/catalogo"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-terracota hover:bg-terracota-hover text-white text-sm font-semibold shadow-sm transition"
              >
                Voltar para o Catálogo
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linho flex flex-col">
      <AdminNav />

      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8 flex-1">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-widest text-terracota font-bold">
              Controle de Acesso & Perfis
            </span>
            <h1 className="text-3xl font-serif font-bold text-musgo mt-0.5">
              Usuários & Perfis (Admin, Gerente, Vendedor)
            </h1>
            <p className="text-xs sm:text-sm text-oliva mt-1">
              Novos usuários recebem automaticamente a senha padrão{" "}
              <code className="font-bold text-musgo">nome@12345</code> e são
              solicitados a alterá-la no primeiro login.
            </p>
          </div>

          {currentAdminUser && (
            <div className="bg-areia px-4 py-2.5 rounded-2xl border border-borda text-xs flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-terracota" />
              <div>
                <span className="text-oliva block leading-none">
                  Logado como ({currentAdminUser.role || "admin"}):
                </span>
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
                  placeholder="Ex: Lorena Eulálio Nunes"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-linho border border-borda text-sm text-musgo focus:outline-none focus:ring-2 focus:ring-argila"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-oliva mb-1">
                Perfil de Acesso *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["vendedor", "gerente", "admin"] as AdminUserRole[]).map(
                  (r) => {
                    const active = role === r;
                    const disabled = Boolean(
                      editingId &&
                        adminUsers.find((u) => u.id === editingId)?.is_master
                    );
                    return (
                      <button
                        key={r}
                        type="button"
                        disabled={disabled}
                        onClick={() => setRole(r)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold uppercase border transition ${
                          active
                            ? "bg-musgo text-linho border-musgo shadow-sm"
                            : "bg-linho text-musgo border-borda hover:border-argila"
                        } disabled:opacity-60`}
                      >
                        {r === "admin"
                          ? "Admin"
                          : r === "gerente"
                          ? "Gerente"
                          : "Vendedor"}
                      </button>
                    );
                  }
                )}
              </div>
              <p className="text-[11px] text-oliva mt-1">
                {ROLE_LABELS[role]}
              </p>
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
                  placeholder="Ex: lorenaeulalio@gmail.com"
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
                  maxLength={15}
                  value={phone}
                  onChange={(e) => setPhone(formatBrazilPhone(e.target.value))}
                  placeholder="Ex: (86) 98146-5710"
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

            {!editingId && (
              <div className="p-3.5 rounded-2xl bg-linho border border-borda space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-oliva font-semibold flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-terracota" />
                    Senha Padrão do 1º Acesso:
                  </span>
                  <code className="px-2.5 py-0.5 rounded-lg bg-areia border border-borda text-musgo font-bold text-sm">
                    {previewDefaultPassword}
                  </code>
                </div>
                <p className="text-[11px] text-oliva">
                  Ao entrar pela primeira vez com{" "}
                  <strong>{previewDefaultPassword}</strong>, o sistema pedirá
                  para o usuário criar sua própria senha.
                </p>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-terracota hover:bg-terracota-hover text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>
                {editingId ? "Salvar Alterações" : "Cadastrar Usuário"}
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
              {adminUsers.map((u) => {
                const defaultPassForUser = buildDefaultPasswordFromFullName(
                  u.full_name
                );
                const userRole: AdminUserRole =
                  u.is_master || u.username === "conradosmn"
                    ? "admin"
                    : u.role || "gerente";

                return (
                  <div
                    key={u.id}
                    className="bg-linho border border-borda rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-serif font-bold text-lg text-musgo">
                          {u.full_name}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-areia border border-borda text-musgo">
                          @{u.username}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                            userRole === "admin"
                              ? "bg-terracota text-white"
                              : userRole === "gerente"
                              ? "bg-musgo text-linho"
                              : "bg-areia border border-borda text-musgo"
                          }`}
                        >
                          {userRole === "admin"
                            ? "Admin"
                            : userRole === "gerente"
                            ? "Gerente"
                            : "Vendedor"}
                        </span>
                        {!u.is_master &&
                          (u.must_change_password ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-argila/25 text-terracota border border-argila/50">
                              1º Acesso ({u.password})
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-600/15 text-emerald-800">
                              Senha Pessoal Ativa
                            </span>
                          ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-oliva">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-terracota" />
                          {u.email}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-terracota" />
                          {formatBrazilPhone(u.phone) || u.phone}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {!u.is_master && u.username !== "conradosmn" && (
                        <select
                          value={userRole}
                          onChange={(e) =>
                            addOrUpdateAdminUser({
                              ...u,
                              role: e.target.value as AdminUserRole,
                            })
                          }
                          className="px-2.5 py-2 rounded-xl bg-areia border border-borda text-xs font-bold text-musgo"
                          title="Alterar perfil de acesso"
                        >
                          <option value="vendedor">Perfil: Vendedor</option>
                          <option value="gerente">Perfil: Gerente</option>
                          <option value="admin">Perfil: Admin</option>
                        </select>
                      )}

                      {!u.is_master && u.username !== "conradosmn" && (
                        <button
                          type="button"
                          onClick={() => handleResetUserPasswordToDefault(u)}
                          title={`Redefinir para a senha inicial ${defaultPassForUser}`}
                          className="px-2.5 py-2 rounded-xl bg-areia hover:bg-borda/50 border border-borda text-xs font-medium text-oliva hover:text-musgo flex items-center gap-1 transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-terracota" />
                          <span>Resetar</span>
                        </button>
                      )}

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
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
