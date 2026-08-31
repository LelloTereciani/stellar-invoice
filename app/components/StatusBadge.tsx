import type { InvoiceStatus } from "../lib/invoices/client-types.js";

const LABELS: Record<InvoiceStatus, string> = {
  confirmed: "Confirmada",
  expired: "Vencida",
  pending: "Pendente",
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return <span className={`status status--${status}`}><span aria-hidden="true" />{LABELS[status]}</span>;
}
