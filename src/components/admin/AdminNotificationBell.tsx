import { useState, useEffect } from 'react';
import { Bell, UserCheck, FileText, ShoppingBag, X, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Notification {
  id: string;
  type: 'repco_pending' | 'repco_order_no_nf' | 'ecommerce_pending';
  title: string;
  description: string;
  count: number;
  tab: string; // which admin tab to navigate to
  icon: React.ElementType;
  color: string;
}

interface AdminNotificationBellProps {
  onNavigate: (tab: string) => void;
}

export function AdminNotificationBell({ onNavigate }: AdminNotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const totalCount = notifications.reduce((sum, n) => sum + n.count, 0);

  const fetchNotifications = async () => {
    setLoading(true);
    const items: Notification[] = [];

    try {
      // 1. RepCo pending approval
      const { count: repPending } = await supabase
        .from('representatives')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (repPending && repPending > 0) {
        items.push({
          id: 'repco_pending',
          type: 'repco_pending',
          title: 'RepCo aguardando aprovação',
          description: `${repPending} representante${repPending > 1 ? 's' : ''} pendente${repPending > 1 ? 's' : ''}`,
          count: repPending,
          tab: 'repco',
          icon: UserCheck,
          color: 'text-amber-600 bg-amber-50',
        });
      }

      // 2. RepCo orders without NF
      const { count: ordersNoNF } = await supabase
        .from('representative_orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['new', 'pending'])
        .is('invoice_pdf_url', null);

      if (ordersNoNF && ordersNoNF > 0) {
        items.push({
          id: 'repco_order_no_nf',
          type: 'repco_order_no_nf',
          title: 'Pedidos RepCo sem nota fiscal',
          description: `${ordersNoNF} pedido${ordersNoNF > 1 ? 's' : ''} aguardando NF`,
          count: ordersNoNF,
          tab: 'repco',
          icon: FileText,
          color: 'text-red-600 bg-red-50',
        });
      }

      // 3. E-commerce orders pending (status column is the single source of truth)
      const { count: ecomPending } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'created']);

      if (ecomPending && ecomPending > 0) {
        items.push({
          id: 'ecommerce_pending',
          type: 'ecommerce_pending',
          title: 'Pedidos e-commerce pendentes',
          description: `${ecomPending} pedido${ecomPending > 1 ? 's' : ''} aguardando pagamento`,
          count: ecomPending,
          tab: 'orders',
          icon: ShoppingBag,
          color: 'text-blue-600 bg-blue-50',
        });
      }

      setNotifications(items);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Refresh every 60 seconds
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleClick = (tab: string) => {
    onNavigate(tab);
    setOpen(false);
  };

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="Notificações"
      >
        <Bell className="w-5 h-5" />
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-[#a4240e] text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-12 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-gray-600" />
                <span className="font-semibold text-gray-900 text-sm">Notificações</span>
                {totalCount > 0 && (
                  <span className="bg-[#a4240e] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {totalCount}
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#a4240e]" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-6 h-6 text-green-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Tudo em dia!</p>
                  <p className="text-xs text-gray-400 mt-1">Nenhuma pendência no momento</p>
                </div>
              ) : (
                <div className="py-2">
                  {notifications.map((notif) => {
                    const Icon = notif.icon;
                    return (
                      <button
                        key={notif.id}
                        onClick={() => handleClick(notif.tab)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${notif.color.split(' ')[1]}`}>
                          <Icon className={`w-4.5 h-4.5 ${notif.color.split(' ')[0]}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{notif.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{notif.description}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-4 py-2">
              <button
                onClick={fetchNotifications}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Atualizar agora
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
