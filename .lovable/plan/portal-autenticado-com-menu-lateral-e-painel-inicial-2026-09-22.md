# Portal autenticado com menu lateral e painel inicial

## Objetivo
Transformar o portal em uma área totalmente autenticada. Depois de entrar, o usuário verá um painel inicial com as solicitações das lojas vinculadas, em vez de abrir diretamente o formulário.

## Alterações
- Exigir login para acessar o portal; a página inicial encaminhará para o acesso ou para o painel conforme a sessão.
- Criar uma estrutura interna compartilhada com menu lateral para:
  - Visão geral
  - Solicitações
  - Nova solicitação
  - Administração, somente para administradores
  - Alterar senha e sair
- Mover o formulário atual para uma nova página protegida em **Nova solicitação**.
- Fazer o formulário listar somente as lojas vinculadas ao usuário; administradores e analistas poderão selecionar entre todas as lojas.
- Atualizar a página principal para mostrar:
  - totais de abertas, pendentes e fechadas;
  - lista das solicitações recentes;
  - filtros rápidos por situação;
  - acesso ao protocolo ao clicar em uma solicitação.
- Manter a página de solicitações como visão completa da fila, usando as mesmas permissões já existentes.
- Adaptar as páginas de análise e administração à nova navegação lateral, inclusive em telas pequenas.

## Segurança e comportamento
- Todas as leituras e aberturas de solicitação continuarão validadas no servidor.
- Usuários de loja verão e criarão solicitações apenas para suas lojas vinculadas.
- Administradores e analistas continuarão vendo a operação completa.
- Após entrar, o usuário será levado para o painel inicial.

## Validação
- Confirmar redirecionamento da entrada para login/painel.
- Conferir menu lateral em computador e celular.
- Testar abertura do painel para um protocolo específico.
- Confirmar que a nova solicitação respeita as lojas permitidas.
