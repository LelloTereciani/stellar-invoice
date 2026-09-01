# Stellar Testnet evidence

On 2026-09-01, `pnpm evidence:testnet` completed a disposable end-to-end journey against the public Stellar Testnet: Friendbot funding, BRLT trustline, BRLT distribution, invoice payment, Horizon retrieval and validation by the application's payment verifier.

Em 2026-09-01, `pnpm evidence:testnet` concluiu uma jornada descartável ponta a ponta na Stellar Testnet pública: financiamento via Friendbot, trustline BRLT, distribuição BRLT, pagamento da fatura, leitura no Horizon e validação pelo verificador da aplicação.

- Customer / cliente: `GAALB75R7EQYLXQH4V246Y5XGX67AWBEM2AFPQEMA2Z7WYQVVUX6S4HN`
- Issuer / emissor: `GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY`
- Distributor / distribuidor: `GADIFANV34ORRVIANOSDARFXSYFTJOBREOSOL4FPLG56YKMP72RVK2SU`
- [Trustline transaction](https://stellar.expert/explorer/testnet/tx/3e835d38f25df713b2ffd6a8bf7cb26d33a556f36a35f0293b276a1cd8e1d906)
- [Distribution transaction](https://stellar.expert/explorer/testnet/tx/ec534c02a0b18d7cf97372a3c1949f7c82e5186da7d37e1874286abff7a309a7)
- [Invoice payment transaction](https://stellar.expert/explorer/testnet/tx/f9c27590493f6c567ad5d7b3d446f901abccf38648c0416c1234b3906ef815aa)

The command prints public identifiers only. Issuer and distributor seeds remain in the ignored `demo-wallet.json` with mode `0600`; each evidence customer seed exists only for that process and is never printed or persisted.

O comando exibe apenas identificadores públicos. As seeds do emissor e distribuidor permanecem no `demo-wallet.json` ignorado, com modo `0600`; a seed de cada cliente de evidência existe apenas durante o processo e nunca é exibida ou persistida.
