# Extractable components

## RootLayout

- Source: `app/layout.tsx`
- Category: layout
- Description: Root HTML document with Brazilian Portuguese locale and product metadata.
- Extractable props: `children` (ReactNode)
- Hardcoded: locale and metadata

## TestnetWallet

- Source: `app/components/TestnetWallet.tsx`
- Category: basic
- Description: Freighter Testnet connection action with address and feedback state.
- Extractable props: none in the current implementation
- Hardcoded: button labels, Testnet restriction, feedback text, semantic HTML

## DemoStarter

- Source: `app/components/DemoStarter.tsx`
- Category: basic
- Description: Guided automatic Testnet provisioning action with progress and public-key output.
- Extractable props: none in the current implementation
- Hardcoded: button labels, progress text, localStorage key, semantic HTML

The repository does not yet contain a reusable visual primitive library, navigation, status badge, invoice card, table, or app shell. These patterns are the target of the first design draft rather than existing components to extract.
