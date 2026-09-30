# Casa Tambor — loja de utensílios

Loja virtual completa com catálogo, carrinho, contas de cliente, checkout pelo
Mercado Pago (Pix, cartão e boleto), acompanhamento de pedidos e painel de
administração. Node.js + Express + SQLite, sem frameworks no navegador.

## Rodar no seu computador (modo demonstração)

Precisa do Node.js 20 ou mais novo.

```bash
npm install
cp .env.example .env
# no .env, troque para:  NODE_ENV=development  e  PAYMENT_MODE=demo
npm start
```

Abra http://localhost:3000. No modo demonstração a página do pedido mostra
botões para simular "pagamento aprovado" ou "recusado". Esse modo é desligado
automaticamente em produção.

Para criar sua conta de administrador:

```bash
npm run create-admin -- voce@seudominio.com "UmaSenhaForte123" "Seu Nome"
```

Depois entre no site com esse e-mail e acesse **Administração** no menu: lá
você vê pedidos, marca como enviado, e altera preço, estoque e o que está à venda.

## Ligar o Mercado Pago

1. Crie uma conta em mercadopago.com.br e acesse **Suas integrações** → **Criar aplicação** (escolha "Pagamentos online" / Checkout Pro).
2. Em **Credenciais**, copie o *Access Token*. Comece com as credenciais **de teste** e troque pelas de produção quando tudo estiver funcionando.
3. Em **Webhooks**, cadastre a URL `https://SEU-DOMINIO/api/webhooks/mercadopago`, marque o evento **Pagamentos** e copie a **assinatura secreta**.
4. Preencha `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` no `.env` e reinicie.

Para testar compras, o Mercado Pago oferece usuários e cartões de teste na
própria área de integrações.

## Colocar no ar

Qualquer hospedagem Node.js serve (Render, Railway, Fly.io, uma VPS com Nginx).
Pontos importantes:

- Configure as variáveis do `.env.example` no painel da hospedagem.
- O site **exige HTTPS** em produção (a hospedagem normalmente fornece o certificado).
- O banco SQLite fica no arquivo `DB_PATH`. Use um **disco persistente**, senão os pedidos somem a cada nova publicação. Faça backup desse arquivo.
- Comando de início: `npm start`.

## Como a segurança funciona

| Proteção | Como |
|---|---|
| Dados de cartão | Digitados no Mercado Pago (Checkout Pro); nunca passam pelo servidor da loja |
| Preço adulterado | O total é sempre calculado no servidor com os preços do banco; o que vem do navegador é ignorado |
| Confirmação de pagamento | Só pelo webhook, com assinatura HMAC verificada, consulta direta à API do Mercado Pago e conferência de valor e moeda |
| Notificações repetidas ou reenviadas | Cada evento é aplicado uma vez só; notificações com mais de 10 minutos são recusadas |
| Senhas | bcrypt com custo 12; mínimo de 8 caracteres com letras e números |
| Força bruta | Limite de 10 tentativas/15 min por IP e bloqueio da conta após 5 senhas erradas |
| Sessão | Cookie `httpOnly`, `secure` e `SameSite`, assinado (JWT HS256), validade de 7 dias |
| CSRF | Token *double submit* obrigatório em todas as ações que alteram dados |
| XSS | Content-Security-Policy sem scripts de terceiros nem inline, e todo texto escapado antes de exibir |
| SQL injection | Somente consultas parametrizadas |
| Acesso indevido | Cada cliente só vê os próprios pedidos; IDs de pedido aleatórios; painel exige perfil admin |
| Estoque | Reservado de forma atômica ao criar o pedido e devolvido se o pagamento for recusado ou expirar |
| Cabeçalhos | Helmet: HSTS, X-Frame-Options, nosniff, Referrer-Policy; redirecionamento para HTTPS |
| Erros | Detalhes internos só no log do servidor, nunca para o visitante |

Boas práticas que continuam com você: manter o `.env` fora do repositório,
rodar `npm audit` e atualizar as dependências de tempos em tempos, fazer backup
do banco e ativar a verificação em duas etapas na conta do Mercado Pago.

## Personalizar

- **Preços e estoque iniciais:** `src/catalog.js` (antes do primeiro uso) ou pelo painel.
- **Frete:** variáveis `SHIPPING_CENTS` e `FREE_SHIPPING_FROM_CENTS`. Se mudar, ajuste também `SHIPPING` e `FREE_FROM` no topo de `public/js/app.js` (servem só para exibir; o valor cobrado vem do servidor).
- **Fotos reais:** coloque as imagens em `public/img/` e troque a chamada `icon(p.icon, p.name)` em `public/js/app.js` por `<img src="/img/${p.slug}.jpg" alt="...">`.
- **Cores e fontes:** variáveis no topo de `public/css/style.css`.

## Estrutura

```
src/
  server.js           servidor, cabeçalhos de segurança, rotas
  config.js           variáveis de ambiente e checagens de produção
  db.js               tabelas do banco
  catalog.js          os 15 produtos iniciais
  lib/auth.js         sessão e permissões
  lib/csrf.js         proteção CSRF
  lib/validate.js     validação de todos os formulários
  lib/payments.js     Mercado Pago e verificação da assinatura do webhook
  lib/orders.js       status, estoque e expiração de pedidos
  routes/             auth, produtos, pedidos, webhook, admin
public/
  index.html, css/style.css, js/app.js, js/icons.js
```
