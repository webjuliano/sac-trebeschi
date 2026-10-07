// Fernando Carvalho — Build Node e Supabase por ambiente para VPS.
// Criacao: 06/10/2026. Ultima alteracao: 06/10/2026.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
export default defineConfig({
  nitro: { preset: "node-server" },
  tanstackStart: { server: { entry: "server" } },
});
