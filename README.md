# Gestor IPTV — Clientes e Mensalidades

Sistema simples para gerenciar clientes e pagamentos de assinaturas de IPTV.
Roda 100% no navegador (HTML + CSS + JS puro), sem servidor e sem necessidade
de internet depois de aberto. Os dados ficam salvos no seu próprio computador,
dentro do navegador (localStorage).

## Como usar offline no seu computador

1. Baixe/extraia os 3 arquivos: `index.html`, `style.css`, `app.js` (deixe-os
   sempre na mesma pasta).
2. Dê dois cliques em `index.html`. Ele abre no seu navegador (Chrome, Edge,
   Firefox) e já funciona, sem instalar nada.
3. Tudo o que você cadastrar (clientes, planos, pagamentos, templates) fica
   salvo automaticamente nesse navegador, nesse computador.

⚠️ **Importante sobre os dados:** como tudo fica salvo no navegador, se você
limpar o cache/dados do site ou trocar de computador, os dados não vão junto.
Por isso existe o botão **💾 (backup)** no topo da tela: use-o regularmente
para exportar um arquivo `.json` com tudo, e guarde esse arquivo em local
seguro. O mesmo botão permite importar esse backup de volta (em outro
computador, por exemplo).

## Como publicar gratuitamente no GitHub Pages

1. Crie uma conta gratuita em [github.com](https://github.com), se ainda não tiver.
2. Crie um repositório novo (por exemplo `gestor-iptv`), público.
3. Envie os arquivos `index.html`, `style.css` e `app.js` para esse
   repositório (pelo site do GitHub: "Add file" → "Upload files").
4. Vá em **Settings → Pages** do repositório.
5. Em "Build and deployment", selecione **Deploy from a branch**, branch
   `main`, pasta `/ (root)`, e clique em **Save**.
6. Em alguns minutos, o GitHub mostrará o link do seu site, algo como:
   `https://SEU-USUARIO.github.io/gestor-iptv/`
7. Pronto — esse link funciona em qualquer dispositivo com internet, de graça,
   para sempre.

⚠️ Como o GitHub Pages é público, qualquer pessoa com o link consegue abrir a
página — mas os dados de cada pessoa ficam separados, pois cada navegador
guarda os seus próprios dados localmente. Se você quiser acessar os **mesmos**
dados em vários dispositivos (celular + computador, por exemplo), use o botão
de backup para exportar no computador e importar no celular (ou vice-versa).

## Sincronizar dados com o GitHub (além do navegador)

Além de salvar no navegador, o sistema pode salvar automaticamente uma cópia
de tudo (`data.json`) em um repositório seu no GitHub. Assim, se você abrir o
site em outro computador ou celular já conectado ao mesmo repositório, os
dados são carregados de lá.

**Passo a passo:**

1. Crie um repositório **privado** no GitHub só para os dados, por exemplo
   `gestor-iptv-dados` (pode ser diferente do repositório do site).
2. Crie um token de acesso pessoal: **GitHub → foto do perfil → Settings →
   Developer settings → Personal access tokens → Fine-grained tokens → Generate
   new token**. Dê acesso apenas a esse repositório, com permissão
   **"Contents: Read and write"**.
3. No site, clique no ícone ☁️ no topo da tela.
4. Preencha: usuário/organização do GitHub, nome do repositório, branch
   (geralmente `main`), nome do arquivo (`data.json` já vem preenchido) e cole
   o token gerado.
5. Clique em **"Conectar e sincronizar"**.

A partir daí, qualquer alteração (novo cliente, pagamento marcado, etc.) é
salva automaticamente no navegador **e** enviada para esse repositório
(alguns segundos depois da alteração, para não gerar um commit a cada tecla
digitada). Ao abrir o site em outro dispositivo conectado ao mesmo
repositório, ele busca automaticamente os dados mais recentes de lá.

⚠️ **Sobre o token:** ele fica salvo apenas no navegador de cada dispositivo
(nunca é enviado a lugar nenhum além da própria API do GitHub) e dá acesso de
escrita apenas ao repositório que você escolher. Se quiser revogar o acesso a
qualquer momento, apague o token nas configurações do GitHub ou clique em
"Desconectar" dentro do site.

## O que o sistema tem

- **Clientes**: cadastro com nome, telefone (WhatsApp), email, plano, valor
  da mensalidade, vencimento e status (ativo/bloqueado).
- **Pagamentos**: gerado automaticamente para cada cliente, com abas
  Pendente / Vencidos / Pagos / Todos, busca e filtro por mês, botão de
  "Marcar pago" e botão para enviar cobrança direto pelo WhatsApp.
- **Planos**: cadastro de planos (ex: Mensal, Trimestral, Anual) com valor e
  duração em dias.
- **Fornecedores**: cadastro dos servidores/painéis que você utiliza.
- **Serviços**: serviços avulsos (ativação, suporte, etc).
- **Financeiro**: resumo de receita recebida no mês, valores a receber e
  últimos pagamentos.
- **Templates de mensagem**: modelos de mensagem com variáveis
  `{nome}`, `{plano}`, `{valor}`, `{vencimento}` para cobrar clientes rápido.
- **Tema claro/escuro** e **backup/importação** de dados em JSON.

## Observações

- Todo o código é livre para você editar como quiser — é só abrir os arquivos
  `.html`, `.css` e `.js` em qualquer editor de texto.
- Não há coleta de dados nem envio para nenhum servidor: tudo roda localmente
  no seu navegador.
