# Stellar Invoice

**Classification:** Independent Project · Testnet · Production-oriented prototype

A full-stack invoice payment prototype built on Stellar Testnet. It explores wallet authentication, invoice creation, XDR review, browser signing, transaction submission, and ledger-backed payment verification using the fictional BRLT test asset.

## Scope

- Stellar Testnet only; no mainnet or commercial usage is claimed.
- Self-hosted Supabase and application services can run through Docker Compose.
- Demo flows use disposable Testnet accounts and Friendbot-funded assets.
- Operational and Testnet evidence is documented in [docs/testnet-evidence.md](docs/testnet-evidence.md).

This repository represents independent study and engineering practice. It is not presented as audited software or as a production service.

## Local development

Requirements: Node.js 22+ and pnpm.

```bash
cp .env.example .env.local
pnpm install
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

For the disposable Testnet demonstration:

```bash
pnpm demo:bootstrap
pnpm evidence:testnet
```

Never commit real secrets, private keys, wallet seeds, or populated `.env` files. Use the example environment files as templates.

## Como testar e usar com a carteira Freighter

A aplicação utiliza a carteira **Freighter** (extensão de navegador) para autenticação criptográfica e assinatura de pagamentos na **Stellar Testnet**.

### 1. Instalação e Configuração do Freighter
1. Instale a extensão oficial do [Freighter Wallet](https://www.freighter.app/) no Google Chrome, Brave ou Firefox.
2. Crie ou recupere sua conta de teste.
3. Abra as configurações do Freighter (⚙️) ou o seletor de rede no topo e selecione **Testnet** (não utilize a rede pública/Mainnet).

### 2. Obter Lumens (XLM) de Teste (Faucet Gratuito)
Para transacionar na Testnet, sua conta precisa de XLM para a taxa de reserva da rede Stellar:
1. Copie o endereço público da sua conta (começa com `G...`, ex: `GDAD6AZSXOQKWV37DFA6MZWVWXIHCJLUWKWOGH73RRWGW5LU65OPZJRF`).
2. Acesse o [Stellar Laboratory - Friendbot](https://laboratory.stellar.org/#account-creator) ou use `https://friendbot.stellar.org/?addr=SUA_CHAVE_PUBLICA`.
3. Cole sua chave pública e solicite os fundos de teste (10.000 XLM serão creditados instantaneamente).

### 3. Conectar e Autenticar no Sistema
1. Acesse o portal da aplicação (local ou no ambiente hospedado).
2. Clique no botão **`◈ Conectar carteira`** no canto superior direito.
3. O Freighter abrirá uma solicitação para aprovar o compartilhamento de endereço com o site (**Approve**).
4. Em seguida, o sistema emitirá um desafio criptográfico temporário (*Challenge*). Clique em **Sign** no Freighter para autenticar sua sessão.
5. Uma vez autenticado, o cabeçalho exibirá seu endereço público e carregará todas as faturas emitidas para a sua carteira.

### 4. Revisar e Pagar Faturas
1. Ao selecionar uma fatura pendente, revise todos os dados contratuais: valor em BRLT fictício, chave do emissor, memo e vencimento.
2. Se a sua carteira ainda não possui a **Trustline** para o ativo `BRLT` do emissor, o sistema disponibiliza o botão para criá-la com 1 clique.
3. Clique em **Pagar Fatura** e aprove a transação no Freighter.
4. O pagamento é submetido diretamente ao ledger da Stellar e verificado pelo backend, exibindo o hash da transação pública para auditoria.

## Deployment notes

The repository includes Docker Compose and EasyPanel/VPS documentation. Read [docs/operations.md](docs/operations.md) and [infra/supabase/STELLAR_INVOICE.md](infra/supabase/STELLAR_INVOICE.md) before attempting a deployment.

## Technology

TypeScript, Next.js, Stellar SDK, Freighter-compatible wallet flows, Supabase/Postgres, Docker Compose, Vitest, Playwright, and GitHub Actions.

## License

MIT. See [LICENSE](LICENSE).

## Author

Lello Tereciani
