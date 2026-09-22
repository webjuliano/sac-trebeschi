import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Portal de atendimento | Trebeschi" },
    { name: "description", content: "Acesse o portal de solicitações de devolução Trebeschi." },
    { property: "og:title", content: "Portal de atendimento | Trebeschi" },
    { property: "og:description", content: "Acesse o portal de solicitações de devolução Trebeschi." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: EntryRedirect,
});

function EntryRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => navigate({ to: data.user ? "/dashboard" : "/auth", replace: true }));
  }, [navigate]);
  return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Abrindo o portal…</main>;
}
