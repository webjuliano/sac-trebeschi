import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);

const fotoSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  base64: z.string().min(10).max(3_500_000),
  hash: hashSchema.optional().nullable(),
});

type AdminClient = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

/** Retorna os hashes já usados em outras solicitações, com o número do protocolo. */
async function hashesJaUsados(admin: AdminClient, hashes: string[]) {
  const mapa = new Map<string, string>();
  if (hashes.length === 0) return mapa;
  const { data, error } = await admin
    .from("protocolo_fotos")
    .select("hash, protocolos(numero)")
    .in("hash", hashes);
  if (error) throw new Error(error.message);
  for (const linha of data ?? []) {
    const numero = (linha.protocolos as { numero: string } | null)?.numero ?? "anterior";
    if (linha.hash && !mapa.has(linha.hash)) mapa.set(linha.hash, numero);
  }
  return mapa;
}

/** Verifica, no momento de anexar, se as fotos já foram usadas em outra solicitação. */
export const verificarFotosUsadas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ hashes: z.array(hashSchema).max(20) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mapa = await hashesJaUsados(supabaseAdmin, data.hashes);
    return Array.from(mapa, ([hash, numero]) => ({ hash, numero }));
  });

const itemSchema = z.object({
  codigo_produto: z.string().trim().max(60).optional().nullable(),
  descricao: z.string().trim().min(1).max(200),
  quantidade: z.number().positive().max(999999),
  unidade: z.string().trim().max(10).optional().nullable(),
  valor_unitario: z.number().min(0).max(9999999),
  lote: z.string().trim().max(60).optional().nullable(),
  motivo: z.string().trim().min(3, "Descreva a avaria de cada item.").max(200),
  fotos: z.array(fotoSchema).min(1, "Anexe ao menos uma foto de evidência por item.").max(6),
});


const aberturaSchema = z.object({
  loja_id: z.string().uuid(),
  cliente_nome: z.string().trim().min(2).max(120),
  cliente_email: z.string().trim().email().max(160),
  cliente_telefone: z.string().trim().max(40).optional().nullable(),
  nota_fiscal: z.string().trim().max(60).optional().nullable(),
  pedido: z.string().trim().max(60).optional().nullable(),
  data_compra: z.string().trim().max(10).optional().nullable(),
  motivo: z.string().trim().max(160).optional().nullable(),
  descricao: z.string().trim().max(2000).optional().nullable(),
  itens: z.array(itemSchema).min(1).max(40),
  fotos: z.array(fotoSchema).max(12).default([]),
});

export type AberturaInput = z.infer<typeof aberturaSchema>;

function decodeBase64(base64: string): Uint8Array {
  const clean = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Lista somente as lojas que o usuário autenticado pode usar. */
export const listarLojasPermitidas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
  const { data, error } = await context.supabase
    .from("lojas")
    .select("id, nome, codigo, rede")
    .eq("ativa", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
  });

