import { InvoiceDetail } from "../../components/InvoiceDetail.js";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return <InvoiceDetail invoiceId={(await params).id} />;
}
