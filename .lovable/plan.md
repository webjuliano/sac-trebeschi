# Gestão de usuários e lojas

## Objetivo
Criar uma área exclusiva do administrador para cadastrar lojas, criar usuários e vincular cada usuário a uma ou várias lojas. Usuários do tipo loja verão apenas os protocolos das lojas às quais possuem acesso; a equipe Trebeschi continuará vendo a fila completa.

## O que será construído
- Nova tela **Administração** com duas áreas:
  - **Lojas:** cadastrar e listar lojas com nome, código, rede, CNPJ, e-mail e situação.
  - **Usuários:** criar acesso com nome, e-mail, senha inicial e perfil; selecionar uma ou várias lojas quando o perfil for “Loja”.
- Acesso à Administração somente para administradores.
- Link de Administração no cabeçalho apenas para administradores.
- Exibição da fila conforme o perfil:
  - administrador e analista: todos os protocolos;
  - usuário de loja: somente protocolos das lojas vinculadas.
- Usuário com várias lojas poderá acompanhar todas elas na mesma lista.

## Segurança e dados
- Criar uma tabela de vínculo entre usuário e loja, permitindo vários vínculos por usuário e vários usuários por loja.
- Aplicar regras no banco para impedir leitura de protocolos, itens, fotos e histórico fora das lojas vinculadas.
- Manter os perfis de acesso separados dos dados do usuário.
- Criação de conta e atribuição de perfil serão validadas no servidor; dados enviados pela tela não poderão conceder acesso administrativo indevido.
- A senha inicial será definida pelo administrador na criação e deverá ter no mínimo 8 caracteres.

## Validação
- Testar cadastro de loja e de usuário administrador.
- Testar usuário vinculado a uma loja e confirmar que não enxerga protocolos de outra.
- Testar usuário vinculado a duas lojas e confirmar que enxerga ambas.
- Confirmar que um usuário comum não acessa a tela administrativa nem consegue alterar vínculos.
