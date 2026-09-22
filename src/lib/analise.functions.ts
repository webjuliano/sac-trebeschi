import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AnaliseComercial } from "./sankhya.server";

async function exigirEquipe(context: { supabase: { rpc: (fn: never, args: never) => unknown }; userId: string }) {
  const { data, error } = await (
    context.supabase as unknown as {
      rpc: (fn: string, args: Record<string, string>) => PromiseLike<{ data: boolean | null; error: { message: string } | null }>;
    }
  ).rpc("is_equipe", { _user_id: context.userId });
  if (error || !data) throw new Error("Análise disponível somente para a equipe Trebeschi.");
}

/** Solicitações pendentes de análise comercial. */
export const listarParaAnalise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ busca: z.string().trim().max(120).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await exigirEquipe(context);
    let query = context.supabase
      .from("protocolos")
      .select("id, numero, loja_nome, loja_codigo, cliente_nome, nota_fiscal, motivo, status, valor_total, created_at")
      .in("status", ["aberto", "em_analise", "aguardando_cliente"])
      .order("created_at", { ascending: true })
      .limit(200);
    if (data.busca) {
      query = query.or(
        `numero.ilike.%${data.busca}%,loja_nome.ilike.%${data.busca}%,nota_fiscal.ilike.%${data.busca}%`,
      );
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Painel comercial do cliente no Sankhya (com cache curto). */
export const obterAnaliseComercial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ protocolo_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ analise: AnaliseComercial; limite_percentual: number }> => {
    await exigirEquipe(context);

    const { data: protocolo, error } = await context.supabase
      .from("protocolos")
      .select("id, loja_id, nota_fiscal")
      .eq("id", data.protocolo_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!protocolo) throw new Error("Solicitação não encontrada.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: loja }, { data: configs }] = await Promise.all([
      protocolo.loja_id
        ? supabaseAdmin.from("lojas").select("codigo_sankhya").eq("id", protocolo.loja_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from("configuracoes")
        .select("chave, valor")
        .in("chave", ["limite_percentual_devolucao", "sankhya_cache_minutos"]),
    ]);

    const valorConfig = (chave: string, padrao: number) => {
      const bruto = (configs ?? []).find((c) => c.chave === chave)?.valor;
      const numero = Number(bruto);
      return Number.isFinite(numero) && numero > 0 ? numero : padrao;
    };
    const limite = valorConfig("limite_percentual_devolucao", 2);
    const minutosCache = valorConfig("sankhya_cache_minutos", 15);

    const codigoCliente = loja?.codigo_sankhya ?? null;
    const chave = `analise:${codigoCliente ?? "sem-codigo"}:${protocolo.nota_fiscal ?? "sem-nota"}`;

    const { data: cache } = await supabaseAdmin
      .from("sankhya_cache")
      .select("payload, expira_em")
      .eq("chave", chave)
      .maybeSingle();
    if (cache && new Date(cache.expira_em) > new Date()) {
      return { analise: cache.payload as unknown as AnaliseComercial, limite_percentual: limite };
    }

    const { buscarAnaliseComercial } = await import("./sankhya.server");
    let analise: AnaliseComercial;
    try {
      analise = await buscarAnaliseComercial({
        codigoCliente,
        notaFiscal: protocolo.nota_fiscal,
      });
    } catch (erro) {
      return {
        analise: {
          configurado: false,
          motivo: erro instanceof Error ? erro.message : "Falha ao consultar o Sankhya.",
        },
        limite_percentual: limite,
      };
    }

    if (analise.configurado) {
      await supabaseAdmin.from("sankhya_cache").upsert({
        chave,
        payload: JSON.parse(JSON.stringify(analise)),
        expira_em: new Date(Date.now() + minutosCache * 60_000).toISOString(),
      });
    }

    return { analise, limite_percentual: limite };
  });

/** Corrige o número da nota de venda e a data da compra informados pela loja. */
export const corrigirDadosVenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        protocolo_id: z.string().uuid(),
        nota_fiscal: z.string().trim().max(30).nullable(),
        data_compra: z
          .string()
          .trim()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da compra no formato dia/mês/ano.")
          .nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirEquipe(context);

    const { data: atual, error: erroLeitura } = await context.supabase
      .from("protocolos")
      .select("nota_fiscal, data_compra")
      .eq("id", data.protocolo_id)
      .maybeSingle();
    if (erroLeitura) throw new Error(erroLeitura.message);
    if (!atual) throw new Error("Solicitação não encontrada.");

    const nota = data.nota_fiscal || null;
    const dataCompra = data.data_compra || null;

    const { error } = await context.supabase
      .from("protocolos")
      .update({ nota_fiscal: nota, data_compra: dataCompra })
      .eq("id", data.protocolo_id);
    if (error) throw new Error(error.message);

    const { data: perfil } = await context.supabase
      .from("profiles")
      .select("nome, email")
      .eq("id", context.userId)
      .maybeSingle();

    await context.supabase.from("protocolo_eventos").insert({
      protocolo_id: data.protocolo_id,
      tipo: "correcao_dados_venda",
      descricao:
        `Dados da venda corrigidos — nota de venda: ${atual.nota_fiscal || "não informada"} → ${nota || "não informada"}; ` +
        `data da compra: ${atual.data_compra || "não informada"} → ${dataCompra || "não informada"}.`,
      autor_id: context.userId,
      autor_nome: perfil?.nome || perfil?.email || "Equipe Trebeschi",
    });

    return { ok: true };
  });

/** Grava no histórico o resumo dos números usados na análise. */

export const registrarSnapshotAnalise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ protocolo_id: z.string().uuid(), resumo: z.string().trim().min(3).max(2000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirEquipe(context);
    const { data: perfil } = await context.supabase
      .from("profiles")
      .select("nome, email")
      .eq("id", context.userId)
      .maybeSingle();
    const { error } = await context.supabase.from("protocolo_eventos").insert({
      protocolo_id: data.protocolo_id,
      tipo: "analise_comercial",
      descricao: data.resumo,
      autor_id: context.userId,
      autor_nome: perfil?.nome || perfil?.email || "Equipe Trebeschi",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
