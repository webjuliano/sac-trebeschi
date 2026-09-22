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
  appkey: string;
  usuario: string;
  senha: string;
};

function lerCredenciais(): Credenciais | null {
  const token = process.env["SANKHYA_TOKEN"];
  const appkey = process.env["SANKHYA_APPKEY"];
  const usuario = process.env["SANKHYA_USUARIO"];
  const senha = process.env["SANKHYA_SENHA"];
  const url = process.env["SANKHYA_URL"] || "https://api.sankhya.com.br";
  if (!token || !appkey || !usuario || !senha) return null;
  return { url: url.replace(/\/+$/, ""), token, appkey, usuario, senha };
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

/** Autentica no gateway Sankhya Om e devolve o bearer token da sessão. */
async function autenticar(cred: Credenciais): Promise<string> {
  return comTempoLimite(async (signal) => {
    const resposta = await fetch(`${cred.url}/login`, {
      method: "POST",
      headers: {
        token: cred.token,
        appkey: cred.appkey,
        username: cred.usuario,
        password: cred.senha,
      },
      signal,
    });
    const texto = await resposta.text();
    if (!resposta.ok) {
      throw new Error(`Sankhya recusou a autenticação (${resposta.status}).`);
    }
    let json: { bearerToken?: string; error?: { descricao?: string } };
    try {
      json = JSON.parse(texto) as typeof json;
    } catch {
      throw new Error("Resposta inesperada do Sankhya na autenticação.");
    }
    if (!json.bearerToken) {
      throw new Error(json.error?.descricao || "Não foi possível autenticar no Sankhya.");
    }
    return json.bearerToken;
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
      `SELECT NUNOTA, NUMNOTA, DTNEG, VLRNOTA FROM TGFCAB
       WHERE CODPARC = '${codigo}' AND NUMNOTA = '${numeroNota}' AND TIPMOV = 'V'`,
    );
    const linha = cabecalho[0];
    if (linha) {
      const itens = await consultar(
        cred,
        sessao,
        `SELECT P.DESCRPROD, I.CODPROD, I.QTDNEG, I.VLRUNIT, I.VLRTOT
         FROM TGFITE I JOIN TGFPRO P ON P.CODPROD = I.CODPROD
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
      `SELECT SUM(I.VLRTOT), SUM(NVL(I.CUSMED, 0) * I.QTDNEG) FROM TGFITE I
       JOIN TGFCAB C ON C.NUNOTA = I.NUNOTA
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
