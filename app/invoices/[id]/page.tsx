import { InvoiceDetail } from "../../components/InvoiceDetail.js";
import { connection } from "next/server.js";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  return <InvoiceDetail invoiceId={(await params).id} />;
}
