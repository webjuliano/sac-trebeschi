import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Leaf, Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Acesso da equipe | Trebeschi" },
    { name: "description", content: "Acesso restrito à equipe de devoluções Trebeschi." },
    { property: "og:title", content: "Acesso da equipe | Trebeschi" },
    { property: "og:description", content: "Acesso restrito à equipe de devoluções Trebeschi." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }), component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate(); const [carregando, setCarregando] = useState(false); const [cadastro, setCadastro] = useState(false); const [confirmacao, setConfirmacao] = useState(false);
  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setCarregando(true);
    const email = String(form.get("email")); const password = String(form.get("senha"));
    if (cadastro) {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/auth" } });
      setCarregando(false); if (error) { toast.error(error.message); return; }
      if (!data.session) { setConfirmacao(true); return; }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setCarregando(false); if (error) { toast.error("E-mail ou senha inválidos."); return; }
    }
    await navigate({ to: "/dashboard" });
  }
  return <main className="grid min-h-screen lg:grid-cols-[42%_58%]">
    <section className="hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-md bg-primary-foreground text-primary"><Leaf /></span><strong className="text-xl">Trebeschi</strong></div><div><p className="text-sm font-semibold uppercase tracking-widest text-primary-foreground/65">Central de devoluções</p><h1 className="mt-4 text-4xl font-bold leading-tight">Cada solicitação,<br />do início ao encerramento.</h1><p className="mt-5 max-w-md text-primary-foreground/70">Fila compartilhada, evidências, decisões e histórico em um único lugar.</p></div><p className="text-xs text-primary-foreground/55">Acesso restrito à equipe autorizada.</p></section>
    <section className="flex items-center justify-center bg-background p-6"><div className="w-full max-w-sm"><Button variant="ghost" className="mb-12 px-0" onClick={() => navigate({ to: "/" })}><ArrowLeft /> Voltar ao formulário</Button><LockKeyhole className="size-8 text-primary" />{confirmacao ? <><h2 className="mt-6 text-3xl font-bold">Confira seu e-mail</h2><p className="mt-3 text-sm text-muted-foreground">Enviamos um link para confirmar o cadastro. Depois da confirmação, volte aqui para entrar.</p><Button variant="outline" className="mt-8 w-full" onClick={() => { setConfirmacao(false); setCadastro(false); }}>Voltar para entrar</Button></> : <><h2 className="mt-6 text-3xl font-bold">{cadastro ? "Criar acesso" : "Acesso da equipe"}</h2><p className="mt-2 text-sm text-muted-foreground">{cadastro ? "O primeiro cadastro recebe acesso administrativo." : "Entre com seu e-mail corporativo."}</p><form onSubmit={entrar} className="mt-8 space-y-5"><div><Label className="mb-2 block">E-mail</Label><Input name="email" type="email" required autoComplete="email" /></div><div><Label className="mb-2 block">Senha</Label><Input name="senha" type="password" minLength={6} required autoComplete={cadastro ? "new-password" : "current-password"} /></div><Button type="submit" size="lg" className="w-full" disabled={carregando}>{carregando && <Loader2 className="animate-spin" />} {cadastro ? "Criar acesso" : "Entrar"}</Button></form><Button variant="link" className="mt-4 w-full" onClick={() => setCadastro((valor) => !valor)}>{cadastro ? "Já tenho acesso" : "Criar primeiro acesso"}</Button></>}</div></section>
  </main>;
}