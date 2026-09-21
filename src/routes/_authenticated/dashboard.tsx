import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Clock3, Inbox, Search, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { PortalHeader } from "@/components/portal-header";
import { Input } from "@/components/ui/input";
import { listarProtocolos } from "@/lib/protocolos.functions";
import { STATUS_CLASSE, STATUS_LABEL, STATUS_OPCOES, dataHora, moeda } from "@/lib/protocolo-ui";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Fila de atendimento | Trebeschi" }, { name: "description", content: "Fila interna de solicitações de devolução." },
    { property: "og:title", content: "Fila de atendimento | Trebeschi" }, { property: "og:description", content: "Fila interna de solicitações de devolução." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Dashboard,
});

function Dashboard() {
  const listar = useServerFn(listarProtocolos); const [protocolos, setProtocolos] = useState<Awaited<ReturnType<typeof listarProtocolos>>>([]); const [status, setStatus] = useState("todos"); const [busca, setBusca] = useState(""); const [carregando, setCarregando] = useState(true);
  useEffect(() => { const timer = setTimeout(() => { setCarregando(true); listar({ data: { status, busca } }).then(setProtocolos).catch(() => toast.error("Não foi possível carregar a fila.")).finally(() => setCarregando(false)); }, 250); return () => clearTimeout(timer); }, [listar, status, busca]);
  const resumo = useMemo(() => ({ abertos: protocolos.filter((p) => p.status === "aberto").length, analise: protocolos.filter((p) => p.status === "em_analise").length, aguardando: protocolos.filter((p) => p.status === "aguardando_cliente" || p.status === "aguardando_nf").length, valor: protocolos.reduce((s, p) => s + Number(p.valor_total), 0) }), [protocolos]);
  return <div className="min-h-screen"><PortalHeader interno /><main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-widest text-primary">Operação</p><h1 className="mt-1 text-3xl font-bold">Fila de atendimento</h1><p className="mt-2 text-sm text-muted-foreground">Solicitações recebidas e em andamento.</p></div><span className="text-sm text-muted-foreground">{protocolos.length} protocolos na visualização</span></div>
    <div className="mt-8 grid gap-px border bg-border sm:grid-cols-2 lg:grid-cols-4"><Metrica icone={<Inbox />} rotulo="Novos" valor={resumo.abertos} /><Metrica icone={<Clock3 />} rotulo="Em análise" valor={resumo.analise} /><Metrica icone={<TrendingUp />} rotulo="Aguardando" valor={resumo.aguardando} /><Metrica icone={<span className="text-sm font-bold">R$</span>} rotulo="Valor na fila" valor={moeda(resumo.valor)} /></div>
    <div className="mt-8 flex flex-col gap-3 border-y bg-card py-4 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar protocolo, loja ou solicitante" value={busca} onChange={(e) => setBusca(e.target.value)} /></div><select className="h-9 rounded-md border bg-background px-3 text-sm sm:w-52" value={status} onChange={(e) => setStatus(e.target.value)}><option value="todos">Todos os status</option>{STATUS_OPCOES.map((opcao) => <option key={opcao} value={opcao}>{STATUS_LABEL[opcao]}</option>)}</select></div>
    <div className="mt-5 overflow-hidden border bg-card"><div className="hidden grid-cols-[145px_1.2fr_1fr_1fr_130px_120px_40px] gap-4 border-b bg-muted/60 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground lg:grid"><span>Protocolo</span><span>Loja</span><span>Solicitante</span><span>Motivo</span><span>Status</span><span>Recebido</span><span /></div>{carregando ? <p className="p-10 text-center text-sm text-muted-foreground">Carregando fila…</p> : protocolos.length === 0 ? <p className="p-10 text-center text-sm text-muted-foreground">Nenhum protocolo encontrado.</p> : protocolos.map((p) => <Link key={p.id} to="/protocolos/$id" params={{ id: p.id }} className="grid gap-2 border-b px-4 py-4 transition-colors last:border-0 hover:bg-accent/40 lg:grid-cols-[145px_1.2fr_1fr_1fr_130px_120px_40px] lg:items-center lg:gap-4"><strong className="text-sm text-primary">{p.numero}</strong><span className="text-sm font-medium">{p.loja_nome}</span><span className="text-sm text-muted-foreground">{p.cliente_nome}</span><span className="truncate text-sm text-muted-foreground">{p.motivo}</span><span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_CLASSE[p.status] ?? "bg-muted"}`}>{STATUS_LABEL[p.status] ?? p.status}</span></span><span className="text-xs text-muted-foreground">{dataHora(p.created_at)}</span><ArrowRight className="hidden size-4 text-muted-foreground lg:block" /></Link>)}</div>
  </main></div>;
}
function Metrica({ icone, rotulo, valor }: { icone: React.ReactNode; rotulo: string; valor: React.ReactNode }) { return <div className="bg-card p-5"><div className="flex items-center justify-between text-muted-foreground"><span className="text-sm">{rotulo}</span><span className="[&_svg]:size-4">{icone}</span></div><strong className="mt-3 block text-2xl">{valor}</strong></div>; }