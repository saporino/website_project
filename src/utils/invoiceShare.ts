/** Formata valor monetário em pt-BR: R$ 1.234,56 */
function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface OrderForShare {
  order_number: string;
  total_amount: number;
}

/**
 * Monta as URLs de compartilhamento de NF via WhatsApp e Email.
 * Não inclui link direto para o arquivo (signed URL é gerada separadamente).
 */
export function buildInvoiceShareUrls(order: OrderForShare) {
  const body =
    `Olá! Tudo bem?\n\n` +
    `Segue a nota fiscal referente ao pedido ${order.order_number}, ` +
    `no valor de ${formatBRL(order.total_amount)}.\n\n` +
    `Qualquer dúvida estamos à disposição.\n\n` +
    `Café Saporino`;

  const subject = `Café Saporino - Nota fiscal do pedido ${order.order_number}`;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(body)}`;
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return { whatsappUrl, mailtoUrl, body, subject };
}

/**
 * Extrai o storage path de uma referência de arquivo do bucket invoices.
 * Suporta path curto (ex: nf/id/pdf-...) e URLs completas do Supabase Storage.
 */
export function extractStoragePath(fileRef: string | null): string | null {
  if (!fileRef) return null;
  const value = fileRef.trim();
  if (!value) return null;
  // Rejeita referências de bucket antigo
  if (value.includes('/representative-docs/')) return null;

  const marker = '/storage/v1/object/';
  if (/^https?:\/\//i.test(value) && value.includes(marker)) {
    const objectPart = value.slice(value.indexOf(marker) + marker.length);
    const withoutMode = objectPart.replace(/^(public|sign)\//, '');
    const withoutBucket = withoutMode.replace(/^invoices\//, '');
    return withoutBucket.split('?')[0] || null;
  }
  // Já é um path curto
  return value.replace(/^\/+/, '') || null;
}
