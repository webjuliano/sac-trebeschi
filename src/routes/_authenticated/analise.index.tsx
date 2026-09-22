import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { LineChart, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { PortalShell } from "@/components/portal-shell";
import { Input } from "@/components/ui/input";
import { listarParaAnalise } from "@/lib/analise.functions";
import { STATUS_CLASSE, STATUS_LABEL, dataHora, moeda } from "@/lib/protocolo-ui";

export const Route = createFileRoute("/_authenticated/analise/")({
  head: () => ({ meta: [
    { title: "Análise comercial | Trebeschi" },
    { name: "description", content: "Selecione uma solicitação para analisar vendas, devoluções e margem do cliente." },
    { property: "og:title", content: "Análise comercial | Trebeschi" },
    { property: "og:description", content: "Selecione uma solicitação para analisar vendas, devoluções e margem do cliente." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AnalisePage,
});

function AnalisePage() {
  const listar = useServerFn(listarParaAnalise);
  const [busca, setBusca] = useState("");
  const [linhas, setLinhas] = useState<Awaited<ReturnType<typeof listarParaAnalise>>>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    const timer = setTimeout(() => {
      listar({ data: { busca: busca || undefined } })
        .then((rows) => { if (ativo) setLinhas(rows); })
        .catch(() => toast.error("Não foi possível carregar a lista de análise."))
        .finally(() => { if (ativo) setCarregando(false); });
    }, 250);
    return () => { ativo = false; clearTimeout(timer); };
  }, [busca, listar]);

  return (
    <PortalShell>
      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Atendimento</p>
            <h1 className="mt-1 text-3xl font-bold">Análise</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Selecione a solicitação para ver a nota de venda e os indicadores comerciais do cliente antes do parecer.
            </p>
          </div>
          <LineChart className="hidden size-9 text-primary sm:block" />
        </div>

        <div className="relative mt-6 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por protocolo, loja ou nota de venda" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>

        <div className="mt-6 overflow-x-auto border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Protocolo</th>
                <th className="p-3">Loja</th>
                <th className="p-3">Nota de venda</th>
                <th className="p-3">Motivo</th>
                <th className="p-3">Situação</th>
                <th className="p-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr><td colSpan={6} className="p-10 text-center text-muted-foreground"><Loader2 className="mx-auto animate-spin" /></td></tr>
              )}
              {!carregando && linhas.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">Nenhuma solicitação aguardando análise.</td></tr>
              )}
              {!carregando && linhas.map((linha) => (
                <tr key={linha.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="p-3">
                    <Link to="/analise/$id" params={{ id: linha.id }} className="font-semibold text-primary hover:underline">{linha.numero}</Link>
                    <span className="block text-xs text-muted-foreground">{dataHora(linha.created_at)}</span>
                  </td>
                  <td className="p-3">{linha.loja_nome}<span className="block text-xs text-muted-foreground">{linha.loja_codigo || "—"}</span></td>
                  <td className="p-3">{linha.nota_fiscal || "Não informada"}</td>
                  <td className="p-3">{linha.motivo}</td>
                  <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSE[linha.status] ?? "bg-muted"}`}>{STATUS_LABEL[linha.status] ?? linha.status}</span></td>
                  <td className="p-3 text-right">{moeda(linha.valor_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </PortalShell>
  );
}
