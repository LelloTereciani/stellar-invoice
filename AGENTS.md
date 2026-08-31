# StellarInvoice autonomous delivery

## Authority

- Work autonomously inside this repository: implement the approved specification and implementation plan, add tests, run validation, perform code/security review, commit, and push to `origin/main` without requesting per-task confirmation.
- Keep the project restricted to Stellar Testnet, fictitious BRLT, Docker-hosted Supabase, and the user-approved autonomous demonstration mode.
- Generate client demo keys only in the browser; never send, persist, log, or commit customer seed phrases.
- Use English and Portuguese for comments that explain non-obvious business, security, or technical decisions. Do not add redundant comments.

## Deployment boundary

- The user configures EasyPanel from the GitHub repository. Do not alter VPS services, Docker runtime, EasyPanel configuration, DNS, domains, or production secrets directly.
- If the execution environment requires an approval prompt for network, package installation, Docker, or remote Git, make the scoped request and continue after it is granted.

## Delivery

- Keep commits focused and push validated increments to GitHub.
- Never publish or enable Stellar mainnet, real-money handling, client-key custody, or Supabase Cloud.
