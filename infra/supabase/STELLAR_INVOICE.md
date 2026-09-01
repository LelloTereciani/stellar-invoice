# Supabase self-hosted for StellarInvoice

The official Supabase Docker template is vendored in this directory at the pinned `self-hosted/v0.8.0` baseline. `docker-compose.stellar-invoice.yml` is the project overlay: it removes public gateway and database ports. The application must reach Supabase only through the private Docker network.

O template oficial Docker do Supabase está versionado neste diretório a partir da base fixada `self-hosted/v0.8.0`. `docker-compose.stellar-invoice.yml` é a sobreposição do projeto: ela remove portas públicas do gateway e banco. A aplicação acessa o Supabase somente pela rede Docker privada.

## EasyPanel configuration

1. Create an EasyPanel **Compose** service from `LelloTereciani/stellar-invoice`, branch `main`, with build path `/`.
2. Set **Docker Compose File** to the single root file `docker-compose.easypanel.yml`. Do not enter the three generic-VPS overlay files in EasyPanel.
3. Create the required environment values from `infra/supabase/.env.example` plus `infra/.env.example`. Generate all secrets with `infra/supabase/utils/generate-keys.sh` and `infra/supabase/utils/add-new-auth-keys.sh`; never retain their output in Git, browser logs, or chat.
4. Add the domain to internal service **`app`**, protocol **HTTP**, target port **`3000`**, and mark it primary. EasyPanel owns HTTPS; do not route the domain to `api-gw`, `db`, Caddy, or port 80. If EasyPanel requires an initial deploy before the service can be selected, perform it and continue with the required redeploy in step 6.
5. Only after the primary domain exists, set `APP_ORIGIN=https://$(PRIMARY_DOMAIN)` and `APP_DOMAIN=$(PRIMARY_DOMAIN)`. Keep `NEXT_PUBLIC_STELLAR_NETWORK=testnet` and configure the bootstrapped public issuer/distributor values.
6. Run `infra/preflight.sh /absolute/path/to/combined.env easypanel`, then deploy or redeploy. The redeploy after assigning the primary domain is mandatory so the application receives the resolved HTTPS origin.
7. Confirm that EasyPanel created the Compose named volumes `postgres-data`, `storage-data` and `postgres-backups`. Configure EasyPanel/VPS snapshots or an encrypted offsite export for `postgres-backups`; a volume on the same VPS is not an independent disaster-recovery copy.

If the public URL shows EasyPanel's `502 Service is not reachable`, first verify that the domain target is exactly `app`, `HTTP`, `3000` and that the deployment source is the Compose file above. An EasyPanel **App** service built only from the Dockerfile starts the frontend but does not create the private Supabase services required by the product.

Se a URL pública exibir `502 Service is not reachable`, verifique primeiro se o destino do domínio é exatamente `app`, `HTTP`, `3000` e se a origem do deploy é o Compose acima. Um serviço **App** criado somente a partir do Dockerfile inicia o frontend, mas não cria os serviços privados do Supabase exigidos pelo produto.

The generic VPS files still include Caddy, but EasyPanel must use its own proxy. The root EasyPanel Compose intentionally contains no Caddy, fixed container names or published host ports.

Os arquivos de VPS genérica continuam incluindo Caddy, mas o EasyPanel deve usar seu próprio proxy. O Compose raiz para EasyPanel não contém Caddy, nomes fixos de contêiner nem portas publicadas no host.

All fifteen project migrations are mounted by the StellarInvoice overlay and run when Postgres initializes a **new** data volume. Existing volumes are intentionally not mutated at container start; back up first and apply only reviewed new SQL migrations during a controlled maintenance window.

As migrations do projeto são montadas pela sobreposição do StellarInvoice e executam quando o Postgres inicializa um volume de dados **novo**. Volumes existentes não são alterados automaticamente na inicialização; aplique migrações SQL revisadas explicitamente em uma janela de manutenção controlada.

Do not use the defaults in `.env.example` to start a public instance. The EasyPanel configuration is intentionally performed by the user; this repository does not contain live credentials.

Não use os valores padrão de `.env.example` para iniciar uma instância pública. A configuração do EasyPanel é realizada intencionalmente pelo usuário; este repositório não contém credenciais reais.

The `backup` sidecar writes a validated daily logical dump of the application `public` schema, including ACLs, to `postgres-backups`. Export a dump from that volume and run `infra/restore-check.sh /absolute/path/to/stellar-invoice-*.sql.gz` quarterly and before a database migration. Do not point the generic `BACKUP_DIR` host path at an EasyPanel-managed Compose project.

O sidecar `backup` grava diariamente no volume `postgres-backups` um dump logico validado do schema `public`, incluindo ACLs. Exporte um dump desse volume e execute `infra/restore-check.sh /caminho/absoluto/stellar-invoice-*.sql.gz` trimestralmente e antes de migracoes do banco. Nao aponte o caminho generico `BACKUP_DIR` do host para um projeto Compose gerenciado pelo EasyPanel.