/** Abertura de protocolo pela loja (formulário público). */
export const abrirProtocolo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => aberturaSchema.parse(data))
  .handler(async ({ data, context }) => {
    const [{ data: equipe }, { data: acesso }] = await Promise.all([
      context.supabase.rpc("is_equipe", { _user_id: context.userId }),
      context.supabase.rpc("usuario_tem_acesso_loja", { _user_id: context.userId, _loja_id: data.loja_id }),
    ]);
    if (!equipe && !acesso) throw new Error("Você não possui acesso a esta loja.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: loja, error: lojaError } = await supabaseAdmin
      .from("lojas")
      .select("id, nome, codigo")
      .eq("id", data.loja_id)
      .maybeSingle();
    if (lojaError) throw new Error(lojaError.message);
    if (!loja) throw new Error("Loja não encontrada.");

    const todosHashes = [...data.itens.flatMap((i) => i.fotos), ...data.fotos]
      .map((f) => f.hash)
      .filter((h): h is string => !!h);
    if (new Set(todosHashes).size !== todosHashes.length) {
      throw new Error("A mesma foto foi anexada mais de uma vez. Remova as fotos repetidas.");
    }
    const usados = await hashesJaUsados(supabaseAdmin, todosHashes);
    if (usados.size > 0) {
      const protocolos = Array.from(new Set(usados.values())).join(", ");
      throw new Error(`Há fotos já usadas em outra solicitação (${protocolos}). Envie fotos novas.`);
    }

    const valorTotal = data.itens.reduce(
      (total, item) => total + item.quantidade * item.valor_unitario,
      0,
    );

    const { data: protocolo, error } = await supabaseAdmin
      .from("protocolos")
      .insert({
        numero: "",
        loja_id: loja.id,
        loja_nome: loja.nome,
        loja_codigo: loja.codigo,
        cliente_nome: data.cliente_nome,
        cliente_email: data.cliente_email.toLowerCase(),
        cliente_telefone: data.cliente_telefone ?? null,
        nota_fiscal: data.nota_fiscal ?? null,
        pedido: data.pedido ?? null,
        data_compra: data.data_compra || null,
        motivo: data.motivo || data.itens.map((i) => i.motivo).join("; ").slice(0, 160),
        descricao: data.descricao ?? null,
        valor_total: Number(valorTotal.toFixed(2)),
      })
      .select("id, numero")
      .single();
    if (error) throw new Error(error.message);

    const { data: itensCriados, error: itensError } = await supabaseAdmin.from("protocolo_itens").insert(
      data.itens.map((item) => ({
        protocolo_id: protocolo.id,
        codigo_produto: item.codigo_produto ?? null,
        descricao: item.descricao,
        quantidade: item.quantidade,
        unidade: item.unidade ?? null,
        valor_unitario: item.valor_unitario,
        lote: item.lote ?? null,
        motivo: item.motivo,
      })),
    ).select("id");
    if (itensError) throw new Error(itensError.message);

    for (const [itemIndex, item] of data.itens.entries()) {
      const itemId = itensCriados?.[itemIndex]?.id ?? null;
      for (const [index, foto] of item.fotos.entries()) {
        const bytes = decodeBase64(foto.base64);
        const path = `${protocolo.id}/item-${itemIndex}-${Date.now()}-${index}.jpg`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from("protocolo-fotos")
          .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
        if (uploadError) continue;
        await supabaseAdmin.from("protocolo_fotos").insert({
          protocolo_id: protocolo.id,
          item_id: itemId,
          storage_path: path,
          tipo: "evidencia",
          tamanho_bytes: bytes.byteLength,
          hash: foto.hash ?? null,
        });
      }
    }

    for (const [index, foto] of data.fotos.entries()) {
      const bytes = decodeBase64(foto.base64);
      const path = `${protocolo.id}/${Date.now()}-${index}.jpg`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("protocolo-fotos")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
      if (uploadError) continue;
      await supabaseAdmin.from("protocolo_fotos").insert({
        protocolo_id: protocolo.id,
        storage_path: path,
        tipo: "evidencia",
        tamanho_bytes: bytes.byteLength,
          hash: foto.hash ?? null,
      });
    }

    await supabaseAdmin.from("protocolo_eventos").insert({
      protocolo_id: protocolo.id,
      tipo: "abertura",
      descricao: `Protocolo aberto pela loja ${loja.nome}.`,
      autor_nome: data.cliente_nome,
    });

    const { notificarCliente } = await import("./notificacoes.server");
    await notificarCliente({
      para: data.cliente_email,
      assunto: `Devolução ${protocolo.numero} registrada`,
      titulo: "Recebemos sua solicitação de devolução",
      linhas: [
        `Olá ${data.cliente_nome}, sua solicitação foi registrada com o número ${protocolo.numero}.`,
        "Nossa equipe vai analisar as evidências e você receberá a resposta por e-mail.",
      ],
      protocoloId: protocolo.id,
    });

    return { numero: protocolo.numero };
  });

/** Consulta pública: número do protocolo + e-mail do solicitante. */
export const consultarProtocolo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ numero: z.string().trim().min(3).max(40), email: z.string().trim().email() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: protocolo, error } = await supabaseAdmin
      .from("protocolos")
      .select(
        "numero, status, loja_nome, motivo, valor_total, created_at, parecer, decidido_em, cliente_nome",
      )
      .eq("numero", data.numero.trim().toUpperCase())
      .eq("cliente_email", data.email.trim().toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return protocolo;
  });

