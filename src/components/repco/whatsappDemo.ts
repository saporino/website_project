// Dados FICTÍCIOS da central de WhatsApp — só para avaliar a interface.
//
// Vivem num arquivo separado de propósito: quando a tela for ligada às tabelas `wa_*`,
// este arquivo sai inteiro e o componente não muda de forma. Nenhum nome, telefone ou
// conversa aqui corresponde a pessoa real.
//
// Os telefones usam a faixa 5511 9xxxx-xxxx com dígitos repetidos, que não é alocada a
// assinante — não há risco de o número existir.

export interface MensagemDemo {
  id: string;
  direcao: 'entrada' | 'saida';
  texto: string;
  /** minutos atrás */
  ha: number;
  estado?: 'enviada' | 'entregue' | 'lida' | 'falhou';
  erro?: string;
  tipo?: 'texto' | 'imagem' | 'documento';
  anexo?: string;
  autor?: string;
}

export interface ConversaDemo {
  id: string;
  nome: string;
  telefone: string;
  cliente: string | null;
  naoLidas: number;
  responsavel: string | null;
  /** minutos desde a última mensagem RECEBIDA; > 1440 = janela fechada */
  desdeEntrada: number;
  mensagens: MensagemDemo[];
}

export const ATENDENTES = ['Vlademir', 'Equipe COFICO'];

export const CONVERSAS_DEMO: ConversaDemo[] = [
  {
    id: 'c1',
    nome: 'Mercado São Jorge',
    telefone: '5511955555551',
    cliente: 'MERCADO SÃO JORGE LTDA',
    naoLidas: 2,
    responsavel: null,
    desdeEntrada: 7,
    mensagens: [
      { id: 'm1', direcao: 'entrada', texto: 'Bom dia! Recebi a tabela que o representante deixou. Vocês entregam em Osasco?', ha: 52 },
      { id: 'm2', direcao: 'saida', texto: 'Bom dia! Entregamos sim, Osasco está na nossa rota de terça e quinta.', ha: 44, estado: 'lida', autor: 'Vlademir' },
      { id: 'm3', direcao: 'entrada', texto: 'Perfeito. Qual o pedido mínimo?', ha: 9 },
      { id: 'm4', direcao: 'entrada', texto: 'E vocês parcelam no boleto?', ha: 7 },
    ],
  },
  {
    id: 'c2',
    nome: 'Padaria Estrela',
    telefone: '5511966666662',
    cliente: null,
    naoLidas: 1,
    responsavel: null,
    desdeEntrada: 38,
    mensagens: [
      { id: 'm1', direcao: 'entrada', texto: 'Oi, vim pelo site de vocês. Quero cotar café para a padaria.', ha: 38 },
    ],
  },
  {
    id: 'c3',
    nome: 'Rede Bom Preço — Compras',
    telefone: '5511977777773',
    cliente: 'REDE BOM PRECO COM DE ALIMENTOS',
    naoLidas: 0,
    responsavel: 'Vlademir',
    desdeEntrada: 190,
    mensagens: [
      { id: 'm1', direcao: 'entrada', texto: 'Segue o comprovante do boleto da nota 1042.', ha: 200, tipo: 'imagem', anexo: 'comprovante-1042.jpg' },
      { id: 'm2', direcao: 'saida', texto: 'Recebido, obrigado! Já dei baixa aqui.', ha: 195, estado: 'lida', autor: 'Vlademir' },
      { id: 'm3', direcao: 'entrada', texto: 'Show. A próxima entrega fica para dia 20?', ha: 190 },
      { id: 'm4', direcao: 'saida', texto: 'Isso, dia 20 pela manhã. Vou confirmar a janela na véspera.', ha: 188, estado: 'entregue', autor: 'Vlademir' },
    ],
  },
  {
    id: 'c4',
    nome: 'Cafeteria do Largo',
    telefone: '5511988888884',
    cliente: 'CAFETERIA DO LARGO ME',
    naoLidas: 0,
    responsavel: 'Equipe COFICO',
    // fechada: mais de 24 h sem mensagem do cliente
    desdeEntrada: 1870,
    mensagens: [
      { id: 'm1', direcao: 'entrada', texto: 'Fechamos o pedido de 20 fardos. Pode faturar.', ha: 1870 },
      { id: 'm2', direcao: 'saida', texto: 'Combinado! Nota emitida, segue o PDF.', ha: 1860, estado: 'lida', autor: 'Equipe COFICO', tipo: 'documento', anexo: 'nota-1055.pdf' },
      { id: 'm3', direcao: 'saida', texto: 'Entrega confirmada para sexta, das 8h às 12h.', ha: 1850, estado: 'entregue', autor: 'Equipe COFICO' },
    ],
  },
  {
    id: 'c5',
    nome: 'Atacado Vale Verde',
    telefone: '5511999999995',
    cliente: null,
    naoLidas: 0,
    responsavel: null,
    desdeEntrada: 4320,
    mensagens: [
      { id: 'm1', direcao: 'entrada', texto: 'Quanto fica o fardo fechado?', ha: 4320 },
      { id: 'm2', direcao: 'saida', texto: 'Enviando a tabela agora.', ha: 4310, estado: 'falhou', erro: '131047 Re-engagement message', autor: 'Vlademir' },
    ],
  },
];
