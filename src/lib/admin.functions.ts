import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const lojaSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  codigo: z.string().trim().min(1).max(40),
  codigo_sankhya: z.string().trim().min(1).max(40),
  dias_vendas: z.number().int().min(1).max(365),
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
      supabaseAdmin.from("profiles").select("id, nome, email, ativo, created_at").order("nome"),
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
      codigo_sankhya: data.codigo_sankhya,
      dias_vendas: data.dias_vendas,
      rede: data.rede || null,
      cnpj: data.cnpj || null,
      email_contato: data.email_contato || null,
    });
    if (error) throw new Error(error.code === "23505" ? "Já existe uma loja com este código." : error.message);
    return { ok: true };
  });

/** Atualiza o código do cliente no Sankhya de uma loja já cadastrada. */
export const atualizarCodigoSankhya = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ loja_id: z.string().uuid(), codigo_sankhya: z.string().trim().max(40), dias_vendas: z.number().int().min(1).max(365) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("lojas")
      .update({ codigo_sankhya: data.codigo_sankhya || null, dias_vendas: data.dias_vendas })
      .eq("id", data.loja_id);
    if (error) {
      throw new Error(
        error.code === "23505" ? "Este código do Sankhya já está em outra loja." : error.message,
      );
    }
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
    if (authError || !criado.user) {
      const mensagem = authError?.message ?? "";
      if (/already been registered|already exists|already registered/i.test(mensagem)) {
        return {
          ok: false as const,
          mensagem: "Já existe um usuário com este e-mail. Ajuste as lojas dele na lista ao lado.",
        };
      }
      return { ok: false as const, mensagem: mensagem || "Não foi possível criar o usuário." };
    }

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
      return { ok: false as const, mensagem: erro.message };
    }
    return { ok: true as const, mensagem: "" };
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

const STATUS_ABERTOS = [
  "aberto",
  "em_analise",
  "aguardando_cliente",
  "aguardando_nf",
  "coletado",
] as const;

/** Ativa ou inativa o acesso de um usuário (mantém o histórico). */
export const definirStatusUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid(), ativo: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    if (data.user_id === context.userId && !data.ativo) {
      return { ok: false as const, mensagem: "Você não pode inativar o seu próprio acesso." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ ativo: data.ativo })
      .eq("id", data.user_id);
    if (error) return { ok: false as const, mensagem: error.message };
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.ativo ? "none" : "876000h",
    });
    if (authError) return { ok: false as const, mensagem: authError.message };
    return { ok: true as const, mensagem: data.ativo ? "Acesso reativado." : "Acesso inativado." };
  });

/** Redefine a senha de um usuário (somente administrador). */
export const redefinirSenhaUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        senha: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres.").max(72),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.senha,
    });
    if (error) return { ok: false as const, mensagem: error.message };
    return { ok: true as const, mensagem: "Senha alterada com sucesso." };
  });


/** Exclui o usuário somente quando não há nenhum vínculo na base. */
export const excluirUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ user_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    if (data.user_id === context.userId) {
      return { ok: false as const, mensagem: "Você não pode excluir o seu próprio acesso." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: papeis } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id);
    const roles = (papeis ?? []).map((item) => item.role);
    const equipe = roles.includes("admin") || roles.includes("analista");

    // Atendimentos: solicitações em que o usuário atuou.
    const atendimentos = await Promise.all(
      (["responsavel_id", "decidido_por", "canhoto_confirmado_por"] as const).map((coluna) =>
        supabaseAdmin
          .from("protocolos")
          .select("id", { count: "exact", head: true })
          .eq(coluna, data.user_id),
      ),
    );
    const eventos = await supabaseAdmin
      .from("protocolo_eventos")
      .select("id", { count: "exact", head: true })
      .eq("autor_id", data.user_id);
    const atuacoes = atendimentos.reduce((total, r) => total + (r.count ?? 0), 0) + (eventos.count ?? 0);
    if (atuacoes > 0) {
      return {
        ok: false as const,
        mensagem: equipe
          ? "Este usuário já possui atendimentos registrados. Inative o acesso em vez de excluir."
          : "Este usuário já possui registros em solicitações. Inative o acesso em vez de excluir.",
      };
    }

    // Usuário de loja: não pode ter solicitação em aberto nas lojas vinculadas.
    if (!equipe) {
      const { data: vinculos } = await supabaseAdmin
        .from("user_lojas")
        .select("loja_id")
        .eq("user_id", data.user_id);
      const lojaIds = (vinculos ?? []).map((item) => item.loja_id);
      if (lojaIds.length > 0) {
        const { count } = await supabaseAdmin
          .from("protocolos")
          .select("id", { count: "exact", head: true })
          .in("loja_id", lojaIds)
          .in("status", [...STATUS_ABERTOS]);
        if ((count ?? 0) > 0) {
          return {
            ok: false as const,
            mensagem:
              "Existem solicitações em aberto nas lojas deste usuário. Conclua-as ou apenas inative o acesso.",
          };
        }
      }
    }

    await supabaseAdmin.from("user_lojas").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) return { ok: false as const, mensagem: error.message };
    return { ok: true as const, mensagem: "Usuário excluído." };
  });
