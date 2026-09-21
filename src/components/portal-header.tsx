import { Link, useNavigate } from "@tanstack/react-router";
import { Leaf, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function PortalHeader({ interno = false }: { interno?: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
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
            <span className="text-xs text-muted-foreground">Portal de devoluções</span>
          </span>
        </Link>
        {interno ? (
          <Button variant="ghost" size="sm" onClick={sair}><LogOut /> Sair</Button>
        ) : (
          <Button asChild variant="outline" size="sm"><Link to="/auth">Acesso da equipe</Link></Button>
        )}
      </div>
    </header>
  );
}