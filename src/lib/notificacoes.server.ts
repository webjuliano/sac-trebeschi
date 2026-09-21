/**
 * Envio de e-mail ao cliente.
 *
 * Enquanto o domínio de envio não estiver configurado, cada notificação fica
 * registrada na tabela `notificacoes` com status "pendente" — nada é perdido.
 * Quando o domínio for configurado, este helper passa a enviar de verdade.
 */

export type NotificacaoInput = {
  para: string;
  assunto: string;
  titulo: string;
  linhas: string[];
  protocoloId?: string;
};

export async function notificarCliente(input: NotificacaoInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const corpo = [input.titulo, "", ...input.linhas.filter(Boolean)].join("\n");

  const { error } = await supabaseAdmin.from("notificacoes").insert({
    protocolo_id: input.protocoloId ?? null,
    destinatario: input.para,
    assunto: input.assunto,
    corpo,
    canal: "email",
    status: "pendente",
  });

  if (error) {
    console.error("Falha ao registrar notificação:", error.message);
    return { registrada: false };
  }

  return { registrada: true };
}