/** Edita nome, perfil e lojas permitidas de um usuário. */
export const editarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      nome: z.string().trim().min(2).max(120),
      role: z.enum(["admin", "analista", "loja"]),
      loja_ids: z.array(z.string().uuid()).max(100),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    if (data.role === "loja" && data.loja_ids.length === 0) {
      return { ok: false as const, mensagem: "Selecione pelo menos uma loja para este usuário." };
    }
    if (data.user_id === context.userId && data.role !== "admin") {
      return { ok: false as const, mensagem: "Você não pode remover o seu próprio perfil de administrador." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: perfilError } = await supabaseAdmin.from("profiles").update({ nome: data.nome }).eq("id", data.user_id);
    if (perfilError) return { ok: false as const, mensagem: perfilError.message };
    const { error: delRole } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).neq("role", data.role);
    if (delRole) return { ok: false as const, mensagem: delRole.message };
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert({ user_id: data.user_id, role: data.role }, { onConflict: "user_id,role" });
    if (roleError) return { ok: false as const, mensagem: roleError.message };
    const { error: delLojas } = await supabaseAdmin.from("user_lojas").delete().eq("user_id", data.user_id);
    if (delLojas) return { ok: false as const, mensagem: delLojas.message };
    if (data.role === "loja") {
      const { error } = await supabaseAdmin.from("user_lojas").insert([...new Set(data.loja_ids)].map((loja_id) => ({ user_id: data.user_id, loja_id })));
      if (error) return { ok: false as const, mensagem: error.message };
    }
    return { ok: true as const, mensagem: "Usuário atualizado." };
  });

/** Busca no Sankhya as lojas de um parceiro matriz, marcando as já cadastradas. */
export const buscarLojasMatriz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ codigo_matriz: z.string().trim().regex(/^\d{1,12}$/) }).parse(data))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { listarLojasMatriz } = await import("./sankhya.server");
    try {
      const resultado = await listarLojasMatriz(data.codigo_matriz);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existentes } = await supabaseAdmin.from("lojas").select("codigo_sankhya, codigo");
      const usados = new Set((existentes ?? []).flatMap((l) => [l.codigo_sankhya, l.codigo]).filter(Boolean));
      return {
        ok: true as const,
        matriz: resultado.matriz,
        lojas: resultado.lojas.map((l) => ({ ...l, ja_cadastrada: usados.has(l.codparc) })),
      };
    } catch (error) {
      return { ok: false as const, mensagem: error instanceof Error ? error.message : "Falha ao consultar o Sankhya." };
    }
  });

export const importarLojasMatriz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      rede: z.string().trim().max(120).nullable(),
      lojas: z.array(z.object({
        codparc: z.string().trim().regex(/^\d{1,12}$/),
        nome: z.string().trim().min(1).max(120),
        dias_vendas: z.number().int().min(1).max(365),
      })).min(1).max(500),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let importadas = 0;
    const falhas: string[] = [];
    for (const loja of data.lojas) {
      const { error } = await supabaseAdmin.from("lojas").insert({
        nome: loja.nome, codigo: loja.codparc, codigo_sankhya: loja.codparc,
        dias_vendas: loja.dias_vendas, rede: data.rede || null,
      });
      if (error) falhas.push(`${loja.nome}${error.code === "23505" ? " (já cadastrada)" : ""}`);
      else importadas++;
    }
    return { importadas, falhas };
  });
