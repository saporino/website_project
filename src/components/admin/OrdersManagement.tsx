import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Printer, Tag, Package, Search, Calendar, Filter } from 'lucide-react';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  cpf: string;
  cep: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  total_amount: number;
  shipping_cost: number;
  status: string;
  payment_status: string;
  carrier_name: string;
  tracking_code: string;
  created_at: string;
  order_items: Array<{
    quantity: number;
    unit_price: number;
    product_id: string;
    products: { name: string; weight_grams: number };
  }>;
}

export function OrdersManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            unit_price,
            product_id,
            products (name, weight_grams)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const updates: any = { status };

      if (status === 'shipped' && !orders.find(o => o.id === orderId)?.tracking_code) {
        const trackingCode = `BR${Date.now().toString().slice(-9)}BR`;
        updates.tracking_code = trackingCode;
        updates.shipped_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;
      loadOrders();
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const printOrder = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalWeight = order.order_items.reduce((sum, item) =>
      sum + (item.products.weight_grams * item.quantity), 0
    );

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pedido ${order.order_number}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #a4240e; border-bottom: 3px solid #a4240e; padding-bottom: 10px; }
            .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .section { margin-bottom: 20px; }
            .section-title { font-weight: bold; font-size: 18px; margin-bottom: 10px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .total { font-size: 20px; font-weight: bold; color: #a4240e; text-align: right; margin-top: 20px; }
            .info-box { background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <h1>CAFÉ SAPORINO - PEDIDO ${order.order_number}</h1>

          <div class="header">
            <div>
              <strong>Data do Pedido:</strong><br>
              ${new Date(order.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            <div>
              <strong>Status:</strong><br>
              ${getStatusLabel(order.status)}
            </div>
          </div>

          <div class="section">
            <div class="section-title">DADOS DO CLIENTE</div>
            <div class="info-box">
              <strong>Nome:</strong> ${order.customer_name}<br>
              <strong>CPF:</strong> ${order.cpf}<br>
              <strong>Email:</strong> ${order.customer_email}<br>
              <strong>Telefone:</strong> ${order.customer_phone}
            </div>
          </div>

          <div class="section">
            <div class="section-title">ENDEREÇO DE ENTREGA</div>
            <div class="info-box">
              ${order.address_street}, ${order.address_number}${order.address_complement ? `, ${order.address_complement}` : ''}<br>
              ${order.address_neighborhood}<br>
              ${order.address_city} - ${order.address_state}<br>
              <strong>CEP:</strong> ${order.cep}
            </div>
          </div>

          <div class="section">
            <div class="section-title">PRODUTOS</div>
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Quantidade</th>
                  <th>Peso Unit.</th>
                  <th>Preço Unit.</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${order.order_items.map(item => `
                  <tr>
                    <td>${item.products.name}</td>
                    <td>${item.quantity}</td>
                    <td>${item.products.weight_grams}g</td>
                    <td>R$ ${item.unit_price.toFixed(2)}</td>
                    <td>R$ ${(item.unit_price * item.quantity).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="section">
            <strong>Peso Total:</strong> ${totalWeight}g (${(totalWeight / 1000).toFixed(2)}kg)<br>
            <strong>Subtotal Produtos:</strong> R$ ${(order.total_amount - order.shipping_cost).toFixed(2)}<br>
            <strong>Frete (${order.carrier_name || 'N/A'}):</strong> R$ ${order.shipping_cost.toFixed(2)}
          </div>

          <div class="total">
            TOTAL: R$ ${order.total_amount.toFixed(2)}
          </div>

          ${order.tracking_code ? `
            <div class="section" style="margin-top: 30px;">
              <div class="section-title">RASTREAMENTO</div>
              <div class="info-box">
                <strong>Código:</strong> ${order.tracking_code}
              </div>
            </div>
          ` : ''}
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const printShippingLabel = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiqueta ${order.order_number}</title>
          <style>
            @page { size: 10cm 15cm; margin: 0; }
            body {
              width: 10cm;
              height: 15cm;
              margin: 0;
              padding: 1cm;
              font-family: Arial, sans-serif;
              box-sizing: border-box;
            }
            .label-container {
              border: 2px solid #000;
              padding: 15px;
              height: 100%;
              display: flex;
              flex-direction: column;
            }
            .section { margin-bottom: 15px; }
            .section-title {
              font-weight: bold;
              font-size: 11px;
              border-bottom: 1px solid #000;
              padding-bottom: 3px;
              margin-bottom: 5px;
            }
            .content { font-size: 10px; line-height: 1.4; }
            .large { font-size: 12px; font-weight: bold; }
            .tracking {
              font-size: 14px;
              font-weight: bold;
              text-align: center;
              padding: 8px;
              background: #f0f0f0;
              border: 1px solid #000;
              margin-top: auto;
            }
          </style>
        </head>
        <body>
          <div class="label-container">
            <div class="section">
              <div class="section-title">REMETENTE</div>
              <div class="content">
                <strong>Café Saporino</strong><br>
                Al. Rio Negro, 503 - Sala 2005<br>
                Alphaville Industrial<br>
                Barueri - SP - CEP: 06454-000
              </div>
            </div>

            <div class="section">
              <div class="section-title">DESTINATÁRIO</div>
              <div class="content">
                <div class="large">${order.customer_name}</div>
                ${order.address_street}, ${order.address_number}${order.address_complement ? `, ${order.address_complement}` : ''}<br>
                ${order.address_neighborhood}<br>
                ${order.address_city} - ${order.address_state}<br>
                <strong>CEP: ${order.cep}</strong>
              </div>
            </div>

            <div class="section">
              <div class="section-title">ENVIO</div>
              <div class="content">
                <strong>Transportadora:</strong> ${order.carrier_name || 'A definir'}<br>
                <strong>Pedido:</strong> ${order.order_number}
              </div>
            </div>

            ${order.tracking_code ? `
              <div class="tracking">
                ${order.tracking_code}
              </div>
            ` : '<div class="tracking">AGUARDANDO POSTAGEM</div>'}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendente',
      paid: 'Pago',
      shipped: 'Enviado',
      delivered: 'Entregue',
      cancelled: 'Cancelado',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === 'all' || order.status === filter;
    const matchesSearch =
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#a4240e]"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Gerenciamento de Pedidos</h2>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por número, nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
            />
          </div>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
          >
            <option value="all">Todos os Status</option>
            <option value="pending">Pendente</option>
            <option value="paid">Pago</option>
            <option value="shipped">Enviado</option>
            <option value="delivered">Entregue</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Pedido {order.order_number}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full font-medium ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 mt-4 lg:mt-0">
                  <button
                    onClick={() => printOrder(order)}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir</span>
                  </button>

                  <button
                    onClick={() => printShippingLabel(order)}
                    className="flex items-center space-x-2 px-4 py-2 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors"
                  >
                    <Tag className="w-4 h-4" />
                    <span>Etiqueta</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Cliente</p>
                  <p className="text-gray-900">{order.customer_name}</p>
                  <p className="text-sm text-gray-600">{order.customer_email}</p>
                  <p className="text-sm text-gray-600">{order.customer_phone}</p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Endereço</p>
                  <p className="text-sm text-gray-900">
                    {order.address_street}, {order.address_number}
                  </p>
                  <p className="text-sm text-gray-900">
                    {order.address_city} - {order.address_state}
                  </p>
                  <p className="text-sm text-gray-900">CEP: {order.cep}</p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Produtos</p>
                  {order.order_items.map((item, idx) => (
                    <p key={idx} className="text-sm text-gray-900">
                      {item.quantity}x {item.products.name}
                    </p>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-sm text-gray-600">Frete: R$ {order.shipping_cost.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">{order.carrier_name || 'Não definida'}</p>
                    {order.tracking_code && (
                      <p className="text-sm font-mono text-gray-900 font-medium">
                        {order.tracking_code}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="text-2xl font-bold text-[#a4240e]">
                      R$ {order.total_amount.toFixed(2)}
                    </p>
                  </div>

                  <select
                    value={order.status}
                    onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                  >
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="shipped">Enviado</option>
                    <option value="delivered">Entregue</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
