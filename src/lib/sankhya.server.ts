/**
 * Camada única de acesso ao ERP Sankhya.
 * Enquanto as credenciais não estiverem cadastradas, tudo responde
 * `configurado: false` e a análise segue de forma manual no portal.
 */

export type LinhaNota = {
  produto: string;
  codigo: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
};

export type NotaVenda = {
  numero: string;
  data_emissao: string | null;
  valor_total: number;
  itens: LinhaNota[];
};

export type PeriodoComercial = {
  rotulo: string;
  vendas: number;
  devolucoes: number;
  percentual_devolucao: number;
  margem_percentual: number | null;
};

export type AnaliseComercial =
  | { configurado: false; motivo: string }
  | {
      configurado: true;
      codigo_cliente: string;
      cliente_nome: string | null;
      nota: NotaVenda | null;
      periodos: PeriodoComercial[];
      consultado_em: string;
    };

type Credenciais = {
  url: string;
  token: string;
  clientId: string;
  clientSecret: string;
};

function normalizarUrl(bruto: string) {
  let u = bruto.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) u = `https://${u}`;
  return u.replace(/\/+$/, "").replace(/\/authenticate$/i, "").replace(/\/login$/i, "");
}

function lerCredenciais(): Credenciais | null {
  const token = process.env["SANKHYA_TOKEN"];
  const clientId = process.env["SANKHYA_CLIENT_ID"];
  const clientSecret = process.env["SANKHYA_CLIENT_SECRET"];
  const url = process.env["SANKHYA_BASE_URL"] || "https://api.sankhya.com.br";
  if (!token || !clientId || !clientSecret) return null;
  return { url: normalizarUrl(url), token, clientId, clientSecret };
}

export function sankhyaConfigurado(): boolean {
  return lerCredenciais() !== null;
}

