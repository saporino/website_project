/** Formata valor monetario em pt-BR: R$ 1.234,56 */
function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface OrderForShare {
  order_number: string;
  total_amount: number;
  client_order_number?: string | null;
}

/**
 * Monta as URLs de compartilhamento de NF via WhatsApp e Email.
 * Inclui referencia condicional ao numero de pedido do cliente.
 */
export function buildInvoiceShareUrls(order: OrderForShare) {
  const clientRef = order.client_order_number?.trim() || '';

  const refBody    = clientRef ? ` (Pedido Cliente N\u00ba ${clientRef})` : '';
  const refSubject = clientRef ? ` - Pedido Cliente N\u00ba ${clientRef}` : '';

  const body =
    `Ol\u00e1! Tudo bem?\n\n` +
    `Segue a nota fiscal referente ao pedido ${order.order_number}${refBody}, ` +
    `no valor de ${formatBRL(order.total_amount)}.\n\n` +
    `Qualquer d\u00favida estamos \u00e0 disposi\u00e7\u00e3o.\n\n` +
    `Caf\u00e9 Saporino`;

  const subject = `Caf\u00e9 Saporino - Nota fiscal do pedido ${order.order_number}${refSubject}`;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(body)}`;
  const mailtoUrl   = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return { whatsappUrl, mailtoUrl, body, subject };
}

/**
 * Extrai o storage path de uma referencia de arquivo do bucket invoices.
 * Suporta path curto (ex: nf/id/pdf-...) e URLs completas do Supabase Storage.
 */
export function extractStoragePath(fileRef: string | null): string | null {
  if (!fileRef) return null;
  const value = fileRef.trim();
  if (!value) return null;
  // Rejeita referencias de bucket antigo
  if (value.includes('/representative-docs/')) return null;

  const marker = '/storage/v1/object/';
  if (/^https?:\/\//i.test(value) && value.includes(marker)) {
    const objectPart   = value.slice(value.indexOf(marker) + marker.length);
    const withoutMode  = objectPart.replace(/^(public|sign)\//, '');
    const withoutBucket = withoutMode.replace(/^invoices\//, '');
    return withoutBucket.split('?')[0] || null;
  }
  // Ja e um path curto
  return value.replace(/^\/+/, '') || null;
}
