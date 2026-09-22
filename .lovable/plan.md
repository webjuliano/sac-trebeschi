# Análise comercial da solicitação (com dados do Sankhya)

## O que será criado

**1. Novo item "Análise" no menu lateral**
- Lista das solicitações que estão em análise (aberto / em análise), com número, loja, cliente, nota de venda e valor.
- Ao selecionar uma solicitação, abre a tela de análise dividida em duas colunas:
  - **Esquerda:** dados informados pela loja (nota de venda, produtos, quantidades, motivo, fotos).
  - **Direita:** painel comercial do cliente, vindo do Sankhya.
- Visível apenas para admin e analista.

**2. Painel comercial do cliente (dados do Sankhya)**
- Dados da nota de venda informada: número, data, valor total, itens com preço unitário.
- Total de vendas do cliente no período (mês atual, últimos 3 e 12 meses).
- Total de devoluções no mesmo período, em valor e em % sobre as vendas.
- Margem de lucro do cliente no período.
- Semáforo simples: percentual de devolução dentro ou acima do aceitável (limite configurável, sugestão inicial 2%).

**3. Código do cliente no cadastro de loja**
- Novo campo obrigatório "Código do cliente no Sankhya" no cadastro de loja (Administração), usado como chave para buscar os dados.
- Lojas já cadastradas podem ser editadas para preencher esse código.

**4. Registro do parecer após a análise**
- Na própria tela de Análise, depois de ver os números, o analista informa as quantidades aceitas por item, a situação (aceito total, parcial, recusado) e o parecer.
- Um resumo dos números consultados (vendas, devoluções, %, margem) fica gravado no histórico da solicitação, para auditoria — mesmo que os números mudem depois.

**5. Modo de funcionamento sem as credenciais ainda**
- A integração é construída com uma camada única de acesso ao Sankhya. Enquanto as credenciais não estiverem cadastradas, o painel mostra um aviso claro ("dados comerciais indisponíveis — integração não configurada") e a análise continua possível manualmente.
- Assim que as credenciais forem cadastradas, os dados aparecem sem nenhuma outra alteração.

## O que preciso de você para buscar os dados no Sankhya

1. **Endereço do serviço** — a URL do Sankhya acessível pela internet (ex.: `https://sankhya.suaempresa.com.br:8180`). Se hoje só funciona dentro da rede da empresa, precisamos de liberação externa ou de um acesso intermediário.
2. **Usuário e senha da integração** — o usuário que você já tem. Ficam guardados como segredo, nunca no código.
3. **Como o Sankhya expõe os dados** — uma destas opções:
   - Serviços padrão do Sankhya (`/mge/service.sbr`, `DbExplorerSP.executeQuery`) — nesse caso preciso saber se esse serviço está liberado para o usuário de integração; ou
   - Consultas/relatórios já prontos que a equipe usa hoje (nome da consulta ou do relatório); ou
   - Acesso somente leitura ao banco de dados.
4. **Onde ficam os números** — quais tabelas/campos representam: nota de venda, vendas do cliente por período, devoluções e margem/custo. Se você me enviar um exemplo real (uma nota e os números que a analista olha hoje), eu monto as consultas a partir disso.
5. **Código do cliente** — o código de cada loja no Sankhya (`CODPARC` ou o código que vocês usam), para preencher no cadastro de loja.

Com os itens 1, 2 e 3 já consigo ligar a busca; o item 4 define quais números aparecem no painel.

## Detalhes técnicos

- Nova coluna `codigo_sankhya` em `lojas` (texto, única quando preenchida) + ajuste no formulário e na edição de lojas.
- `src/lib/sankhya.server.ts`: cliente com login/logout por sessão, leitura das credenciais via `process.env` dentro do handler, timeout e tratamento de erro; retorna DTOs simples.
- `src/lib/analise.functions.ts`: server functions com `requireSupabaseAuth` + verificação `is_equipe` — `listarParaAnalise`, `obterAnaliseComercial(protocoloId)`, `registrarParecerComAnalise`.
- Cache curto dos indicadores comerciais em tabela `sankhya_cache` (chave = código do cliente + período, TTL configurável) para suportar o volume diário sem sobrecarregar o ERP.
- Nova rota `src/routes/_authenticated/analise.tsx` (lista) e `analise.$id.tsx` (tela de análise), reaproveitando `PortalShell` e os componentes já existentes de itens/fotos/histórico.
- Snapshot da análise gravado em `protocolo_eventos` (tipo `analise_comercial`).
- Limite de % de devolução aceitável em `configuracoes`.
