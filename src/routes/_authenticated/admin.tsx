import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Ban, Building2, Loader2, Plus, RotateCcw, ShieldCheck, Store, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { PortalHeader } from "@/components/portal-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  atualizarCodigoSankhya,
  atualizarVinculosUsuario,
  criarLoja,
  criarUsuario,
  definirStatusUsuario,
  excluirUsuario,
  listarAdministracao,
} from "@/lib/admin.functions";


export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Administração | Trebeschi" },
    { name: "description", content: "Gestão de usuários, lojas e acessos do portal Trebeschi." },
    { property: "og:title", content: "Administração | Trebeschi" },
    { property: "og:description", content: "Gestão de usuários, lojas e acessos do portal Trebeschi." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AdminPage,
});

type DadosAdmin = Awaited<ReturnType<typeof listarAdministracao>>;

function AdminPage() {
  const navigate = useNavigate();
  const listar = useServerFn(listarAdministracao);
  const salvarLoja = useServerFn(criarLoja);
  const salvarCodigoSankhya = useServerFn(atualizarCodigoSankhya);

  const salvarUsuario = useServerFn(criarUsuario);
  const salvarVinculos = useServerFn(atualizarVinculosUsuario);
  const mudarStatus = useServerFn(definirStatusUsuario);
  const removerUsuario = useServerFn(excluirUsuario);
  const [dados, setDados] = useState<DadosAdmin | null>(null);
  const [aba, setAba] = useState<"usuarios" | "lojas">("usuarios");
  const [role, setRole] = useState<"admin" | "analista" | "loja">("loja");
  const [lojasSelecionadas, setLojasSelecionadas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    try {
      setDados(await listar());
    } catch {
      toast.error("Acesso permitido somente para administradores.");
      await navigate({ to: "/dashboard", replace: true });
    }
  }
  useEffect(() => { void carregar(); }, []);

  async function cadastrarLoja(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSalvando(true);
    try {
      await salvarLoja({ data: {
        nome: String(form.get("nome")), codigo: String(form.get("codigo")),
        codigo_sankhya: String(form.get("codigo_sankhya")),
        dias_vendas: Number(form.get("dias_vendas") || 30),
        rede: String(form.get("rede") || ""), cnpj: String(form.get("cnpj") || ""),
        email_contato: String(form.get("email_contato") || ""),
      } });

      formElement.reset();
      toast.success("Loja cadastrada.");
      await carregar();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar a loja."); }
    finally { setSalvando(false); }
  }

  async function cadastrarUsuario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSalvando(true);
    try {
      const resultado = await salvarUsuario({ data: {
        nome: String(form.get("nome")), email: String(form.get("email")), senha: String(form.get("senha")),
        role, loja_ids: role === "loja" ? lojasSelecionadas : [],
      } });
      if (!resultado.ok) {
        toast.error(resultado.mensagem);
        return;
      }
      formElement.reset(); setRole("loja"); setLojasSelecionadas([]);
      toast.success("Usuário criado e acesso configurado.");
      await carregar();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível criar o usuário."); }
    finally { setSalvando(false); }
  }

  if (!dados) return <div className="min-h-screen"><PortalHeader interno /><p className="p-16 text-center text-sm text-muted-foreground">Verificando acesso…</p></div>;
  return <div className="min-h-screen bg-background"><PortalHeader interno />
    <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between border-b pb-6"><div><p className="text-sm font-semibold uppercase tracking-widest text-primary">Configuração</p><h1 className="mt-1 text-3xl font-bold">Administração</h1><p className="mt-2 text-sm text-muted-foreground">Cadastre acessos e defina quais lojas cada usuário pode visualizar.</p></div><ShieldCheck className="hidden size-9 text-primary sm:block" /></div>
      <div className="mt-6 flex gap-1 border-b"><Button variant={aba === "usuarios" ? "default" : "ghost"} onClick={() => setAba("usuarios")}><Users /> Usuários</Button><Button variant={aba === "lojas" ? "default" : "ghost"} onClick={() => setAba("lojas")}><Store /> Lojas</Button></div>
      {aba === "lojas" ? <div className="mt-8 grid gap-8 lg:grid-cols-[420px_1fr]">
        <form onSubmit={cadastrarLoja} className="space-y-5 border bg-card p-6"><div><h2 className="text-xl font-bold">Nova loja</h2><p className="mt-1 text-sm text-muted-foreground">Inclua uma unidade para liberar nos acessos.</p></div><Campo label="Nome da loja"><Input name="nome" required /></Campo><div className="grid grid-cols-2 gap-4"><Campo label="Código"><Input name="codigo" required /></Campo><Campo label="Rede"><Input name="rede" /></Campo></div><div className="grid grid-cols-2 gap-4"><Campo label="Código do cliente no Sankhya"><Input name="codigo_sankhya" required placeholder="Ex.: 1042" /></Campo><Campo label="Qtd dias vendas"><Input name="dias_vendas" type="number" min={1} max={365} defaultValue={30} required /></Campo></div><Campo label="CNPJ"><Input name="cnpj" /></Campo><Campo label="E-mail de contato"><Input name="email_contato" type="email" /></Campo><Button className="w-full" type="submit" disabled={salvando}>{salvando ? <Loader2 className="animate-spin" /> : <Plus />} Cadastrar loja</Button></form>
        <section><h2 className="text-lg font-bold">Lojas cadastradas</h2><div className="mt-4 overflow-hidden border bg-card">{dados.lojas.map((loja) => <LinhaLoja key={loja.id} loja={loja} salvar={async (codigo_sankhya, dias_vendas) => { try { await salvarCodigoSankhya({ data: { loja_id: loja.id, codigo_sankhya, dias_vendas } }); toast.success("Loja atualizada."); await carregar(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."); } }} />)}</div></section>

      </div> : <div className="mt-8 grid gap-8 lg:grid-cols-[420px_1fr]">
        <form onSubmit={cadastrarUsuario} className="space-y-5 border bg-card p-6"><div><h2 className="text-xl font-bold">Novo usuário</h2><p className="mt-1 text-sm text-muted-foreground">Crie o acesso e escolha as lojas permitidas.</p></div><Campo label="Nome"><Input name="nome" required /></Campo><Campo label="E-mail"><Input name="email" type="email" required /></Campo><Campo label="Senha inicial"><Input name="senha" type="password" minLength={8} required /></Campo><Campo label="Perfil"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={role} onChange={(e) => { setRole(e.target.value as typeof role); setLojasSelecionadas([]); }}><option value="loja">Usuário de loja</option><option value="analista">Analista Trebeschi</option><option value="admin">Administrador</option></select></Campo>{role === "loja" && <SelecaoLojas lojas={dados.lojas} selecionadas={lojasSelecionadas} onChange={setLojasSelecionadas} />}<Button className="w-full" type="submit" disabled={salvando}>{salvando ? <Loader2 className="animate-spin" /> : <Plus />} Criar usuário</Button></form>
        <section><h2 className="text-lg font-bold">Usuários cadastrados</h2><div className="mt-4 space-y-3">{dados.usuarios.map((usuario) => <Usuario key={usuario.id} usuario={usuario} lojas={dados.lojas} salvar={async (loja_ids) => { try { await salvarVinculos({ data: { user_id: usuario.id, loja_ids } }); toast.success("Lojas atualizadas."); await carregar(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."); } }} alterarStatus={async (ativo) => { try { const r = await mudarStatus({ data: { user_id: usuario.id, ativo } }); if (!r.ok) { toast.error(r.mensagem); return; } toast.success(r.mensagem); await carregar(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível alterar o acesso."); } }} excluir={async () => { try { const r = await removerUsuario({ data: { user_id: usuario.id } }); if (!r.ok) { toast.error(r.mensagem); return; } toast.success(r.mensagem); await carregar(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir."); } }} />)}</div></section>
      </div>}
    </main></div>;
}

function LinhaLoja({ loja, salvar }: { loja: DadosAdmin["lojas"][number]; salvar: (codigo: string, dias: number) => Promise<void> }) {
  const [codigo, setCodigo] = useState(loja.codigo_sankhya ?? "");
  const [dias, setDias] = useState(String(loja.dias_vendas ?? 30));
  const alterado = codigo !== (loja.codigo_sankhya ?? "") || Number(dias) !== (loja.dias_vendas ?? 30);
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b p-4 last:border-0">
      <div className="min-w-[200px]">
        <strong className="text-sm">{loja.nome}</strong>
        <p className="mt-1 text-xs text-muted-foreground">{loja.rede || "Sem rede"} · {loja.codigo}</p>
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground" htmlFor={`sankhya-${loja.id}`}>Código Sankhya</Label>
        <Input id={`sankhya-${loja.id}`} className="w-28" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="—" />
        <Label className="text-xs text-muted-foreground" htmlFor={`dias-${loja.id}`}>Qtd dias vendas</Label>
        <Input id={`dias-${loja.id}`} className="w-20" type="number" min={1} max={365} value={dias} onChange={(e) => setDias(e.target.value)} />
        <Button variant="outline" size="sm" disabled={!alterado || Number(dias) < 1 || Number(dias) > 365} onClick={() => salvar(codigo.trim(), Math.round(Number(dias)))}>Salvar</Button>
      </div>
      <span className={loja.ativa ? "text-xs font-semibold text-primary" : "text-xs text-muted-foreground"}>{loja.ativa ? "Ativa" : "Inativa"}</span>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label className="mb-2 block">{label}</Label>{children}</div>; }
function SelecaoLojas({ lojas, selecionadas, onChange }: { lojas: DadosAdmin["lojas"]; selecionadas: string[]; onChange: (ids: string[]) => void }) { return <fieldset><legend className="mb-2 text-sm font-medium">Lojas permitidas</legend><div className="max-h-52 space-y-1 overflow-y-auto border p-2">{lojas.map((loja) => <label key={loja.id} className="flex cursor-pointer items-center gap-3 p-2 text-sm hover:bg-accent"><input type="checkbox" className="size-4 accent-primary" checked={selecionadas.includes(loja.id)} onChange={(e) => onChange(e.target.checked ? [...selecionadas, loja.id] : selecionadas.filter((id) => id !== loja.id))} /><span>{loja.rede ? `${loja.rede} — ` : ""}{loja.nome}</span></label>)}</div></fieldset>; }
function Usuario({ usuario, lojas, salvar, alterarStatus, excluir }: { usuario: DadosAdmin["usuarios"][number]; lojas: DadosAdmin["lojas"]; salvar: (ids: string[]) => Promise<void>; alterarStatus: (ativo: boolean) => Promise<void>; excluir: () => Promise<void> }) {
  const [ids, setIds] = useState(usuario.loja_ids);
  const [editando, setEditando] = useState(false);
  const vinculadas = lojas.filter((l) => usuario.loja_ids.includes(l.id));
  const perfil = usuario.roles.includes("admin") ? "Administrador" : usuario.roles.includes("analista") ? "Analista" : "Usuário de loja";
  const editavel = usuario.roles.includes("loja");
  const ativo = usuario.ativo !== false;
  return <div className="border bg-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><strong>{usuario.nome || "Sem nome"}</strong><p className="mt-1 text-sm text-muted-foreground">{usuario.email}</p></div>
      <div className="flex items-center gap-2">
        <span className={ativo ? "rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary" : "rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground"}>{ativo ? "Ativo" : "Inativo"}</span>
        <span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">{perfil}</span>
      </div>
    </div>
    {editavel && <div className="mt-4">
      <div className="flex items-center justify-between"><p className="text-sm font-medium">Lojas com acesso ({vinculadas.length})</p>{!editando && <Button variant="outline" size="sm" onClick={() => { setIds(usuario.loja_ids); setEditando(true); }}><Pencil /> Editar lojas</Button>}</div>
      {!editando && (vinculadas.length === 0 ? <p className="mt-2 text-sm text-destructive">Nenhuma loja vinculada — este usuário não vê nenhuma solicitação.</p> : <div className="mt-2 flex flex-wrap gap-2">{vinculadas.map((l) => <span key={l.id} className="rounded-md border bg-muted px-2 py-1 text-xs">{l.rede ? `${l.rede} — ` : ""}{l.nome} ({l.codigo})</span>)}</div>)}
      {editando && <div className="mt-3"><SelecaoLojas lojas={lojas} selecionadas={ids} onChange={setIds} /><div className="mt-3 flex gap-2"><Button size="sm" disabled={ids.length === 0} onClick={async () => { await salvar(ids); setEditando(false); }}>Salvar lojas</Button><Button variant="ghost" size="sm" onClick={() => { setIds(usuario.loja_ids); setEditando(false); }}>Cancelar</Button></div>{ids.length === 0 && <p className="mt-2 text-xs text-destructive">Selecione pelo menos uma loja.</p>}</div>}
    </div>}
    <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
      <Button variant="outline" size="sm" onClick={() => alterarStatus(!ativo)}>{ativo ? <><Ban /> Inativar acesso</> : <><RotateCcw /> Reativar acesso</>}</Button>
      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { if (window.confirm(`Excluir definitivamente ${usuario.email}? Só é possível se não houver nada vinculado.`)) void excluir(); }}><Trash2 /> Excluir</Button>
    </div>
  </div>;
}