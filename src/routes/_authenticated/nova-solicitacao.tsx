import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, ImagePlus, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PortalShell } from "@/components/portal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { comprimirImagem } from "@/lib/comprimir-imagem";
import { abrirProtocolo, listarItensNotaVenda, listarLojasPermitidas, listarNotasVendaLoja } from "@/lib/protocolos.functions";
import { data, moeda } from "@/lib/protocolo-ui";

export const Route = createFileRoute("/_authenticated/nova-solicitacao")({
  head: () => ({ meta: [
    { title: "Nova solicitação | Trebeschi" },
    { name: "description", content: "Abra e acompanhe solicitações de devolução de produtos Trebeschi." },
    { property: "og:title", content: "Solicitar devolução | Trebeschi" },
    { property: "og:description", content: "Abra e acompanhe solicitações de devolução de produtos Trebeschi." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: NovaSolicitacao,
});

type NotaResumo = { nunota: string; numero: string; data: string | null; valor_total: number };
type ItemNota = { produto: string; codigo: string | null; quantidade: number; valor_unitario: number; valor_total: number; unidade: string };
type Foto = { nome: string; base64: string; bytes: number };
type Selecao = { quantidade: number; motivo: string; fotos: Foto[] };

function NovaSolicitacao() {
  const listar = useServerFn(listarLojasPermitidas);
  const abrir = useServerFn(abrirProtocolo);
  const buscarNotas = useServerFn(listarNotasVendaLoja);
  const buscarItens = useServerFn(listarItensNotaVenda);
  const [lojas, setLojas] = useState<Array<{ id: string; nome: string; codigo: string; rede: string | null }>>([]);
  const [lojaId, setLojaId] = useState("");
  const [contato, setContato] = useState({ nome: "", email: "", telefone: "" });
  const [notas, setNotas] = useState<NotaResumo[]>([]);
  const [dias, setDias] = useState<number | null>(null);
  const [carregandoNotas, setCarregandoNotas] = useState(false);
  const [erroNotas, setErroNotas] = useState<string | null>(null);
  const [nota, setNota] = useState<NotaResumo | null>(null);
  const [itensNota, setItensNota] = useState<ItemNota[]>([]);
  const [carregandoItens, setCarregandoItens] = useState(false);
  const [selecao, setSelecao] = useState<Record<number, Selecao>>({});
  const [processando, setProcessando] = useState<number | null>(null);
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [numeroCriado, setNumeroCriado] = useState<string | null>(null);

  useEffect(() => { listar().then(setLojas).catch(() => toast.error("Não foi possível carregar as lojas.")); }, [listar]);

  useEffect(() => {
    setNotas([]); setNota(null); setItensNota([]); setSelecao({}); setErroNotas(null); setDias(null);
    if (!lojaId) return;
    setCarregandoNotas(true);
    buscarNotas({ data: { loja_id: lojaId } })
      .then((r) => { setNotas(r.notas); setDias(r.dias); })
      .catch((e) => setErroNotas(e instanceof Error ? e.message : "Não foi possível buscar as notas no Sankhya."))
      .finally(() => setCarregandoNotas(false));
  }, [lojaId, buscarNotas]);

  async function escolherNota(n: NotaResumo) {
    setNota(n); setItensNota([]); setSelecao({}); setCarregandoItens(true);
    try { setItensNota(await buscarItens({ data: { loja_id: lojaId, nunota: n.nunota } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível carregar os itens da nota."); }
    finally { setCarregandoItens(false); }
  }

  function alternarItem(index: number) {
    setSelecao((s) => { const n = { ...s }; if (n[index]) delete n[index]; else n[index] = { quantidade: 1, motivo: "", fotos: [] }; return n; });
  }
  function atualizar(index: number, campo: Partial<Selecao>) {
    setSelecao((s) => ({ ...s, [index]: { ...s[index], ...campo } }));
  }
  async function adicionarFotos(index: number, files: FileList | null) {
    if (!files) return;
    const atual = selecao[index]?.fotos ?? [];
    const restantes = 6 - atual.length;
    if (files.length > restantes) toast.warning("Até 6 fotos por item.");
    setProcessando(index);
    try {
      const novas = await Promise.all(Array.from(files).slice(0, restantes).map((f) => comprimirImagem(f)));
      atualizar(index, { fotos: [...atual, ...novas] });
    } catch { toast.error("Não foi possível processar uma das fotos."); }
    finally { setProcessando(null); }
  }

  const selecionados = Object.entries(selecao).map(([i, s]) => ({ item: itensNota[Number(i)], sel: s, index: Number(i) })).filter((x) => x.item);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nota) { toast.error("Selecione a nota de venda."); return; }
    if (selecionados.length === 0) { toast.error("Selecione ao menos um item da nota."); return; }
    for (const { item, sel } of selecionados) {
      if (!(sel.quantidade > 0) || sel.quantidade > item.quantidade) { toast.error(`Quantidade inválida para "${item.produto}" (máx. ${item.quantidade}).`); return; }
      if (sel.motivo.trim().length < 3) { toast.error(`Descreva a avaria de "${item.produto}".`); return; }
      if (sel.fotos.length === 0) { toast.error(`Anexe a foto da evidência de "${item.produto}".`); return; }
    }
    setEnviando(true);
    try {
      const retorno = await abrir({ data: {
        loja_id: lojaId, cliente_nome: contato.nome, cliente_email: contato.email, cliente_telefone: contato.telefone || null,
        nota_fiscal: nota.numero, pedido: null, data_compra: nota.data, motivo: null, descricao: descricao || null,
        itens: selecionados.map(({ item, sel }) => ({
          codigo_produto: item.codigo, descricao: item.produto.slice(0, 200), quantidade: sel.quantidade, unidade: item.unidade || null,
          valor_unitario: item.valor_unitario, lote: null, motivo: sel.motivo.trim(), fotos: sel.fotos.map(({ nome, base64 }) => ({ nome, base64 })),
        })),
        fotos: [],
      } });
      setNumeroCriado(retorno.numero);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível enviar a solicitação."); }
    finally { setEnviando(false); }
  }

  if (numeroCriado) return (
    <PortalShell>
      <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
        <CheckCircle2 className="size-16 text-primary" />
        <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-primary">Solicitação registrada</p>
        <h1 className="mt-2 text-4xl font-bold">Protocolo {numeroCriado}</h1>
        <p className="mt-4 max-w-lg text-muted-foreground">A confirmação foi registrada para envio ao seu e-mail. Guarde o número para acompanhar a análise.</p>
        <Button className="mt-8" onClick={() => { setNumeroCriado(null); setNota(null); setItensNota([]); setSelecao({}); setDescricao(""); }}>Nova solicitação</Button>
      </main>
    </PortalShell>
  );

  const contatoOk = contato.nome.trim().length >= 2 && /.+@.+\..+/.test(contato.email);

  return (
    <PortalShell>
      <section className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-foreground/70">Atendimento ao cliente</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold sm:text-4xl">Solicitação de devolução</h1>
          <p className="mt-3 max-w-2xl text-primary-foreground/75">Escolha a loja, informe o contato, selecione a nota de venda e os itens com problema.</p>
        </div>
      </section>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <form onSubmit={enviar} className="space-y-10">
          <FormSection numero="01" titulo="Loja">
            <select value={lojaId} onChange={(e) => setLojaId(e.target.value)} required className="h-10 w-full rounded-md border bg-card px-3 text-sm"><option value="">Selecione a loja</option>{lojas.map((loja) => <option key={loja.id} value={loja.id}>{loja.rede ? `${loja.rede} — ` : ""}{loja.nome} ({loja.codigo})</option>)}</select>
          </FormSection>
          {lojaId && <FormSection numero="02" titulo="Contato do solicitante">
            <div className="grid gap-5 sm:grid-cols-3">
              <Campo label="Nome do solicitante"><Input required minLength={2} value={contato.nome} onChange={(e) => setContato({ ...contato, nome: e.target.value })} /></Campo>
              <Campo label="E-mail para atualizações"><Input type="email" required value={contato.email} onChange={(e) => setContato({ ...contato, email: e.target.value })} /></Campo>
              <Campo label="Telefone"><Input type="tel" value={contato.telefone} onChange={(e) => setContato({ ...contato, telefone: e.target.value })} /></Campo>
            </div>
          </FormSection>}
          {lojaId && contatoOk && <FormSection numero="03" titulo="Nota de venda">
            {dias && <p className="mb-3 text-sm text-muted-foreground">Vendas dos últimos {dias} dias.</p>}
            {carregandoNotas ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Buscando notas no Sankhya…</p>
              : erroNotas ? <p className="text-sm text-destructive">{erroNotas}</p>
              : notas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma nota de venda encontrada no período.</p>
              : <div className="max-h-72 overflow-y-auto border bg-card">{notas.map((n) => (
                <button type="button" key={n.nunota} onClick={() => escolherNota(n)} className={`flex w-full items-center justify-between border-b px-4 py-3 text-left text-sm last:border-0 hover:bg-accent ${nota?.nunota === n.nunota ? "bg-primary/10 font-semibold" : ""}`}>
                  <span>NF {n.numero}</span><span className="text-muted-foreground">{n.data ? data(n.data) : "—"}</span><span>{moeda(n.valor_total)}</span>
                </button>))}</div>}
          </FormSection>}
          {nota && <FormSection numero="04" titulo={`Itens da NF ${nota.numero}`}>
            {carregandoItens ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando itens…</p> : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Marque os itens com problema. Para cada um, informe a quantidade, a avaria e a foto da evidência.</p>
                {itensNota.map((item, index) => { const sel = selecao[index]; return (
                  <div key={index} className={`border bg-card p-4 ${sel ? "border-l-2 border-l-primary shadow-sm" : ""}`}>
                    <label className="flex cursor-pointer items-center gap-3">
                      <input type="checkbox" className="size-4 accent-primary" checked={!!sel} onChange={() => alternarItem(index)} />
                      <span className="flex-1 text-sm"><strong>{item.produto}</strong> <span className="text-muted-foreground">({item.codigo})</span></span>
                      <span className="text-xs text-muted-foreground">{item.quantidade} {item.unidade} × {moeda(item.valor_unitario)}</span>
                    </label>
                    {sel && <div className="mt-4 grid gap-4 sm:grid-cols-6">
                      <Campo label={`Qtd. solicitada (máx. ${item.quantidade})`} className="sm:col-span-2"><Input type="number" min="0.01" step="0.01" max={item.quantidade} required value={sel.quantidade} onChange={(e) => atualizar(index, { quantidade: Number(e.target.value) })} /></Campo>
                      <Campo label="Avaria do item *" className="sm:col-span-4"><Input required minLength={3} value={sel.motivo} onChange={(e) => atualizar(index, { motivo: e.target.value })} placeholder="Descreva o problema deste produto" /></Campo>
                      <div className="sm:col-span-6">
                        <Label className="mb-2 block">Evidência do item *</Label>
                        <div className="flex flex-wrap gap-3">
                          {sel.fotos.map((foto, fi) => <div key={fi} className="relative"><img src={`data:image/jpeg;base64,${foto.base64}`} alt={`Evidência ${fi + 1}`} className="size-24 border object-cover" /><Button type="button" variant="destructive" size="icon" className="absolute right-1 top-1 size-6" aria-label="Excluir foto" onClick={() => atualizar(index, { fotos: sel.fotos.filter((_, i) => i !== fi) })}><Trash2 /></Button></div>)}
                          <label className="flex size-24 cursor-pointer flex-col items-center justify-center border border-dashed border-primary/50 bg-primary/5 text-center text-xs">
                            {processando === index ? <Loader2 className="size-5 animate-spin text-primary" /> : <ImagePlus className="size-5 text-primary" />}<span className="mt-1">Adicionar</span>
                            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void adicionarFotos(index, e.target.files); e.target.value = ""; }} />
                          </label>
                        </div>
                      </div>
                    </div>}
                  </div>); })}
                <Campo label="Observações gerais (opcional)"><Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Campo>
              </div>)}
          </FormSection>}
          <div className="flex items-center justify-end border-t pt-6"><Button type="submit" size="lg" disabled={enviando || processando !== null || selecionados.length === 0}>{enviando ? <Loader2 className="animate-spin" /> : <Send />} Enviar solicitação</Button></div>
        </form>
      </main>
    </PortalShell>
  );
}

function FormSection({ numero, titulo, children }: { numero: string; titulo: string; children: React.ReactNode }) {
  return <section><div className="mb-5 flex items-center gap-3"><span className="font-mono text-sm font-bold text-primary">{numero}</span><h2 className="text-xl font-bold">{titulo}</h2><span className="h-px flex-1 bg-border" /></div>{children}</section>;
}
function Campo({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={className}><Label className="mb-2 block">{label}</Label>{children}</div>;
}