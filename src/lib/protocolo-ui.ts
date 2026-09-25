export const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  em_analise: "Em análise",
  aguardando_cliente: "Aguardando cliente",
  aceito_total: "Aceito integral",
  aceito_parcial: "Aceito parcial",
  recusado: "Recusado",
  aguardando_nf: "Aguardando NF",
  coletado: "Coletado",
  encerrado: "Encerrado",
};

export const STATUS_CLASSE: Record<string, string> = {
  aberto: "bg-primary/10 text-primary",
  em_analise: "bg-chart-5/20 text-chart-1",
  aguardando_cliente: "bg-chart-5/20 text-chart-1",
  aceito_total: "bg-chart-2/20 text-chart-3",
  aceito_parcial: "bg-chart-2/20 text-chart-3",
  recusado: "bg-destructive/15 text-destructive",
  aguardando_nf: "bg-muted text-muted-foreground",
  coletado: "bg-chart-2/20 text-chart-3",
  encerrado: "bg-muted text-muted-foreground",
};

export const STATUS_OPCOES = Object.keys(STATUS_LABEL);

export function moeda(valor: number | string | null | undefined) {
  const numero = typeof valor === "string" ? Number(valor) : (valor ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(numero) ? numero : 0,
  );
}

export function dataHora(valor: string | null | undefined) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(valor),
  );
}

export function data(valor: string | null | undefined) {
  if (!valor) return "—";
  // Datas puras (YYYY-MM-DD) não devem sofrer conversão de fuso horário
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(valor));
}
