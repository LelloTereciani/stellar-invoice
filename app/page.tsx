import { InvoicePortal } from "./components/InvoicePortal.js";
import { connection } from "next/server.js";

// This shell intentionally exposes no administrative data or secrets.
// Esta estrutura não expõe dados administrativos nem segredos.
export default async function HomePage() {
  await connection();
  return <InvoicePortal />;
}
