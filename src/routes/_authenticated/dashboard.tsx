import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, Inbox, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { PortalShell } from "@/components/portal-shell";
import { Button } from "@/components/ui/button";
import { listarProtocolos } from "@/lib/protocolos.functions";
import { STATUS_CLASSE, STATUS_LABEL, dataHora, moeda } from "@/lib/protocolo-ui";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Visão geral | Trebeschi" },
    { name: "description", content: "Painel com as solicitações de devolução abertas, pendentes e fechadas." },
    { property: "og:title", content: "Visão geral | Trebeschi" },
    { property: "og:description", content: "Painel com as solicitações de devolução abertas, pendentes e fechadas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Dashboard,
});

const ABERTOS = ["aberto", "em_analise"];
const PENDENTES = ["aguardando_cliente", "aguardando_nf", "nf_anexada", "coletado"];
const FECHADOS = ["aceito_total", "aceito_parcial", "recusado", "encerrado"];

type Filtro = "todos" | "abertos" | "pendentes" | "fechados";

function Dashboard() {
  const listar = useServerFn(listarProtocolos);
  const [protocolos, setProtocolos] = useState<Awaited<ReturnType<typeof listarProtocolos>>>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  useEffect(() => {
    setCarregando(true);
    listar({ data: { status: "todos", busca: "" } })
      .then(setProtocolos)
      .catch(() => toast.error("Não foi possível carregar o painel."))
      .finally(() => setCarregando(false));
  }, [listar]);

  const resumo = useMemo(() => ({
    abertos: protocolos.filter((p) => ABERTOS.includes(p.status)).length,
    pendentes: protocolos.filter((p) => PENDENTES.includes(p.status)).length,
    fechados: protocolos.filter((p) => FECHADOS.includes(p.status)).length,
    valor: protocolos.filter((p) => !FECHADOS.includes(p.status)).reduce((s, p) => s + Number(p.valor_total), 0),
  }), [protocolos]);

  const lista = useMemo(() => {
    const grupos: Record<Filtro, string[] | null> = { todos: null, abertos: ABERTOS, pendentes: PENDENTES, fechados: FECHADOS };
    const grupo = grupos[filtro];
    return (grupo ? protocolos.filter((p) => grupo.includes(p.status)) : protocolos).slice(0, 12);
  }, [protocolos, filtro]);

  return (
    <PortalShell>
      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Painel</p>
            <h1 className="mt-1 text-3xl font-bold">Visão geral</h1>
            <p className="mt-2 text-sm text-muted-foreground">Acompanhe as solicitações em aberto, pendentes e já fechadas.</p>
          </div>
          <Button asChild><Link to="/nova-solicitacao">Nova solicitação</Link></Button>
        </div>

        <div className="mt-8 grid gap-px border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Cartao ativo={filtro === "abertos"} onClick={() => setFiltro(filtro === "abertos" ? "todos" : "abertos")} icone={<Inbox />} rotulo="Abertas" valor={resumo.abertos} />
          <Cartao ativo={filtro === "pendentes"} onClick={() => setFiltro(filtro === "pendentes" ? "todos" : "pendentes")} icone={<Clock3 />} rotulo="Pendentes" valor={resumo.pendentes} />
          <Cartao ativo={filtro === "fechados"} onClick={() => setFiltro(filtro === "fechados" ? "todos" : "fechados")} icone={<CheckCircle2 />} rotulo="Fechadas" valor={resumo.fechados} />
          <Cartao icone={<TrendingUp />} rotulo="Valor em andamento" valor={moeda(resumo.valor)} />
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {filtro === "todos" ? "Solicitações recentes" : filtro === "abertos" ? "Solicitações abertas" : filtro === "pendentes" ? "Solicitações pendentes" : "Solicitações fechadas"}
          </h2>
          <Button asChild variant="ghost" size="sm"><Link to="/solicitacoes">Ver todas <ArrowRight /></Link></Button>
        </div>

        <div className="mt-3 overflow-hidden border bg-card">
          {carregando ? (
            <p className="p-10 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : lista.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">Nenhuma solicitação nesta situação.</p>
          ) : lista.map((p) => (
            <Link key={p.id} to="/protocolos/$id" params={{ id: p.id }} className="grid gap-2 border-b px-4 py-4 transition-colors last:border-0 hover:bg-accent/40 lg:grid-cols-[145px_1.3fr_1fr_140px_120px_40px] lg:items-center lg:gap-4">
              <strong className="text-sm text-primary">{p.numero}</strong>
              <span className="text-sm font-medium">{p.loja_nome}</span>
              <span className="truncate text-sm text-muted-foreground">{p.motivo}</span>
              <span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_CLASSE[p.status] ?? "bg-muted"}`}>{STATUS_LABEL[p.status] ?? p.status}</span></span>
              <span className="text-xs text-muted-foreground">{dataHora(p.created_at)}</span>
              <ArrowRight className="hidden size-4 text-muted-foreground lg:block" />
            </Link>
          ))}
        </div>
      </main>
    </PortalShell>
  );
}

function Cartao({ icone, rotulo, valor, onClick, ativo }: { icone: React.ReactNode; rotulo: string; valor: React.ReactNode; onClick?: () => void; ativo?: boolean }) {
  const conteudo = (
    <>
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm">{rotulo}</span>
        <span className="[&_svg]:size-4">{icone}</span>
      </div>
      <strong className="mt-3 block text-2xl">{valor}</strong>
    </>
  );
  if (!onClick) return <div className="bg-card p-5">{conteudo}</div>;
  return (
    <button type="button" onClick={onClick} className={`p-5 text-left transition-colors ${ativo ? "bg-primary/10" : "bg-card hover:bg-accent/40"}`}>
      {conteudo}
    </button>
  );
}