async function comTempoLimite<T>(executar: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    return await executar(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Autentica no gateway Sankhya e devolve o access token da sessão. */
async function autenticar(cred: Credenciais): Promise<string> {
  return comTempoLimite(async (signal) => {
    const resposta = await fetch(`${cred.url}/authenticate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "X-Token": cred.token,
      },
      body: new URLSearchParams({
        client_id: cred.clientId,
        client_secret: cred.clientSecret,
        grant_type: "client_credentials",
      }).toString(),
      signal,
    });
    const texto = await resposta.text();
    if (!resposta.ok) {
      throw new Error(`Sankhya recusou a autenticação (${resposta.status}).`);
    }
    let json: { access_token?: string; error_description?: string };
    try {
      json = JSON.parse(texto) as typeof json;
    } catch {
      throw new Error("Resposta inesperada do Sankhya na autenticação.");
    }
    if (!json.access_token) {
      throw new Error(json.error_description || "Não foi possível autenticar no Sankhya.");
    }
    return json.access_token;
  });
}


async function chamar(cred: Credenciais, bearer: string, serviceName: string, body: unknown) {
  const alvo = new URL(`${cred.url}/gateway/v1/mge/service.sbr`);
  alvo.searchParams.set("serviceName", serviceName);
  alvo.searchParams.set("outputType", "json");
  return comTempoLimite(async (signal) => {
    const resposta = await fetch(alvo.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ serviceName, requestBody: body }),
      signal,
    });
    if (!resposta.ok) throw new Error(`Sankhya respondeu ${resposta.status}`);
    const json = (await resposta.json()) as {
      status?: string;
      statusMessage?: string;
      responseBody?: Record<string, unknown>;
    };
    if (json.status && json.status !== "1") {
      const mensagem = json.statusMessage
        ? decodeURIComponent(json.statusMessage.replace(/\+/g, " "))
        : "Falha na consulta ao Sankhya.";
      throw new Error(mensagem);
    }
    return json.responseBody ?? {};
  });
}

async function consultar(cred: Credenciais, bearer: string, sql: string): Promise<string[][]> {
  const corpo = await chamar(cred, bearer, "DbExplorerSP.executeQuery", { sql });
  const rows = (corpo as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) return [];
  return rows.map((linha) => (Array.isArray(linha) ? linha.map((v) => (v == null ? "" : String(v))) : []));
}


const num = (valor: string | undefined) => {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const escapar = (valor: string) => valor.replace(/'/g, "''");

/** Busca nota de venda + indicadores comerciais do cliente. */
export async function buscarAnaliseComercial(params: {
  codigoCliente: string | null;
  notaFiscal: string | null;
}): Promise<AnaliseComercial> {
  const cred = lerCredenciais();
  if (!cred) {
    return {
      configurado: false,
      motivo: "Integração com o Sankhya ainda não configurada (endereço e usuário de integração).",
    };
  }
  if (!params.codigoCliente) {
    return {
      configurado: false,
      motivo: "Esta loja ainda não tem o código do cliente do Sankhya preenchido no cadastro.",
    };
  }

  const codigo = escapar(params.codigoCliente.trim());
  const sessao = await autenticar(cred);

  const parceiro = await consultar(
    cred,
    sessao,
    `SELECT NOMEPARC FROM TGFPAR WHERE CODPARC = '${codigo}'`,
  );

  let nota: NotaVenda | null = null;
  if (params.notaFiscal) {
    const numeroNota = escapar(params.notaFiscal.trim());
    const cabecalho = await consultar(
      cred,
      sessao,
      `SELECT * FROM (
         SELECT NUNOTA, NUMNOTA, TO_CHAR(DTNEG, 'YYYY-MM-DD') AS DATA, VLRNOTA FROM TGFCAB
         WHERE CODPARC = '${codigo}' AND NUMNOTA = '${numeroNota}' AND TIPMOV = 'V'
         ORDER BY DTNEG DESC
       ) WHERE ROWNUM <= 1`,
    );

    const linha = cabecalho[0];
    if (linha) {
      const itens = await consultar(
        cred,
        sessao,
        `SELECT P.DESCRPROD, I.CODPROD, CASE WHEN VOA.DM = 'D' AND VOA.FATOR > 0 THEN I.QTDNEG * VOA.FATOR WHEN VOA.DM = 'M' AND VOA.FATOR > 0 THEN I.QTDNEG / VOA.FATOR ELSE I.QTDNEG END, CASE WHEN VOA.DM = 'D' AND VOA.FATOR > 0 THEN I.VLRUNIT / VOA.FATOR WHEN VOA.DM = 'M' AND VOA.FATOR > 0 THEN I.VLRUNIT * VOA.FATOR ELSE I.VLRUNIT END, I.VLRTOT
         FROM TGFITE I JOIN TGFPRO P ON P.CODPROD = I.CODPROD
         LEFT JOIN (SELECT CODPROD, CODVOL, MAX(DIVIDEMULTIPLICA) DM, MAX(QUANTIDADE) FATOR FROM TGFVOA GROUP BY CODPROD, CODVOL) VOA ON VOA.CODPROD = I.CODPROD AND VOA.CODVOL = I.CODVOL
         WHERE I.NUNOTA = ${num(linha[0])}`,
      );
      nota = {
        numero: linha[1] ?? numeroNota,
        data_emissao: linha[2] ?? null,
        valor_total: num(linha[3]),
        itens: itens.map((i) => ({
          produto: i[0] ?? "",
          codigo: i[1] ?? null,
          quantidade: num(i[2]),
          valor_unitario: num(i[3]),
          valor_total: num(i[4]),
        })),
      };
    }
  }

  const janelas: Array<{ rotulo: string; meses: number }> = [
    { rotulo: "Mês atual", meses: 0 },
    { rotulo: "Últimos 3 meses", meses: 3 },
    { rotulo: "Últimos 12 meses", meses: 12 },
  ];

  const periodos: PeriodoComercial[] = [];
  for (const janela of janelas) {
    const filtroData = (alias: string) =>
      janela.meses === 0
        ? `${alias}DTNEG >= TRUNC(SYSDATE, 'MM')`
        : `${alias}DTNEG >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -${janela.meses})`;
    const linhas = await consultar(
      cred,
      sessao,
      `SELECT TIPMOV, SUM(VLRNOTA) FROM TGFCAB
       WHERE CODPARC = '${codigo}' AND TIPMOV IN ('V','D') AND ${filtroData("")}
       GROUP BY TIPMOV`,
    );
    const vendas = num(linhas.find((l) => l[0] === "V")?.[1]);
    const devolucoes = num(linhas.find((l) => l[0] === "D")?.[1]);

    const margemLinhas = await consultar(
      cred,
      sessao,
      `SELECT SUM(I.VLRTOT), SUM(I.QTDNEG * NVL(CU.CUSMED, 0))
       FROM TGFITE I
       JOIN TGFCAB C ON C.NUNOTA = I.NUNOTA
       LEFT JOIN (
         SELECT CODPROD, MAX(CUSMED) KEEP (DENSE_RANK LAST ORDER BY DTATUAL) CUSMED
         FROM TGFCUS GROUP BY CODPROD
       ) CU ON CU.CODPROD = I.CODPROD
       WHERE C.CODPARC = '${codigo}' AND C.TIPMOV = 'V' AND ${filtroData("C.")}`,
    ).catch(() => [] as string[][]);
    const receita = num(margemLinhas[0]?.[0]);
    const custo = num(margemLinhas[0]?.[1]);


    periodos.push({
      rotulo: janela.rotulo,
      vendas,
      devolucoes,
      percentual_devolucao: vendas > 0 ? (devolucoes / vendas) * 100 : 0,
      margem_percentual: receita > 0 && custo > 0 ? ((receita - custo) / receita) * 100 : null,
    });
  }

  return {
    configurado: true,
    codigo_cliente: params.codigoCliente,
    cliente_nome: parceiro[0]?.[0] ?? null,
    nota,
    periodos,
    consultado_em: new Date().toISOString(),
  };
}

export type NotaResumo = { nunota: string; numero: string; data: string | null; valor_total: number };

/** Últimas notas de venda do cliente dentro da janela de dias. */
export async function listarNotasRecentes(codigoCliente: string, dias: number): Promise<NotaResumo[]> {
  const cred = lerCredenciais();
  if (!cred) throw new Error("Integração com o Sankhya não configurada.");
  const codigo = escapar(codigoCliente.trim());
  const janela = Math.max(1, Math.min(365, Math.round(dias)));
  const sessao = await autenticar(cred);
  const linhas = await consultar(
    cred,
    sessao,
    `SELECT * FROM (
       SELECT NUNOTA, NUMNOTA, TO_CHAR(DTNEG, 'YYYY-MM-DD'), VLRNOTA FROM TGFCAB
       WHERE CODPARC = '${codigo}' AND TIPMOV = 'V' AND DTNEG >= TRUNC(SYSDATE) - ${janela}
       ORDER BY DTNEG DESC, NUNOTA DESC
     ) WHERE ROWNUM <= 300`,
  );
  return linhas.map((l) => ({ nunota: l[0] ?? "", numero: l[1] ?? "", data: l[2] || null, valor_total: num(l[3]) }));
}

/** Itens de uma nota de venda, validando que ela pertence ao cliente. */
export async function listarItensNota(codigoCliente: string, nunota: string): Promise<Array<LinhaNota & { unidade: string }>> {
  const cred = lerCredenciais();
  if (!cred) throw new Error("Integração com o Sankhya não configurada.");
  const codigo = escapar(codigoCliente.trim());
  const sessao = await autenticar(cred);
  const linhas = await consultar(
    cred,
    sessao,
    `SELECT P.DESCRPROD, I.CODPROD,
       SUM(CASE WHEN VOA.DM = 'D' AND VOA.FATOR > 0 THEN I.QTDNEG * VOA.FATOR WHEN VOA.DM = 'M' AND VOA.FATOR > 0 THEN I.QTDNEG / VOA.FATOR ELSE I.QTDNEG END) AS QTD,
       SUM(I.VLRTOT) AS TOTAL, I.CODVOL
     FROM TGFITE I JOIN TGFPRO P ON P.CODPROD = I.CODPROD
     JOIN TGFCAB C ON C.NUNOTA = I.NUNOTA
     LEFT JOIN (SELECT CODPROD, CODVOL, MAX(DIVIDEMULTIPLICA) DM, MAX(QUANTIDADE) FATOR FROM TGFVOA GROUP BY CODPROD, CODVOL) VOA ON VOA.CODPROD = I.CODPROD AND VOA.CODVOL = I.CODVOL
     WHERE I.NUNOTA = ${num(nunota)} AND C.CODPARC = '${codigo}' AND C.TIPMOV = 'V'
     GROUP BY P.DESCRPROD, I.CODPROD, I.CODVOL
     ORDER BY P.DESCRPROD`,
  );
  return linhas.map((i) => ({
    produto: i[0] ?? "",
    codigo: i[1] ?? null,
    quantidade: num(i[2]),
    valor_unitario: num(i[3]),
    valor_total: num(i[4]),
    unidade: i[5] ?? "",
  }));
}

export type LojaParceiro = { codparc: string; nome: string; endereco: string; numero: string; cidade: string; uf: string };

/** Lojas (parceiros ativos) vinculadas a um parceiro matriz. */
export async function listarLojasMatriz(codMatriz: string): Promise<{ matriz: string | null; lojas: LojaParceiro[] }> {
  const cred = lerCredenciais();
  if (!cred) throw new Error("Integração com o Sankhya não configurada.");
  const cod = Math.trunc(num(codMatriz));
  if (!cod) throw new Error("Código do parceiro matriz inválido.");
  const sessao = await autenticar(cred);
  const matriz = await consultar(cred, sessao, `SELECT NOMEPARC FROM TGFPAR WHERE CODPARC = ${cod}`);
  const linhas = await consultar(
    cred,
    sessao,
    `SELECT PAR.CODPARC, PAR.NOMEPARC, EN.NOMEEND, PAR.NUMEND, CID.NOMECID, UF.UF
     FROM TGFPAR PAR
     LEFT JOIN TSIEND EN ON PAR.CODEND = EN.CODEND
     LEFT JOIN TSICID CID ON PAR.CODCID = CID.CODCID
     LEFT JOIN TSIUFS UF ON CID.UF = UF.CODUF
     WHERE PAR.CODPARCMATRIZ = ${cod} AND PAR.ATIVO = 'S'
     ORDER BY PAR.NOMEPARC`,
  );
  return {
    matriz: matriz[0]?.[0] ?? null,
    lojas: linhas.map((l) => ({ codparc: l[0] ?? "", nome: (l[1] ?? "").trim(), endereco: l[2] ?? "", numero: l[3] ?? "", cidade: l[4] ?? "", uf: l[5] ?? "" })),
  };
}
