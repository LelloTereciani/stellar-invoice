import type { CustomerInvoice } from "../lib/invoices/client-types.js";
import { StatusBadge } from "./StatusBadge.js";

export function InvoiceList({ invoices, selectedId }: { invoices: CustomerInvoice[]; selectedId?: string }) {
  if (invoices.length === 0) {
    return <div className="empty-state"><p>Nenhuma fatura foi destinada a esta carteira.</p></div>;
  }
  return (
    <div className="invoice-list">
      {invoices.map((invoice) => (
        <a className={`invoice-row${invoice.id === selectedId ? " invoice-row--selected" : ""}`} href={`/invoices/${encodeURIComponent(invoice.id)}`} key={invoice.id}>
          <span className="invoice-row__top">
            <strong className="mono">{invoice.amount} BRLT</strong>
            <StatusBadge status={invoice.status} />
          </span>
          <span className="invoice-row__meta">
            <span>Vencimento: <span className="mono">{new Date(invoice.dueAt).toISOString().slice(0, 10)}</span></span>
            <span className="mono">MEMO: {invoice.memo}</span>
          </span>
        </a>
      ))}
    </div>
  );
}
