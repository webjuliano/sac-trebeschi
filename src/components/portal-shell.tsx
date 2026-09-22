import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  LineChart,

  Leaf,
  Loader2,
  LogOut,
  Menu,
  PlusCircle,
  Settings,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { obterMeuAcesso } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

const links = [
  { to: "/dashboard" as const, label: "Visão geral", icon: LayoutDashboard },
  { to: "/solicitacoes" as const, label: "Solicitações", icon: ClipboardList },
  { to: "/nova-solicitacao" as const, label: "Nova solicitação", icon: PlusCircle },
];

export function PortalShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const consultarAcesso = useServerFn(obterMeuAcesso);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEquipe, setIsEquipe] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [senhaAberta, setSenhaAberta] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  useEffect(() => {
    consultarAcesso()
      .then((acesso) => {
        setIsAdmin(acesso.isAdmin);
        setIsEquipe(acesso.roles.includes("admin") || acesso.roles.includes("analista"));
      })
      .catch(() => { setIsAdmin(false); setIsEquipe(false); });
  }, [consultarAcesso]);


  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  async function alterarSenha(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const senhaAtual = String(form.get("senhaAtual"));
    const novaSenha = String(form.get("novaSenha"));
    const confirmacao = String(form.get("confirmacao"));
    if (novaSenha !== confirmacao) {
      toast.error("As novas senhas não coincidem.");
      return;
    }
    setSalvandoSenha(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha, current_password: senhaAtual });
    setSalvandoSenha(false);
    if (error) {
      toast.error("Não foi possível alterar a senha. Confira a senha atual.");
      return;
    }
    setSenhaAberta(false);
    toast.success("Senha alterada com sucesso.");
  }

  const navigation = <Navigation isAdmin={isAdmin} isEquipe={isEquipe} onNavigate={() => setMenuAberto(false)} onPassword={() => setSenhaAberta(true)} onLogout={sair} />;

  return (
    <div className="min-h-screen bg-muted/25 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r bg-card lg:flex lg:flex-col">
        {navigation}
      </aside>
      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:hidden">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><Leaf className="size-4" /></span>
            Trebeschi
          </Link>
          <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
            <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Abrir menu"><Menu /></Button></SheetTrigger>
            <SheetContent side="left" className="w-[288px] p-0"><SheetTitle className="sr-only">Menu principal</SheetTitle>{navigation}</SheetContent>
          </Sheet>
        </header>
        {children}
      </div>
      <Dialog open={senhaAberta} onOpenChange={setSenhaAberta}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar senha</DialogTitle><DialogDescription>Confirme sua senha atual e defina a nova senha.</DialogDescription></DialogHeader>
          <form onSubmit={alterarSenha} className="space-y-4">
            <div><Label htmlFor="senha-atual" className="mb-2 block">Senha atual</Label><Input id="senha-atual" name="senhaAtual" type="password" required autoComplete="current-password" /></div>
            <div><Label htmlFor="nova-senha" className="mb-2 block">Nova senha</Label><Input id="nova-senha" name="novaSenha" type="password" minLength={8} required autoComplete="new-password" /></div>
            <div><Label htmlFor="confirmar-senha" className="mb-2 block">Confirmar nova senha</Label><Input id="confirmar-senha" name="confirmacao" type="password" minLength={8} required autoComplete="new-password" /></div>
            <DialogFooter><Button type="submit" disabled={salvandoSenha}>{salvandoSenha && <Loader2 className="animate-spin" />} Salvar senha</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Navigation({ isAdmin, isEquipe, onNavigate, onPassword, onLogout }: { isAdmin: boolean; isEquipe: boolean; onNavigate: () => void; onPassword: () => void; onLogout: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Link to="/dashboard" onClick={onNavigate} className="flex h-20 items-center gap-3 border-b px-5">
        <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground"><Leaf className="size-5" /></span>
        <span><strong className="block leading-none">Trebeschi</strong><span className="mt-1 block text-xs text-muted-foreground">Portal de atendimento</span></span>
      </Link>
      <nav className="flex-1 space-y-1 p-3">
        <p className="px-3 pb-2 pt-3 text-xs font-semibold uppercase text-muted-foreground">Menu</p>
        {links.map(({ to, label, icon: Icon }) => <Link key={to} to={to} onClick={onNavigate} activeOptions={{ exact: true }} className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" activeProps={{ className: "bg-primary/10 text-primary" }}><Icon className="size-4" />{label}</Link>)}
        {isEquipe && <Link to="/analise" onClick={onNavigate} className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" activeProps={{ className: "bg-primary/10 text-primary" }}><LineChart className="size-4" />Análise</Link>}
        {isAdmin && <Link to="/admin" onClick={onNavigate} className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" activeProps={{ className: "bg-primary/10 text-primary" }}><Settings className="size-4" />Administração</Link>}
      </nav>

      <div className="space-y-1 border-t p-3">
        <Button variant="ghost" className={cn("w-full justify-start text-muted-foreground")} onClick={onPassword}><KeyRound /> Alterar senha</Button>
        <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={onLogout}><LogOut /> Sair</Button>
      </div>
    </div>
  );
}