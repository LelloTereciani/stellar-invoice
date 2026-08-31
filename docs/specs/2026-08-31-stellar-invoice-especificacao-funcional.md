# StellarInvoice — Especificação Funcional

**Status:** Proposta para aprovação.

## 1. Propósito

O StellarInvoice é um MVP de faturamento B2B demonstrável na Stellar Testnet. Ele permite que um emissor crie faturas em `BRLT`, um ativo fictício emitido na Stellar, e que um cliente as pague usando a própria carteira. O produto registra a fatura, confere o pagamento no ledger e mostra uma evidência verificável da transação.

O sistema é hospedado integralmente em uma VPS própria. O banco é Supabase auto-hospedado em Docker; não há Vercel nem Supabase Cloud.

## 2. Perfis e permissões

| Perfil | Pode fazer |
| --- | --- |
| Emissor | Autenticar-se com a carteira emissora, criar faturas e consultar as faturas criadas. |
| Cliente | Conectar a própria carteira, consultar as próprias faturas, criar trustline e assinar o pagamento. |
| Sistema | Registrar a fatura, verificar pagamentos públicos no ledger e atualizar estados segundo as regras abaixo. |

Uma carteira não recebe privilégios de emissor somente por informar um endereço: deve provar posse da carteira emissora ao assinar um desafio temporário. O cliente nunca fornece seed phrase ou chave privada ao sistema.

## 3. Ativo e ambiente

- A rede é exclusivamente Stellar Testnet.
- A moeda faturada é o ativo clássico fictício `BRLT`, identificado sempre por `BRLT` e pela chave pública do emissor.
- O emissor possui uma conta emissora e uma conta distribuidora de BRLT, ambas configuradas pela rotina administrativa.
- Para a demonstração, o administrador entrega BRLT de teste manualmente a uma carteira cliente que já tenha criado trustline. Essa entrega não é uma funcionalidade pública do painel.

## 4. Fatura

Cada fatura possui:

- Identificador interno;
- Carteira pública do cliente devedor;
- Carteira pública do emissor recebedor;
- Ativo `BRLT` e respectivo emissor;
- Valor positivo, com até sete casas decimais;
- Memo textual único, gerado pelo sistema;
- Vencimento em UTC;
- Estado;
- Hash e instante de confirmação, quando aplicável.

O emissor informa somente cliente, valor e vencimento. O sistema define emissor, ativo, memo, identificador e estado inicial. O emissor não pode editar uma fatura depois de criada; para corrigir dados, cria uma nova fatura.

## 5. Estados e regras de transição

| Estado | Significado | Transições permitidas |
| --- | --- | --- |
| `pending` | Fatura criada, ainda sem pagamento válido. | `confirmed` ou `expired`. |
| `confirmed` | Um pagamento válido e único foi encontrado no ledger. | Nenhuma. |
| `expired` | O vencimento passou sem pagamento válido confirmado. | Nenhuma. |

Uma fatura só se torna `confirmed` quando uma operação de pagamento concluída na Testnet atende simultaneamente a todos os critérios: destino igual ao emissor, ativo BRLT com o emissor correto, valor exatamente igual ao da fatura e memo exatamente igual ao memo da fatura. Um mesmo hash de transação não pode confirmar mais de uma fatura.

Se não houver pagamento válido ao vencer, a fatura torna-se `expired`. Se o sistema encontrar uma tentativa com memo correspondente, mas ativo, destino ou valor divergente, registra-a como tentativa rejeitada com hash e motivo, sem alterar a fatura de `pending`; essa tentativa não é contabilizada como pagamento e o cliente ainda pode pagar corretamente até o vencimento.

## 6. Fluxos funcionais

### 6.1 Preparar o ambiente

O administrador executa uma rotina protegida fora do painel público. Ela cria ou reutiliza as contas de teste, garante a configuração do ativo BRLT e registra somente informações públicas necessárias para o app. Reexecutá-la não deve produzir outra emissão nem apagar registros existentes.

### 6.2 Criar fatura

