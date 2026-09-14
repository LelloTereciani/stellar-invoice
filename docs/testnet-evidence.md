# Stellar Testnet evidence

## Separate receiver evidence — pending after redeploy

Fresh public Testnet evidence for the separate payment receiver is intentionally pending. The application and reproducible `pnpm evidence:testnet` path now model three roles: BRLT issuer, treasury/receiver and customer. A valid fresh run must occur only after migration `0018`, the receiver environment variable and the new application build have been deployed. It must prove treasury `-25 BRLT`, customer `+25 BRLT`, then customer `25 -> 20 BRLT` and treasury `+5 BRLT`, while the issuer has no trustline for its own asset. No hashes are recorded here until that deployed run exists.

A nova evidência pública da Testnet para o recebedor separado está deliberadamente pendente. O aplicativo e o caminho reproduzível `pnpm evidence:testnet` agora representam três papéis: emissor BRLT, tesouraria/recebedor e cliente. A nova execução válida só deve ocorrer após o deploy da migration `0018`, da variável do recebedor e do novo build. Ela deve provar tesouraria `-25 BRLT`, cliente `+25 BRLT`, depois cliente `25 -> 20 BRLT` e tesouraria `+5 BRLT`, mantendo o emissor sem trustline do próprio ativo. Nenhum hash será registrado antes dessa execução implantada.

The evidence command reads the ignored issuer/distributor wallet file, derives the treasury receiver from the distributor, creates a new customer only in memory, and prints only public account keys, public transaction hashes and the measured balance transitions. It never prints or persists the customer seed.

## Legacy evidence — 2026-09-01 (issuer destination)

The evidence below predates receiver separation and is retained only as historical proof of the former issuer-destination flow. It must not be cited as proof of migration `0018` or of treasury receipt.

On 2026-09-01, the then-current `pnpm evidence:testnet` completed a disposable end-to-end journey against the public Stellar Testnet: Friendbot funding, BRLT trustline, BRLT distribution, invoice payment to the issuer, Horizon retrieval and validation by the application's payment verifier.

Em 2026-09-01, a versão então existente de `pnpm evidence:testnet` concluiu uma jornada descartável ponta a ponta na Stellar Testnet pública: financiamento via Friendbot, trustline BRLT, distribuição BRLT, pagamento da fatura ao emissor, leitura no Horizon e validação pelo verificador da aplicação.

- Customer / cliente: `GAALB75R7EQYLXQH4V246Y5XGX67AWBEM2AFPQEMA2Z7WYQVVUX6S4HN`
- Issuer / emissor: `GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY`
- Distributor / distribuidor: `GADIFANV34ORRVIANOSDARFXSYFTJOBREOSOL4FPLG56YKMP72RVK2SU`
- [Trustline transaction](https://stellar.expert/explorer/testnet/tx/3e835d38f25df713b2ffd6a8bf7cb26d33a556f36a35f0293b276a1cd8e1d906)
- [Distribution transaction](https://stellar.expert/explorer/testnet/tx/ec534c02a0b18d7cf97372a3c1949f7c82e5186da7d37e1874286abff7a309a7)
- [Invoice payment transaction](https://stellar.expert/explorer/testnet/tx/f9c27590493f6c567ad5d7b3d446f901abccf38648c0416c1234b3906ef815aa)

The command prints public identifiers only. Issuer and distributor seeds remain in the ignored `demo-wallet.json` with mode `0600`; each evidence customer seed exists only for that process and is never printed or persisted.

O comando exibe apenas identificadores públicos. As seeds do emissor e distribuidor permanecem no `demo-wallet.json` ignorado, com modo `0600`; a seed de cada cliente de evidência existe apenas durante o processo e nunca é exibida ou persistida.
