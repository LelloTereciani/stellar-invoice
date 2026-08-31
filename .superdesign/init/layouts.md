# Shared layouts

## `app/layout.tsx`

Root Next.js layout. The current application has no navigation, sidebar, or footer component.

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "StellarInvoice",
  description: "Faturamento B2B verificável na Stellar Testnet",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```
