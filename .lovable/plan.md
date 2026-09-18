# Portal de Devoluções Trebeschi — Plano do Piloto

## O que vamos construir

Um portal único onde cada devolução vira um **protocolo** com histórico completo, substituindo a troca de e-mails, WhatsApp e planilhas. O e-mail continua sendo enviado automaticamente ao cliente em cada etapa (obrigatório), mas o portal passa a ser a fonte da verdade.

Volume previsto: ~70 solicitações por dia.

## Fluxo do protocolo

```text
Loja abre solicitação (formulário + fotos)
   -> Fila da Trebeschi (triagem)
   -> Análise com dados do Sankhya ao lado (margem, % devolução do cliente)
   -> Decisão: aceito total / parcial / recusado  -> e-mail automático ao cliente
   -> Loja anexa NF de devolução
   -> Operador confirma coleta / canhoto
   -> Encerrado (tudo registrado com data, autor e anexos)
```

## Etapas de entrega

**Etapa 1 — Base e abertura de protocolo**
- Formulário público por loja: dados da venda, motivo, itens, quantidade, fotos.
- Geração de número de protocolo e e-mail de confirmação para o cliente.

**Etapa 2 — Painel interno (fila)**
- Lista com filtros por status, loja, data, motivo e responsável.
- Tela do protocolo com todos os dados, fotos, histórico e campo de parecer.
- Decisão com motivo padronizado e e-mail automático ao cliente.

**Etapa 3 — Dados do Sankhya na tela de análise**
- Integração com o usuário de integração já existente para trazer margem do cliente, histórico de compras e percentual de devoluções.
- Cache local dos indicadores para não depender do ERP em tempo real a cada abertura.

**Etapa 4 — Fechamento e indicadores**
- Anexo de NF de devolução pela loja e confirmação de coleta/canhoto.
- Painel gerencial: devoluções por loja, motivo, valor, tempo médio de resposta.

## Fotos e armazenamento

- Compressão automática no envio (redimensionamento e recompressão) antes de gravar, mantendo leitura do defeito.
- Limite de fotos por protocolo e por item.
- Rotina agendada de expurgo: fotos com mais de X meses são apagadas automaticamente, mantendo o restante do protocolo intacto. O prazo X fica configurável.
- Monitoramento do espaço usado, para ajustar o prazo se o crescimento acelerar.

## Notificações

- E-mail obrigatório ao cliente em: abertura, decisão, pedido de informação adicional e encerramento.
- Notificação interna no portal para a equipe Trebeschi (sem depender de WhatsApp).

## Pontos técnicos

- Banco de dados e armazenamento de arquivos na infraestrutura da Lovable, com controle de acesso por perfil (loja vê só os próprios protocolos; equipe Trebeschi vê tudo).
- Integração Sankhya via serviço no servidor, com as credenciais guardadas como segredo.
- Rotina agendada diária para o expurgo de fotos.
- E-mails transacionais com domínio próprio.

## Em aberto

- Assinatura eletrônica do canhoto: a confirmar com o Assaí. Por enquanto o portal registra o canhoto como anexo/imagem e quem confirmou.
- Prazo exato de retenção das fotos (sugestão inicial: 12 meses).

## Próximo passo

Começar pela Etapa 1 (formulário + protocolo + e-mail) e Etapa 2 (painel da fila), que já tiram o processo do e-mail e do WhatsApp.
