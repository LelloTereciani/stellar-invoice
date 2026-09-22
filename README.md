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

`pnpm evidence:testnet` proves only the ledger semantics of a disposable public Testnet journey. By itself, it does not prove correlation with the deployed application, database, migration `0018`, PostgREST schema cache, or application build. See [docs/testnet-evidence.md](docs/testnet-evidence.md) for the required receiver evidence and its current status.

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

### 5. Pagar com a Carteira Demo

As faturas da demonstração podem ser pagas pela conta automática criada neste navegador. Essa opção é destinada somente ao fluxo de demonstração na **Stellar Testnet**:

1. Inicie ou retome a demonstração explicitamente no portal. A chave demo é mantida apenas no armazenamento local do navegador e não é enviada ao servidor.
2. Abra uma fatura pendente em que a carteira demo seja o devedor. O bloco **Ação rápida · Testnet** exibirá o botão **Pagar esta fatura com a Carteira Demo (1 clique)**.
3. Use o botão para autenticar a carteira demo, preparar a transação, assinar localmente e enviá-la para a Testnet.
4. O sistema verifica no ledger o hash, o valor, o emissor, o destinatário e o memo da fatura antes de marcá-la como confirmada.

O botão aparece também nas faturas demo antigas enquanto elas estiverem pendentes, desde que a chave demo local corresponda exatamente ao devedor da fatura. Não é necessário informar uma seed manualmente. Se a conta demo não estiver neste navegador, retome a demonstração antes de tentar pagar. A conta Freighter continua sendo necessária para pagamentos com uma carteira pessoal; ela não compartilha nem recebe a chave demo.

## Deployment notes

The repository includes Docker Compose and EasyPanel/VPS documentation. Read [docs/operations.md](docs/operations.md) and [infra/supabase/STELLAR_INVOICE.md](infra/supabase/STELLAR_INVOICE.md) before attempting a deployment.

For EasyPanel, use the single `docker-compose.easypanel.yml` Compose definition. Route the primary domain to the internal `app` service over HTTP port `3000`; do not publish ports `80`, `443`, or Supabase service ports from the Compose project. Configure environment values as secrets, run `pnpm demo:bootstrap` once on Testnet, and transfer only the required public keys and operational variables. Preflight, backup, isolated restore, migration, redeploy, and rollback procedures are documented in [docs/operations.md](docs/operations.md).

The production image excludes local environment files and `demo-wallet.json`, so Testnet seeds never enter the build context.

## Technology

TypeScript, Next.js, Stellar SDK, Freighter-compatible wallet flows, Supabase/Postgres, Docker Compose, Vitest, Playwright, and GitHub Actions.

## License

MIT. See [LICENSE](LICENSE).

## Author

Lello Tereciani
