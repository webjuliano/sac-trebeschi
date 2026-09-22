import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const lojaSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  codigo: z.string().trim().min(1).max(40),
  codigo_sankhya: z.string().trim().min(1).max(40),
  rede: z.string().trim().max(120).optional().nullable(),
  cnpj: z.string().trim().max(24).optional().nullable(),
  email_contato: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
});


const usuarioSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  senha: z.string().min(8).max(72),
  role: z.enum(["admin", "analista", "loja"]),
  loja_ids: z.array(z.string().uuid()).max(100),
});

async function exigirAdmin(context: {
  supabase: {
    rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{
      data: boolean | null;
      error: { message: string } | null;
    }>;
  };
  userId: string;
}) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Acesso permitido somente para administradores.");
}

export const obterMeuAcesso = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((item) => item.role);
    return { isAdmin: roles.includes("admin"), roles };
  });

export const listarAdministracao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [lojas, perfis, papeis, vinculos] = await Promise.all([
      supabaseAdmin.from("lojas").select("*").order("rede").order("nome"),
      supabaseAdmin.from("profiles").select("id, nome, email, created_at").order("nome"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("user_lojas").select("user_id, loja_id"),
    ]);
    const erro = lojas.error ?? perfis.error ?? papeis.error ?? vinculos.error;
    if (erro) throw new Error(erro.message);
    return {
      lojas: lojas.data ?? [],
      usuarios: (perfis.data ?? []).map((perfil) => ({
        ...perfil,
        roles: (papeis.data ?? []).filter((item) => item.user_id === perfil.id).map((item) => item.role),
        loja_ids: (vinculos.data ?? []).filter((item) => item.user_id === perfil.id).map((item) => item.loja_id),
      })),
    };
  });

export const criarLoja = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => lojaSchema.parse(data))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("lojas").insert({
      nome: data.nome,
      codigo: data.codigo.toUpperCase(),
      rede: data.rede || null,
      cnpj: data.cnpj || null,
      email_contato: data.email_contato || null,
    });
    if (error) throw new Error(error.code === "23505" ? "Já existe uma loja com este código." : error.message);
    return { ok: true };
  });

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => usuarioSchema.parse(data))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    if (data.role === "loja" && data.loja_ids.length === 0) {
      throw new Error("Selecione pelo menos uma loja para este usuário.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: criado, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (authError || !criado.user) throw new Error(authError?.message ?? "Não foi possível criar o usuário.");

    const userId = criado.user.id;
    const { error: perfilError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, nome: data.nome, email: data.email.toLowerCase() });
    const { error: papelError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" });
    const { error: vinculoError } = data.role === "loja"
      ? await supabaseAdmin.from("user_lojas").insert(
          [...new Set(data.loja_ids)].map((loja_id) => ({ user_id: userId, loja_id })),
        )
      : { error: null };

    const erro = perfilError ?? papelError ?? vinculoError;
    if (erro) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(erro.message);
    }
    return { ok: true };
  });

export const atualizarVinculosUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid(), loja_ids: z.array(z.string().uuid()).max(100) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: deleteError } = await supabaseAdmin.from("user_lojas").delete().eq("user_id", data.user_id);
    if (deleteError) throw new Error(deleteError.message);
    if (data.loja_ids.length > 0) {
      const { error } = await supabaseAdmin.from("user_lojas").insert(
        [...new Set(data.loja_ids)].map((loja_id) => ({ user_id: data.user_id, loja_id })),
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });