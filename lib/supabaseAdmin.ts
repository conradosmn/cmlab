import { createClient } from "@supabase/supabase-js";
import { supabase as anonClient, isSupabaseConfigured } from "./supabaseClient";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const hasServiceRole = Boolean(
  supabaseUrl && serviceRoleKey && supabaseUrl.startsWith("http")
);

/**
 * Cliente de escrita do servidor.
 *
 * Com SUPABASE_SERVICE_ROLE_KEY definida, ignora RLS — é o que permite fechar
 * as políticas sem quebrar a aplicação (ver supabase/rls-lockdown.sql).
 * Sem ela, cai no cliente anônimo: tudo segue funcionando, mas o banco continua
 * exposto a quem extrair a anon key do bundle.
 *
 * Esta chave NUNCA pode ter o prefixo NEXT_PUBLIC_: ela daria acesso total ao
 * banco a qualquer visitante.
 */
export const supabaseAdmin = hasServiceRole
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : anonClient;

export const isSupabaseWritable = hasServiceRole || isSupabaseConfigured;
