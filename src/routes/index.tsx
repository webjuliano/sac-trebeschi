import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/dashboard" : "/auth" });
  },
  head: () => ({ meta: [
    { title: "Portal de devoluções | Trebeschi" },
    { name: "description", content: "Acesse o portal de solicitações de devolução Trebeschi." },
    { property: "og:title", content: "Portal de devoluções | Trebeschi" },
    { property: "og:description", content: "Acesse o portal de solicitações de devolução Trebeschi." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => null,
});
