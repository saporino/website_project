import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { mapMpStatus, decideOrderUpdate, buildManifest } from '../_shared/mpWebhook.ts';
import { logEdge, newRequestId } from '../_shared/log.ts';

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-signature, x-request-id",
};

const FN = 'mercadopago-webhook';
const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

interface MercadoPagoWebhookData {
    id: string;
    live_mode: boolean;
    type: string;
    date_created: string;
    user_id: string;
    api_version: string;
    action: string;
    data: {
        id: string;
    };
}

// Verify the Mercado Pago webhook signature
async function verifyMPSignature(
    req: Request,
    body: string,
    secret: string
): Promise<boolean> {
    try {
        const xSignature = req.headers.get('x-signature');
        const xRequestId = req.headers.get('x-request-id');

        // A missing signature must be REJECTED, not allowed. (Fase 0 / P0 fix:
        // this previously returned true "for testing", leaving the webhook open.)
        if (!xSignature) {
            console.error('Missing x-signature header — rejecting webhook');
            return false;
        }

        // Parse the signature header: ts=TIMESTAMP,v1=HASH
        const parts: Record<string, string> = {};
        xSignature.split(',').forEach(part => {
            const [key, value] = part.split('=');
            if (key && value) parts[key.trim()] = value.trim();
        });

        const ts = parts['ts'];
        const v1 = parts['v1'];

        if (!ts || !v1) return false;

        // Timestamp: defesa ADICIONAL contra replay, mas NUNCA descarta um
        // pagamento legítimo por atraso/retry. A autenticidade vem da assinatura
        // e a duplicidade é tratada por idempotência/no-regression. Fora da janela
        // → apenas aviso (não rejeita). (Prioridade: não perder pagamento.)
        const tsMs = Number(ts) * 1000;
        if (!Number.isFinite(tsMs)) return false;
        if (Math.abs(Date.now() - tsMs) > 10 * 60 * 1000) {
            console.warn('Webhook timestamp outside 10min window (allowed; dedup via idempotency)');
        }

        // Parse the data.id from body
        let dataId = '';
        try {
            const parsed = JSON.parse(body);
            dataId = parsed?.data?.id || '';
        } catch (_) {
            // ignore
        }

        const manifest = buildManifest(dataId, xRequestId || '', ts);

        // Compute HMAC-SHA256
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const cryptoKey = await crypto.subtle.importKey(
            'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(manifest));
        const hashHex = Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0')).join('');

        return hashHex === v1;
    } catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    const rid = newRequestId(req);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // Read body as text for signature verification
        const bodyText = await req.text();

        // The webhook secret is REQUIRED. If it is not configured we fail closed
        // (do not process unverified notifications). (Fase 0 / P0 fix.)
        const webhookSecret = Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET');
        if (!webhookSecret) {
            console.error('MERCADO_PAGO_WEBHOOK_SECRET not configured — rejecting webhook');
            return new Response(
                JSON.stringify({ error: 'Webhook not configured' }),
                { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
        const isValid = await verifyMPSignature(req, bodyText, webhookSecret);
        if (!isValid) {
            console.error('Invalid webhook signature — request rejected');
            return new Response(
                JSON.stringify({ error: 'Invalid signature' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Parse webhook data
        const webhookData: MercadoPagoWebhookData = JSON.parse(bodyText);
        console.log('Webhook received:', JSON.stringify(webhookData, null, 2));

        // We only care about payment notifications
        if (webhookData.type !== 'payment') {
            return new Response(
                JSON.stringify({ message: 'Not a payment notification, ignoring' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const paymentId = webhookData.data.id;

        // Get Mercado Pago Access Token — degrade gracefully to the env secret
        // if admin_settings is missing/errors (same P0 fix as create-payment).
        let dbAccessToken: string | null = null;
        const { data: settings, error: settingsError } = await supabase
            .from('admin_settings')
            .select('mercado_pago_access_token')
            .maybeSingle();

        if (settingsError) {
            console.error('Could not read admin_settings, falling back to env secret:', settingsError.message);
        } else {
            dbAccessToken = settings?.mercado_pago_access_token ?? null;
        }

        const accessToken = dbAccessToken || Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');

        if (!accessToken) {
            throw new Error('Mercado Pago Access Token not configured');
        }

        // Get payment details from Mercado Pago API
        const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!paymentResponse.ok) {
            const error = await paymentResponse.text();
            console.error('Mercado Pago API error:', error);
            throw new Error(`Failed to get payment details: ${paymentResponse.statusText}`);
        }

        const paymentData = await paymentResponse.json();
        console.log('Payment data:', JSON.stringify(paymentData, null, 2));

        const externalReference = paymentData.external_reference;
        const status = paymentData.status;
        const paymentMethodId = paymentData.payment_method_id;

        const orderStatus = mapMpStatus(status);

        // Ler o pedido atual e decidir a atualização (idempotência / no-regression).
        const { data: currentOrder, error: currentErr } = await supabase
            .from('orders')
            .select('status, paid_at')
            .eq('id', externalReference)
            .maybeSingle();

        if (currentErr) throw currentErr;
        if (!currentOrder) {
            await logEdge(supabase, { function_name: FN, request_id: rid, level: 'warn', status: 200, error_text: 'order not found', meta: { ext: externalReference } });
            return json({ message: 'Order not found, ignoring', orderId: externalReference }, 200);
        }

        const decision = decideOrderUpdate(currentOrder, orderStatus);
        if (!decision.apply) {
            await logEdge(supabase, { function_name: FN, request_id: rid, level: 'info', status: 200, meta: { ext: externalReference, skipped: decision.reason } });
            return json({ message: 'Ignored (no-regression)', orderId: externalReference, status: currentOrder.status }, 200);
        }

        const updatePayload: Record<string, unknown> = {
            status: orderStatus,
            mercadopago_payment_id: paymentId,
            mercadopago_collection_id: paymentData.collection_id,
            mercadopago_collection_status: status,
            payment_method: paymentMethodId,
        };
        if (decision.setPaidAt) updatePayload.paid_at = new Date().toISOString();

        const { error: orderError } = await supabase
            .from('orders')
            .update(updatePayload)
            .eq('id', externalReference)
            .select()
            .single();

        if (orderError) throw orderError;

        await logEdge(supabase, { function_name: FN, request_id: rid, level: 'info', status: 200, meta: { ext: externalReference, status: orderStatus } });
        return json({ message: 'Webhook processed successfully', orderId: externalReference, status: orderStatus }, 200);

    } catch (error) {
        await logEdge(supabase, { function_name: FN, request_id: rid, level: 'error', status: 500, error_text: (error as Error).message });
        return json({ error: 'Erro interno no webhook' }, 500);
    }
});