/** Fila interna da equipe Trebeschi. */
export const listarProtocolos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        status: z.string().optional(),
        busca: z.string().trim().max(120).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("protocolos")
      .select(
        "id, numero, loja_nome, cliente_nome, motivo, status, valor_total, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.status && data.status !== "todos") {
      query = query.eq("status", data.status as never);
    }
    if (data.busca) {
      query = query.or(
        `numero.ilike.%${data.busca}%,loja_nome.ilike.%${data.busca}%,cliente_nome.ilike.%${data.busca}%`,
      );
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const obterProtocolo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: protocolo, error } = await context.supabase
      .from("protocolos")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!protocolo) throw new Error("Protocolo não encontrado.");

    const [itens, fotos, eventos, acesso] = await Promise.all([
      context.supabase
        .from("protocolo_itens")
        .select("*")
        .eq("protocolo_id", data.id)
        .order("created_at"),
      context.supabase
        .from("protocolo_fotos")
        .select("id, storage_path, tipo, expurgada, created_at")
        .eq("protocolo_id", data.id)
        .order("created_at"),
      context.supabase
        .from("protocolo_eventos")
        .select("*")
        .eq("protocolo_id", data.id)
        .order("created_at"),
      context.supabase.rpc("is_equipe", { _user_id: context.userId }),
    ]);

    // Registros internos (análise comercial, correções de dados da venda) só para a equipe Trebeschi.
    const tiposInternos = new Set(["analise_comercial", "correcao_dados_venda"]);
    const eventosVisiveis = acesso.data
      ? eventos.data ?? []
      : (eventos.data ?? []).filter((evento) => !tiposInternos.has(evento.tipo));

    const fotosComUrl = await Promise.all(
      (fotos.data ?? []).map(async (foto) => {
        if (foto.expurgada) return { ...foto, url: null };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: signed } = await supabaseAdmin.storage
          .from("protocolo-fotos")
          .createSignedUrl(foto.storage_path, 60 * 30);
        return { ...foto, url: signed?.signedUrl ?? null };
      }),
    );

    let nfUrl: string | null = null;
    if (protocolo.nf_devolucao_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage
        .from("protocolo-nf").createSignedUrl(protocolo.nf_devolucao_path, 60 * 30);
      nfUrl = signed?.signedUrl ?? null;
    }
    let canhotoUrl: string | null = null;
    if (protocolo.canhoto_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage
        .from("protocolo-canhoto").createSignedUrl(protocolo.canhoto_path, 60 * 30);
      canhotoUrl = signed?.signedUrl ?? null;
    }

    return {
      protocolo,
      nfUrl,
      canhotoUrl,
      itens: itens.data ?? [],
      fotos: fotosComUrl,
      eventos: eventosVisiveis,
    };
  });

const decisaoSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["aberto", "em_analise", "recusado", "aguardando_nf", "nf_anexada", "canhoto_assinado", "encerrado"]),
  aprovacao: z.enum(["aceito_parcial", "aceito_total", "recusado"]).optional().nullable(),
  parecer: z.string().trim().max(2000).optional().nullable(),
  quantidades: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        quantidade_aceita: z.number().min(0).max(999999),
      }),
    )
    .max(40)
    .optional(),
});

const ROTULOS: Record<string, string> = {
  em_analise: "Em análise",
  aguardando_cliente: "Aguardando informação do cliente",
  aceito_total: "Devolução aceita integralmente",
  aceito_parcial: "Devolução aceita parcialmente",
  recusado: "Devolução recusada",
  aguardando_nf: "Aguardando nota fiscal de devolução",
  coletado: "Coleta confirmada",
  nf_anexada: "Nota fiscal de devolução anexada",
  canhoto_assinado: "Canhoto assinado",
  aberto: "Aberto",
  encerrado: "Protocolo encerrado",
};