1. O emissor conecta a carteira e assina um desafio de uso único.
2. O emissor informa a carteira cliente, o valor e o vencimento.
3. O sistema valida os dados, cria a fatura `pending` e apresenta o memo, o ativo, o emissor, o valor e o vencimento.
4. O emissor pode abrir a página de detalhes e compartilhar o identificador/link da fatura com o cliente.

### 6.3 Preparar carteira do cliente

1. O cliente abre uma fatura pendente e conecta a carteira.
2. O app informa se a carteira não é a carteira devedora, se está fora da Testnet ou se não tem trustline BRLT.
3. Com a carteira devedora na Testnet, o cliente pode assinar a criação da trustline para BRLT.
4. O cliente precisa dispor de BRLT de teste antes de efetuar o pagamento.

### 6.4 Pagar e confirmar

1. O app monta a transação de pagamento com destino, ativo, valor e memo imutáveis da fatura.
2. O cliente revisa e assina a transação na própria carteira.
3. O app apresenta que a transação está pendente e seu hash após a submissão.
4. O cliente ou emissor solicita a verificação da fatura.
5. O sistema consulta o ledger, aplica as quatro comparações obrigatórias e atualiza o estado.
6. Quando confirmada, a fatura exibe o hash e um link para o explorador da Stellar Testnet.

## 7. Telas mínimas

| Tela | Conteúdo e ações |
| --- | --- |
| Lista do emissor | Botão para conectar carteira, criar fatura e lista de faturas próprias com estado, cliente, valor e vencimento. |
| Nova fatura | Campos de carteira do cliente, valor BRLT e vencimento; mostra erros de validação e confirma a criação. |
| Detalhe da fatura | Estado, valor, ativo com emissor, cliente, memo, vencimento, hash, tentativas rejeitadas com seus motivos e ação de verificar. |
| Pagamento do cliente | Conectar carteira, checar Testnet/trustline/saldo, criar trustline, assinar pagamento e acompanhar o hash. |

Todos os erros precisam explicar a próxima ação: instalar/conectar carteira, trocar para Testnet, criar trustline, obter BRLT de teste, corrigir endereço/valor/vencimento ou tentar a verificação novamente.

## 8. Segurança e dados

- Seeds e chaves privadas não aparecem no frontend, no repositório, nas respostas HTTP ou nos logs.
- A seed do emissor é restrita à rotina administrativa em servidor; o painel não pode usá-la para iniciar pagamentos.
- O cliente assina somente transações na própria carteira.
- As rotas administrativas exigem desafio assinado, expiram o desafio e não aceitam reutilização.
- O cliente só pode consultar as faturas associadas à própria carteira; o emissor só consulta suas próprias faturas.
- O banco persiste no volume Docker da VPS, com backup e restauração testada antes de disponibilizar o MVP.
- Comentários de código que expliquem regras de negócio, segurança ou decisões técnicas são escritos em inglês e português; comentários redundantes são evitados.

## 9. Critérios de aceite

1. O bootstrap repetido mantém a mesma configuração de BRLT e não expõe segredos.
2. O emissor autenticado cria uma fatura pendente válida.
3. O cliente devedor cria trustline e assina o pagamento sem que o servidor receba sua chave privada.
4. Um pagamento correto confirma apenas a fatura correspondente e fornece hash verificável no explorador.
5. Pagamentos com rede, ativo, emissor, destino, valor ou memo incorretos não confirmam a fatura; são registrados como tentativas rejeitadas e a fatura continua pendente até vencer ou receber um pagamento válido.
6. Fatura não paga passa a vencida após o vencimento.
7. O MVP roda na VPS com Docker e Supabase auto-hospedado, sem Vercel nem Supabase Cloud.

## 10. Fora do escopo deste MVP

- Stellar mainnet, dinheiro real, KYC, câmbio, cobrança recorrente/automática, custódia de chaves de clientes, envio de pagamentos pelo servidor, painel público de distribuição de BRLT, notificações e integrações bancárias.
