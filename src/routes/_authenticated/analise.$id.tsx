import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Package, ReceiptText, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { PortalShell } from "@/components/portal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { corrigirDadosVenda, obterAnaliseComercial, registrarSnapshotAnalise } from "@/lib/analise.functions";
import { obterProtocolo, registrarDecisao } from "@/lib/protocolos.functions";
import { STATUS_CLASSE, STATUS_LABEL, STATUS_OPCOES, data as formatarData, dataHora, moeda } from "@/lib/protocolo-ui";

export const Route = createFileRoute("/_authenticated/analise/$id")({
  head: () => ({ meta: [
    { title: "Análise da solicitação | Trebeschi" },
    { name: "description", content: "Nota de venda, vendas, devoluções e margem do cliente para embasar o parecer." },
    { property: "og:title", content: "Análise da solicitação | Trebeschi" },
    { property: "og:description", content: "Nota de venda, vendas, devoluções e margem do cliente para embasar o parecer." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AnaliseDetalhePage,
});

const pct = (valor: number | null) =>
  valor == null ? "—" : `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function AnaliseDetalhePage() {
  const { id } = Route.useParams();
  const obter = useServerFn(obterProtocolo);
  const obterComercial = useServerFn(obterAnaliseComercial);
  const decidir = useServerFn(registrarDecisao);
  const gravarSnapshot = useServerFn(registrarSnapshotAnalise);

  const [dados, setDados] = useState<Awaited<ReturnType<typeof obterProtocolo>> | null>(null);
  const [comercial, setComercial] = useState<Awaited<ReturnType<typeof obterAnaliseComercial>> | null>(null);
  const [carregandoComercial, setCarregandoComercial] = useState(true);
  const [status, setStatus] = useState("aceito_parcial");
  const [parecer, setParecer] = useState("");
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [salvando, setSalvando] = useState(false);
  const [notaEdit, setNotaEdit] = useState("");
  const [dataCompraEdit, setDataCompraEdit] = useState("");
  const [corrigindo, setCorrigindo] = useState(false);

  async function carregar() {
    try {
      const retorno = await obter({ data: { id } });
      setDados(retorno);
      setStatus(retorno.protocolo.status === "aberto" ? "aceito_parcial" : retorno.protocolo.status);
      setParecer(retorno.protocolo.parecer ?? "");
      setNotaEdit(retorno.protocolo.nota_fiscal ?? "");
      setDataCompraEdit(retorno.protocolo.data_compra ?? "");
      setQuantidades(Object.fromEntries(retorno.itens.map((item) => [item.id, Number(item.quantidade_aceita ?? item.quantidade)])));
    } catch {
      toast.error("Não foi possível carregar esta solicitação.");
    }
  }

  async function carregarComercial() {
    setCarregandoComercial(true);
    try {
      setComercial(await obterComercial({ data: { protocolo_id: id } }));
    } catch {
      setComercial(null);
    } finally {
      setCarregandoComercial(false);
    }
  }

  useEffect(() => { void carregar(); }, [id]);

  useEffect(() => { void carregarComercial(); }, [id]);

  async function corrigirVenda(event: FormEvent) {
    event.preventDefault();
    setCorrigindo(true);
    try {
      await corrigir({ data: {
        protocolo_id: id,
        nota_fiscal: notaEdit.trim() || null,
        data_compra: dataCompraEdit || null,
      } });
      toast.success("Dados da venda corrigidos.");
      await carregar();
      await carregarComercial();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível corrigir os dados da venda.");
    } finally {
      setCorrigindo(false);
    }
  }


  const valorAceito = useMemo(
    () => dados?.itens.reduce((soma, item) => soma + (quantidades[item.id] ?? 0) * Number(item.valor_unitario), 0) ?? 0,
    [dados, quantidades],
  );

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setSalvando(true);
    try {
      await decidir({ data: {
        id,
        status: status as "aceito_parcial",
        parecer: parecer || null,
        quantidades: Object.entries(quantidades).map(([item_id, quantidade_aceita]) => ({ item_id, quantidade_aceita })),
      } });

      if (comercial?.analise.configurado) {
        const resumo = comercial.analise.periodos
          .map((p) => `${p.rotulo}: vendas ${moeda(p.vendas)}, devoluções ${moeda(p.devolucoes)} (${pct(p.percentual_devolucao)}), margem ${pct(p.margem_percentual)}`)
          .join(" | ");
        await gravarSnapshot({ data: { protocolo_id: id, resumo: `Análise comercial no momento do parecer — ${resumo}` } });
      }

      toast.success("Parecer registrado e notificação preparada para o cliente.");
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o parecer.");
    } finally {
      setSalvando(false);
    }
  }

  if (!dados) {
    return <PortalShell><p className="p-16 text-center text-sm text-muted-foreground">Carregando solicitação…</p></PortalShell>;
  }

  const p = dados.protocolo;
  const limite = comercial?.limite_percentual ?? 2;

  return (
    <PortalShell>
      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <Link to="/analise" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Voltar para a análise
        </Link>

        <div className="mt-5 flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row sm:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">{p.numero}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSE[p.status] ?? "bg-muted"}`}>{STATUS_LABEL[p.status] ?? p.status}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {p.loja_nome} · nota de venda {p.nota_fiscal || "não informada"} · recebido em {dataHora(p.created_at)}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs uppercase text-muted-foreground">Valor solicitado</p>
            <strong className="text-2xl">{moeda(p.valor_total)}</strong>
          </div>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-8">
            <section>
              <Titulo icon={<Package />} texto="Itens solicitados pela loja" />
              <div className="mt-4 overflow-x-auto border bg-card">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="p-3">Produto</th><th className="p-3">Lote</th><th className="p-3">Solicitado</th><th className="p-3">Valor unit.</th><th className="p-3">Quantidade aceita</th></tr>
                  </thead>
                  <tbody>
                    {dados.itens.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="p-3"><strong>{item.descricao}</strong><span className="block text-xs text-muted-foreground">{item.codigo_produto || "Sem código"} · {item.motivo || p.motivo}</span></td>
                        <td className="p-3">{item.lote || "—"}</td>
                        <td className="p-3">{item.quantidade} {item.unidade}</td>
                        <td className="p-3">{moeda(item.valor_unitario)}</td>
                        <td className="p-3">
                          <Input aria-label={`Quantidade aceita de ${item.descricao}`} type="number" min="0" max={item.quantidade} step="0.01" className="w-28"
                            value={quantidades[item.id] ?? 0}
                            onChange={(e) => setQuantidades({ ...quantidades, [item.id]: Number(e.target.value) })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end border-t bg-muted/30 p-4 text-sm">
                  <span className="mr-4 text-muted-foreground">Valor aceito</span><strong>{moeda(valorAceito)}</strong>
                </div>
              </div>
            </section>

            <section>
              <Titulo icon={<ReceiptText />} texto="Ocorrência e evidências" />
              <div className="mt-4 border-l-2 border-primary bg-card p-5">
                <strong>{p.motivo}</strong>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{p.descricao || "Sem descrição adicional."}</p>
                <p className="mt-3 text-xs text-muted-foreground">Data da compra: {formatarData(p.data_compra)}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                {dados.fotos.map((foto, index) => foto.url ? (
                  <a key={foto.id} href={foto.url} target="_blank" rel="noreferrer" className="group overflow-hidden border bg-card">
                    <img src={foto.url} alt={`Evidência ${index + 1}`} className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.02]" />
                  </a>
                ) : (
                  <div key={foto.id} className="flex aspect-[4/3] items-center justify-center border bg-muted text-xs text-muted-foreground">Imagem expurgada</div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <section className="border bg-card">
              <div className="flex items-center gap-3 border-b bg-secondary p-5">
                <TrendingUp className="size-5 text-primary" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Sankhya</p>
                  <h2 className="text-lg font-bold">Análise do cliente</h2>
                </div>
              </div>

              {carregandoComercial && <p className="p-5 text-sm text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" /> Consultando o Sankhya…</p>}

              {!carregandoComercial && (!comercial || !comercial.analise.configurado) && (
                <div className="flex gap-3 p-5 text-sm">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
                  <div>
                    <strong className="block">Dados comerciais indisponíveis</strong>
                    <p className="mt-1 text-muted-foreground">
                      {comercial && !comercial.analise.configurado ? comercial.analise.motivo : "Não foi possível consultar o Sankhya agora."}
                    </p>
                    <p className="mt-2 text-muted-foreground">Você pode seguir com a análise manual e registrar o parecer normalmente.</p>
                  </div>
                </div>
              )}

              {!carregandoComercial && comercial?.analise.configurado && (
                <div className="space-y-5 p-5 text-sm">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Cliente no Sankhya</p>
                    <strong className="block">{comercial.analise.cliente_nome || "Cliente"}</strong>
                    <span className="text-xs text-muted-foreground">Código {comercial.analise.codigo_cliente}</span>
                  </div>

                  <div className="border">
                    <p className="border-b bg-muted/50 p-3 text-xs font-semibold uppercase text-muted-foreground">Nota de venda</p>
                    {comercial.analise.nota ? (
                      <div className="divide-y">
                        <div className="flex items-center justify-between p-3">
                          <span>{comercial.analise.nota.numero} · {formatarData(comercial.analise.nota.data_emissao)}</span>
                          <strong>{moeda(comercial.analise.nota.valor_total)}</strong>
                        </div>
                        {comercial.analise.nota.itens.map((item, index) => (
                          <div key={`${item.codigo}-${index}`} className="flex items-center justify-between gap-3 p-3 text-xs">
                            <span className="min-w-0 truncate">{item.produto}</span>
                            <span className="shrink-0 text-muted-foreground">{item.quantidade} × {moeda(item.valor_unitario)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="p-3 text-xs text-muted-foreground">Nota de venda não localizada no Sankhya para este cliente.</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    {comercial.analise.periodos.map((periodo) => {
                      const acima = periodo.percentual_devolucao > limite;
                      return (
                        <div key={periodo.rotulo} className="border p-3">
                          <div className="flex items-center justify-between">
                            <strong className="text-sm">{periodo.rotulo}</strong>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${acima ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                              {pct(periodo.percentual_devolucao)} devolução
                            </span>
                          </div>
                          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                            <div><dt className="text-muted-foreground">Vendas</dt><dd className="font-semibold">{moeda(periodo.vendas)}</dd></div>
                            <div><dt className="text-muted-foreground">Devoluções</dt><dd className="font-semibold">{moeda(periodo.devolucoes)}</dd></div>
                            <div><dt className="text-muted-foreground">Margem</dt><dd className="font-semibold">{pct(periodo.margem_percentual)}</dd></div>
                          </dl>
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground">Limite considerado aceitável: {limite}% de devolução. Consulta de {dataHora(comercial.analise.consultado_em)}.</p>
                  </div>
                </div>
              )}
            </section>

            <form onSubmit={salvar} className="border bg-card shadow-sm">
              <div className="border-b bg-primary p-5 text-primary-foreground">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/65">Após a análise</p>
                <h2 className="mt-1 text-xl font-bold">Registrar parecer</h2>
              </div>
              <div className="space-y-5 p-5">
                <div>
                  <Label className="mb-2 block">Situação</Label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {STATUS_OPCOES.filter((s) => s !== "aberto").map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="mb-2 block">Parecer para o cliente</Label>
                  <Textarea rows={7} value={parecer} onChange={(e) => setParecer(e.target.value)} placeholder="Explique a decisão, as quantidades aceitas e os próximos passos." />
                </div>
                <div className="border-l-2 border-primary bg-primary/5 p-3 text-xs text-muted-foreground">
                  <strong className="block text-foreground">Registro no histórico</strong>
                  Os números consultados no Sankhya ficam gravados junto ao parecer.
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={salvando}>
                  {salvando ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Salvar parecer
                </Button>
              </div>
            </form>
          </aside>
        </div>
      </main>
    </PortalShell>
  );
}

function Titulo({ icon, texto }: { icon: React.ReactNode; texto: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-8 items-center justify-center rounded-md bg-secondary text-primary [&_svg]:size-4">{icon}</span>
      <h2 className="text-lg font-bold">{texto}</h2>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
