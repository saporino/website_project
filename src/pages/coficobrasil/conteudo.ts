// Conteúdo compartilhado entre a home da COFICO e a página de Serviços.
// A operação (recebe → separa → entrega → rastreia) é uma sequência: aparece
// inteira nos dois lugares, nunca picada.
import { Warehouse, PackageCheck, Truck, Radar } from 'lucide-react';

export const FAZEMOS = [
  { icon: Warehouse, t: 'Recebimento e armazenagem', d: 'Conferência na entrada, controle de lote e de validade, armazenagem seca em centro de distribuição próprio em Várzea Paulista.' },
  { icon: PackageCheck, t: 'Separação e expedição', d: 'Separação por FIFO e FEFO — primeiro que entra sai primeiro, primeiro que vence sai primeiro. Carga fracionada por cliente e por região.' },
  { icon: Truck, t: 'Entrega', d: 'Frota própria em rota programada, com comprovante digital de entrega.' },
  { icon: Radar, t: 'Controle e rastreio', d: 'Estoque e status do pedido acompanhados em tempo real pela nossa plataforma.' },
];

// Link de WhatsApp da COFICO com o assunto já escrito.
export const whatsAppCofico = (telefone: string, assunto: string) =>
  `https://wa.me/55${telefone.replace(/\D/g, '')}?text=${encodeURIComponent(assunto)}`;
