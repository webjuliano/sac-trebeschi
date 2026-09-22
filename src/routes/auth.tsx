import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { Leaf, Loader2, LockKeyhole } from "lucide-react";
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
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(false);
  const envioEmAndamento = useRef(false);

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (envioEmAndamento.current) return;
    envioEmAndamento.current = true;
    setCarregando(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim().toLowerCase();
    const password = String(form.get("senha"));
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      envioEmAndamento.current = false;
      setCarregando(false);
      toast.error("E-mail ou senha inválidos.");
      return;
    }

    await navigate({ to: "/dashboard", replace: true });
  }

  return <main className="grid min-h-screen lg:grid-cols-[42%_58%]">
    <section className="hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-md bg-primary-foreground text-primary"><Leaf /></span><strong className="text-xl">Trebeschi</strong></div><div><p className="text-sm font-semibold uppercase tracking-widest text-primary-foreground/65">Central de devoluções</p><h1 className="mt-4 text-4xl font-bold leading-tight">Cada solicitação,<br />do início ao encerramento.</h1><p className="mt-5 max-w-md text-primary-foreground/70">Fila compartilhada, evidências, decisões e histórico em um único lugar.</p></div><p className="text-xs text-primary-foreground/55">Acesso restrito à equipe autorizada.</p></section>
    <section className="flex items-center justify-center bg-background p-6"><div className="w-full max-w-sm"><LockKeyhole className="size-8 text-primary" /><h1 className="mt-6 text-3xl font-bold">Acesso ao portal</h1><p className="mt-2 text-sm text-muted-foreground">Entre com seu e-mail corporativo.</p><form onSubmit={entrar} className="mt-8 space-y-5"><div><Label htmlFor="email" className="mb-2 block">E-mail</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div><div><Label htmlFor="senha" className="mb-2 block">Senha</Label><Input id="senha" name="senha" type="password" minLength={6} required autoComplete="current-password" /></div><Button type="submit" size="lg" className="w-full" disabled={carregando}>{carregando && <Loader2 className="animate-spin" />} Entrar</Button></form></div></section>
  </main>;
}