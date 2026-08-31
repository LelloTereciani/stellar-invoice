# Supabase self-hosted for StellarInvoice

The official Supabase Docker template is vendored in this directory at the pinned `self-hosted/v0.8.0` baseline. `docker-compose.stellar-invoice.yml` is the project overlay: it removes public gateway and database ports. The application must reach Supabase only through the private Docker network.

O template oficial Docker do Supabase está versionado neste diretório a partir da base fixada `self-hosted/v0.8.0`. `docker-compose.stellar-invoice.yml` é a sobreposição do projeto: ela remove portas públicas do gateway e banco. A aplicação acessa o Supabase somente pela rede Docker privada.

## EasyPanel configuration

1. Deploy the repository from GitHub with Docker Compose support.
2. Use both Compose files, in this order: `infra/supabase/docker-compose.yml` and `infra/supabase/docker-compose.stellar-invoice.yml`.
3. Create the required environment values from `infra/supabase/.env.example` in EasyPanel. Generate all secrets with the included `utils/generate-keys.sh` and `utils/add-new-auth-keys.sh`; never retain their output in Git, browser logs, or chat.
4. Set the public URLs to the final HTTPS domain and restrict CORS/site redirects to that domain.
5. Attach persistent storage for `infra/supabase/volumes` and keep a backup outside that volume.

Do not use the defaults in `.env.example` to start a public instance. The EasyPanel configuration is intentionally performed by the user; this repository does not contain live credentials.

Não use os valores padrão de `.env.example` para iniciar uma instância pública. A configuração do EasyPanel é realizada intencionalmente pelo usuário; este repositório não contém credenciais reais.