export const registrarDecisao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => decisaoSchema.parse(data))
  .handler(async ({ data, context }) => {
    const decisivo = !!data.aprovacao;
    if (data.aprovacao === "aceito_total" || data.aprovacao === "aceito_parcial") data.status = "aguardando_nf";
    else if (data.aprovacao === "recusado") data.status = "recusado";
    const rotulo = data.aprovacao ? ROTULOS[data.aprovacao] : ROTULOS[data.status];

    if (data.quantidades?.length) {
      const resultados = await Promise.all(
        data.quantidades.map((item) =>
          context.supabase
            .from("protocolo_itens")
            .update({ quantidade_aceita: item.quantidade_aceita })
            .eq("id", item.item_id)
            .eq("protocolo_id", data.id),
        ),
      );
      const erroQuantidade = resultados.find((resultado) => resultado.error)?.error;
      if (erroQuantidade) throw new Error(erroQuantidade.message);
    }

    const { data: protocolo, error } = await context.supabase
      .from("protocolos")
      .update({
        status: data.status,
        aprovacao: data.aprovacao ?? null,
        parecer: data.parecer ?? null,
        responsavel_id: context.userId,
        ...(decisivo ? { decidido_por: context.userId, decidido_em: new Date().toISOString() } : {}),
        ...(data.status === "encerrado" ? { encerrado_em: new Date().toISOString() } : {}),
      })
      .eq("id", data.id)
      .select("id, numero, cliente_nome, cliente_email, status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!protocolo) throw new Error("Protocolo não encontrado ou sem permissão.");

    const { data: perfil } = await context.supabase
      .from("profiles")
      .select("nome, email")
      .eq("id", context.userId)
      .maybeSingle();

    await context.supabase.from("protocolo_eventos").insert({
      protocolo_id: data.id,
      tipo: decisivo ? "decisao" : "andamento",
      descricao: `${rotulo}${data.aprovacao === "aceito_total" || data.aprovacao === "aceito_parcial" ? " — aguardando NF de devolução" : ""}${data.parecer ? ` — ${data.parecer}` : ""}`,
      autor_id: context.userId,
      autor_nome: perfil?.nome || perfil?.email || "Equipe Trebeschi",
    });

    const { notificarCliente } = await import("./notificacoes.server");
    await notificarCliente({
      para: protocolo.cliente_email,
      assunto: `Devolução ${protocolo.numero}: ${rotulo}`,
      titulo: rotulo ?? "Atualização da sua devolução",
      linhas: [
        `Olá ${protocolo.cliente_nome}, houve uma atualização no protocolo ${protocolo.numero}.`,
        rotulo ?? "",
        ...(data.status === "aguardando_nf" ? ["Acesse o portal e anexe o PDF (DANFE) da nota fiscal de devolução."] : []),
        ...(data.parecer ? [data.parecer] : []),
      ],
      protocoloId: protocolo.id,
    });

    return { ok: true };
  });

export const registrarNotaDevolucao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        nf_devolucao: z.string().trim().min(1).max(60),
        pdf_base64: z.string().min(10).max(14_000_000),
        nome_arquivo: z.string().max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // RLS garante que o usuário só enxerga protocolos das lojas dele
    const { data: protocolo } = await context.supabase
      .from("protocolos").select("id, numero, status").eq("id", data.id).maybeSingle();
    if (!protocolo) throw new Error("Protocolo não encontrado ou sem permissão.");
    if (protocolo.status !== "aguardando_nf") throw new Error("Este protocolo não está aguardando nota fiscal.");
    const bytes = Buffer.from(data.pdf_base64, "base64");
    if (bytes.subarray(0, 4).toString() !== "%PDF") throw new Error("Envie o arquivo PDF (DANFE) da nota fiscal.");
    if (bytes.length > 10 * 1024 * 1024) throw new Error("O PDF deve ter no máximo 10 MB.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const caminho = `${data.id}/nf-${Date.now()}.pdf`;
    const { error: erroUpload } = await supabaseAdmin.storage
      .from("protocolo-nf").upload(caminho, bytes, { contentType: "application/pdf" });
    if (erroUpload) throw new Error("Não foi possível gravar o PDF.");
    const { error } = await supabaseAdmin
      .from("protocolos")
      .update({ nf_devolucao: data.nf_devolucao, nf_devolucao_path: caminho, status: "nf_anexada" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { data: perfil } = await context.supabase
      .from("profiles").select("nome, email").eq("id", context.userId).maybeSingle();
    await supabaseAdmin.from("protocolo_eventos").insert({
      protocolo_id: data.id,
      tipo: "nota_fiscal",
      descricao: `Nota fiscal de devolução anexada: ${data.nf_devolucao} (${data.nome_arquivo}).`,
      autor_id: context.userId,
      autor_nome: perfil?.nome || perfil?.email || null,
    });
    return { ok: true };
  });

export const registrarCanhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        arquivo_base64: z.string().min(10).max(14_000_000),
        nome_arquivo: z.string().max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: equipe } = await context.supabase.rpc("is_equipe", { _user_id: context.userId });
    if (!equipe) throw new Error("Somente a equipe Trebeschi pode anexar o canhoto.");
    const { data: protocolo } = await context.supabase
      .from("protocolos").select("id, status").eq("id", data.id).maybeSingle();
    if (!protocolo) throw new Error("Protocolo não encontrado.");
    if (protocolo.status !== "nf_anexada") throw new Error("O canhoto só pode ser anexado após a NF anexada.");
    const bytes = Buffer.from(data.arquivo_base64, "base64");
    if (bytes.length > 10 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 10 MB.");
    let tipo = "";
    let ext = "";
    if (bytes.subarray(0, 4).toString() === "%PDF") { tipo = "application/pdf"; ext = "pdf"; }
    else if (bytes[0] === 0xff && bytes[1] === 0xd8) { tipo = "image/jpeg"; ext = "jpg"; }
    else if (bytes[0] === 0x89 && bytes[1] === 0x50) { tipo = "image/png"; ext = "png"; }
    else throw new Error("Envie o canhoto em PDF, JPG ou PNG.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const caminho = `${data.id}/canhoto-${Date.now()}.${ext}`;
    const { error: erroUpload } = await supabaseAdmin.storage
      .from("protocolo-canhoto").upload(caminho, bytes, { contentType: tipo });
    if (erroUpload) throw new Error("Não foi possível gravar o canhoto.");
    const agora = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("protocolos")
      .update({ canhoto_path: caminho, canhoto_confirmado_por: context.userId, canhoto_confirmado_em: agora, status: "canhoto_assinado" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const { data: perfil } = await context.supabase
      .from("profiles").select("nome, email").eq("id", context.userId).maybeSingle();
    await supabaseAdmin.from("protocolo_eventos").insert({
      protocolo_id: data.id,
      tipo: "canhoto",
      descricao: `Canhoto assinado anexado (${data.nome_arquivo}).`,
      autor_id: context.userId,
      autor_nome: perfil?.nome || perfil?.email || null,
    });
    return { ok: true };
  });

export const indicadores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("protocolos")
      .select("status, valor_total, loja_nome, created_at")
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

async function lojaComAcesso(context: { supabase: any; userId: string }, lojaId: string) {
  const [{ data: equipe }, { data: acesso }] = await Promise.all([
    context.supabase.rpc("is_equipe", { _user_id: context.userId }),
    context.supabase.rpc("usuario_tem_acesso_loja", { _user_id: context.userId, _loja_id: lojaId }),
  ]);
  if (!equipe && !acesso) throw new Error("Você não possui acesso a esta loja.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: loja } = await supabaseAdmin
    .from("lojas").select("codigo_sankhya, dias_vendas").eq("id", lojaId).maybeSingle();
  if (!loja?.codigo_sankhya) throw new Error("Esta loja ainda não tem o código do cliente no Sankhya cadastrado.");
  return { codigo: loja.codigo_sankhya, dias: loja.dias_vendas ?? 30 };
}

/** Últimas notas de venda da loja conforme a quantidade de dias do cadastro. */
export const listarNotasVendaLoja = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ loja_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const loja = await lojaComAcesso(context, data.loja_id);
    const { listarNotasRecentes } = await import("./sankhya.server");
    return { dias: loja.dias, notas: await listarNotasRecentes(loja.codigo, loja.dias) };
  });

/** Itens de uma nota de venda da loja. */
export const listarItensNotaVenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ loja_id: z.string().uuid(), nunota: z.string().regex(/^\d{1,12}$/) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const loja = await lojaComAcesso(context, data.loja_id);
    const { listarItensNota } = await import("./sankhya.server");
    return await listarItensNota(loja.codigo, data.nunota);
  });
