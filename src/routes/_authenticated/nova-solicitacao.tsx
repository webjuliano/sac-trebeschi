import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, ImagePlus, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PortalShell } from "@/components/portal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { comprimirImagem } from "@/lib/comprimir-imagem";
import { abrirProtocolo, listarLojasPermitidas } from "@/lib/protocolos.functions";

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

type ItemForm = { codigo_produto: string; descricao: string; quantidade: number; unidade: string; valor_unitario: number; lote: string; motivo: string };
const itemVazio = (): ItemForm => ({ codigo_produto: "", descricao: "", quantidade: 1, unidade: "kg", valor_unitario: 0, lote: "", motivo: "" });

function NovaSolicitacao() {
  const listar = useServerFn(listarLojasPermitidas);
  const abrir = useServerFn(abrirProtocolo);
  const [lojas, setLojas] = useState<Array<{ id: string; nome: string; codigo: string; rede: string | null }>>([]);
  const [itens, setItens] = useState<ItemForm[]>([itemVazio()]);
  const [fotos, setFotos] = useState<Array<{ nome: string; base64: string; bytes: number }>>([]);
  const [enviando, setEnviando] = useState(false);
  const [processandoFotos, setProcessandoFotos] = useState(false);
  const [numeroCriado, setNumeroCriado] = useState<string | null>(null);

  useEffect(() => { listar().then(setLojas).catch(() => toast.error("Não foi possível carregar as lojas.")); }, [listar]);

  function atualizarItem(index: number, campo: keyof ItemForm, valor: string | number) {
    setItens((atuais) => atuais.map((item, i) => i === index ? { ...item, [campo]: valor } : item));
  }

  async function selecionarFotos(files: FileList | null) {
    if (!files) return;
    const restantes = 12 - fotos.length;
    if (files.length > restantes) toast.warning("Você pode anexar até 12 fotos.");
    setProcessandoFotos(true);
    try {
      const novas = await Promise.all(Array.from(files).slice(0, restantes).map((file) => comprimirImagem(file)));
      setFotos((atuais) => [...atuais, ...novas]);
    } catch { toast.error("Não foi possível processar uma das fotos."); }
    finally { setProcessandoFotos(false); }
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (fotos.length < 2) { toast.error("Anexe pelo menos duas fotos das evidências."); return; }
    setEnviando(true);
    try {
      const retorno = await abrir({ data: {
        loja_id: String(form.get("loja_id")), cliente_nome: String(form.get("cliente_nome")),
        cliente_email: String(form.get("cliente_email")), cliente_telefone: String(form.get("cliente_telefone")) || null,
        nota_fiscal: String(form.get("nota_fiscal")) || null, pedido: String(form.get("pedido")) || null,
        data_compra: String(form.get("data_compra")) || null, motivo: String(form.get("motivo")),
        descricao: String(form.get("descricao")) || null, itens, fotos: fotos.map(({ nome, base64 }) => ({ nome, base64 })),
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
        <Button className="mt-8" onClick={() => { setNumeroCriado(null); setItens([itemVazio()]); setFotos([]); }}>Nova solicitação</Button>
      </main>
    </PortalShell>
  );

  return (
    <PortalShell>
      <section className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-foreground/70">Atendimento ao cliente</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold sm:text-4xl">Solicitação de devolução</h1>
          <p className="mt-3 max-w-2xl text-primary-foreground/75">Informe os produtos, quantidades e evidências. Você receberá as atualizações pelo e-mail cadastrado.</p>
        </div>
      </section>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <form onSubmit={enviar} className="space-y-10">
          <FormSection numero="01" titulo="Loja e contato">
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo label="Loja" className="sm:col-span-2"><select name="loja_id" required className="h-10 w-full rounded-md border bg-card px-3 text-sm"><option value="">Selecione a loja</option>{lojas.map((loja) => <option key={loja.id} value={loja.id}>{loja.rede ? `${loja.rede} — ` : ""}{loja.nome} ({loja.codigo})</option>)}</select></Campo>
              <Campo label="Nome do solicitante"><Input name="cliente_nome" required minLength={2} /></Campo>
              <Campo label="E-mail para atualizações"><Input name="cliente_email" type="email" required /></Campo>
              <Campo label="Telefone"><Input name="cliente_telefone" type="tel" /></Campo>
              <Campo label="Data da compra"><Input name="data_compra" type="date" /></Campo>
            </div>
          </FormSection>
          <FormSection numero="02" titulo="Documento e motivo">
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo label="Nota fiscal de recebimento"><Input name="nota_fiscal" /></Campo>
              <Campo label="Pedido"><Input name="pedido" /></Campo>
              <Campo label="Motivo principal" className="sm:col-span-2"><Input name="motivo" required placeholder="Ex.: avaria, qualidade ou validade" /></Campo>
              <Campo label="Descrição da ocorrência" className="sm:col-span-2"><Textarea name="descricao" rows={4} placeholder="Descreva o que aconteceu e como os produtos foram recebidos." /></Campo>
            </div>
          </FormSection>
          <FormSection numero="03" titulo="Produtos">
            <div className="space-y-5">{itens.map((item, index) => (
              <div key={index} className="border-l-2 border-primary bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between"><strong className="text-sm">Item {index + 1}</strong>{itens.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label="Remover item" title="Remover item" onClick={() => setItens((atuais) => atuais.filter((_, i) => i !== index))}><Trash2 /></Button>}</div>
                <div className="grid gap-4 sm:grid-cols-6">
                  <Campo label="Código" className="sm:col-span-2"><Input value={item.codigo_produto} onChange={(e) => atualizarItem(index, "codigo_produto", e.target.value)} /></Campo>
                  <Campo label="Produto" className="sm:col-span-4"><Input required value={item.descricao} onChange={(e) => atualizarItem(index, "descricao", e.target.value)} /></Campo>
                  <Campo label="Quantidade" className="sm:col-span-2"><Input type="number" min="0.01" step="0.01" required value={item.quantidade} onChange={(e) => atualizarItem(index, "quantidade", Number(e.target.value))} /></Campo>
                  <Campo label="Unidade"><Input value={item.unidade} onChange={(e) => atualizarItem(index, "unidade", e.target.value)} /></Campo>
                  <Campo label="Valor unitário" className="sm:col-span-2"><Input type="number" min="0" step="0.01" value={item.valor_unitario} onChange={(e) => atualizarItem(index, "valor_unitario", Number(e.target.value))} /></Campo>
                  <Campo label="Lote"><Input value={item.lote} onChange={(e) => atualizarItem(index, "lote", e.target.value)} /></Campo>
                  <Campo label="Avaria do item" className="sm:col-span-6"><Input value={item.motivo} onChange={(e) => atualizarItem(index, "motivo", e.target.value)} placeholder="Descreva a avaria deste produto" /></Campo>
                </div>
              </div>
            ))}</div>
            <Button type="button" variant="outline" className="mt-4" onClick={() => setItens((atuais) => [...atuais, itemVazio()])}><Plus /> Adicionar produto</Button>
          </FormSection>
          <FormSection numero="04" titulo="Evidências fotográficas">
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center border border-dashed border-primary/50 bg-primary/5 p-6 text-center">
              {processandoFotos ? <Loader2 className="size-7 animate-spin text-primary" /> : <ImagePlus className="size-7 text-primary" />}
              <span className="mt-3 text-sm font-semibold">Adicionar fotos</span><span className="mt-1 text-xs text-muted-foreground">Mínimo 2, máximo 12. As imagens serão reduzidas automaticamente.</span>
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => selecionarFotos(e.target.files)} />
            </label>
            {fotos.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{fotos.map((foto, index) => <div key={`${foto.nome}-${index}`} className="relative border bg-card p-2"><img src={`data:image/jpeg;base64,${foto.base64}`} alt={`Evidência ${index + 1}`} className="aspect-square w-full object-cover" /><Button type="button" variant="destructive" size="icon" className="absolute right-3 top-3 size-7" aria-label="Excluir foto" onClick={() => setFotos((atuais) => atuais.filter((_, i) => i !== index))}><Trash2 /></Button><p className="mt-2 truncate text-xs text-muted-foreground">{Math.round(foto.bytes / 1024)} KB</p></div>)}</div>}
          </FormSection>
          <div className="flex items-center justify-end border-t pt-6"><Button type="submit" size="lg" disabled={enviando || processandoFotos}>{enviando ? <Loader2 className="animate-spin" /> : <Send />} Enviar solicitação</Button></div>
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