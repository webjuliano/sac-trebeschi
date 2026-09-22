import { Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, Leaf, Loader2, LogOut, Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { obterMeuAcesso } from "@/lib/admin.functions";

export function PortalHeader({ interno = false }: { interno?: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const consultarAcesso = useServerFn(obterMeuAcesso);
  const [isAdmin, setIsAdmin] = useState(false);
  const [senhaAberta, setSenhaAberta] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  useEffect(() => {
    if (!interno) return;
    consultarAcesso().then((acesso) => setIsAdmin(acesso.isAdmin)).catch(() => setIsAdmin(false));
  }, [consultarAcesso, interno]);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  async function alterarSenha(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const novaSenha = String(form.get("novaSenha"));
    const confirmacao = String(form.get("confirmacao"));
    if (novaSenha !== confirmacao) { toast.error("As senhas não coincidem."); return; }
    setSalvandoSenha(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setSalvandoSenha(false);
    if (error) { toast.error("Não foi possível alterar a senha."); return; }
    setSenhaAberta(false);
    toast.success("Senha alterada com sucesso.");
  }

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to={interno ? "/dashboard" : "/"} className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Leaf className="size-5" />
          </span>
          <span>
            <strong className="block text-base leading-none">Trebeschi</strong>
            <span className="text-xs text-muted-foreground">Portal de atendimento</span>
          </span>
        </Link>
        {interno ? (
          <div className="flex items-center gap-1">
            {isAdmin && <Button asChild variant="ghost" size="sm"><Link to="/admin"><Settings /> Administração</Link></Button>}
            <Dialog open={senhaAberta} onOpenChange={setSenhaAberta}>
              <DialogTrigger asChild><Button variant="ghost" size="sm"><KeyRound /> Alterar senha</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Alterar senha</DialogTitle><DialogDescription>Defina uma nova senha para o seu acesso.</DialogDescription></DialogHeader>
                <form onSubmit={alterarSenha} className="space-y-4">
                  <div><Label htmlFor="nova-senha" className="mb-2 block">Nova senha</Label><Input id="nova-senha" name="novaSenha" type="password" minLength={8} required autoComplete="new-password" /></div>
                  <div><Label htmlFor="confirmar-senha" className="mb-2 block">Confirmar nova senha</Label><Input id="confirmar-senha" name="confirmacao" type="password" minLength={8} required autoComplete="new-password" /></div>
                  <DialogFooter><Button type="submit" disabled={salvandoSenha}>{salvandoSenha && <Loader2 className="animate-spin" />} Salvar nova senha</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={sair}><LogOut /> Sair</Button>
          </div>
        ) : (
          <Button asChild variant="outline" size="sm"><Link to="/auth">Acesso da equipe</Link></Button>
        )}
      </div>
    </header>
  );
}