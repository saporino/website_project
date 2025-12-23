import { useEffect, useState } from 'react';
import { Check, X, Clock, ShoppingBag, Home, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

const logoImage = '/SAPORINO LOGO transparente big-PNG.png';

interface OrderDetails {
    order_number: string;
    total_amount: number;
    status: string;
    created_at: string;
    customer_name: string;
    customer_email: string;
}

// Payment Success Page
export const PaymentSuccess = () => {
    const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadOrderDetails();
        // Clear cart from localStorage
        localStorage.removeItem('cart');
    }, []);

    const loadOrderDetails = async () => {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const externalReference = urlParams.get('external_reference');
            const paymentId = urlParams.get('payment_id');
            const collectionId = urlParams.get('collection_id');
            const collectionStatus = urlParams.get('collection_status');

            if (externalReference) {
                // Update order with payment information
                const { data, error } = await supabase
                    .from('orders')
                    .update({
                        status: 'approved',
                        mercadopago_payment_id: paymentId,
                        mercadopago_collection_id: collectionId,
                        mercadopago_collection_status: collectionStatus,
                        paid_at: new Date().toISOString(),
                    })
                    .eq('id', externalReference)
                    .select()
                    .single();

                if (error) throw error;
                setOrderDetails(data);
            }
        } catch (error) {
            console.error('Error loading order details:', error);
        } finally {
            setLoading(false);
        }
    };

    const goToHome = () => {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-6">
            <div className="max-w-2xl w-full">
                {/* Logo */}
                <div className="text-center mb-8">
                    <img
                        src={logoImage}
                        alt="Café Saporino"
                        className="h-24 w-auto mx-auto drop-shadow-lg"
                    />
                </div>

                {/* Success Card */}
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                    {/* Header with Icon */}
                    <div className="bg-gradient-to-r from-green-500 to-green-600 px-8 py-12 text-center">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                            <Check className="w-12 h-12 text-green-600" />
                        </div>
                        <h1 className="text-4xl font-bold text-white mb-3">
                            Pagamento Confirmado!
                        </h1>
                        <p className="text-green-50 text-lg">
                            Seu pedido foi realizado com sucesso
                        </p>
                    </div>

                    {/* Content */}
                    <div className="px-8 py-10">
                        {loading ? (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-600 mx-auto"></div>
                                <p className="text-gray-600 mt-4">Carregando detalhes do pedido...</p>
                            </div>
                        ) : orderDetails ? (
                            <div className="space-y-6">
                                {/* Order Number */}
                                <div className="bg-green-50 rounded-2xl p-6 text-center border-2 border-green-200">
                                    <p className="text-sm text-green-700 font-semibold mb-2">
                                        Número do Pedido
                                    </p>
                                    <p className="text-3xl font-bold text-green-900">
                                        {orderDetails.order_number}
                                    </p>
                                </div>

                                {/* Order Details */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                                        <span className="text-gray-600 font-medium">Cliente</span>
                                        <span className="text-gray-900 font-semibold">{orderDetails.customer_name}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                                        <span className="text-gray-600 font-medium">E-mail</span>
                                        <span className="text-gray-900">{orderDetails.customer_email}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                                        <span className="text-gray-600 font-medium">Total Pago</span>
                                        <span className="text-2xl font-bold text-green-600">
                                            R$ {orderDetails.total_amount.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {/* Next Steps */}
                                <div className="bg-stone-50 rounded-2xl p-6 mt-8">
                                    <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center">
                                        <ShoppingBag className="w-5 h-5 mr-2 text-[#a4240e]" />
                                        Próximos Passos
                                    </h3>
                                    <ul className="space-y-3 text-gray-700">
                                        <li className="flex items-start">
                                            <ArrowRight className="w-5 h-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span>Você receberá um e-mail de confirmação em breve</span>
                                        </li>
                                        <li className="flex items-start">
                                            <ArrowRight className="w-5 h-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span>Entraremos em contato para coordenar a entrega</span>
                                        </li>
                                        <li className="flex items-start">
                                            <ArrowRight className="w-5 h-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                                            <span>Acompanhe seu pedido através do seu perfil</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-gray-600">Detalhes do pedido não disponíveis</p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="mt-8 space-y-3">
                            <button
                                onClick={goToHome}
                                className="w-full bg-[#a4240e] text-white py-4 rounded-full font-semibold hover:bg-[#8a1f0c] transition-all shadow-lg flex items-center justify-center space-x-2"
                            >
                                <Home className="w-5 h-5" />
                                <span>Voltar para a Página Inicial</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Payment Failure Page
export const PaymentFailure = () => {
    const goToHome = () => {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-6">
            <div className="max-w-2xl w-full">
                {/* Logo */}
                <div className="text-center mb-8">
                    <img
                        src={logoImage}
                        alt="Café Saporino"
                        className="h-24 w-auto mx-auto drop-shadow-lg"
                    />
                </div>

                {/* Failure Card */}
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                    {/* Header with Icon */}
                    <div className="bg-gradient-to-r from-red-500 to-red-600 px-8 py-12 text-center">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                            <X className="w-12 h-12 text-red-600" />
                        </div>
                        <h1 className="text-4xl font-bold text-white mb-3">
                            Pagamento Não Aprovado
                        </h1>
                        <p className="text-red-50 text-lg">
                            Não foi possível processar seu pagamento
                        </p>
                    </div>

                    {/* Content */}
                    <div className="px-8 py-10">
                        <div className="space-y-6">
                            {/* Possible Reasons */}
                            <div className="bg-red-50 rounded-2xl p-6 border-2 border-red-200">
                                <h3 className="font-bold text-red-900 text-lg mb-4">
                                    Possíveis Motivos
                                </h3>
                                <ul className="space-y-2 text-red-800">
                                    <li className="flex items-start">
                                        <span className="mr-2">•</span>
                                        <span>Saldo insuficiente ou limite excedido</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2">•</span>
                                        <span>Dados do cartão incorretos</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2">•</span>
                                        <span>Problemas de conexão durante o pagamento</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2">•</span>
                                        <span>Cartão bloqueado ou vencido</span>
                                    </li>
                                </ul>
                            </div>

                            {/* What to do */}
                            <div className="bg-stone-50 rounded-2xl p-6">
                                <h3 className="font-bold text-gray-900 text-lg mb-4">
                                    O que fazer agora?
                                </h3>
                                <ul className="space-y-3 text-gray-700">
                                    <li className="flex items-start">
                                        <ArrowRight className="w-5 h-5 mr-2 text-[#a4240e] flex-shrink-0 mt-0.5" />
                                        <span>Verifique seus dados bancários e tente novamente</span>
                                    </li>
                                    <li className="flex items-start">
                                        <ArrowRight className="w-5 h-5 mr-2 text-[#a4240e] flex-shrink-0 mt-0.5" />
                                        <span>Tente usar outro método de pagamento</span>
                                    </li>
                                    <li className="flex items-start">
                                        <ArrowRight className="w-5 h-5 mr-2 text-[#a4240e] flex-shrink-0 mt-0.5" />
                                        <span>Entre em contato com seu banco se o problema persistir</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Contact */}
                            <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200 text-center">
                                <p className="text-blue-900 font-semibold mb-2">Precisa de ajuda?</p>
                                <p className="text-blue-800 text-sm">
                                    Entre em contato conosco pelo WhatsApp:
                                </p>
                                <a
                                    href="https://wa.me/5519917719798"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block mt-3 text-green-600 font-bold hover:text-green-700"
                                >
                                    +55 (19) 91771-9798
                                </a>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-8 space-y-3">
                            <button
                                onClick={goToHome}
                                className="w-full bg-[#a4240e] text-white py-4 rounded-full font-semibold hover:bg-[#8a1f0c] transition-all shadow-lg flex items-center justify-center space-x-2"
                            >
                                <Home className="w-5 h-5" />
                                <span>Voltar para a Página Inicial</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Payment Pending Page
export const PaymentPending = () => {
    const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadOrderDetails();
    }, []);

    const loadOrderDetails = async () => {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const externalReference = urlParams.get('external_reference');
            const paymentId = urlParams.get('payment_id');

            if (externalReference) {
                // Update order status to pending
                const { data, error } = await supabase
                    .from('orders')
                    .update({
                        status: 'in_process',
                        mercadopago_payment_id: paymentId,
                    })
                    .eq('id', externalReference)
                    .select()
                    .single();

                if (error) throw error;
                setOrderDetails(data);
            }
        } catch (error) {
            console.error('Error loading order details:', error);
        } finally {
            setLoading(false);
        }
    };

    const goToHome = () => {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-white flex items-center justify-center p-6">
            <div className="max-w-2xl w-full">
                {/* Logo */}
                <div className="text-center mb-8">
                    <img
                        src={logoImage}
                        alt="Café Saporino"
                        className="h-24 w-auto mx-auto drop-shadow-lg"
                    />
                </div>

                {/* Pending Card */}
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                    {/* Header with Icon */}
                    <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 px-8 py-12 text-center">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                            <Clock className="w-12 h-12 text-yellow-600" />
                        </div>
                        <h1 className="text-4xl font-bold text-white mb-3">
                            Pagamento Pendente
                        </h1>
                        <p className="text-yellow-50 text-lg">
                            Aguardando confirmação do pagamento
                        </p>
                    </div>

                    {/* Content */}
                    <div className="px-8 py-10">
                        {loading ? (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-yellow-600 mx-auto"></div>
                                <p className="text-gray-600 mt-4">Carregando detalhes do pedido...</p>
                            </div>
                        ) : orderDetails ? (
                            <div className="space-y-6">
                                {/* Order Number */}
                                <div className="bg-yellow-50 rounded-2xl p-6 text-center border-2 border-yellow-200">
                                    <p className="text-sm text-yellow-700 font-semibold mb-2">
                                        Número do Pedido
                                    </p>
                                    <p className="text-3xl font-bold text-yellow-900">
                                        {orderDetails.order_number}
                                    </p>
                                </div>

                                {/* Instructions */}
                                <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200">
                                    <h3 className="font-bold text-blue-900 text-lg mb-4">
                                        Sobre Pagamentos Pendentes
                                    </h3>
                                    <p className="text-blue-800 mb-4">
                                        Seu pedido foi criado com sucesso! Pagamentos via <strong>PIX</strong> ou <strong>Boleto</strong> podem levar algumas horas para serem confirmados.
                                    </p>
                                    <ul className="space-y-2 text-blue-800">
                                        <li className="flex items-start">
                                            <span className="mr-2">•</span>
                                            <span><strong>PIX:</strong> Confirmação em até 1 hora</span>
                                        </li>
                                        <li className="flex items-start">
                                            <span className="mr-2">•</span>
                                            <span><strong>Boleto:</strong> Confirmação em até 2 dias úteis</span>
                                        </li>
                                    </ul>
                                </div>

                                {/* What happens next */}
                                <div className="bg-stone-50 rounded-2xl p-6">
                                    <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center">
                                        <ShoppingBag className="w-5 h-5 mr-2 text-[#a4240e]" />
                                        O que acontece agora?
                                    </h3>
                                    <ul className="space-y-3 text-gray-700">
                                        <li className="flex items-start">
                                            <ArrowRight className="w-5 h-5 mr-2 text-yellow-600 flex-shrink-0 mt-0.5" />
                                            <span>Você receberá um e-mail assim que o pagamento for confirmado</span>
                                        </li>
                                        <li className="flex items-start">
                                            <ArrowRight className="w-5 h-5 mr-2 text-yellow-600 flex-shrink-0 mt-0.5" />
                                            <span>Seu pedido será processado após a confirmação</span>
                                        </li>
                                        <li className="flex items-start">
                                            <ArrowRight className="w-5 h-5 mr-2 text-yellow-600 flex-shrink-0 mt-0.5" />
                                            <span>Entraremos em contato para coordenar a entrega</span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Contact */}
                                <div className="bg-green-50 rounded-2xl p-6 border-2 border-green-200 text-center">
                                    <p className="text-green-900 font-semibold mb-2">Dúvidas?</p>
                                    <p className="text-green-800 text-sm mb-3">
                                        Entre em contato conosco pelo WhatsApp
                                    </p>
                                    <a
                                        href="https://wa.me/5519917719798"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block text-green-600 font-bold hover:text-green-700"
                                    >
                                        +55 (19) 91771-9798
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-gray-600">Detalhes do pedido não disponíveis</p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="mt-8 space-y-3">
                            <button
                                onClick={goToHome}
                                className="w-full bg-[#a4240e] text-white py-4 rounded-full font-semibold hover:bg-[#8a1f0c] transition-all shadow-lg flex items-center justify-center space-x-2"
                            >
                                <Home className="w-5 h-5" />
                                <span>Voltar para a Página Inicial</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
