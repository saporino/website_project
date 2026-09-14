-- BASELINE DE ESTRUTURA — gerada por scripts/staging/gerar-baseline.mjs
-- Origem: produção (rsvoazrkxtdrcjnatzcm), SOMENTE ESTRUTURA. Nenhum dado, nenhum job do pg_cron, nenhum segredo.
-- Equivale ao estado de produção depois da migration 20260913140000.
-- Não editar à mão: regenerar pelo script. Mudanças novas vão em supabase/migrations/.
-- Contagem: {"extensoes":4,"sequencias":5,"tabelas":141,"colunas":2100,"funcoes":120,"views":43,"constraints":531,"indices":195,"triggers":36,"policies":334,"buckets":12,"realtime":11}

set check_function_bodies = off;
set search_path = public, extensions;

-- Extensões
create extension if not exists "pg_cron";
create extension if not exists "pg_net";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Sequências
create sequence if not exists public."batch_number_seq" as bigint increment 1 minvalue 1 maxvalue 9223372036854775807 start 1;
create sequence if not exists public."promoter_audit_log_id_seq" as bigint increment 1 minvalue 1 maxvalue 9223372036854775807 start 1;
create sequence if not exists public."promoter_visit_locations_id_seq" as bigint increment 1 minvalue 1 maxvalue 9223372036854775807 start 1;
create sequence if not exists public."repco_order_seq" as bigint increment 1 minvalue 1 maxvalue 9223372036854775807 start 1;
create sequence if not exists public."shipping_coverage_id_seq" as bigint increment 1 minvalue 1 maxvalue 9223372036854775807 start 1;

-- Tabelas (defaults vêm depois das funções)
create table if not exists public."admin_settings" (
  "id" uuid not null,
  "store_name" text not null,
  "store_cnpj" text,
  "store_email" text,
  "store_phone" text,
  "sender_name" text not null,
  "sender_street" text,
  "sender_number" text,
  "sender_complement" text,
  "sender_neighborhood" text,
  "sender_city" text,
  "sender_state" text,
  "sender_cep" text,
  "mercado_pago_access_token" text,
  "mercado_pago_public_key" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);
create table if not exists public."ai_usage_events" (
  "id" uuid not null,
  "created_at" timestamp with time zone not null,
  "company_id" uuid,
  "user_id" uuid,
  "operation" text not null,
  "provider" text not null,
  "model" text not null,
  "prompt_version" text,
  "input_tokens" integer,
  "output_tokens" integer,
  "cached_tokens" integer,
  "audio_seconds" numeric(10,2),
  "image_count" integer,
  "quality" text,
  "width" integer,
  "height" integer,
  "cost_usd" numeric(12,6),
  "fx_rate" numeric(10,4),
  "cost_brl" numeric(12,4),
  "request_id" text,
  "subject_type" text,
  "subject_id" uuid,
  "status" text not null,
  "error_text" text,
  "duration_ms" integer,
  "input_text_tokens" integer,
  "input_image_tokens" integer,
  "organization_id" uuid
);
create table if not exists public."b2b_leads" (
  "id" uuid not null,
  "nome" text,
  "empresa" text,
  "telefone" text,
  "email" text,
  "site" text,
  "redes_sociais" text,
  "cidade" text,
  "uf" text,
  "descricao" text,
  "tipos_cafe" text[],
  "formato" text,
  "torras" text[],
  "grao_tipo" text,
  "volume_valor" numeric,
  "volume_unidade" text,
  "embalagens" text[],
  "consent_lgpd" boolean not null,
  "status" text not null,
  "converted_client_id" uuid,
  "notes" text,
  "created_at" timestamp with time zone not null,
  "modalidade" text,
  "num_pessoas" integer
);
create table if not exists public."batch_photos" (
  "id" uuid not null,
  "batch_id" uuid,
  "photo_url" text not null,
  "photo_type" text,
  "caption" text,
  "taken_at" timestamp with time zone,
  "uploaded_by" uuid,
  "company_id" uuid
);
create table if not exists public."candidaturas_representante" (
  "id" uuid not null,
  "nome_completo" text not null,
  "whatsapp" text,
  "cidade_regiao" text,
  "experiencia" text,
  "carteira_ativa" boolean,
  "clientes_aprox" text,
  "canais" text[],
  "situacao_cadastral" text,
  "marcas_atuais" text,
  "ciente_condicoes" boolean not null,
  "status" text not null,
  "obs_admin" text,
  "created_at" timestamp with time zone not null
);
create table if not exists public."chat_conversations" (
  "id" uuid not null,
  "type" text not null,
  "name" text,
  "avatar_url" text,
  "created_by" uuid,
  "created_at" timestamp with time zone,
  "last_message_at" timestamp with time zone,
  "last_message_preview" text,
  "company_id" uuid,
  "context_type" text,
  "context_id" uuid,
  "product_id" uuid
);
create table if not exists public."chat_messages" (
  "id" uuid not null,
  "conversation_id" uuid,
  "sender_id" uuid not null,
  "body" text,
  "attachment_url" text,
  "attachment_type" text,
  "attachment_name" text,
  "attachment_size" integer,
  "created_at" timestamp with time zone
);
create table if not exists public."chat_participants" (
  "conversation_id" uuid not null,
  "user_id" uuid not null,
  "role" text,
  "last_read_at" timestamp with time zone,
  "joined_at" timestamp with time zone
);
create table if not exists public."coffee_bebida_scale" (
  "code" text not null,
  "label" text not null,
  "ordinal" integer not null
);
create table if not exists public."coffee_market_index" (
  "id" bigint generated always as identity not null,
  "ref_date" date not null,
  "arabica" numeric(10,2),
  "conilon" numeric(10,2),
  "source" text,
  "note" text,
  "created_at" timestamp with time zone not null,
  "arabica_var" numeric(6,2),
  "conilon_var" numeric(6,2)
);
create table if not exists public."coffee_matches" (
  "id" uuid not null,
  "offer_id" uuid not null,
  "request_id" uuid not null,
  "score" numeric(5,2) not null,
  "factors" jsonb not null,
  "status" text not null,
  "computed_at" timestamp with time zone not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."coffee_offer_photos" (
  "id" uuid not null,
  "offer_id" uuid not null,
  "storage_path" text not null,
  "kind" text,
  "moderation_status" text not null,
  "moderation_note" text,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "uploaded_by" uuid,
  "created_at" timestamp with time zone not null
);
create table if not exists public."coffee_offers" (
  "id" uuid not null,
  "entity_id" uuid not null,
  "property_id" uuid,
  "species" text not null,
  "harvest_year" integer,
  "quantity_bags" numeric(10,2) not null,
  "bag_weight_kg" numeric(6,2) not null,
  "bebida" text,
  "screen_min" integer,
  "screen_note" text,
  "process" text,
  "moisture_pct" numeric(4,1),
  "defect_type" integer,
  "sca_score" numeric(4,1),
  "certifications" text[] not null,
  "sensory_notes" text,
  "asking_price_brl_bag" numeric(12,2),
  "price_note" text,
  "origin_municipio" text,
  "origin_uf" text,
  "region_label" text,
  "available_from" date,
  "available_until" date,
  "status" text not null,
  "exclusive_until" timestamp with time zone,
  "published_at" timestamp with time zone,
  "sold_externally" boolean not null,
  "sold_at" timestamp with time zone,
  "sold_note" text,
  "moderation_note" text,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."coffee_pilot_cases" (
  "id" uuid not null,
  "codigo" text,
  "data_inicio" date not null,
  "produtor_entity_id" uuid,
  "comprador_entity_id" uuid,
  "offer_id" uuid,
  "request_id" uuid,
  "match_id" uuid,
  "match_score" numeric(5,2),
  "cadastro_em" timestamp with time zone,
  "oferta_ativa_em" timestamp with time zone,
  "primeiro_match_em" timestamp with time zone,
  "minutos_ate_oferta_ativa" integer,
  "minutos_ate_primeiro_match" integer,
  "matches_gerados" integer,
  "tempo_cofico_minutos" integer,
  "amostra_solicitada" boolean,
  "proposta_feita" boolean,
  "houve_negociacao" boolean,
  "fechou" boolean,
  "motivo_perda" text,
  "volume_sacas" numeric(10,2),
  "valor_potencial_brl" numeric(14,2),
  "resultado" text,
  "ajuste_manual_necessario" text,
  "campos_que_faltaram" text,
  "campos_que_sobraram" text,
  "feedback_produtor" text,
  "feedback_comprador" text,
  "aprendizado" text,
  "autoriza_divulgacao" boolean not null,
  "divulgacao_anonimizada" boolean not null,
  "observacoes_internas" text,
  "created_by" uuid,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."coffee_purchase_requests" (
  "id" uuid not null,
  "entity_id" uuid not null,
  "species" text not null,
  "harvest_year" integer,
  "quantity_bags" numeric(10,2) not null,
  "bebida_min" text,
  "screen_min" integer,
  "process_accepted" text[] not null,
  "moisture_max" numeric(4,1),
  "defect_type_max" integer,
  "sca_min" numeric(4,1),
  "sensory_notes" text,
  "certifications_required" text[] not null,
  "target_price_min" numeric(12,2),
  "target_price_max" numeric(12,2),
  "origin_uf" text,
  "origin_region_label" text,
  "destination_uf" text,
  "destination_municipio" text,
  "delivery_window_start" date,
  "delivery_window_end" date,
  "freight_terms" text,
  "sample_required" boolean not null,
  "notes" text,
  "status" text not null,
  "created_by" uuid,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."commercial_accounts" (
  "id" uuid not null,
  "entity_id" uuid not null,
  "company_id" uuid not null,
  "relationship_type" text not null,
  "status" text not null,
  "price_segment" text,
  "payment_method" text,
  "payment_term" text,
  "credit_limit" numeric(12,2),
  "credit_score" integer,
  "discount_pct" numeric(5,2),
  "bonificacao_padrao" numeric(12,2),
  "commission_override_pct" numeric(5,2),
  "assigned_representative_id" uuid,
  "confidential_notes" text,
  "representative_client_id" uuid,
  "opened_at" timestamp with time zone not null,
  "opened_by" uuid,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."companies" (
  "id" uuid not null,
  "name" text not null,
  "cnpj" text,
  "created_at" timestamp with time zone not null,
  "fantasia" text,
  "logo_url" text,
  "endereco" text,
  "cidade" text,
  "uf" text,
  "cep" text,
  "is_active" boolean not null,
  "sort_order" integer,
  "commission_model" text not null,
  "allow_cash" boolean not null,
  "is_b2c" boolean not null,
  "order_prefix" text,
  "is_operator" boolean not null,
  "studio_enabled" boolean not null,
  "payment_account" text,
  "pickup_hours" text,
  "notify_email" text,
  "shipping_subsidy_per_kg" numeric(10,2) not null,
  "shipping_discount_active" boolean not null,
  "shipping_discount_unit" text not null,
  "shipping_discount_min_packs" integer not null,
  "shipping_discount_max" numeric(10,2) not null
);
create table if not exists public."company_order_counters" (
  "company_id" uuid not null,
  "last_number" integer not null
);
create table if not exists public."coupon_redemptions" (
  "id" uuid not null,
  "coupon_id" uuid not null,
  "order_id" uuid not null,
  "cpf" text,
  "amount" numeric(10,2) not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."coupons" (
  "id" uuid not null,
  "company_id" uuid,
  "code" text not null,
  "description" text,
  "kind" text not null,
  "amount" numeric(10,2) not null,
  "min_subtotal" numeric(10,2) not null,
  "first_purchase_only" boolean not null,
  "max_uses" integer,
  "uses" integer not null,
  "starts_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "is_active" boolean not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."delivery_dispatch_audit" (
  "id" uuid not null,
  "order_id" uuid,
  "changed_by" uuid,
  "field" text,
  "old_value" text,
  "new_value" text,
  "note" text,
  "created_at" timestamp with time zone not null
);
create table if not exists public."delivery_routes" (
  "id" uuid not null,
  "driver_id" uuid,
  "scheduled_date" date,
  "status" text not null,
  "origin_label" text not null,
  "origin_lat" double precision,
  "origin_lng" double precision,
  "total_stops" integer,
  "total_km" numeric,
  "total_weight_kg" numeric,
  "planned_by" uuid,
  "planned_at" timestamp with time zone,
  "dispatched_at" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."delivery_stops" (
  "id" uuid not null,
  "route_id" uuid,
  "order_id" uuid,
  "company_id" uuid,
  "stop_order" integer,
  "client_name" text,
  "address" text,
  "city" text,
  "zone" text,
  "lat" double precision,
  "lng" double precision,
  "weight_kg" numeric,
  "distance_from_cd_km" numeric,
  "point_type" text not null,
  "scheduled_window" text,
  "status" text not null,
  "pickup_photo_url" text,
  "delivery_photo_url" text,
  "canhoto_photo_url" text,
  "delivered_at" timestamp with time zone,
  "delivered_lat" double precision,
  "delivered_lng" double precision,
  "arrival_at" timestamp with time zone,
  "departure_at" timestamp with time zone,
  "failure_reason" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."discovery_campaigns" (
  "id" uuid not null,
  "name" text not null,
  "country" text not null,
  "region_state" text,
  "region_city" text,
  "sources" text[] not null,
  "keywords" text[] not null,
  "company_id" uuid,
  "created_by" uuid,
  "created_at" timestamp with time zone not null,
  "objectives" text[] not null,
  "product_ref" text,
  "budget_usd" numeric(10,2)
);
create table if not exists public."discovery_keywords" (
  "id" uuid not null,
  "term" text not null,
  "group_name" text,
  "segment" text,
  "sources" text[] not null,
  "active" boolean not null,
  "company_id" uuid,
  "created_by" uuid,
  "created_at" timestamp with time zone not null
);
create table if not exists public."discovery_results" (
  "id" uuid not null,
  "campaign_id" uuid,
  "run_id" uuid,
  "source" text not null,
  "result_type" text not null,
  "title" text,
  "description" text,
  "public_url" text,
  "keyword" text,
  "country" text,
  "state" text,
  "city" text,
  "external_id" text,
  "canonical_url" text,
  "member_count" integer,
  "provider" text,
  "actor_id" text,
  "raw_payload" jsonb,
  "score" integer,
  "score_factors" jsonb,
  "status" text not null,
  "converted_prospect_lead_id" uuid,
  "discovered_at" timestamp with time zone not null,
  "last_checked_at" timestamp with time zone,
  "company_id" uuid,
  "created_by" uuid,
  "created_at" timestamp with time zone not null,
  "follower_count" integer,
  "engagement_rate" numeric(6,3),
  "niche" text,
  "confidence" integer
);
create table if not exists public."distributed_brands" (
  "id" uuid not null,
  "name" text not null,
  "url" text,
  "sort_order" integer,
  "is_active" boolean not null,
  "created_at" timestamp with time zone
);
create table if not exists public."driver_documents" (
  "id" uuid not null,
  "driver_id" uuid,
  "tipo" text not null,
  "numero" text,
  "validade" date,
  "doc_path" text,
  "doc_name" text,
  "created_at" timestamp with time zone not null
);
create table if not exists public."drivers" (
  "id" uuid not null,
  "user_id" uuid,
  "full_name" text not null,
  "cpf" text,
  "cnh" text,
  "cnh_categoria" text,
  "cnh_validade" date,
  "phone" text,
  "email" text,
  "company_id" uuid,
  "vehicle_desc" text,
  "vehicle_plate" text,
  "status" text not null,
  "blocked_reason" text,
  "approved_at" timestamp with time zone,
  "notes" text,
  "last_seen_at" timestamp with time zone,
  "last_lat" double precision,
  "last_lng" double precision,
  "is_online" boolean not null,
  "current_tab" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "driver_type" text not null
);
create table if not exists public."ecommerce_price_snapshots" (
  "id" bigint generated always as identity not null,
  "company_id" uuid not null,
  "captured_at" timestamp with time zone not null,
  "marketplace" text not null,
  "search_term" text,
  "listing_sku" text not null,
  "title" text not null,
  "thumb_url" text,
  "url" text,
  "domain_id" text,
  "price" numeric(12,2) not null,
  "price_before" numeric(12,2),
  "discount_pct" integer,
  "currency" text,
  "search_position" integer,
  "is_sponsored" boolean,
  "weight_g" numeric(10,2),
  "unit_type" text,
  "is_arabica" boolean,
  "price_per_kg" numeric(12,2),
  "is_suspect" boolean,
  "raw" jsonb not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."ecommerce_sources" (
  "marketplace" text not null,
  "label" text not null,
  "actor_id" text,
  "default_input" jsonb,
  "enabled" boolean not null,
  "updated_at" timestamp with time zone not null,
  "kind" text not null,
  "visible_to_reps" boolean not null,
  "sort_order" integer not null
);
create table if not exists public."edge_logs" (
  "id" uuid not null,
  "ts" timestamp with time zone not null,
  "function_name" text not null,
  "request_id" text,
  "level" text not null,
  "status" integer,
  "duration_ms" integer,
  "error_text" text,
  "meta" jsonb
);
create table if not exists public."edge_rate_limits" (
  "bucket_key" text not null,
  "window_start" timestamp with time zone not null,
  "count" integer not null
);
create table if not exists public."fleet_documents" (
  "id" uuid not null,
  "vehicle_id" uuid,
  "tipo" text not null,
  "validade" date,
  "doc_path" text,
  "doc_name" text,
  "created_at" timestamp with time zone not null
);
create table if not exists public."fleet_maintenance" (
  "id" uuid not null,
  "vehicle_id" uuid,
  "tipo" text not null,
  "data" date,
  "km" numeric,
  "custo" numeric,
  "obs" text,
  "doc_path" text,
  "doc_name" text,
  "created_at" timestamp with time zone not null
);
create table if not exists public."fleet_vehicles" (
  "id" uuid not null,
  "company_id" uuid,
  "tipo" text not null,
  "placa" text,
  "renavam" text,
  "marca" text,
  "modelo" text,
  "ano" integer,
  "cor" text,
  "km_atual" numeric,
  "crlv_validade" date,
  "seguradora" text,
  "apolice" text,
  "seguro_validade" date,
  "licenciamento_validade" date,
  "tacografo_validade" date,
  "antt_rntrc" text,
  "oleo_ultima_data" date,
  "oleo_ultimo_km" numeric,
  "oleo_proximo_km" numeric,
  "status" text not null,
  "notes" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "owner_driver_id" uuid
);
create table if not exists public."green_coffee_lots" (
  "id" uuid not null,
  "batch_number" text not null,
  "product_id" uuid,
  "product_name" text,
  "status" text not null,
  "supplier_name" text,
  "supplier_city" text,
  "supplier_state" text,
  "variety" text,
  "altitude_meters" integer,
  "supplier_certifications" text[],
  "green_weight_kg" numeric not null,
  "green_cost_per_kg" numeric not null,
  "green_total_cost" numeric generated always as ((green_weight_kg * green_cost_per_kg)) stored,
  "roast_date" date,
  "roasted_by" text,
  "roasted_weight_kg" numeric,
  "roast_loss_pct" numeric generated always as (
CASE
    WHEN ((green_weight_kg > (0)::numeric) AND (roasted_weight_kg IS NOT NULL)) THEN round((((green_weight_kg - roasted_weight_kg) / green_weight_kg) * (100)::numeric), 2)
    ELSE (0)::numeric
END) stored,
  "roast_cost" numeric,
  "roast_profile" text,
  "roast_temperature" numeric,
  "roast_duration_minutes" integer,
  "pkg_cost_250g" numeric,
  "pkg_cost_500g" numeric,
  "pkg_cost_1kg" numeric,
  "pkg_cost_fardo5kg" numeric,
  "label_cost_per_unit" numeric,
  "plastic_wrap_cost_per_unit" numeric,
  "fuel_cost" numeric,
  "toll_cost" numeric,
  "hotel_cost" numeric,
  "food_cost" numeric,
  "other_costs" jsonb,
  "samples_given_units" integer,
  "samples_unit_size_g" integer,
  "bonus_given_units" integer,
  "bonus_unit_size_g" integer,
  "total_variable_cost" numeric,
  "total_bonus_cost" numeric,
  "cost_per_100g" numeric,
  "cost_per_250g" numeric,
  "cost_per_500g" numeric,
  "cost_per_1kg" numeric,
  "cost_per_fardo5kg" numeric,
  "units_produced_250g" integer,
  "units_produced_500g" integer,
  "units_produced_1kg" integer,
  "units_produced_fardo5kg" integer,
  "production_date" date,
  "expiry_date" date,
  "nf_purchase_url" text,
  "supplier_certificate_url" text,
  "quality_report_url" text,
  "sensory_notes" text,
  "sca_score" numeric,
  "photo_urls" text[],
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "created_by" uuid,
  "roasting_company_id" uuid,
  "farm_name" text,
  "farm_city" text,
  "farm_state" text,
  "altitude_m" integer,
  "quantity_packages" integer,
  "nf_url" text,
  "notes" text,
  "ap_percentage" numeric(5,2),
  "price_per_point" numeric(10,2),
  "total_paid_brl" numeric(12,2),
  "logistics_cost_brl" numeric(12,2),
  "logistics_breakdown" jsonb,
  "green_input_to_roast_kg" numeric(10,3),
  "service_price_per_kg" numeric(10,2),
  "roasted_output_kg" numeric(10,3),
  "packaged_kg" numeric(10,3),
  "packaging_cost_per_kg" numeric(10,2),
  "packaging_date" date,
  "cost_per_kg_verde_puro" numeric(10,4) generated always as (
CASE
    WHEN ((green_weight_kg > (0)::numeric) AND (total_paid_brl IS NOT NULL)) THEN round((total_paid_brl / green_weight_kg), 4)
    ELSE NULL::numeric
END) stored,
  "cost_per_kg_verde_efetivo" numeric(10,4) generated always as (
CASE
    WHEN ((green_weight_kg > (0)::numeric) AND (total_paid_brl IS NOT NULL)) THEN round(((total_paid_brl + COALESCE(logistics_cost_brl, (0)::numeric)) / green_weight_kg), 4)
    ELSE NULL::numeric
END) stored,
  "shrinkage_pct" numeric(5,2) generated always as (
CASE
    WHEN ((green_input_to_roast_kg > (0)::numeric) AND (roasted_output_kg IS NOT NULL)) THEN round((((green_input_to_roast_kg - roasted_output_kg) / green_input_to_roast_kg) * (100)::numeric), 2)
    ELSE NULL::numeric
END) stored,
  "service_total_cost_brl" numeric(12,2) generated always as (
CASE
    WHEN ((green_input_to_roast_kg > (0)::numeric) AND (service_price_per_kg IS NOT NULL)) THEN round((green_input_to_roast_kg * service_price_per_kg), 2)
    ELSE NULL::numeric
END) stored,
  "sobra_torrado_kg" numeric(10,3) generated always as (
CASE
    WHEN ((roasted_output_kg IS NOT NULL) AND (packaged_kg IS NOT NULL)) THEN round((roasted_output_kg - packaged_kg), 3)
    ELSE NULL::numeric
END) stored,
  "green_remaining_kg" numeric(10,3) generated always as (
CASE
    WHEN (green_weight_kg IS NOT NULL) THEN round((green_weight_kg - COALESCE(green_input_to_roast_kg, (0)::numeric)), 3)
    ELSE NULL::numeric
END) stored,
  "company_id" uuid
);
create table if not exists public."ibge_municipios" (
  "codigo_ibge" text not null,
  "uf" text not null,
  "nome" text not null,
  "nome_norm" text not null,
  "lat" double precision,
  "lng" double precision
);
create table if not exists public."invoices" (
  "id" uuid not null,
  "order_id" uuid,
  "invoice_number" text not null,
  "invoice_series" text not null,
  "invoice_key" text not null,
  "invoice_total" numeric(12,2) not null,
  "invoice_xml_url" text,
  "invoice_pdf_url" text,
  "status" text,
  "created_at" timestamp with time zone
);
create table if not exists public."lead_rf_candidates" (
  "id" uuid not null,
  "lead_id" uuid not null,
  "rf_cnpj" text not null,
  "rf_razao" text,
  "rf_fantasia" text,
  "rf_bairro" text,
  "rf_municipio" text,
  "rf_uf" text,
  "score" numeric(4,3),
  "reason" text,
  "status" text not null,
  "created_at" timestamp with time zone not null,
  "resolved_at" timestamp with time zone
);
create table if not exists public."lot_documents" (
  "id" uuid not null,
  "lot_id" uuid not null,
  "kind" text not null,
  "storage_path" text not null,
  "file_name" text,
  "uploaded_at" timestamp with time zone,
  "company_id" uuid
);
create table if not exists public."lot_transfers" (
  "id" uuid not null,
  "from_lot_id" uuid not null,
  "to_lot_id" uuid not null,
  "kind" text not null,
  "kg_amount" numeric(10,3) not null,
  "unit_cost_brl" numeric(12,4) not null,
  "value_amount_brl" numeric(12,2) generated always as (round((kg_amount * unit_cost_brl), 2)) stored,
  "transferred_at" timestamp with time zone not null,
  "notes" text,
  "company_id" uuid
);
create table if not exists public."lv_attributes" (
  "id" uuid not null,
  "chave" text not null,
  "rotulo" text not null,
  "tipo" text not null,
  "unidade" text,
  "opcoes" jsonb not null,
  "no_passport" boolean not null,
  "filtravel" boolean not null,
  "ordem" integer not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."lv_b2b_empresas" (
  "id" uuid not null,
  "nome" text not null,
  "cnpj" text,
  "cidade" text,
  "uf" character(2),
  "tipo_negocio" text not null,
  "responsavel" text,
  "email" text,
  "telefone" text,
  "is_demo" boolean not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."lv_b2b_solicitacoes" (
  "id" uuid not null,
  "empresa_id" uuid not null,
  "classificacao" text,
  "gramatura_g" integer,
  "moagem" text,
  "consumo_mensal_kg" integer,
  "quantidade_kg" integer not null,
  "frequencia" text not null,
  "observacao" text,
  "status" text not null,
  "nota_interna" text,
  "is_demo" boolean not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."lv_categories" (
  "id" uuid not null,
  "parent_id" uuid,
  "slug" text not null,
  "nome" text not null,
  "icone" text,
  "ordem" integer not null,
  "ativa" boolean not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."lv_category_attributes" (
  "category_id" uuid not null,
  "attribute_id" uuid not null,
  "obrigatorio" boolean not null,
  "ordem" integer not null
);
create table if not exists public."lv_demo_access" (
  "id" uuid not null,
  "label" text not null,
  "code_hash" text not null,
  "ativo" boolean not null,
  "expires_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  "uses" integer not null,
  "created_at" timestamp with time zone not null,
  "created_by" uuid
);
create table if not exists public."lv_inventory_lots" (
  "id" uuid not null,
  "product_id" uuid not null,
  "seller_id" uuid not null,
  "lote" text,
  "validade" date,
  "entrada_em" date,
  "qtd_disponivel" integer not null,
  "qtd_reservada" integer not null,
  "is_demo" boolean not null,
  "created_at" timestamp with time zone not null,
  "variant_id" uuid not null,
  "data_torra" date,
  "safra" text
);
create table if not exists public."lv_plans" (
  "id" uuid not null,
  "slug" text not null,
  "nome" text not null,
  "chamada" text,
  "mensalidade_cents" bigint not null,
  "comissao_bps" integer,
  "destaques" jsonb not null,
  "limite_produtos" integer,
  "ordem" integer not null,
  "ativo" boolean not null,
  "em_estudo" boolean not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."lv_price_history" (
  "id" uuid not null,
  "product_id" uuid not null,
  "seller_id" uuid not null,
  "preco_anterior_cents" bigint,
  "preco_novo_cents" bigint not null,
  "origem" text not null,
  "motivo" text,
  "recomendacao" jsonb,
  "user_id" uuid,
  "desfeito_em" timestamp with time zone,
  "desfaz_id" uuid,
  "is_demo" boolean not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."lv_price_tiers" (
  "id" uuid not null,
  "product_id" uuid not null,
  "min_qty" integer not null,
  "tipo" text not null,
  "valor" integer not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."lv_product_attributes" (
  "product_id" uuid not null,
  "attribute_id" uuid not null,
  "valor" text not null
);
create table if not exists public."lv_product_images" (
  "id" uuid not null,
  "product_id" uuid not null,
  "url" text not null,
  "alt" text,
  "ordem" integer not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."lv_product_variants" (
  "id" uuid not null,
  "product_id" uuid not null,
  "nome" text not null,
  "gramatura_g" integer,
  "moagem" text,
  "embalagem" text,
  "sku" text,
  "ean" text,
  "preco_cents" bigint,
  "padrao" boolean not null,
  "ativa" boolean not null,
  "ordem" integer not null,
  "is_demo" boolean not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."lv_products" (
  "id" uuid not null,
  "store_id" uuid not null,
  "seller_id" uuid not null,
  "category_id" uuid,
  "slug" text not null,
  "titulo" text not null,
  "marca" text,
  "descricao" text,
  "peso_g" integer,
  "status" text not null,
  "destaque" boolean not null,
  "ordem" integer not null,
  "is_demo" boolean not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "preco_cents" bigint,
  "preco_de_cents" bigint,
  "venda_por_quantidade" boolean not null,
  "preco_minimo_cents" bigint,
  "sku" text,
  "aprovado_em" timestamp with time zone,
  "nota_moderacao" text
);
create table if not exists public."lv_qr_codes" (
  "codigo" text not null,
  "product_id" uuid not null,
  "variant_id" uuid,
  "lot_id" uuid,
  "ativo" boolean not null,
  "is_demo" boolean not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."lv_seller_applications" (
  "id" uuid not null,
  "cnpj" text,
  "razao_social" text,
  "nome_marca" text not null,
  "tipo" text not null,
  "responsavel" text not null,
  "email" text not null,
  "telefone" text,
  "cidade" text,
  "uf" character(2),
  "tipos_de_cafe" text,
  "volume_mensal" text,
  "prazo_expedicao" text,
  "emite_nfe" boolean,
  "mensagem" text,
  "plan_id" uuid,
  "status" text not null,
  "nota_interna" text,
  "seller_id" uuid,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."lv_seller_users" (
  "seller_id" uuid not null,
  "user_id" uuid not null,
  "papel" text not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."lv_sellers" (
  "id" uuid not null,
  "nome_fantasia" text not null,
  "razao_social" text,
  "cnpj" text,
  "tipo" text not null,
  "cidade" text,
  "uf" character(2),
  "responsavel" text,
  "email" text,
  "telefone" text,
  "status" text not null,
  "is_demo" boolean not null,
  "observacoes" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "pagamento_status" text not null,
  "pagamento_atualizado_em" timestamp with time zone
);
create table if not exists public."lv_settings" (
  "key" text not null,
  "value" jsonb not null,
  "updated_at" timestamp with time zone not null,
  "updated_by" uuid
);
create table if not exists public."lv_simulacao_premissas" (
  "chave" text not null,
  "valor" integer not null,
  "rotulo" text not null,
  "unidade" text,
  "fonte" text,
  "observacao" text,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."lv_stores" (
  "id" uuid not null,
  "seller_id" uuid not null,
  "slug" text not null,
  "nome" text not null,
  "chamada" text,
  "historia" text,
  "especialidade" text,
  "cidade" text,
  "uf" character(2),
  "logo_url" text,
  "capa_url" text,
  "cor" text,
  "iniciais" text,
  "ativa" boolean not null,
  "destaque" boolean not null,
  "ordem" integer not null,
  "is_demo" boolean not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."lv_tarifas_simulacao" (
  "id" uuid not null,
  "plataforma" text not null,
  "modalidade" text,
  "componente" text not null,
  "cenario" text,
  "percentual_bps" integer,
  "valor_cents" bigint,
  "valor_micros" bigint,
  "minimo_cents" bigint,
  "preco_min_cents" bigint,
  "preco_max_cents" bigint,
  "peso_sobre" text,
  "peso_min_g" integer,
  "peso_max_g" integer,
  "confiabilidade" text not null,
  "natureza" text not null,
  "rotulo" text,
  "fonte" text,
  "fonte_url" text,
  "verificado_em" date,
  "vigencia_inicio" date,
  "vigencia_fim" date,
  "observacao" text,
  "ordem" integer not null,
  "ativo" boolean not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "updated_by" uuid,
  "modelo" text not null
);
create table if not exists public."marketing_contacts" (
  "id" uuid not null,
  "phone_e164" text not null,
  "ddd" text,
  "numero" text,
  "is_mobile" boolean not null,
  "name" text,
  "email" text,
  "segment" text not null,
  "company_id" uuid,
  "source" text,
  "consent" boolean not null,
  "consent_at" timestamp with time zone not null,
  "opted_out_at" timestamp with time zone,
  "last_order_at" timestamp with time zone,
  "orders_count" integer not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."marketplace_stores" (
  "id" uuid not null,
  "company_id" uuid,
  "name" text not null,
  "url" text not null,
  "logo_url" text,
  "is_active" boolean not null,
  "sort_order" integer not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."network_audit_log" (
  "id" uuid not null,
  "actor_user_id" uuid,
  "action" text not null,
  "entity_table" text not null,
  "entity_id" uuid,
  "previous_state" jsonb,
  "new_state" jsonb,
  "reason" text,
  "created_at" timestamp with time zone not null
);
create table if not exists public."network_entities" (
  "id" uuid not null,
  "entity_type" text not null,
  "legal_name" text not null,
  "display_name" text,
  "document_type" text,
  "document_number" text,
  "email" text,
  "phone" text,
  "whatsapp" text,
  "cep" text,
  "logradouro" text,
  "numero" text,
  "complemento" text,
  "bairro" text,
  "municipio" text,
  "uf" text,
  "lat" double precision,
  "lng" double precision,
  "status" text not null,
  "verified_at" timestamp with time zone,
  "verified_by" uuid,
  "user_id" uuid,
  "internal_notes" text,
  "created_by" uuid,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."network_entity_roles" (
  "id" uuid not null,
  "entity_id" uuid not null,
  "role_code" text not null,
  "status" text not null,
  "granted_at" timestamp with time zone not null,
  "granted_by" uuid
);
create table if not exists public."network_properties" (
  "id" uuid not null,
  "entity_id" uuid not null,
  "name" text not null,
  "municipio" text,
  "uf" text,
  "region_label" text,
  "lat" double precision,
  "lng" double precision,
  "altitude_m" integer,
  "area_ha" numeric(10,2),
  "notes" text,
  "created_by" uuid,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."network_roles" (
  "code" text not null,
  "label" text not null,
  "description" text,
  "sort_order" integer not null
);
create table if not exists public."order_emails" (
  "id" uuid not null,
  "order_id" uuid not null,
  "kind" text not null,
  "to_email" text not null,
  "provider_id" text,
  "status" text not null,
  "error_text" text,
  "created_at" timestamp with time zone not null
);
create table if not exists public."order_items" (
  "id" uuid not null,
  "order_id" uuid not null,
  "product_id" uuid,
  "product_name" text not null,
  "product_description" text,
  "grind_type" text,
  "quantity" integer not null,
  "unit_price" numeric(10,2) not null,
  "subtotal" numeric(10,2) not null,
  "created_at" timestamp with time zone
);
create table if not exists public."orders" (
  "id" uuid not null,
  "user_id" uuid,
  "order_number" text not null,
  "total_amount" numeric(10,2) not null,
  "status" text not null,
  "payment_method" text,
  "mercadopago_preference_id" text,
  "mercadopago_payment_id" text,
  "mercadopago_collection_id" text,
  "mercadopago_collection_status" text,
  "external_reference" text,
  "customer_name" text not null,
  "customer_email" text not null,
  "customer_phone" text,
  "shipping_address" text,
  "shipping_postal_code" text,
  "shipping_city" text,
  "shipping_state" text,
  "shipping_number" text,
  "shipping_neighborhood" text,
  "shipping_complement" text,
  "order_type" text,
  "subscription_frequency" text,
  "subscription_shipping_date" integer,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "order_status" text,
  "package_weight" numeric(10,3),
  "package_height" numeric(10,2),
  "package_width" numeric(10,2),
  "package_length" numeric(10,2),
  "label_url" text,
  "label_format" text,
  "dispatch_date" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "is_gift" boolean,
  "shipping_recipient" text,
  "shipping_carrier_id" uuid,
  "shipping_carrier_name" text,
  "shipping_cost" numeric(10,2),
  "tracking_events" jsonb,
  "channel" text,
  "order_public_token_hash" text,
  "seller_company_id" uuid,
  "mp_account_key" text,
  "mp_collector_id" text,
  "phone_e164" text,
  "phone_is_mobile" boolean,
  "accepts_whatsapp_promos" boolean not null,
  "is_pickup" boolean not null,
  "shipping_street" text,
  "ready_at" timestamp with time zone,
  "shipped_at" timestamp with time zone,
  "tracking_code" text,
  "tracking_url" text,
  "customer_cpf" text,
  "shipping_service_id" integer,
  "shipping_service_name" text,
  "coupon_code" text,
  "discount_amount" numeric(10,2) not null,
  "shipping_zone" text,
  "shipping_zone_days" integer
);
create table if not exists public."packaging_specs" (
  "id" uuid not null,
  "units" integer not null,
  "block_w_cm" numeric(6,1),
  "block_d_cm" numeric(6,1),
  "block_h_cm" numeric(6,1),
  "envelope" text,
  "tare_g" integer not null,
  "is_estimate" boolean not null,
  "notes" text,
  "ship_w_cm" numeric(6,1),
  "ship_d_cm" numeric(6,1),
  "ship_h_cm" numeric(6,1)
);
create table if not exists public."payment_refunds" (
  "id" uuid not null,
  "order_id" uuid not null,
  "mp_payment_id" text not null,
  "mp_refund_id" text,
  "amount" numeric(12,2),
  "is_partial" boolean not null,
  "status" text not null,
  "mp_response" jsonb,
  "error_text" text,
  "requested_by" uuid,
  "created_at" timestamp with time zone not null
);
create table if not exists public."popup_settings" (
  "id" uuid not null,
  "enabled" boolean not null,
  "image_url" text,
  "eyebrow" text,
  "headline" text,
  "subtext" text,
  "disclaimer" text,
  "button_text" text,
  "button_link" text,
  "show_days" integer not null,
  "updated_at" timestamp with time zone not null,
  "name" text not null,
  "sort_order" integer not null,
  "logo_url" text,
  "logo_scale" numeric(4,2) not null
);
create table if not exists public."price_lists" (
  "id" uuid not null,
  "product_id" uuid not null,
  "segment" text not null,
  "price" numeric(10,2) not null,
  "volume_discount" numeric(5,2),
  "volume_min_qty" integer,
  "is_active" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "company_id" uuid
);
create table if not exists public."products" (
  "id" uuid not null,
  "name" text not null,
  "description" text,
  "price" numeric(10,2) not null,
  "promotional_price" numeric(10,2),
  "image_url" text,
  "weight_grams" integer,
  "roast_type" text,
  "flavor_notes" jsonb,
  "in_stock" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "is_active" boolean,
  "featured" boolean,
  "category" text,
  "display_order" integer,
  "discount_percentage" numeric,
  "stock" integer,
  "full_details" text,
  "subscription_enabled" boolean,
  "subscription_months" integer,
  "subscription_discount_pct" integer,
  "additional_images" text[],
  "barcode" text,
  "product_line" text,
  "company_id" uuid,
  "pj_only" boolean not null,
  "hidden_from_store" boolean not null,
  "sales_channels" text[] not null,
  "kit_of_product_id" uuid,
  "kit_quantity" integer,
  "sku" text,
  "has_custom_image" boolean not null
);
create table if not exists public."promo_banners" (
  "id" uuid not null,
  "image_url" text not null,
  "title" text,
  "link_url" text,
  "sort_order" integer not null,
  "active" boolean not null,
  "created_at" timestamp with time zone not null,
  "button_text" text,
  "button_link" text,
  "button_x" real not null,
  "button_y" real not null,
  "button_scale" real not null,
  "overlay_image_url" text,
  "overlay_x" real not null,
  "overlay_y" real not null,
  "overlay_scale" real not null,
  "site" text not null
);
create table if not exists public."promoter_audit_log" (
  "id" bigint not null,
  "actor_user_id" uuid,
  "entity" text,
  "entity_id" uuid,
  "action" text,
  "payload" jsonb,
  "created_at" timestamp with time zone
);
create table if not exists public."promoter_client_mix" (
  "id" uuid not null,
  "representative_client_id" uuid not null,
  "product_id" uuid not null,
  "company_id" uuid,
  "min_frentes" integer,
  "is_active" boolean not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."promoter_clients" (
  "id" uuid not null,
  "promoter_id" uuid not null,
  "representative_client_id" uuid not null,
  "company_id" uuid,
  "is_active" boolean not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."promoter_incidents" (
  "id" uuid not null,
  "visit_id" uuid,
  "representative_client_id" uuid not null,
  "product_id" uuid,
  "promoter_id" uuid not null,
  "assigned_representative_id" uuid,
  "company_id" uuid,
  "category" text not null,
  "priority" text not null,
  "description" text,
  "status" text not null,
  "resolution" text,
  "opened_at" timestamp with time zone not null,
  "closed_at" timestamp with time zone,
  "due_at" timestamp with time zone,
  "converted_to_order_id" uuid,
  "created_at" timestamp with time zone not null
);
create table if not exists public."promoter_routes" (
  "id" uuid not null,
  "promoter_id" uuid not null,
  "company_id" uuid,
  "route_date" date not null,
  "status" text not null,
  "created_by" uuid,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."promoter_visit_audits" (
  "id" uuid not null,
  "visit_id" uuid not null,
  "product_id" uuid not null,
  "qty_gondola_antes" integer,
  "qty_deposito" integer,
  "frentes_antes" integer,
  "etiqueta_presente" boolean,
  "posicao_correta" boolean,
  "preco_gondola" numeric,
  "preco_promocional" numeric,
  "lote" text,
  "validade_mais_proxima" date,
  "qty_avariada" integer,
  "qty_vencida" integer,
  "qty_proxima_vencimento" integer,
  "qty_retirada_deposito" integer,
  "qty_abastecida" integer,
  "saldo_deposito" integer,
  "frentes_depois" integer,
  "peps_aplicado" boolean,
  "reorganizado" boolean,
  "etiqueta_corrigida" boolean,
  "nao_localizado" boolean not null,
  "ruptura_status_antes" text,
  "ruptura_status_depois" text,
  "observacoes" text,
  "company_id" uuid,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."promoter_visit_locations" (
  "id" bigint not null,
  "visit_id" uuid not null,
  "lat" numeric not null,
  "lng" numeric not null,
  "accuracy_m" numeric,
  "captured_at" timestamp with time zone not null,
  "source" text not null
);
create table if not exists public."promoter_visit_photos" (
  "id" uuid not null,
  "visit_id" uuid not null,
  "kind" text not null,
  "product_id" uuid,
  "photo_url" text not null,
  "lat" numeric,
  "lng" numeric,
  "taken_at" timestamp with time zone not null,
  "caption" text,
  "company_id" uuid,
  "created_at" timestamp with time zone not null
);
create table if not exists public."promoter_visits" (
  "id" uuid not null,
  "route_id" uuid,
  "promoter_id" uuid not null,
  "representative_client_id" uuid not null,
  "company_id" uuid,
  "stop_order" integer,
  "priority" text,
  "scheduled_at" timestamp with time zone,
  "estimated_minutes" integer,
  "status" text not null,
  "arrival_at" timestamp with time zone,
  "checkin_lat" numeric,
  "checkin_lng" numeric,
  "checkin_accuracy_m" numeric,
  "checkin_distance_m" numeric,
  "checkin_geofence_ok" boolean,
  "checkin_justification" text,
  "departure_at" timestamp with time zone,
  "checkout_lat" numeric,
  "checkout_lng" numeric,
  "checkout_accuracy_m" numeric,
  "checkout_distance_m" numeric,
  "checkout_geofence_ok" boolean,
  "checkout_justification" text,
  "duration_minutes" integer,
  "is_scheduled" boolean not null,
  "not_visited_reason" text,
  "not_visited_notes" text,
  "notes" text,
  "cancelled_at" timestamp with time zone,
  "cancelled_by" uuid,
  "cancellation_reason" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."promoters" (
  "id" uuid not null,
  "user_id" uuid not null,
  "full_name" text not null,
  "cpf" text,
  "phone" text,
  "email" text,
  "company_id" uuid,
  "supervisor_user_id" uuid,
  "status" text not null,
  "blocked_reason" text,
  "approved_at" timestamp with time zone,
  "notes" text,
  "last_seen_at" timestamp with time zone,
  "last_lat" numeric,
  "last_lng" numeric,
  "is_online" boolean,
  "current_tab" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."prospect_leads" (
  "id" uuid not null,
  "prospect_list_id" uuid not null,
  "representative_id" uuid,
  "representative_client_id" uuid,
  "company_name" text not null,
  "trade_name" text,
  "cnpj" text,
  "cpf" text,
  "segment" text,
  "category" text,
  "source" text,
  "address" text,
  "number" text,
  "complement" text,
  "district" text,
  "city" text,
  "state" text,
  "zip_code" text,
  "lat" numeric(10,7),
  "lng" numeric(10,7),
  "geocode_status" text not null,
  "geocode_source" text,
  "geocoded_at" timestamp with time zone,
  "contact_name" text,
  "phone" text,
  "whatsapp" text,
  "email" text,
  "website" text,
  "raw_data" jsonb not null,
  "status" text not null,
  "audit_notes" text,
  "rejection_reason" text,
  "visited_at" timestamp with time zone,
  "qualified_at" timestamp with time zone,
  "converted_at" timestamp with time zone,
  "duplicate_of_lead_id" uuid,
  "duplicate_of_client_id" uuid,
  "created_by" uuid,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "company_id" uuid,
  "rf_cnpj" text,
  "rf_razao" text,
  "rf_match_status" text not null
);
create table if not exists public."prospect_lists" (
  "id" uuid not null,
  "name" text not null,
  "description" text,
  "segment" text,
  "source_type" text not null,
  "source_name" text,
  "status" text not null,
  "assigned_representative_id" uuid,
  "total_count" integer not null,
  "pending_count" integer not null,
  "converted_count" integer not null,
  "rejected_count" integer not null,
  "duplicate_count" integer not null,
  "invalid_count" integer not null,
  "created_by" uuid,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "completed_at" timestamp with time zone,
  "company_id" uuid
);
create table if not exists public."prospect_runs" (
  "id" uuid not null,
  "requested_by" uuid,
  "uf" text,
  "municipio" text,
  "bairro" text,
  "category" text,
  "keywords" text[] not null,
  "max_places" integer not null,
  "keyword_count" integer not null,
  "places_estimate" integer not null,
  "cost_estimate_usd" numeric(10,2) not null,
  "apify_run_id" text,
  "apify_dataset_id" text,
  "status" text not null,
  "places_returned" integer,
  "leads_created" integer,
  "leads_duplicated" integer,
  "error_message" text,
  "prospect_list_id" uuid,
  "representative_id" uuid,
  "company_id" uuid,
  "created_at" timestamp with time zone not null,
  "finished_at" timestamp with time zone,
  "source_type" text,
  "provider" text,
  "actor_id" text,
  "actor_version" text,
  "result_count" integer,
  "campaign_id" uuid,
  "country" text,
  "cost_actual_usd" numeric(10,4)
);
create table if not exists public."prospects_b2b" (
  "id" uuid not null,
  "cnpj" text not null,
  "cnpj_basico" text,
  "razao_social" text,
  "nome_fantasia" text,
  "cnae_principal" text,
  "cnae_descricao" text,
  "situacao_cadastral" text,
  "data_inicio_atividade" date,
  "tipo_logradouro" text,
  "logradouro" text,
  "numero" text,
  "complemento" text,
  "bairro" text,
  "municipio_rf_code" text,
  "municipio" text,
  "uf" text,
  "cep" text,
  "telefone" text,
  "email" text,
  "lat" double precision,
  "lng" double precision,
  "geocode_status" text not null,
  "is_client" boolean not null,
  "fonte" text not null,
  "atualizado_em" timestamp with time zone not null,
  "company_id" uuid,
  "created_at" timestamp with time zone not null,
  "covered_at" timestamp with time zone,
  "covered_by_lead_id" uuid
);
create table if not exists public."rep_daily_plans" (
  "id" uuid not null,
  "representative_id" uuid not null,
  "lead_id" uuid not null,
  "plan_date" date not null,
  "created_at" timestamp with time zone
);
create table if not exists public."repco_help_articles" (
  "id" uuid not null,
  "question" text not null,
  "answer" text not null,
  "category" text,
  "sort_order" integer not null,
  "is_active" boolean not null,
  "created_at" timestamp with time zone not null,
  "audience" text not null
);
create table if not exists public."repco_invite_codes" (
  "id" uuid not null,
  "code" text not null,
  "note" text,
  "created_by" uuid,
  "created_at" timestamp with time zone,
  "expires_at" timestamp with time zone not null,
  "used_by" uuid,
  "used_at" timestamp with time zone,
  "role_code" text not null,
  "company_id" uuid
);
create table if not exists public."representative_clients" (
  "id" uuid not null,
  "representative_id" uuid not null,
  "cnpj" text,
  "razao_social" text,
  "nome_fantasia" text,
  "situacao_receita" text,
  "endereco_completo" text,
  "email_comprador" text,
  "email_xml" text,
  "nome_comprador" text,
  "whatsapp_comprador" text,
  "prazo_pagamento" text,
  "forma_pagamento" text,
  "limite_credito" numeric(12,2),
  "status" text not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "segment" text,
  "last_order_at" timestamp with time zone,
  "inactivity_snoozed_until" timestamp with time zone,
  "inactivity_alert_dismissed" boolean,
  "inscricao_estadual" text,
  "cpf" text,
  "nome_completo" text,
  "snooze_count" integer,
  "snooze_admin_alert" boolean,
  "is_active_client" boolean,
  "deactivated_by" uuid,
  "deactivated_at" timestamp with time zone,
  "deactivation_reason" text,
  "assigned_to_company" boolean,
  "pix_key" text,
  "bank_name" text,
  "bank_agency" text,
  "bank_account" text,
  "bank_account_type" text,
  "default_fiscal_order_type" text,
  "cep" text,
  "municipio" text,
  "uf" text,
  "bairro" text,
  "lat" double precision,
  "lng" double precision,
  "credito_score" integer,
  "score_serasa_pdf_url" text,
  "score_serasa_pdf_filename" text,
  "company_id" uuid,
  "public_pos" boolean not null,
  "geocode_status" text not null,
  "geocoded_at" timestamp with time zone,
  "desconto_financeiro_pct" numeric not null,
  "desconto_logistico_pct" numeric not null,
  "bonificacao_padrao" text,
  "tem_gondola" boolean,
  "geofence_radius_m" integer not null
);
create table if not exists public."representative_commission_payouts" (
  "id" uuid not null,
  "commission_id" uuid not null,
  "installment_id" uuid,
  "representative_id" uuid not null,
  "amount" numeric not null,
  "payment_method" text,
  "cycle_start" date,
  "cycle_end" date,
  "scheduled_payment_date" date,
  "status" text not null,
  "paid_at" timestamp with time zone,
  "proof_url" text,
  "proof_filename" text,
  "created_at" timestamp with time zone not null,
  "company_id" uuid
);
create table if not exists public."representative_commissions" (
  "id" uuid not null,
  "representative_id" uuid not null,
  "order_id" uuid not null,
  "order_amount" numeric(12,2) not null,
  "base_rate" numeric(5,2) not null,
  "pix_bonus" numeric(5,2) not null,
  "delivery_bonus" numeric(5,2) not null,
  "total_rate" numeric(5,2) not null,
  "commission_amount" numeric(12,2) not null,
  "status" text not null,
  "paid_at" timestamp with time zone,
  "paid_by" uuid,
  "created_at" timestamp with time zone not null,
  "payment_cycle_start" date,
  "payment_cycle_end" date,
  "scheduled_payment_date" date,
  "payment_method" text,
  "proof_url" text,
  "notes" text,
  "company_id" uuid
);
create table if not exists public."representative_company_settings" (
  "representative_id" uuid not null,
  "company_id" uuid not null,
  "commission_rate" numeric,
  "active" boolean not null,
  "created_at" timestamp with time zone
);
create table if not exists public."representative_documents" (
  "id" uuid not null,
  "representative_id" uuid not null,
  "doc_type" text not null,
  "file_url" text not null,
  "file_name" text,
  "file_size" bigint,
  "uploaded_at" timestamp with time zone not null
);
create table if not exists public."representative_order_installments" (
  "id" uuid not null,
  "order_id" uuid not null,
  "installment_number" integer not null,
  "amount" numeric not null,
  "due_date" date,
  "boleto_url" text,
  "boleto_filename" text,
  "proof_url" text,
  "proof_filename" text,
  "status" text not null,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone not null,
  "company_id" uuid
);
create table if not exists public."representative_order_items" (
  "id" uuid not null,
  "order_id" uuid not null,
  "product_id" uuid not null,
  "representative_id" uuid,
  "quantity" integer not null,
  "unit" text not null,
  "unit_price" numeric,
  "stock_applied" boolean not null,
  "created_at" timestamp with time zone not null,
  "company_id" uuid,
  "is_bonus" boolean not null
);
create table if not exists public."representative_order_notes" (
  "id" uuid not null,
  "order_id" uuid not null,
  "author_user_id" uuid,
  "author_name" text,
  "note" text not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."representative_orders" (
  "id" uuid not null,
  "representative_id" uuid not null,
  "representative_client_id" uuid,
  "order_number" text not null,
  "description" text,
  "total_amount" numeric(12,2) not null,
  "payment_method" text,
  "is_personal_delivery" boolean not null,
  "invoice_xml_url" text,
  "invoice_pdf_url" text,
  "invoice_key" text,
  "invoice_number" text,
  "status" text not null,
  "notes" text,
  "created_at" timestamp with time zone not null,
  "completed_at" timestamp with time zone,
  "created_by" uuid,
  "client_order_number" text,
  "has_client_order_number" boolean,
  "payment_term" integer,
  "discount_percentage" numeric(5,2),
  "original_amount" numeric(10,2),
  "commission_paid_proof_url" text,
  "service_invoice_url" text,
  "channel" text,
  "pix_bonus_eligible" boolean,
  "fiscal_order_type" text,
  "invoice_pdf_filename" text,
  "invoice_xml_filename" text,
  "payment_proof_filename" text,
  "payment_proof_url" text,
  "company_id" uuid,
  "delivery_status" text,
  "delivery_accepted_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "delivery_proof_url" text,
  "delivery_proof_filename" text,
  "delivery_proof_lat" double precision,
  "delivery_proof_lng" double precision,
  "desconto_financeiro_pct" numeric not null,
  "desconto_logistico_pct" numeric not null,
  "freight_amount" numeric not null,
  "carrier_id" uuid,
  "delivery_mode" text,
  "delivery_dispatched_at" timestamp with time zone
);
create table if not exists public."representative_routes" (
  "id" uuid not null,
  "representative_id" uuid not null,
  "name" text not null,
  "description" text,
  "status" text not null,
  "created_by" uuid,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "route_type" text,
  "max_weight_kg" numeric,
  "total_weight_kg" numeric,
  "region" text,
  "segment_filter" text,
  "finalized_at" timestamp with time zone,
  "finalized_by" uuid,
  "report_pdf_url" text,
  "learned_order" jsonb
);
create table if not exists public."representatives" (
  "id" uuid not null,
  "user_id" uuid not null,
  "full_name" text not null,
  "cpf" text,
  "cnpj" text,
  "email" text,
  "phone" text,
  "commission_rate" numeric(5,2) not null,
  "has_personal_delivery" boolean not null,
  "experience_start_date" date,
  "status" text not null,
  "approved_at" timestamp with time zone,
  "blocked_reason" text,
  "notes" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "last_seen_at" timestamp with time zone,
  "last_lat" numeric(10,7),
  "last_lng" numeric(10,7),
  "current_tab" text,
  "is_online" boolean,
  "company_id" uuid
);
create table if not exists public."roasting_companies" (
  "id" uuid not null,
  "name" text not null,
  "cnpj" text,
  "address" text,
  "city" text,
  "state" text,
  "cep" text,
  "company_code" integer not null,
  "active" boolean,
  "notes" text,
  "created_at" timestamp with time zone,
  "director_name" text,
  "email" text,
  "whatsapp" text,
  "inscricao_estadual" text,
  "company_id" uuid
);
create table if not exists public."roasting_company_contacts" (
  "id" uuid not null,
  "company_id" uuid not null,
  "name" text not null,
  "role" text not null,
  "email" text,
  "phone" text,
  "whatsapp" text,
  "extension" text,
  "active" boolean,
  "created_at" timestamp with time zone
);
create table if not exists public."roles" (
  "code" text not null,
  "label" text not null,
  "description" text,
  "created_at" timestamp with time zone not null
);
create table if not exists public."route_stops" (
  "id" uuid not null,
  "route_id" uuid not null,
  "stop_order" integer not null,
  "company_name" text not null,
  "address" text,
  "city" text,
  "phone" text,
  "segment" text,
  "lat" numeric(10,7),
  "lng" numeric(10,7),
  "visit_status" text not null,
  "visit_notes" text,
  "visited_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "representative_client_id" uuid,
  "scheduled_at" timestamp with time zone,
  "proof_photo_url" text,
  "proof_photo_lat" numeric,
  "proof_photo_lng" numeric,
  "proof_photo_at" timestamp with time zone,
  "arrival_at" timestamp with time zone,
  "departure_at" timestamp with time zone,
  "geofence_triggered" boolean,
  "distance_from_stop" numeric,
  "stop_type" text,
  "weight_kg" numeric,
  "prospect_lead_id" uuid
);
create table if not exists public."shipments" (
  "id" uuid not null,
  "order_id" uuid,
  "carrier_name" text,
  "carrier_service" text,
  "carrier_api_shipment_id" text,
  "tracking_code" text,
  "label_url" text,
  "label_format" text,
  "status" text,
  "dispatch_date" timestamp with time zone,
  "last_tracking_check" timestamp with time zone,
  "tracking_events" jsonb,
  "created_at" timestamp with time zone
);
create table if not exists public."shipping_carriers" (
  "id" uuid not null,
  "name" text not null,
  "code" text not null,
  "price_per_kg" numeric,
  "fixed_price" numeric,
  "delivery_time_days" integer,
  "is_active" boolean,
  "logo_url" text,
  "api_type" text,
  "api_endpoint" text,
  "api_key" text,
  "api_username" text,
  "api_password" text,
  "integration_notes" text,
  "created_at" timestamp with time zone,
  "is_own" boolean not null
);
create table if not exists public."shipping_coverage" (
  "id" bigint not null,
  "table_id" uuid not null,
  "cep_ini" integer not null,
  "cep_fim" integer not null,
  "uf" text,
  "city" text,
  "zone_code" text not null,
  "days" integer
);
create table if not exists public."shipping_quotes" (
  "id" uuid not null,
  "company_id" uuid,
  "dest_cep" text not null,
  "packages" integer not null,
  "goods_value" numeric(12,2) not null,
  "weight_kg" numeric(10,3),
  "service_id" integer,
  "service_name" text,
  "carrier_logo" text,
  "delivery_days" integer,
  "base_price" numeric(10,2) not null,
  "discount" numeric(10,2) not null,
  "price" numeric(10,2) not null,
  "expires_at" timestamp with time zone not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."shipping_rate_tables" (
  "id" uuid not null,
  "carrier_id" uuid,
  "name" text not null,
  "origin_uf" text,
  "insurance_pct" numeric(6,4) not null,
  "gris_pct" numeric(6,4) not null,
  "gris_min" numeric(10,2) not null,
  "max_weight_kg" numeric(10,3),
  "notes" text,
  "is_active" boolean not null,
  "created_at" timestamp with time zone not null,
  "allow_discount" boolean not null,
  "toll_per_100kg" numeric(10,2) not null,
  "tas_fee" numeric(10,2) not null,
  "tde_pct" numeric(6,2) not null,
  "tde_min" numeric(10,2) not null,
  "tda_fee" numeric(10,2) not null
);
create table if not exists public."shipping_rates" (
  "id" uuid not null,
  "table_id" uuid not null,
  "zone_code" text not null,
  "weight_kg" numeric(10,3),
  "price" numeric(10,2) not null
);
create table if not exists public."site_settings" (
  "key" text not null,
  "value" boolean not null,
  "updated_at" timestamp with time zone
);
create table if not exists public."site_visits" (
  "id" uuid not null,
  "city" text,
  "region" text,
  "country" text,
  "lat" double precision,
  "lng" double precision,
  "path" text,
  "created_at" timestamp with time zone not null
);
create table if not exists public."stock_movements" (
  "id" uuid not null,
  "product_id" uuid not null,
  "lot_id" uuid,
  "batch_number" text,
  "quantity" integer not null,
  "movement_type" text not null,
  "channel" text,
  "company_id" uuid,
  "reference_type" text,
  "reference_id" uuid,
  "sem_lote" boolean not null,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamp with time zone not null
);
create table if not exists public."storage_cleanup_log" (
  "id" uuid not null,
  "executed_by" uuid,
  "bucket_id" text,
  "dry_run" boolean not null,
  "min_age_days" integer,
  "candidates" integer not null,
  "deleted" integer not null,
  "objects" jsonb,
  "error" text,
  "created_at" timestamp with time zone not null
);
create table if not exists public."studio_analyses" (
  "id" uuid not null,
  "video_id" uuid,
  "resumo" text,
  "objetivo" text,
  "publico_alvo" text,
  "gancho" text,
  "estrategia" text,
  "gatilhos" jsonb,
  "pontos_fortes" jsonb,
  "pontos_fracos" jsonb,
  "como_reproduzir" text,
  "como_melhorar" text,
  "como_vender" text,
  "workflow" text,
  "nivel_dificuldade" text,
  "analise_visual" jsonb,
  "prompts" jsonb,
  "legendas" jsonb,
  "hashtags" jsonb,
  "created_at" timestamp with time zone,
  "adaptacao_marca" text,
  "creative_principle" text,
  "do_not_copy" jsonb,
  "originality_changes" jsonb,
  "claims_used" jsonb,
  "assets_required" jsonb,
  "suggestions_not_facts" jsonb,
  "validation_warnings" jsonb,
  "competitor_text" text,
  "organization_id" uuid
);
create table if not exists public."studio_brand_profiles" (
  "id" uuid not null,
  "company_id" uuid,
  "name" text not null,
  "is_primary" boolean,
  "colors" jsonb,
  "tone" text,
  "audience" text,
  "product_line" text,
  "dos" text,
  "donts" text,
  "logo_url" text,
  "product_images" jsonb,
  "notes" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "guardrails" jsonb not null,
  "organization_id" uuid
);
create table if not exists public."studio_campaigns" (
  "id" uuid not null,
  "video_id" uuid,
  "company_id" uuid,
  "title" text not null,
  "platform" text not null,
  "content" text,
  "prompt_used" text,
  "status" text,
  "scheduled_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "published_at" timestamp with time zone,
  "external_url" text,
  "publish_error" text,
  "media_path" text,
  "media_type" text,
  "platform_post_id" text,
  "organization_id" uuid
);
create table if not exists public."studio_content_fingerprints" (
  "id" uuid not null,
  "headline_hash" text not null,
  "structure_hash" text,
  "organization_id" uuid,
  "generation_id" uuid,
  "created_at" timestamp with time zone not null
);
create table if not exists public."studio_generations" (
  "id" uuid not null,
  "created_at" timestamp with time zone not null,
  "company_id" uuid not null,
  "created_by" uuid,
  "format" text not null,
  "brief" text not null,
  "prompt" text,
  "reference_path" text,
  "provider" text not null,
  "model" text,
  "width" integer,
  "height" integer,
  "storage_path" text,
  "status" text not null,
  "error_text" text,
  "outcome" text,
  "outcome_at" timestamp with time zone,
  "downloaded_at" timestamp with time zone,
  "parent_id" uuid,
  "organization_id" uuid,
  "brand_id" uuid,
  "content_type" text,
  "briefing" jsonb,
  "reference_paths" text[],
  "reference_roles" text[],
  "style" text,
  "text_mode" text,
  "handle" text,
  "creative_director_status" text,
  "brand_mode" text not null,
  "brand_name" text,
  "batch_id" uuid,
  "batch_index" integer
);
create table if not exists public."studio_members" (
  "id" uuid not null,
  "organization_id" uuid not null,
  "user_id" uuid not null,
  "role" text not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."studio_organizations" (
  "id" uuid not null,
  "name" text not null,
  "slug" text,
  "company_id" uuid,
  "plan" text not null,
  "status" text not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."studio_profile_snapshots" (
  "id" uuid not null,
  "company_id" uuid,
  "handle" text not null,
  "followers" integer,
  "posts_count" integer,
  "captured_at" timestamp with time zone
);
create table if not exists public."studio_reference_assets" (
  "id" uuid not null,
  "path" text not null,
  "company_id" uuid not null,
  "organization_id" uuid,
  "brand_id" uuid,
  "brand_mode" text not null,
  "brand_name" text,
  "filename" text,
  "mime" text,
  "size_bytes" bigint,
  "created_by" uuid,
  "created_at" timestamp with time zone not null
);
create table if not exists public."studio_social_connections" (
  "id" uuid not null,
  "company_id" uuid,
  "platform" text not null,
  "account_name" text,
  "account_id" text,
  "access_token" text,
  "refresh_token" text,
  "expires_at" timestamp with time zone,
  "status" text,
  "meta" jsonb,
  "updated_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "organization_id" uuid
);
create table if not exists public."studio_transcriptions" (
  "id" uuid not null,
  "video_id" uuid,
  "full_text" text,
  "segments" jsonb,
  "srt_content" text,
  "created_at" timestamp with time zone,
  "organization_id" uuid
);
create table if not exists public."studio_videos" (
  "id" uuid not null,
  "company_id" uuid,
  "created_by" uuid,
  "filename" text not null,
  "storage_path" text not null,
  "status" text,
  "duration" real,
  "language" text,
  "brand_detected" text,
  "created_at" timestamp with time zone,
  "processed_at" timestamp with time zone,
  "error_text" text,
  "audio_path" text,
  "media_type" text,
  "source_url" text,
  "thumbnail_path" text,
  "analysis_mode" text,
  "audio_transcription_status" text,
  "organization_id" uuid
);
create table if not exists public."subscription_settings" (
  "id" uuid not null,
  "accepting_new" boolean not null,
  "tiers" jsonb not null,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."subscriptions" (
  "id" uuid not null,
  "user_id" uuid,
  "order_id" uuid,
  "account_type" text,
  "selected_coffees" jsonb,
  "grind_type" text,
  "shipping_date" integer,
  "commitment_months" integer,
  "discount_pct" integer,
  "status" text not null,
  "started_at" timestamp with time zone not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."superfrete_settings" (
  "id" uuid not null,
  "company_id" uuid,
  "is_active" boolean not null,
  "origin_cep" text,
  "services" text not null,
  "markup_pct" numeric(6,2) not null,
  "markup_fixo" numeric(10,2) not null,
  "last_ok_at" timestamp with time zone,
  "last_error" text,
  "updated_at" timestamp with time zone not null
);
create table if not exists public."telegram_recipients" (
  "id" uuid not null,
  "chat_id" text not null,
  "label" text,
  "company_id" uuid,
  "is_active" boolean not null,
  "created_at" timestamp with time zone not null
);
create table if not exists public."user_addresses" (
  "id" uuid not null,
  "user_id" uuid not null,
  "address_line1" text not null,
  "address_line2" text,
  "city" text not null,
  "state" text not null,
  "postal_code" text not null,
  "country" text,
  "is_default" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "street" text,
  "number" text,
  "complement" text,
  "neighborhood" text,
  "recipient_name" text,
  "phone" text
);
create table if not exists public."user_profiles" (
  "id" uuid not null,
  "full_name" text,
  "phone" text,
  "is_admin" boolean,
  "created_at" timestamp with time zone
);
create table if not exists public."user_roles" (
  "id" uuid not null,
  "user_id" uuid not null,
  "role_code" text not null,
  "company_id" uuid,
  "is_active" boolean not null,
  "granted_at" timestamp with time zone not null,
  "granted_by" uuid
);

-- Funções (corpo não é validado agora: check_function_bodies = off)
CREATE OR REPLACE FUNCTION public.calculate_batch_costs(p_batch_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  b RECORD;
  total_var NUMERIC;
  roasted_kg NUMERIC;
  cost_per_100g_calc NUMERIC;
  other_costs_total NUMERIC;
BEGIN
  SELECT * INTO b FROM public.product_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RETURN; END IF;

  roasted_kg := COALESCE(b.roasted_weight_kg, b.green_weight_kg * 0.82);

  SELECT COALESCE(SUM((item->>'value')::NUMERIC), 0)
  INTO other_costs_total
  FROM jsonb_array_elements(COALESCE(b.other_costs, '[]'::jsonb)) AS item;

  total_var := COALESCE(b.green_total_cost, 0)
    + COALESCE(b.roast_cost, 0)
    + COALESCE(b.fuel_cost, 0)
    + COALESCE(b.toll_cost, 0)
    + COALESCE(b.hotel_cost, 0)
    + COALESCE(b.food_cost, 0)
    + other_costs_total;

  IF roasted_kg > 0 THEN
    cost_per_100g_calc := total_var / (roasted_kg * 10);
  ELSE
    cost_per_100g_calc := 0;
  END IF;

  IF roasted_kg > 0 THEN
    DECLARE
      bonus_kg NUMERIC;
      remaining_kg NUMERIC;
      total_cost_with_bonus NUMERIC;
    BEGIN
      bonus_kg := (
        COALESCE(b.samples_given_units, 0) * COALESCE(b.samples_unit_size_g, 500) +
        COALESCE(b.bonus_given_units, 0) * COALESCE(b.bonus_unit_size_g, 500)
      ) / 1000.0;
      remaining_kg := roasted_kg - bonus_kg;
      IF remaining_kg > 0 AND bonus_kg > 0 THEN
        total_cost_with_bonus := total_var + (bonus_kg * cost_per_100g_calc * 10);
        cost_per_100g_calc := total_cost_with_bonus / (remaining_kg * 10);
      END IF;
    END;
  END IF;

  UPDATE public.product_batches SET
    total_variable_cost = total_var,
    cost_per_100g = ROUND(cost_per_100g_calc, 4),
    cost_per_250g = ROUND(cost_per_100g_calc * 2.5 + COALESCE(b.pkg_cost_250g, 0) + COALESCE(b.label_cost_per_unit, 0) + COALESCE(b.plastic_wrap_cost_per_unit, 0), 2),
    cost_per_500g = ROUND(cost_per_100g_calc * 5 + COALESCE(b.pkg_cost_500g, 0) + COALESCE(b.label_cost_per_unit, 0) + COALESCE(b.plastic_wrap_cost_per_unit, 0), 2),
    cost_per_1kg = ROUND(cost_per_100g_calc * 10 + COALESCE(b.pkg_cost_1kg, 0) + COALESCE(b.label_cost_per_unit, 0) + COALESCE(b.plastic_wrap_cost_per_unit, 0), 2),
    cost_per_fardo5kg = ROUND(cost_per_100g_calc * 50 + COALESCE(b.pkg_cost_fardo5kg, 0) + COALESCE(b.label_cost_per_unit, 0) * 10 + COALESCE(b.plastic_wrap_cost_per_unit, 0) * 10, 2),
    updated_at = NOW()
  WHERE id = p_batch_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.calculate_repco_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rep          public.representatives%ROWTYPE;
  v_model        text := 'formula';
  v_flat_rate    numeric;
  v_base_rate    DECIMAL := 5.00;
  v_pix_bonus    DECIMAL := 0;
  v_del_bonus    DECIMAL := 0;
  v_total_rate   DECIMAL;
  v_amount       DECIMAL;
  v_sale_date    DATE;
  v_close_friday DATE;
  v_cycle_start  DATE;
  v_cycle_end    DATE;
  v_scheduled    DATE;
BEGIN
  IF OLD.status = NEW.status OR NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_rep FROM public.representatives WHERE id = NEW.representative_id;

  -- modelo de comissao da empresa do pedido (formula = Saporino, flat = % fixo por rep)
  SELECT commission_model INTO v_model FROM public.companies WHERE id = NEW.company_id;
  v_model := COALESCE(v_model, 'formula');

  IF v_model = 'flat' THEN
    -- Fazendinha: % fixo por representante, SEM bonus de PIX/entrega, SEM cap.
    SELECT commission_rate INTO v_flat_rate
      FROM public.representative_company_settings
      WHERE representative_id = NEW.representative_id AND company_id = NEW.company_id AND active = true;
    v_base_rate  := COALESCE(v_flat_rate, v_rep.commission_rate, 0);
    v_pix_bonus  := 0;
    v_del_bonus  := 0;
    v_total_rate := v_base_rate;
  ELSE
    -- Saporino: 5% base + 0,5% PIX + 2,5% entrega pessoal, cap 8%.
    v_base_rate := COALESCE(v_rep.commission_rate, 5.00);
    IF NEW.payment_method = 'pix' THEN
      v_pix_bonus := 0.50;
    END IF;
    IF NEW.is_personal_delivery AND COALESCE(v_rep.has_personal_delivery, false) THEN
      v_del_bonus := 2.50;
    END IF;
    v_total_rate := LEAST(v_base_rate + v_pix_bonus + v_del_bonus, 8.00);
  END IF;

  v_amount := ROUND((NEW.total_amount * v_total_rate / 100), 2);

  v_sale_date    := NEW.created_at::date;
  v_close_friday := v_sale_date + ((5 - EXTRACT(DOW FROM v_sale_date)::int + 7) % 7);

  -- Boleto libera por parcela (ciclo definido no pagamento da parcela).
  -- Demais formas (pix, deposito, dinheiro, a_vista) = a vista: mesmo ciclo do PIX.
  IF NEW.payment_method = 'boleto' THEN
    v_cycle_start := NULL;
    v_cycle_end   := NULL;
    v_scheduled   := NULL;
  ELSE
    v_cycle_start := v_close_friday - 6;
    v_cycle_end   := v_close_friday;
    v_scheduled   := v_close_friday + 10;
  END IF;

  INSERT INTO public.representative_commissions (
    representative_id, company_id, order_id, order_amount,
    base_rate, pix_bonus, delivery_bonus,
    total_rate, commission_amount, status,
    payment_method, payment_cycle_start, payment_cycle_end, scheduled_payment_date
  ) VALUES (
    NEW.representative_id, NEW.company_id, NEW.id, NEW.total_amount,
    v_base_rate, v_pix_bonus, v_del_bonus,
    v_total_rate, v_amount, 'pending',
    NEW.payment_method, v_cycle_start, v_cycle_end, v_scheduled
  )
  ON CONFLICT DO NOTHING;

  NEW.completed_at := now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.can_access_invoice_file(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.is_admin()
    or exists (
      select 1 from public.representative_orders o
       where o.representative_id = public.my_rep_id()
         and (o.invoice_pdf_url like '%'||p_name
           or o.invoice_xml_url like '%'||p_name
           or o.payment_proof_url like '%'||p_name
           or o.commission_paid_proof_url like '%'||p_name
           or o.service_invoice_url like '%'||p_name
           or o.delivery_proof_url like '%'||p_name)
    )
    or exists (
      select 1 from public.representative_order_installments i
        join public.representative_orders o on o.id = i.order_id
       where o.representative_id = public.my_rep_id()
         and (i.boleto_url like '%'||p_name or i.proof_url like '%'||p_name)
    )
    or exists (
      select 1 from public.representative_commissions c
       where c.representative_id = public.my_rep_id()
         and c.proof_url like '%'||p_name
    )
    or exists (
      select 1 from public.representative_commission_payouts p
       where p.representative_id = public.my_rep_id()
         and p.proof_url like '%'||p_name
    )
    or exists (
      select 1 from public.representative_clients rc
       where rc.representative_id = public.my_rep_id()
         and rc.score_serasa_pdf_url like '%'||p_name
    )
    or exists (
      select 1 from public.invoices inv
        join public.orders ord on ord.id = inv.order_id
       where ord.user_id = auth.uid()
         and (inv.invoice_pdf_url like '%'||p_name or inv.invoice_xml_url like '%'||p_name)
    );
$function$;
CREATE OR REPLACE FUNCTION public.chat_contacts()
 RETURNS TABLE(user_id uuid, full_name text, is_admin boolean, is_online boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$ select up.id, coalesce(nullif(up.full_name,''), r.full_name, 'Usuário'), coalesce(up.is_admin,false), coalesce(r.is_online,false) from user_profiles up left join representatives r on r.user_id=up.id where up.id <> auth.uid() and (coalesce(up.is_admin,false)=true or r.id is not null) $function$;
CREATE OR REPLACE FUNCTION public.chat_create_group(gname text, members uuid[], p_company uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare me uuid := auth.uid(); conv uuid; m uuid;
begin
  if me is null then raise exception 'sem auth'; end if;
  insert into chat_conversations(type,name,created_by,company_id) values('group',gname,me,p_company) returning id into conv;
  insert into chat_participants(conversation_id,user_id,role) values(conv,me,'owner');
  foreach m in array members loop
    if m<>me then insert into chat_participants(conversation_id,user_id,role) values(conv,m,'member') on conflict do nothing; end if;
  end loop;
  return conv;
end; $function$;
CREATE OR REPLACE FUNCTION public.chat_mark_read(conv uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$ update chat_participants set last_read_at=now() where conversation_id=conv and user_id=auth.uid() $function$;
CREATE OR REPLACE FUNCTION public.chat_media_conversation(p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare v uuid;
begin
  begin
    v := ((storage.foldername(p_name))[1])::uuid;
  exception when others then
    return null;   -- caminho antigo, sem conversa: ninguém além do admin lê
  end;
  return v;
end;
$function$;
CREATE OR REPLACE FUNCTION public.chat_my_conversations(p_company uuid)
 RETURNS TABLE(id uuid, type text, name text, last_message_at timestamp with time zone, last_message_preview text, unread integer, other_user_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select c.id, c.type, c.name, c.last_message_at, c.last_message_preview,
    (select count(*) from chat_messages m where m.conversation_id=c.id and m.created_at > p.last_read_at and m.sender_id <> auth.uid())::int,
    (select p2.user_id from chat_participants p2 where p2.conversation_id=c.id and p2.user_id <> auth.uid() limit 1)
  from chat_conversations c
  join chat_participants p on p.conversation_id=c.id and p.user_id=auth.uid()
  where c.company_id = p_company
  order by c.last_message_at desc
$function$;
CREATE OR REPLACE FUNCTION public.chat_start_direct(other uuid, p_company uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare me uuid := auth.uid(); conv uuid;
begin
  if me is null then raise exception 'sem auth'; end if;
  -- conversa direta é por empresa: mesma dupla tem thread separada em cada empresa
  select c.id into conv from chat_conversations c
   where c.type='direct' and c.company_id = p_company
     and exists(select 1 from chat_participants p where p.conversation_id=c.id and p.user_id=me)
     and exists(select 1 from chat_participants p where p.conversation_id=c.id and p.user_id=other)
     and (select count(*) from chat_participants p where p.conversation_id=c.id)=2
   limit 1;
  if conv is not null then return conv; end if;
  insert into chat_conversations(type,created_by,company_id) values('direct',me,p_company) returning id into conv;
  insert into chat_participants(conversation_id,user_id,role) values (conv,me,'owner'),(conv,other,'member');
  return conv;
end; $function$;
CREATE OR REPLACE FUNCTION public.chat_touch_conv()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ begin update chat_conversations set last_message_at=new.created_at, last_message_preview=coalesce(nullif(new.body,''), case new.attachment_type when 'image' then '📷 Foto' when 'audio' then '🎤 Áudio' when 'file' then '📎 Documento' else 'Mensagem' end) where id=new.conversation_id; return new; end; $function$;
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
BEGIN
  INSERT INTO edge_rate_limits (bucket_key, window_start, count)
  VALUES (p_key, v_window, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET count = edge_rate_limits.count + 1
  RETURNING count INTO v_count;

  -- Sem faxina inline (para a migration ser estritamente não-destrutiva).
  -- A limpeza de janelas antigas de edge_rate_limits será um job periódico futuro.

  RETURN v_count <= p_limit;
END;
$function$;
CREATE OR REPLACE FUNCTION public.coffee_compute_matches(p_request_id uuid, p_min_score numeric DEFAULT 50)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  rec record;
  res jsonb;
  n int := 0;
begin
  if not public.is_admin() then
    raise exception 'apenas administrador pode recalcular matches';
  end if;

  for rec in
    select o.id from public.coffee_offers o
     where o.status = 'active'
       and (o.available_until is null or o.available_until >= current_date)
  loop
    res := public.coffee_match_score(rec.id, p_request_id);
    if (res->>'eligible')::boolean and (res->>'score')::numeric >= p_min_score then
      insert into public.coffee_matches (offer_id, request_id, score, factors, computed_at)
      values (rec.id, p_request_id, (res->>'score')::numeric, res->'fatores', now())
      on conflict (offer_id, request_id) do update
        set score = excluded.score,
            factors = excluded.factors,
            computed_at = now();
      n := n + 1;
    end if;
  end loop;

  insert into public.network_audit_log (action, entity_table, entity_id, new_state, reason)
  values ('match.compute', 'coffee_purchase_requests', p_request_id,
          jsonb_build_object('matches', n, 'min_score', p_min_score),
          'recalculo de matches');

  return n;
end;
$function$;
CREATE OR REPLACE FUNCTION public.coffee_match_score(p_offer_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o public.coffee_offers%rowtype;
  r public.coffee_purchase_requests%rowtype;
  o_bebida int; r_bebida int;
  score numeric := 0;
  factors jsonb := '[]'::jsonb;
  vol_ratio numeric;
  vol_points numeric;
  missing_certs text[];
begin
  select * into o from public.coffee_offers where id = p_offer_id;
  select * into r from public.coffee_purchase_requests where id = p_request_id;
  if o.id is null or r.id is null then
    return jsonb_build_object('eligible', false, 'reason', 'oferta ou solicitacao inexistente');
  end if;

  -- ---- eliminatórios ----
  if o.species is distinct from r.species then
    return jsonb_build_object('eligible', false, 'reason', 'especie diferente');
  end if;

  if r.harvest_year is not null and o.harvest_year is not null
     and o.harvest_year <> r.harvest_year then
    return jsonb_build_object('eligible', false, 'reason', 'safra diferente da exigida');
  end if;

  if r.sca_min is not null and (o.sca_score is null or o.sca_score < r.sca_min) then
    return jsonb_build_object('eligible', false, 'reason', 'pontuacao SCA abaixo do minimo exigido');
  end if;

  if array_length(r.certifications_required, 1) is not null then
    select array_agg(c) into missing_certs
      from unnest(r.certifications_required) c
     where not (c = any(o.certifications));
    if missing_certs is not null then
      return jsonb_build_object('eligible', false, 'reason',
        'certificacao exigida ausente: ' || array_to_string(missing_certs, ', '));
    end if;
  end if;

  if r.moisture_max is not null and o.moisture_pct is not null
     and o.moisture_pct > r.moisture_max then
    return jsonb_build_object('eligible', false, 'reason', 'umidade acima do maximo aceito');
  end if;

  if r.defect_type_max is not null and o.defect_type is not null
     and o.defect_type > r.defect_type_max then
    return jsonb_build_object('eligible', false, 'reason', 'tipo/classificacao acima do maximo aceito');
  end if;

  -- ---- espécie (20) ----
  score := score + 20;
  factors := factors || jsonb_build_object('fator','especie','resultado','match','peso',20,'ganho',20);

  -- ---- bebida (15) ----
  select ordinal into o_bebida from public.coffee_bebida_scale where code = o.bebida;
  select ordinal into r_bebida from public.coffee_bebida_scale where code = r.bebida_min;
  if r_bebida is null then
    score := score + 15;
    factors := factors || jsonb_build_object('fator','bebida','resultado','nao exigido','peso',15,'ganho',15);
  elsif o_bebida is null then
    factors := factors || jsonb_build_object('fator','bebida','resultado','oferta nao informou','peso',15,'ganho',0);
  elsif o_bebida >= r_bebida then
    score := score + 15;
    factors := factors || jsonb_build_object('fator','bebida','resultado','match','peso',15,'ganho',15);
  else
    factors := factors || jsonb_build_object('fator','bebida','resultado','abaixo do pedido','peso',15,'ganho',0);
  end if;

  -- ---- peneira (15) ----
  if r.screen_min is null then
    score := score + 15;
    factors := factors || jsonb_build_object('fator','peneira','resultado','nao exigido','peso',15,'ganho',15);
  elsif o.screen_min is null then
    factors := factors || jsonb_build_object('fator','peneira','resultado','oferta nao informou','peso',15,'ganho',0);
  elsif o.screen_min >= r.screen_min then
    score := score + 15;
    factors := factors || jsonb_build_object('fator','peneira','resultado','match','peso',15,'ganho',15);
  else
    factors := factors || jsonb_build_object('fator','peneira','resultado','abaixo do pedido','peso',15,'ganho',0);
  end if;

  -- ---- processo (15) ----
  if array_length(r.process_accepted, 1) is null then
    score := score + 15;
    factors := factors || jsonb_build_object('fator','processo','resultado','nao exigido','peso',15,'ganho',15);
  elsif o.process is not null and o.process = any(r.process_accepted) then
    score := score + 15;
    factors := factors || jsonb_build_object('fator','processo','resultado','match','peso',15,'ganho',15);
  else
    factors := factors || jsonb_build_object('fator','processo','resultado','fora da lista aceita','peso',15,'ganho',0);
  end if;

  -- ---- volume (15) — proporcional, gera "parcial" ----
  vol_ratio := least(o.quantity_bags / nullif(r.quantity_bags, 0), 1);
  vol_points := round(15 * coalesce(vol_ratio, 0), 2);
  score := score + vol_points;
  factors := factors || jsonb_build_object(
    'fator','volume',
    'resultado', case when coalesce(vol_ratio,0) >= 1 then 'match' else 'parcial' end,
    'peso',15,'ganho',vol_points,
    'detalhe', format('%s de %s sacas', o.quantity_bags, r.quantity_bags));

  -- ---- região (10) ----
  if r.origin_uf is null then
    score := score + 10;
    factors := factors || jsonb_build_object('fator','regiao','resultado','nao exigida','peso',10,'ganho',10);
  elsif o.origin_uf is not null and o.origin_uf = r.origin_uf then
    score := score + 10;
    factors := factors || jsonb_build_object('fator','regiao','resultado','match','peso',10,'ganho',10);
  else
    factors := factors || jsonb_build_object('fator','regiao','resultado','origem diferente','peso',10,'ganho',0);
  end if;

  -- ---- preço (10) ----
  if r.target_price_max is null or o.asking_price_brl_bag is null then
    score := score + 10;
    factors := factors || jsonb_build_object('fator','preco','resultado','sem faixa definida','peso',10,'ganho',10);
  elsif o.asking_price_brl_bag <= r.target_price_max then
    score := score + 10;
    factors := factors || jsonb_build_object('fator','preco','resultado','dentro da faixa','peso',10,'ganho',10);
  else
    factors := factors || jsonb_build_object('fator','preco','resultado','acima da faixa','peso',10,'ganho',0);
  end if;

  return jsonb_build_object(
    'eligible', true,
    'score', round(score, 2),
    'fatores', factors,
    'calculado_em', now()
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.coffee_offer_mark_sold(p_offer_id uuid, p_externally boolean DEFAULT true, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_prev jsonb;
begin
  select to_jsonb(o) into v_prev from public.coffee_offers o where o.id = p_offer_id;
  if v_prev is null then raise exception 'oferta inexistente'; end if;

  if not (public.is_admin() or exists (
        select 1 from public.coffee_offers o
         where o.id = p_offer_id
           and o.entity_id in (select public.my_network_entity_ids()))) then
    raise exception 'sem permissao para dar baixa nesta oferta';
  end if;

  update public.coffee_offers
     set status = 'sold', sold_externally = p_externally,
         sold_at = now(), sold_note = p_note, updated_at = now()
   where id = p_offer_id;

  insert into public.network_audit_log (action, entity_table, entity_id, previous_state, new_state, reason)
  values ('oferta.baixa', 'coffee_offers', p_offer_id, v_prev,
          jsonb_build_object('status','sold','sold_externally', p_externally), p_note);
end;
$function$;
CREATE OR REPLACE FUNCTION public.coffee_offer_moderate(p_offer_id uuid, p_decision text, p_note text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prev jsonb;
  v_new_status text;
begin
  if not public.is_admin() then
    raise exception 'apenas a equipe COFICO pode moderar ofertas';
  end if;

  select to_jsonb(o) into v_prev from public.coffee_offers o where o.id = p_offer_id;
  if v_prev is null then raise exception 'oferta inexistente'; end if;

  v_new_status := case p_decision
    when 'approve'         then 'approved'
    when 'reject'          then 'rejected'
    when 'request_changes' then 'draft'
    else null end;
  if v_new_status is null then
    raise exception 'decisao invalida: use approve, reject ou request_changes';
  end if;

  update public.coffee_offers
     set status = v_new_status, moderation_note = p_note,
         reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   where id = p_offer_id;

  insert into public.network_audit_log (action, entity_table, entity_id, previous_state, new_state, reason)
  values ('oferta.moderada', 'coffee_offers', p_offer_id, v_prev,
          jsonb_build_object('status', v_new_status), p_note);

  return v_new_status;
end;
$function$;
CREATE OR REPLACE FUNCTION public.coffee_offer_photo_moderate(p_photo_id uuid, p_decision text, p_note text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_prev jsonb; v_status text;
begin
  if not public.is_admin() then
    raise exception 'apenas a equipe COFICO pode moderar fotos';
  end if;

  select to_jsonb(p) into v_prev from public.coffee_offer_photos p where p.id = p_photo_id;
  if v_prev is null then raise exception 'foto inexistente'; end if;

  v_status := case p_decision when 'approve' then 'approved'
                              when 'reject'  then 'rejected' else null end;
  if v_status is null then raise exception 'decisao invalida: use approve ou reject'; end if;

  update public.coffee_offer_photos
     set moderation_status = v_status, moderation_note = p_note,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_photo_id;

  insert into public.network_audit_log (action, entity_table, entity_id, previous_state, new_state, reason)
  values ('oferta.foto_moderada','coffee_offer_photos', p_photo_id, v_prev,
          jsonb_build_object('moderation_status', v_status), p_note);

  return v_status;
end;
$function$;
CREATE OR REPLACE FUNCTION public.coffee_offer_publish(p_offer_id uuid, p_hours integer DEFAULT 24)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prev jsonb;
  v_until timestamptz;
  v_status text;
begin
  select to_jsonb(o) , o.status into v_prev, v_status
    from public.coffee_offers o where o.id = p_offer_id;
  if v_prev is null then raise exception 'oferta inexistente'; end if;

  if not (public.is_admin() or exists (
        select 1 from public.coffee_offers o
         where o.id = p_offer_id
           and o.entity_id in (select public.my_network_entity_ids()))) then
    raise exception 'sem permissao para publicar esta oferta';
  end if;

  if v_status <> 'approved' then
    raise exception 'oferta precisa estar aprovada pela COFICO antes de publicar (status atual: %)', v_status;
  end if;

  v_until := now() + make_interval(hours => p_hours);

  update public.coffee_offers
     set status = 'active', published_at = now(),
         exclusive_until = v_until, updated_at = now()
   where id = p_offer_id;

  insert into public.network_audit_log (action, entity_table, entity_id, previous_state, new_state, reason)
  values ('oferta.publicada', 'coffee_offers', p_offer_id, v_prev,
          jsonb_build_object('status','active','exclusive_until', v_until),
          format('janela de exclusividade de %s horas', p_hours));

  return v_until;
end;
$function$;
CREATE OR REPLACE FUNCTION public.cofico_dispatch_route(p_driver_id uuid, p_scheduled_date date, p_order_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_route_id uuid;
  v_order record;
  v_seq int := 0;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas admin pode despachar rota.'; END IF;
  IF p_order_ids IS NULL OR array_length(p_order_ids,1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um pedido.';
  END IF;

  INSERT INTO public.delivery_routes(driver_id, scheduled_date, status, planned_by, planned_at, dispatched_at)
    VALUES (p_driver_id, p_scheduled_date, 'dispatched', auth.uid(), now(), now())
    RETURNING id INTO v_route_id;

  FOR v_order IN
    SELECT o.id, o.company_id, cl.razao_social, cl.endereco_completo, cl.bairro, cl.lat, cl.lng
    FROM public.representative_orders o
    LEFT JOIN public.representative_clients cl ON cl.id = o.representative_client_id
    WHERE o.id = ANY(p_order_ids) AND o.delivery_mode = 'cofico' AND o.delivery_dispatched_at IS NULL
    ORDER BY array_position(p_order_ids, o.id)
  LOOP
    v_seq := v_seq + 1;
    INSERT INTO public.delivery_stops(route_id, order_id, company_id, stop_order, client_name, address, zone, lat, lng, status)
      VALUES (v_route_id, v_order.id, v_order.company_id, v_seq, v_order.razao_social, v_order.endereco_completo, v_order.bairro, v_order.lat, v_order.lng, 'pending');
    UPDATE public.representative_orders SET delivery_dispatched_at = now() WHERE id = v_order.id;
    INSERT INTO public.delivery_dispatch_audit(order_id, changed_by, field, new_value, note)
      VALUES (v_order.id, auth.uid(), 'dispatch', v_route_id::text, 'despachado na rota');
  END LOOP;

  IF v_seq = 0 THEN
    DELETE FROM public.delivery_routes WHERE id = v_route_id;  -- nada elegível
    RAISE EXCEPTION 'Nenhum pedido elegível (já despachado ou não é COFICO).';
  END IF;

  UPDATE public.delivery_routes SET total_stops = v_seq WHERE id = v_route_id;
  RETURN v_route_id;
END $function$;
CREATE OR REPLACE FUNCTION public.cofico_public_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'entregas', (SELECT count(*) FROM representative_orders WHERE delivered_at IS NOT NULL),
    'clientes', (SELECT count(DISTINCT representative_client_id) FROM representative_orders WHERE delivered_at IS NOT NULL)
  );
$function$;
CREATE OR REPLACE FUNCTION public.consume_stock_fifo(p_product_id uuid, p_quantity integer, p_channel text DEFAULT NULL::text, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid, p_company_id uuid DEFAULT NULL::uuid, p_movement_type text DEFAULT 'venda'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_restante int;
  v_tirar    int;
  v_lote     record;
  v_saidas   jsonb := '[]'::jsonb;
  v_produto  uuid := p_product_id;
  v_qtd      int  := p_quantity;
  v_kit      record;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('consumido', 0, 'sem_lote', 0, 'saidas', v_saidas);
  END IF;

  -- Kit não tem estoque próprio: a baixa acontece no café, multiplicada pelo
  -- tamanho do kit. A tradução fica aqui, dentro da função que todo canal
  -- chama, para que ninguém esqueça de multiplicar num canal novo.
  SELECT kit_of_product_id, kit_quantity INTO v_kit
    FROM public.products WHERE id = p_product_id;
  IF v_kit.kit_of_product_id IS NOT NULL AND coalesce(v_kit.kit_quantity, 0) > 0 THEN
    v_produto := v_kit.kit_of_product_id;
    v_qtd     := p_quantity * v_kit.kit_quantity;
  END IF;

  v_restante := v_qtd;

  FOR v_lote IN
    SELECT id, batch_number, quantity_packages, company_id
      FROM public.green_coffee_lots
     WHERE product_id = v_produto
       AND status = 'active'
       AND coalesce(quantity_packages, 0) > 0
     ORDER BY production_date NULLS LAST, batch_number   -- o mais antigo sai primeiro
     FOR UPDATE
  LOOP
    EXIT WHEN v_restante <= 0;

    v_tirar := LEAST(v_restante, v_lote.quantity_packages);

    UPDATE public.green_coffee_lots
       SET quantity_packages = quantity_packages - v_tirar,
           status = CASE WHEN quantity_packages - v_tirar <= 0 THEN 'consumed' ELSE status END,
           updated_at = now()
     WHERE id = v_lote.id;

    INSERT INTO public.stock_movements
      (product_id, lot_id, batch_number, quantity, movement_type, channel, company_id, reference_type, reference_id)
    VALUES
      (v_produto, v_lote.id, v_lote.batch_number, -v_tirar, p_movement_type, p_channel,
       coalesce(p_company_id, v_lote.company_id), p_reference_type, p_reference_id);

    v_saidas := v_saidas || jsonb_build_object('lote', v_lote.batch_number, 'quantidade', v_tirar);
    v_restante := v_restante - v_tirar;
  END LOOP;

  IF v_restante > 0 THEN
    INSERT INTO public.stock_movements
      (product_id, lot_id, batch_number, quantity, movement_type, channel, company_id,
       reference_type, reference_id, sem_lote, notes)
    VALUES
      (v_produto, NULL, NULL, -v_restante, p_movement_type, p_channel, p_company_id,
       p_reference_type, p_reference_id, true, 'Venda sem lote disponivel: repor estoque');
  END IF;

  RETURN jsonb_build_object(
    'consumido', v_qtd - v_restante,
    'sem_lote',  v_restante,
    'saidas',    v_saidas
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.consume_stock_on_order_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item record;
  v_canal text;
BEGIN
  IF NEW.status <> 'approved' OR coalesce(OLD.status, '') = 'approved' THEN
    RETURN NEW;
  END IF;

  -- O canal vem da empresa que faturou, que já está no pedido.
  SELECT CASE WHEN c.order_prefix = 'CO' THEN 'cofico' ELSE 'saporino' END
    INTO v_canal
    FROM public.companies c WHERE c.id = NEW.seller_company_id;

  FOR v_item IN
    SELECT product_id, quantity FROM public.order_items
     WHERE order_id = NEW.id AND product_id IS NOT NULL
  LOOP
    PERFORM public.consume_stock_fifo(
      v_item.product_id, v_item.quantity, coalesce(v_canal, 'saporino'),
      'order', NEW.id, NEW.seller_company_id, 'venda'
    );
  END LOOP;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.cotar_frete(p_table_id uuid, p_cep text, p_peso_kg numeric, p_valor numeric DEFAULT 0, p_subsidio_kg numeric DEFAULT 0)
 RETURNS TABLE(zona text, uf text, cidade text, dias integer, transporte numeric, seguro numeric, gris numeric, pedagio numeric, tas numeric, desconto numeric, preco numeric, atendido boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cep       integer;
  v_cob       record;
  v_tab       record;
  v_faixa     numeric;
  v_base      numeric;
  v_adicional numeric;
  v_seguro    numeric := 0;
  v_gris      numeric := 0;
  v_pedagio   numeric := 0;
  v_tas       numeric := 0;
  v_desconto  numeric := 0;
  v_total     numeric := 0;
begin
  v_cep := nullif(regexp_replace(coalesce(p_cep, ''), '\D', '', 'g'), '')::integer;
  select * into v_tab from shipping_rate_tables where id = p_table_id and is_active;

  if v_cep is null or not found then
    return query select null::text, null::text, null::text, null::integer,
                        null::numeric, null::numeric, null::numeric, null::numeric,
                        null::numeric, null::numeric, null::numeric, false;
    return;
  end if;

  select * into v_cob from shipping_coverage
   where table_id = p_table_id and v_cep between cep_ini and cep_fim
   order by cep_ini limit 1;

  if not found then
    return query select null::text, null::text, null::text, null::integer,
                        null::numeric, null::numeric, null::numeric, null::numeric,
                        null::numeric, null::numeric, null::numeric, false;
    return;
  end if;

  -- Menor faixa de peso que comporta o pedido. Cobrança por faixa: 1 kg paga
  -- o valor de 10 kg, porque é assim que a transportadora cobra.
  select r.weight_kg, r.price into v_faixa, v_base
    from shipping_rates r
   where r.table_id = p_table_id and r.zone_code = v_cob.zone_code
     and r.weight_kg is not null and r.weight_kg >= greatest(p_peso_kg, 0)
   order by r.weight_kg limit 1;

  -- Acima da última faixa, cobra a última faixa mais o adicional por quilo.
  if v_base is null then
    select r.weight_kg, r.price into v_faixa, v_base
      from shipping_rates r
     where r.table_id = p_table_id and r.zone_code = v_cob.zone_code and r.weight_kg is not null
     order by r.weight_kg desc limit 1;
    if v_base is null then
      return query select v_cob.zone_code, v_cob.uf, v_cob.city, v_cob.days,
                          null::numeric, null::numeric, null::numeric, null::numeric,
                          null::numeric, null::numeric, null::numeric, false;
      return;
    end if;
    select r.price into v_adicional from shipping_rates r
     where r.table_id = p_table_id and r.zone_code = v_cob.zone_code and r.weight_kg is null;
    v_base := v_base + coalesce(v_adicional, 0) * greatest(p_peso_kg - v_faixa, 0);
  end if;

  -- Seguro e GRIS incidem sobre o VALOR da mercadoria, não sobre o peso. O
  -- GRIS tem piso: num pedido de R$ 100 o percentual daria R$ 0,20, e o piso
  -- é que manda.
  v_seguro := coalesce(p_valor, 0) * v_tab.insurance_pct / 100.0;
  v_gris   := greatest(coalesce(p_valor, 0) * v_tab.gris_pct / 100.0, v_tab.gris_min);

  -- Pedágio por 100 kg OU FRAÇÃO: sempre pelo menos uma fração, mesmo em
  -- 500 g. Arredondar para cima é a regra da tabela, não um exagero nosso.
  if v_tab.toll_per_100kg > 0 then
    v_pedagio := v_tab.toll_per_100kg * greatest(ceil(greatest(p_peso_kg, 0) / 100.0), 1);
  end if;

  -- TAS: só quando o CT-e cruza a fronteira do estado de origem. Sem UF de
  -- origem cadastrada não dá para afirmar que é interestadual — e cobrar por
  -- suposição é pior que não cobrar.
  if v_tab.tas_fee > 0 and v_tab.origin_uf is not null
     and v_cob.uf is not null and v_cob.uf <> v_tab.origin_uf then
    v_tas := v_tab.tas_fee;
  end if;

  v_total := v_base + v_seguro + v_gris + v_pedagio + v_tas;

  -- O desconto nunca deixa o frete ficar negativo: no máximo, sai de graça.
  v_desconto := least(coalesce(p_subsidio_kg, 0) * greatest(p_peso_kg, 0), v_total);

  return query select v_cob.zone_code, v_cob.uf, v_cob.city, v_cob.days,
                      round(v_base, 2), round(v_seguro, 2), round(v_gris, 2),
                      round(v_pedagio, 2), round(v_tas, 2), round(v_desconto, 2),
                      round(v_total - v_desconto, 2), true;
end $function$;
CREATE OR REPLACE FUNCTION public.create_boleto_commission_payout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_comm     public.representative_commissions%ROWTYPE;
  v_cyc      RECORD;
  v_date     date;
  v_slice    numeric;
  v_already  numeric;
  v_all_paid boolean;
BEGIN
  IF NEW.status <> 'paid' OR (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_comm FROM public.representative_commissions WHERE order_id = NEW.order_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_date := COALESCE(NEW.paid_at::date, CURRENT_DATE);
  SELECT * INTO v_cyc FROM public.repco_commission_cycle(v_date, 'boleto');

  v_all_paid := NOT EXISTS (
    SELECT 1 FROM public.representative_order_installments
    WHERE order_id = NEW.order_id AND status <> 'paid'
  );

  IF v_all_paid THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_already
      FROM public.representative_commission_payouts WHERE commission_id = v_comm.id;
    v_slice := v_comm.commission_amount - v_already;
  ELSE
    v_slice := ROUND(v_comm.commission_amount * NEW.amount / NULLIF(v_comm.order_amount, 0), 2);
  END IF;

  INSERT INTO public.representative_commission_payouts (
    commission_id, installment_id, representative_id, company_id, amount, payment_method,
    cycle_start, cycle_end, scheduled_payment_date, status
  ) VALUES (
    v_comm.id, NEW.id, v_comm.representative_id, v_comm.company_id, v_slice, 'boleto',
    v_cyc.cycle_start, v_cyc.cycle_end, v_cyc.scheduled, 'scheduled'
  )
  ON CONFLICT (installment_id) WHERE installment_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.create_pix_commission_payout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- a vista (pix, deposito, dinheiro, a_vista): gera o payout agendado direto.
  -- boleto NAO passa por aqui (libera por parcela em create_boleto_commission_payout).
  IF NEW.payment_method <> 'boleto' AND NEW.scheduled_payment_date IS NOT NULL THEN
    INSERT INTO public.representative_commission_payouts (
      commission_id, installment_id, representative_id, company_id, amount, payment_method,
      cycle_start, cycle_end, scheduled_payment_date, status
    ) VALUES (
      NEW.id, NULL, NEW.representative_id, NEW.company_id, NEW.commission_amount, NEW.payment_method,
      NEW.payment_cycle_start, NEW.payment_cycle_end, NEW.scheduled_payment_date, 'scheduled'
    )
    ON CONFLICT (commission_id) WHERE installment_id IS NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.criar_kits(p_produto_id uuid, p_degraus jsonb)
 RETURNS TABLE(quantidade integer, sku text, preco numeric, por_pacote numeric, por_kg numeric, criado boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_base    record;
  v_d       jsonb;
  v_qtd     int;
  v_ppp     numeric;
  v_total   numeric;
  v_kg      numeric;
  v_ant_kg  numeric;
  v_sku     text;
  v_id      uuid;
  v_novo    boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'apenas administrador';
  END IF;

  SELECT * INTO v_base FROM public.products WHERE id = p_produto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'produto nao encontrado'; END IF;
  IF v_base.kit_of_product_id IS NOT NULL THEN
    RAISE EXCEPTION 'nao da para criar kit de um kit';
  END IF;

  -- O avulso é o primeiro degrau: o R$/kg dele é o teto de todos os outros.
  v_ant_kg := v_base.price / (coalesce(nullif(v_base.weight_grams, 0), 500) / 1000.0);

  FOR v_d IN SELECT value FROM jsonb_array_elements(p_degraus) t(value)
             ORDER BY (t.value->>'quantidade')::int
  LOOP
    v_qtd := (v_d->>'quantidade')::int;
    v_ppp := (v_d->>'preco_por_pacote')::numeric;
    IF v_qtd IS NULL OR v_qtd < 2 THEN RAISE EXCEPTION 'kit precisa de 2 pacotes ou mais'; END IF;
    IF v_ppp IS NULL OR v_ppp <= 0 THEN RAISE EXCEPTION 'preco por pacote invalido no kit de %', v_qtd; END IF;

    v_total := round(v_ppp * v_qtd, 2);
    v_kg    := round(v_total / (v_qtd * coalesce(nullif(v_base.weight_grams, 0), 500) / 1000.0), 2);

    IF v_kg >= v_ant_kg THEN
      RAISE EXCEPTION
        'O kit de % sai a R$ %/kg e o degrau anterior sai a R$ %/kg. O preco por quilo tem que cair sempre — senao o cliente paga mais e leva menos cafe.',
        v_qtd, to_char(v_kg, 'FM999G990D00'), to_char(v_ant_kg, 'FM999G990D00');
    END IF;
    v_ant_kg := v_kg;

    v_sku := public.kit_sku(v_base.sku, p_produto_id, v_qtd);

    SELECT id INTO v_id FROM public.products
      WHERE kit_of_product_id = p_produto_id AND kit_quantity = v_qtd;
    v_novo := v_id IS NULL;

    IF v_novo THEN
      INSERT INTO public.products (
        name, description, price, category, image_url, company_id, product_line,
        roast_type, flavor_notes, weight_grams, is_active, sales_channels,
        kit_of_product_id, kit_quantity, sku, display_order
      ) VALUES (
        public.kit_nome(v_base.name, v_qtd, v_base.weight_grams),
        v_base.description, v_total, v_base.category, v_base.image_url, v_base.company_id,
        v_base.product_line, v_base.roast_type, v_base.flavor_notes,
        v_qtd * coalesce(nullif(v_base.weight_grams, 0), 500), true, v_base.sales_channels,
        p_produto_id, v_qtd, v_sku, coalesce(v_base.display_order, 0) + v_qtd
      ) RETURNING id INTO v_id;
    ELSE
      UPDATE public.products p SET
        name = public.kit_nome(v_base.name, v_qtd, v_base.weight_grams),
        price = v_total,
        weight_grams = v_qtd * coalesce(nullif(v_base.weight_grams, 0), 500),
        description = v_base.description,
        -- Foto própria não é tocada. Sem esta condição, quem subisse a foto do
        -- fardo a perderia no próximo ajuste de preço.
        image_url = CASE WHEN p.has_custom_image THEN p.image_url ELSE v_base.image_url END,
        sales_channels = v_base.sales_channels,
        sku = v_sku,
        is_active = true
      WHERE p.id = v_id;
    END IF;

    RETURN QUERY SELECT v_qtd, v_sku, v_total, v_ppp, v_kg, v_novo;
  END LOOP;
END $function$;
CREATE OR REPLACE FUNCTION public.decrement_stock_on_repco_order()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  item RECORD;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    FOR item IN
      SELECT product_id, quantity
      FROM representative_order_items
      WHERE order_id = NEW.id
    LOOP
      UPDATE public.products
      SET stock = GREATEST(0, stock - item.quantity),
          in_stock = CASE WHEN GREATEST(0, stock - item.quantity) > 0 THEN true ELSE false END
      WHERE id = item.product_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.espelhar_foto_nos_kits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.image_url IS DISTINCT FROM OLD.image_url AND NEW.kit_of_product_id IS NULL THEN
    UPDATE public.products
       SET image_url = NEW.image_url
     WHERE kit_of_product_id = NEW.id
       AND has_custom_image = false;
  END IF;
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.exec_migration(q text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ BEGIN EXECUTE q; END; $function$;
CREATE OR REPLACE FUNCTION public.exec_select(q text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE r jsonb;
BEGIN
  EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || q || ') t' INTO r;
  RETURN r;
END $function$;
CREATE OR REPLACE FUNCTION public.generate_batch_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE v_code TEXT; v_next INT;
BEGIN
  IF NEW.batch_number IS NULL OR btrim(NEW.batch_number) = '' THEN
    SELECT company_code::text INTO v_code FROM roasting_companies WHERE id = NEW.roasting_company_id;
    IF v_code IS NULL THEN
      NEW.batch_number := to_char(NOW(),'YYYY') || '-' || LPAD((COALESCE((SELECT MAX((split_part(batch_number,'-',2))::int) FROM green_coffee_lots WHERE batch_number ~ '^[0-9]+-[0-9]+$'),0)+1)::text,3,'0');
    ELSE
      SELECT COALESCE(MAX((split_part(batch_number,'-',2))::int),0)+1 INTO v_next FROM green_coffee_lots WHERE roasting_company_id = NEW.roasting_company_id AND batch_number ~ ('^'||v_code||'-[0-9]+$');
      NEW.batch_number := v_code || '-' || LPAD(v_next::text,3,'0');
    END IF;
  END IF;
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  new_number TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate order number: ORD-YYYYMMDD-XXXXX (5 random digits)
    new_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
    
    -- Check if it exists
    SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = new_number) INTO exists_check;
    
    -- If it doesn't exist, return it
    IF NOT exists_check THEN
      RETURN new_number;
    END IF;
  END LOOP;
END;
$function$;
CREATE OR REPLACE FUNCTION public.generate_order_number(p_order_type text DEFAULT 'PF'::text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  prefix TEXT;
  seq_num INTEGER;
  new_number TEXT;
  counter INTEGER := 0;
BEGIN
  prefix := CASE p_order_type
    WHEN 'PJ' THEN 'PJ'
    WHEN 'RC' THEN 'RC'
    WHEN 'ML' THEN 'ML'
    WHEN 'SH' THEN 'SH'
    WHEN 'AZ' THEN 'AZ'
    WHEN 'TK' THEN 'TK'
    ELSE 'PF'
  END;

  LOOP
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO seq_num
    FROM public.orders
    WHERE order_number LIKE prefix || '%';

    new_number := prefix || LPAD(seq_num::TEXT, 6, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.orders WHERE order_number = new_number
    );

    counter := counter + 1;
    IF counter > 100 THEN
      new_number := prefix || LPAD((FLOOR(RANDOM() * 999999 + 1))::TEXT, 6, '0');
      EXIT;
    END IF;
  END LOOP;

  RETURN new_number;
END;
$function$;
CREATE OR REPLACE FUNCTION public.generate_repco_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix text;
  v_n      integer;
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    -- prefixo por empresa: CS = Cafe Saporino, CF = Cafe Fazendinha (fallback RC)
    IF NEW.company_id IS NOT NULL THEN
      SELECT order_prefix INTO v_prefix FROM public.companies WHERE id = NEW.company_id;
      v_prefix := COALESCE(v_prefix, 'RC');
      -- contador atomico por empresa (cada empresa comeca do 1)
      INSERT INTO public.company_order_counters (company_id, last_number)
        VALUES (NEW.company_id, 1)
        ON CONFLICT (company_id) DO UPDATE SET last_number = public.company_order_counters.last_number + 1
        RETURNING last_number INTO v_n;
      NEW.order_number := v_prefix || '-' || LPAD(v_n::text, 5, '0');
    ELSE
      -- pedido sem empresa (nao deveria ocorrer): usa a sequencia global legada
      NEW.order_number := 'RC-' || LPAD(nextval('repco_order_seq')::text, 5, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_order_public(p_order_id uuid, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_hash text;
  v_order orders%ROWTYPE;
  v_items jsonb;
BEGIN
  IF p_order_id IS NULL OR p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL;
  END IF;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_order FROM orders
  WHERE id = p_order_id AND order_public_token_hash = v_hash;

  IF NOT FOUND THEN
    RETURN NULL; -- genérico: não revela se o pedido existe
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'product_name', oi.product_name,
           'quantity', oi.quantity
         )), '[]'::jsonb)
  INTO v_items
  FROM order_items oi WHERE oi.order_id = v_order.id;

  RETURN jsonb_build_object(
    'order_number', v_order.order_number,
    'status', v_order.status,
    'total_amount', v_order.total_amount,
    'created_at', v_order.created_at,
    'items', v_items
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.handle_client_snooze()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.inactivity_snoozed_until IS DISTINCT FROM OLD.inactivity_snoozed_until
    AND NEW.inactivity_snoozed_until IS NOT NULL THEN
    NEW.snooze_count := COALESCE(OLD.snooze_count, 0) + 1;
    IF NEW.snooze_count >= 2 THEN
      NEW.snooze_admin_alert := TRUE;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, is_admin)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', false);
  RETURN new;
END;
$function$;
CREATE OR REPLACE FUNCTION public.has_role(p_role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ SELECT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role_code = p_role AND ur.is_active) $function$;
CREATE OR REPLACE FUNCTION public.has_role(p_role text, p_company uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ SELECT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role_code = p_role AND ur.is_active AND (ur.company_id = p_company OR ur.company_id IS NULL)) $function$;
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$function$;
CREATE OR REPLACE FUNCTION public.is_chat_member(conv uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$ select exists(select 1 from chat_participants where conversation_id=conv and user_id=auth.uid()) $function$;
CREATE OR REPLACE FUNCTION public.kit_disponivel(p_produto_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
  select case
    when p.kit_of_product_id is null then coalesce(p.stock, 0)
    else floor(coalesce(b.stock, 0)::numeric / greatest(p.kit_quantity, 1))::int
  end
  from public.products p
  left join public.products b on b.id = p.kit_of_product_id
  where p.id = p_produto_id;
$function$;
CREATE OR REPLACE FUNCTION public.kit_nome(p_base text, p_qtd integer, p_gramas integer)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select p_base || case when p_qtd >= 10
    then ' — Fardo ' || public.kit_peso_texto(p_qtd * coalesce(nullif(p_gramas, 0), 500)) || ' kg'
    else ' — Kit ' || p_qtd || ' × ' || coalesce(nullif(p_gramas, 0), 500) || ' g' end;
$function$;
CREATE OR REPLACE FUNCTION public.kit_peso_texto(p_gramas numeric)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select replace(
           rtrim(rtrim((p_gramas / 1000.0)::numeric(10,1)::text, '0'), '.'),
           '.', ','
         );
$function$;
CREATE OR REPLACE FUNCTION public.kit_sku(p_base_sku text, p_produto_id uuid, p_qtd integer)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select
    -- Família: o SKU do avulso sem o último segmento (U01). Sem SKU cadastrado,
    -- cai num código derivado do id, que é feio mas nunca colide.
    coalesce(
      nullif(regexp_replace(coalesce(p_base_sku, ''), '-[A-Z]\d+$', ''), ''),
      'P' || upper(left(replace(p_produto_id::text, '-', ''), 6))
    )
    || '-'
    || case
         -- Fardo é medido em fardos, não em pacotes: 10 pacotes = F01.
         when p_qtd >= 10 and p_qtd % 10 = 0 then 'F' || lpad((p_qtd / 10)::text, 2, '0')
         else 'K' || lpad(p_qtd::text, 2, '0')
       end;
$function$;
CREATE OR REPLACE FUNCTION public.limpar_carrinhos_abandonados(p_horas integer DEFAULT 24, p_aplicar boolean DEFAULT false)
 RETURNS TABLE(pedidos integer, itens integer, mais_antigo timestamp with time zone, aplicado boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ids  uuid[];
  v_qtd  integer;
  v_itens integer;
  v_velho timestamptz;
begin
  if not public.is_admin() then
    raise exception 'apenas administrador';
  end if;

  -- Nunca menos de uma hora: abaixo disso o risco de apagar uma compra em
  -- andamento é real.
  p_horas := greatest(coalesce(p_horas, 24), 1);

  select array_agg(o.id), count(*)::int, min(o.created_at)
    into v_ids, v_qtd, v_velho
  from public.orders o
  where o.status = 'pending'
    and o.mercadopago_payment_id is null
    and o.paid_at is null
    and o.created_at < now() - make_interval(hours => p_horas);

  v_qtd := coalesce(v_qtd, 0);
  if v_qtd = 0 then
    return query select 0, 0, null::timestamptz, p_aplicar;
    return;
  end if;

  select count(*)::int into v_itens from public.order_items where order_id = any(v_ids);

  -- Sem aplicar, só conta. Ninguém apaga o que não viu antes.
  if not p_aplicar then
    return query select v_qtd, v_itens, v_velho, false;
    return;
  end if;

  delete from public.order_items where order_id = any(v_ids);
  delete from public.orders     where id = any(v_ids);

  return query select v_qtd, v_itens, v_velho, true;
end $function$;
CREATE OR REPLACE FUNCTION public.limpar_cotacoes_vencidas()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_n integer;
begin
  delete from public.shipping_quotes where expires_at < now() - interval '1 day';
  get diagnostics v_n = row_count;
  return v_n;
end $function$;
CREATE OR REPLACE FUNCTION public.lv_aplicar_preco(p_product uuid, p_preco_cents bigint, p_origem text DEFAULT 'copiloto'::text, p_motivo text DEFAULT NULL::text, p_recomendacao jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v record;
  v_status text;
  v_hist uuid;
begin
  -- "automatico" existe no vocabulário para o futuro, mas nesta fase nada
  -- muda preço sem o vendedor autorizar.
  if p_origem not in ('manual', 'copiloto', 'promocao') then
    raise exception 'Origem de alteração não permitida.';
  end if;

  select id, seller_id, preco_cents, preco_minimo_cents into v
    from public.lv_products where id = p_product;
  if not found or not (v.seller_id = any(public.lv_meus_vendedores()) or public.is_admin()) then
    raise exception 'Produto não encontrado.';
  end if;
  if p_preco_cents is null or p_preco_cents <= 0 then
    raise exception 'Preço inválido.';
  end if;
  if v.preco_minimo_cents is not null and p_preco_cents < v.preco_minimo_cents then
    raise exception 'O novo preço fica abaixo do seu preço mínimo. Nada foi alterado.';
  end if;
  if p_preco_cents = v.preco_cents then
    raise exception 'O produto já está com este preço.';
  end if;

  perform set_config('lv.preco_origem', p_origem, true);
  perform set_config('lv.preco_motivo', coalesce(left(p_motivo, 500), ''), true);
  perform set_config('lv.preco_recomendacao', coalesce(p_recomendacao::text, ''), true);
  perform set_config('lv.preco_desfaz', '', true);

  update public.lv_products set preco_cents = p_preco_cents, updated_at = now()
   where id = p_product
  returning status into v_status;

  perform public.lv_limpar_contexto_de_preco();

  select id into v_hist from public.lv_price_history
   where product_id = p_product order by created_at desc limit 1;

  return jsonb_build_object(
    'history_id', v_hist, 'status', v_status,
    'preco_anterior_cents', v.preco_cents, 'preco_novo_cents', p_preco_cents);
end;
$function$;
CREATE OR REPLACE FUNCTION public.lv_b2b_solicitar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_empresa uuid;
  v_id uuid;
  v_nome text := btrim(coalesce(p->>'nome', ''));
  v_tipo text := coalesce(p->>'tipo_negocio', '');
  v_freq text := coalesce(p->>'frequencia', '');
  v_qtd int;
  v_uf text := upper(nullif(btrim(coalesce(p->>'uf', '')), ''));
begin
  if length(v_nome) < 2 or length(v_nome) > 120 then raise exception 'Informe o nome da empresa.'; end if;
  if v_tipo not in ('cafeteria','hotel','restaurante','padaria','escritorio','cozinha_industrial','mercado','distribuidor','outro') then
    raise exception 'Escolha o tipo de negócio.';
  end if;
  if v_freq not in ('unica','semanal','quinzenal','mensal') then raise exception 'Escolha a frequência.'; end if;
  begin
    v_qtd := (p->>'quantidade_kg')::int;
  exception when others then
    raise exception 'Informe a quantidade em kg.';
  end;
  if v_qtd is null or v_qtd <= 0 or v_qtd > 100000 then raise exception 'Informe a quantidade em kg.'; end if;
  if v_uf is not null and v_uf !~ '^[A-Z]{2}$' then raise exception 'UF inválida.'; end if;
  if nullif(btrim(coalesce(p->>'email', '')), '') is not null and (p->>'email') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido.';
  end if;

  insert into public.lv_b2b_empresas (nome, cnpj, cidade, uf, tipo_negocio, responsavel, email, telefone)
  values (
    v_nome, nullif(regexp_replace(coalesce(p->>'cnpj', ''), '\D', '', 'g'), ''),
    nullif(left(btrim(coalesce(p->>'cidade', '')), 80), ''), v_uf, v_tipo,
    nullif(left(btrim(coalesce(p->>'responsavel', '')), 120), ''),
    nullif(left(btrim(coalesce(p->>'email', '')), 160), ''),
    nullif(left(btrim(coalesce(p->>'telefone', '')), 30), '')
  )
  returning id into v_empresa;

  insert into public.lv_b2b_solicitacoes
    (empresa_id, classificacao, gramatura_g, moagem, consumo_mensal_kg, quantidade_kg, frequencia, observacao)
  values (
    v_empresa,
    nullif(left(btrim(coalesce(p->>'classificacao', '')), 40), ''),
    nullif(p->>'gramatura_g', '')::int,
    nullif(left(btrim(coalesce(p->>'moagem', '')), 40), ''),
    nullif(p->>'consumo_mensal_kg', '')::int,
    v_qtd, v_freq,
    nullif(left(btrim(coalesce(p->>'observacao', '')), 1000), '')
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$function$;
CREATE OR REPLACE FUNCTION public.lv_chamada_privilegiada()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select public.is_admin()
      or coalesce(auth.role(), '') = 'service_role'
      or auth.uid() is null;
$function$;
CREATE OR REPLACE FUNCTION public.lv_desfazer_preco(p_history uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  h record;
  v_status text;
begin
  select ph.*, p.preco_cents as atual, p.preco_minimo_cents as piso
    into h
    from public.lv_price_history ph
    join public.lv_products p on p.id = ph.product_id
   where ph.id = p_history;
  if not found or not (h.seller_id = any(public.lv_meus_vendedores()) or public.is_admin()) then
    raise exception 'Alteração não encontrada.';
  end if;
  if h.desfeito_em is not null then raise exception 'Esta alteração já foi desfeita.'; end if;
  if h.origem = 'desfazer' then raise exception 'Uma alteração de desfazer não pode ser desfeita.'; end if;
  if h.preco_anterior_cents is null then raise exception 'Não há preço anterior para restaurar.'; end if;
  if exists (select 1 from public.lv_price_history x where x.product_id = h.product_id and x.created_at > h.created_at) then
    raise exception 'Houve outra alteração de preço depois desta.';
  end if;
  if h.atual is distinct from h.preco_novo_cents then raise exception 'O preço mudou desde esta alteração.'; end if;
  if h.created_at < now() - interval '24 hours' then raise exception 'Só é possível desfazer em até 24 horas.'; end if;
  if h.piso is not null and h.preco_anterior_cents < h.piso then
    raise exception 'O preço anterior fica abaixo do seu preço mínimo atual.';
  end if;

  perform set_config('lv.preco_origem', 'desfazer', true);
  perform set_config('lv.preco_motivo', 'Desfeita a alteração anterior', true);
  perform set_config('lv.preco_recomendacao', '', true);
  perform set_config('lv.preco_desfaz', p_history::text, true);

  update public.lv_products set preco_cents = h.preco_anterior_cents, updated_at = now()
   where id = h.product_id
  returning status into v_status;

  perform public.lv_limpar_contexto_de_preco();

  update public.lv_price_history set desfeito_em = now() where id = p_history;

  return jsonb_build_object('status', v_status, 'preco_cents', h.preco_anterior_cents);
end;
$function$;
CREATE OR REPLACE FUNCTION public.lv_gerar_codigo_qr()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea;
  saida text;
begin
  loop
    bytes := extensions.gen_random_bytes(8);
    saida := '';
    for i in 0..7 loop
      saida := saida || substr(alfabeto, (get_byte(bytes, i) % 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.lv_qr_codes where codigo = saida);
  end loop;
  return saida;
end;
$function$;
CREATE OR REPLACE FUNCTION public.lv_guarda_loja()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if public.lv_chamada_privilegiada() then
    return new;
  end if;
  new.ativa     := old.ativa;
  new.slug      := old.slug;
  new.seller_id := old.seller_id;
  new.is_demo   := old.is_demo;
  new.destaque  := old.destaque;
  new.ordem     := old.ordem;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.lv_guarda_lote()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare v_demo boolean;
begin
  if new.variant_id is null and new.product_id is not null then
    select v.id into new.variant_id from public.lv_product_variants v
     where v.product_id = new.product_id and v.padrao;
  end if;
  if new.variant_id is null then
    raise exception 'Lote precisa de uma variante.';
  end if;
  select v.product_id, p.seller_id, p.is_demo
    into new.product_id, new.seller_id, v_demo
    from public.lv_product_variants v join public.lv_products p on p.id = v.product_id
   where v.id = new.variant_id;
  if new.is_demo is distinct from v_demo then
    raise exception 'Estoque de demonstração e estoque real não se misturam: o lote precisa ter a mesma marcação do produto.';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.lv_guarda_produto()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if public.lv_chamada_privilegiada() then
    -- A moderação aprovando carimba a aprovação.
    if new.status = 'ativo' and (tg_op = 'INSERT' or old.status is distinct from 'ativo') then
      new.aprovado_em := coalesce(new.aprovado_em, now());
      new.nota_moderacao := null;
    end if;
    return new;
  end if;

  -- ---- Vendedor criando ----
  if tg_op = 'INSERT' then
    new.is_demo := false;
    new.destaque := false;
    new.ordem := 0;
    new.aprovado_em := null;
    new.nota_moderacao := null;
    if new.status not in ('rascunho', 'em_moderacao') then
      new.status := 'rascunho';
    end if;
    return new;
  end if;

  -- ---- Vendedor editando ----
  -- Estas colunas são da plataforma, não do vendedor. Voltam ao que eram
  -- em silêncio: a interface nem oferece, e quem forçar pela API não
  -- consegue.
  new.is_demo        := old.is_demo;
  new.destaque       := old.destaque;
  new.ordem          := old.ordem;
  new.seller_id      := old.seller_id;
  new.store_id       := old.store_id;
  new.nota_moderacao := old.nota_moderacao;
  -- O slug pode estar impresso numa embalagem via QR. Embalagem não se
  -- recolhe.
  new.slug           := old.slug;

  -- Edição sensível derruba a aprovação (seção 4.3 do RAIO-X).
  if new.titulo is distinct from old.titulo
     or new.category_id is distinct from old.category_id
     or (coalesce(old.preco_cents, 0) > 0 and coalesce(new.preco_cents, 0) < old.preco_cents / 2) then
    new.aprovado_em := null;
  else
    new.aprovado_em := old.aprovado_em;
  end if;

  -- Recusar é da moderação.
  if new.status = 'recusado' and old.status is distinct from 'recusado' then
    raise exception 'Somente a moderação recusa um produto.';
  end if;

  -- Recusado não salta direto para o ar: volta pela fila.
  if old.status = 'recusado' and new.status not in ('recusado', 'rascunho', 'em_moderacao', 'arquivado') then
    raise exception 'Produto recusado precisa ser corrigido e reenviado para moderação.';
  end if;

  -- Pediu "ativo" sem aprovação vigente, ou estava no ar e mudou campo
  -- sensível: vai para a fila. O banco decide, não a tela.
  if new.status = 'ativo' and new.aprovado_em is null then
    new.status := 'em_moderacao';
  end if;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.lv_guarda_qr()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if tg_op = 'UPDATE' then
    new.codigo := old.codigo;
    new.product_id := old.product_id;
    new.variant_id := old.variant_id;
  end if;
  if new.variant_id is not null and not exists (
       select 1 from public.lv_product_variants v where v.id = new.variant_id and v.product_id = new.product_id) then
    raise exception 'A variante do QR precisa ser do mesmo produto.';
  end if;
  select p.is_demo into new.is_demo from public.lv_products p where p.id = new.product_id;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.lv_guarda_variante()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if tg_op = 'UPDATE' then
    new.product_id := old.product_id;
  end if;
  select p.is_demo into new.is_demo from public.lv_products p where p.id = new.product_id;
  new.updated_at := now();
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.lv_limpar_contexto_de_preco()
 RETURNS void
 LANGUAGE sql
AS $function$
  select set_config('lv.preco_origem', '', true), set_config('lv.preco_motivo', '', true),
         set_config('lv.preco_recomendacao', '', true), set_config('lv.preco_desfaz', '', true);
$function$;
CREATE OR REPLACE FUNCTION public.lv_meus_vendedores()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(seller_id), '{}')
    from public.lv_seller_users
   where user_id = auth.uid();
$function$;
CREATE OR REPLACE FUNCTION public.lv_nasce_produto()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.lv_product_variants (product_id, nome, gramatura_g, sku, padrao)
  values (new.id, public.lv_nome_da_variante(new.peso_g, null, null), new.peso_g, new.sku, true);
  insert into public.lv_qr_codes (codigo, product_id) values (public.lv_gerar_codigo_qr(), new.id);
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.lv_nivel_do_passport(p_product_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  with campos as (
    select a.chave, pa.valor
      from public.lv_product_attributes pa
      join public.lv_attributes a on a.id = pa.attribute_id
     where pa.product_id = p_product_id
       and btrim(pa.valor) <> ''
  )
  select case
    when exists (select 1 from campos where chave = 'pontuacao'
                   and coalesce(nullif(regexp_replace(valor, '[^0-9.]', '', 'g'), ''), '0')::numeric >= 80)
      then 'especial'
    when exists (select 1 from campos where chave in ('fazenda', 'produtor', 'regiao', 'variedade'))
      then 'origem_identificada'
    when exists (select 1 from campos where chave in ('torra', 'moagem', 'especie'))
      then 'comercial'
    else null
  end;
$function$;
CREATE OR REPLACE FUNCTION public.lv_nome_da_variante(p_gramatura integer, p_moagem text, p_embalagem text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select coalesce(nullif(concat_ws(' · ',
           case when p_gramatura is null then null
                when p_gramatura >= 1000 and p_gramatura % 1000 = 0 then (p_gramatura / 1000) || ' kg'
                else p_gramatura || ' g' end,
           nullif(btrim(p_moagem), ''),
           nullif(btrim(p_embalagem), '')), ''), 'Padrão');
$function$;
CREATE OR REPLACE FUNCTION public.lv_normalizar_codigo(bruto text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select encode(extensions.digest(lower(btrim(coalesce(bruto, ''))), 'sha256'), 'hex');
$function$;
CREATE OR REPLACE FUNCTION public.lv_publicar_produto(p_id uuid, p_publicar boolean)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_status text;
begin
  update public.lv_products
     set status = case when p_publicar then 'ativo' else 'pausado' end,
         updated_at = now()
   where id = p_id
  returning status into v_status;
  if v_status is null then
    raise exception 'Produto não encontrado.';
  end if;
  return v_status;
end;
$function$;
CREATE OR REPLACE FUNCTION public.lv_registra_preco()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_origem text;
begin
  if new.preco_cents is not distinct from old.preco_cents or new.preco_cents is null then
    return new;
  end if;
  v_origem := nullif(current_setting('lv.preco_origem', true), '');
  if v_origem is null then
    v_origem := case when public.lv_chamada_privilegiada() then 'admin' else 'manual' end;
  end if;
  insert into public.lv_price_history
    (product_id, seller_id, preco_anterior_cents, preco_novo_cents, origem, motivo, recomendacao, user_id, desfaz_id, is_demo)
  values (
    new.id, new.seller_id, old.preco_cents, new.preco_cents, v_origem,
    nullif(current_setting('lv.preco_motivo', true), ''),
    nullif(current_setting('lv.preco_recomendacao', true), '')::jsonb,
    auth.uid(),
    nullif(current_setting('lv.preco_desfaz', true), '')::uuid,
    new.is_demo
  );
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.lv_resolver_qr(p_codigo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record;
begin
  select q.product_id, q.variant_id, q.lot_id, q.ativo, p.slug, p.status, s.ativa as loja_ativa
    into r
    from public.lv_qr_codes q
    join public.lv_products p on p.id = q.product_id
    join public.lv_stores s on s.id = p.store_id
   where q.codigo = upper(btrim(coalesce(p_codigo, '')));
  if not found then
    return null;
  end if;
  if not r.ativo or r.status <> 'ativo' or not r.loja_ativa then
    return jsonb_build_object('disponivel', false);
  end if;
  return jsonb_build_object('disponivel', true, 'slug', r.slug, 'variante_id', r.variant_id, 'lote_id', r.lot_id);
end;
$function$;
CREATE OR REPLACE FUNCTION public.lv_salvar_produto(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_id       uuid := nullif(p->>'id', '')::uuid;
  v_store    uuid := nullif(p->>'store_id', '')::uuid;
  v_seller   uuid;
  v_categoria uuid := nullif(p->>'category_id', '')::uuid;
  v_titulo   text := btrim(coalesce(p->>'titulo', ''));
  v_slug     text;
  v_status   text;
  v_peso     int := nullif(p->>'peso_g', '')::int;
  v_sku      text := nullif(btrim(p->>'sku'), '');
  v_moagem   text := nullif(btrim(coalesce(p->'atributos'->>'moagem', '')), '');
begin
  if length(v_titulo) < 3 then
    raise exception 'O nome do produto precisa de pelo menos 3 letras.';
  end if;

  select seller_id into v_seller from public.lv_stores where id = v_store;
  if v_seller is null then
    raise exception 'Loja não encontrada.';
  end if;

  if v_id is null then
    v_slug := left(btrim(regexp_replace(lower(translate(v_titulo,
                'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')), '[^a-z0-9]+', '-', 'g'), '-'), 60)
              || '-' || substr(md5(gen_random_uuid()::text), 1, 6);

    insert into public.lv_products (
      store_id, seller_id, category_id, slug, titulo, marca, descricao, sku,
      preco_cents, peso_g, preco_minimo_cents, venda_por_quantidade, status
    ) values (
      v_store, v_seller, v_categoria, v_slug, v_titulo,
      nullif(btrim(p->>'marca'), ''), nullif(btrim(p->>'descricao'), ''), v_sku,
      nullif(p->>'preco_cents', '')::bigint, v_peso,
      nullif(p->>'preco_minimo_cents', '')::bigint,
      coalesce((p->>'venda_por_quantidade')::boolean, false),
      'rascunho'
    )
    returning id into v_id;
  else
    update public.lv_products set
      category_id          = v_categoria,
      titulo               = v_titulo,
      marca                = nullif(btrim(p->>'marca'), ''),
      descricao            = nullif(btrim(p->>'descricao'), ''),
      sku                  = v_sku,
      preco_cents          = nullif(p->>'preco_cents', '')::bigint,
      peso_g               = v_peso,
      preco_minimo_cents   = nullif(p->>'preco_minimo_cents', '')::bigint,
      venda_por_quantidade = coalesce((p->>'venda_por_quantidade')::boolean, false),
      updated_at           = now()
    where id = v_id;
    if not found then
      raise exception 'Produto não encontrado.';
    end if;
  end if;

  delete from public.lv_product_attributes where product_id = v_id;
  insert into public.lv_product_attributes (product_id, attribute_id, valor)
  select v_id, a.id, btrim(x.value)
    from jsonb_each_text(coalesce(p->'atributos', '{}'::jsonb)) x
    join public.lv_attributes a on a.chave = x.key
    join public.lv_category_attributes ca on ca.attribute_id = a.id and ca.category_id = v_categoria
   where btrim(x.value) <> '';

  -- Moagem só vale se a categoria a admite (um moedor não tem moagem).
  if not exists (select 1 from public.lv_category_attributes ca join public.lv_attributes a on a.id = ca.attribute_id
                  where ca.category_id = v_categoria and a.chave = 'moagem') then
    v_moagem := null;
  end if;

  update public.lv_product_variants set
    gramatura_g = v_peso,
    moagem      = v_moagem,
    sku         = v_sku,
    ean         = nullif(regexp_replace(coalesce(p->>'ean', ''), '\D', '', 'g'), ''),
    nome        = public.lv_nome_da_variante(v_peso, v_moagem, embalagem)
  where product_id = v_id and padrao;

  delete from public.lv_price_tiers where product_id = v_id;
  insert into public.lv_price_tiers (product_id, min_qty, tipo, valor)
  select v_id, (t->>'min_qty')::int, t->>'tipo', (t->>'valor')::int
    from jsonb_array_elements(coalesce(p->'faixas', '[]'::jsonb)) t
   where coalesce((t->>'valor')::int, 0) > 0;

  select status into v_status from public.lv_products where id = v_id;
  return jsonb_build_object('id', v_id, 'status', v_status);
end;
$function$;
CREATE OR REPLACE FUNCTION public.lv_validar_acesso(codigo text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  alvo uuid;
begin
  if codigo is null or btrim(codigo) = '' then
    return false;
  end if;

  select id into alvo
    from public.lv_demo_access
   where code_hash = public.lv_normalizar_codigo(codigo)
     and ativo
     and (expires_at is null or expires_at > now())
   limit 1;

  if alvo is null then
    return false;
  end if;

  -- Uso registrado para o admin enxergar movimento na demonstração. Não
  -- identifica ninguém: só conta e carimba a hora.
  update public.lv_demo_access
     set uses = uses + 1, last_used_at = now()
   where id = alvo;

  return true;
end;
$function$;
CREATE OR REPLACE FUNCTION public.lv_variantes_a_venda(p_product uuid)
 RETURNS TABLE(id uuid, nome text, gramatura_g integer, moagem text, embalagem text, preco_cents bigint, padrao boolean, ordem integer, disponivel integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select v.id, v.nome, v.gramatura_g, v.moagem, v.embalagem,
         coalesce(v.preco_cents, p.preco_cents), v.padrao, v.ordem,
         public.lv_vendavel_da_variante(v.id)
    from public.lv_product_variants v
    join public.lv_products p on p.id = v.product_id
    join public.lv_stores s on s.id = p.store_id
   where v.product_id = p_product and v.ativa and p.status = 'ativo' and s.ativa
   order by v.padrao desc, v.ordem, v.gramatura_g nulls last;
$function$;
CREATE OR REPLACE FUNCTION public.lv_vendavel_da_variante(p_variant uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(l.qtd_disponivel), 0)::int
    from public.lv_inventory_lots l
    join public.lv_product_variants v on v.id = l.variant_id
    join public.lv_products p on p.id = v.product_id
    join public.lv_stores s on s.id = p.store_id
   where l.variant_id = p_variant
     and v.ativa and p.status = 'ativo' and s.ativa
     and l.is_demo = p.is_demo
     and (l.validade is null or l.validade >= current_date);
$function$;
CREATE OR REPLACE FUNCTION public.lv_vendedor_pode_receber(p_seller uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select pagamento_status = 'verificado' from public.lv_sellers where id = p_seller), false);
$function$;
CREATE OR REPLACE FUNCTION public.mark_inactive_reps()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.representatives
  SET is_online = FALSE
  WHERE is_online = TRUE
  AND last_seen_at < NOW() - INTERVAL '3 minutes';
END;
$function$;
CREATE OR REPLACE FUNCTION public.my_company_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT company_id FROM public.representatives WHERE user_id = auth.uid() LIMIT 1;
$function$;
CREATE OR REPLACE FUNCTION public.my_driver_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM public.drivers WHERE user_id = auth.uid() LIMIT 1;
$function$;
CREATE OR REPLACE FUNCTION public.my_network_entity_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from public.network_entities where user_id = auth.uid();
$function$;
CREATE OR REPLACE FUNCTION public.my_promoter_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ SELECT id FROM public.promoters WHERE user_id = auth.uid() $function$;
CREATE OR REPLACE FUNCTION public.my_rep_id()
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT id FROM public.representatives WHERE user_id = auth.uid() LIMIT 1;
$function$;
CREATE OR REPLACE FUNCTION public.my_studio_orgs()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(organization_id), '{}')
    from public.studio_members
   where user_id = auth.uid();
$function$;
CREATE OR REPLACE FUNCTION public.network_convert_to_client(p_entity_id uuid, p_company_id uuid, p_relationship_type text DEFAULT 'cliente'::text, p_price_segment text DEFAULT NULL::text, p_payment_method text DEFAULT NULL::text, p_payment_term text DEFAULT NULL::text, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_existing uuid;
begin
  if not public.is_admin() then
    raise exception 'apenas administrador pode converter participante em cliente';
  end if;

  if not exists (select 1 from public.network_entities where id = p_entity_id) then
    raise exception 'participante inexistente';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception 'empresa inexistente';
  end if;

  select id into v_existing from public.commercial_accounts
   where entity_id = p_entity_id and company_id = p_company_id
     and relationship_type = p_relationship_type;
  if v_existing is not null then
    return v_existing;  -- idempotente: já existe relação com esta empresa
  end if;

  -- Cria SOMENTE a relação comercial. A identidade não é copiada:
  -- nome, documento, endereço e contato continuam em network_entities.
  -- Nenhuma condição comercial é herdada de outra empresa.
  insert into public.commercial_accounts (
    entity_id, company_id, relationship_type,
    price_segment, payment_method, payment_term
  ) values (
    p_entity_id, p_company_id, p_relationship_type,
    p_price_segment, p_payment_method, p_payment_term
  ) returning id into v_id;

  insert into public.network_audit_log (action, entity_table, entity_id, new_state, reason)
  values ('participante.convertido_em_cliente', 'commercial_accounts', v_id,
          jsonb_build_object('entity_id', p_entity_id, 'company_id', p_company_id,
                             'relationship_type', p_relationship_type),
          coalesce(p_reason, 'conversao manual pelo admin'));

  return v_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.open_ruptura_chat(p_incident_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 DECLARE inc promoter_incidents; conv uuid; rep_user uuid; prom_user uuid; prod_name text; store_name text;
 BEGIN
   SELECT * INTO inc FROM promoter_incidents WHERE id = p_incident_id;
   IF inc.id IS NULL THEN RAISE EXCEPTION 'ocorrencia nao encontrada'; END IF;
   -- so o rep atribuido, o promotor da ocorrencia, admin ou supervisor abrem a conversa
   IF NOT (is_admin() OR has_role('supervisor', inc.company_id)
           OR inc.assigned_representative_id = my_rep_id()
           OR inc.promoter_id = my_promoter_id()) THEN
     RAISE EXCEPTION 'sem permissao';
   END IF;
   SELECT id INTO conv FROM chat_conversations WHERE context_type = 'ruptura' AND context_id = p_incident_id LIMIT 1;
   IF conv IS NOT NULL THEN RETURN conv; END IF;
   SELECT r.user_id INTO rep_user FROM representatives r WHERE r.id = inc.assigned_representative_id;
   SELECT pr.user_id INTO prom_user FROM promoters pr WHERE pr.id = inc.promoter_id;
   SELECT COALESCE(p.name,'SKU') INTO prod_name FROM products p WHERE p.id = inc.product_id;
   SELECT COALESCE(c.nome_fantasia, c.razao_social, 'Loja') INTO store_name FROM representative_clients c WHERE c.id = inc.representative_client_id;
   INSERT INTO chat_conversations (type, name, created_by, company_id, context_type, context_id, product_id)
   VALUES ('group', prod_name || ' · ' || store_name, auth.uid(), inc.company_id, 'ruptura', p_incident_id, inc.product_id)
   RETURNING id INTO conv;
   INSERT INTO chat_participants (conversation_id, user_id, role) VALUES (conv, COALESCE(rep_user, auth.uid()), 'member') ON CONFLICT DO NOTHING;
   INSERT INTO chat_participants (conversation_id, user_id, role) VALUES (conv, COALESCE(prom_user, auth.uid()), 'member') ON CONFLICT DO NOTHING;
   IF auth.uid() IS NOT NULL THEN
     INSERT INTO chat_participants (conversation_id, user_id, role) VALUES (conv, auth.uid(), 'owner') ON CONFLICT DO NOTHING;
   END IF;
   -- primeira mensagem: contexto da ruptura
   INSERT INTO chat_messages (conversation_id, sender_id, body)
   VALUES (conv, COALESCE(prom_user, auth.uid()),
     'RUPTURA TOTAL — ' || prod_name || ' na loja ' || store_name || ' às ' || to_char(inc.opened_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'));
   -- fotos da ruptura como mensagens
   INSERT INTO chat_messages (conversation_id, sender_id, body, attachment_url, attachment_type)
   SELECT conv, COALESCE(prom_user, auth.uid()), NULL, ph.photo_url, 'image'
   FROM promoter_visit_photos ph
   WHERE ph.visit_id = inc.visit_id AND (ph.product_id = inc.product_id AND ph.kind = 'sku_ruptura')
   LIMIT 4;
   RETURN conv;
 END; $function$;
CREATE OR REPLACE FUNCTION public.peso_bruto_kg(p_unidades integer, p_g_por_unidade integer DEFAULT 500)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_tara integer;
  v_ult  record;
begin
  if coalesce(p_unidades, 0) <= 0 then return 0; end if;

  select tare_g into v_tara from public.packaging_specs
   where units >= p_unidades order by units limit 1;

  if v_tara is null then
    select units, tare_g into v_ult from public.packaging_specs order by units desc limit 1;
    v_tara := ceil(v_ult.tare_g::numeric / v_ult.units * p_unidades);
  end if;

  return round((p_unidades * p_g_por_unidade + v_tara)::numeric / 1000.0, 3);
end $function$;
CREATE OR REPLACE FUNCTION public.promoter_classify_ruptura()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 DECLARE in_mix boolean; gondola_final integer; deposito_final integer;
 BEGIN
   SELECT EXISTS(
     SELECT 1 FROM promoter_client_mix m JOIN promoter_visits v ON v.id = NEW.visit_id
     WHERE m.representative_client_id = v.representative_client_id AND m.product_id = NEW.product_id AND m.is_active
   ) INTO in_mix;
   IF NOT in_mix THEN
     NEW.ruptura_status_antes := 'fora_mix'; NEW.ruptura_status_depois := 'fora_mix';
   ELSIF COALESCE(NEW.nao_localizado, false) THEN
     NEW.ruptura_status_antes := 'nao_localizado'; NEW.ruptura_status_depois := 'nao_localizado';
   ELSE
     IF NEW.qty_gondola_antes IS NULL THEN NEW.ruptura_status_antes := NULL;
     ELSIF NEW.qty_gondola_antes > 0 THEN NEW.ruptura_status_antes := 'disponivel';
     ELSIF COALESCE(NEW.qty_deposito, 0) > 0 THEN NEW.ruptura_status_antes := 'ruptura_gondola';
     ELSE NEW.ruptura_status_antes := 'ruptura_total';
     END IF;
     gondola_final := COALESCE(NEW.qty_gondola_antes, 0) + COALESCE(NEW.qty_abastecida, 0);
     deposito_final := COALESCE(NEW.saldo_deposito, GREATEST(COALESCE(NEW.qty_deposito, 0) - COALESCE(NEW.qty_retirada_deposito, 0), 0));
     IF NEW.qty_gondola_antes IS NULL AND NEW.qty_abastecida IS NULL THEN NEW.ruptura_status_depois := NULL;
     ELSIF gondola_final > 0 THEN NEW.ruptura_status_depois := 'disponivel';
     ELSIF deposito_final > 0 THEN NEW.ruptura_status_depois := 'ruptura_gondola';
     ELSE NEW.ruptura_status_depois := 'ruptura_total';
     END IF;
   END IF;
   NEW.updated_at := now();
   RETURN NEW;
 END; $function$;
CREATE OR REPLACE FUNCTION public.promoter_generate_invite(p_note text DEFAULT NULL::text)
 RETURNS TABLE(code text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ declare c text; begin
   if not is_admin() then raise exception 'apenas admin'; end if;
   loop c := upper(substr(md5(random()::text),1,6)); exit when not exists(select 1 from repco_invite_codes i where i.code=c); end loop;
   insert into repco_invite_codes(code,note,created_by,expires_at,role_code) values(c,p_note,auth.uid(),now()+interval '24 hours','promotor');
   return query select c, (now()+interval '24 hours')::timestamptz;
 end; $function$;
CREATE OR REPLACE FUNCTION public.promoter_generate_invite(p_note text DEFAULT NULL::text, p_company uuid DEFAULT NULL::uuid)
 RETURNS TABLE(code text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ declare c text; begin
     if not is_admin() then raise exception 'apenas admin'; end if;
     loop c := upper(substr(md5(random()::text),1,6)); exit when not exists(select 1 from repco_invite_codes i where i.code=c); end loop;
     insert into repco_invite_codes(code,note,created_by,expires_at,role_code,company_id)
       values(c,p_note,auth.uid(),now()+interval '24 hours','promotor',p_company);
     return query select c, (now()+interval '24 hours')::timestamptz;
   end; $function$;
CREATE OR REPLACE FUNCTION public.promoter_list_invites()
 RETURNS TABLE(code text, note text, created_at timestamp with time zone, expires_at timestamp with time zone, used_by uuid, used_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$ select code,note,created_at,expires_at,used_by,used_at from repco_invite_codes
        where is_admin() and role_code='promotor' and used_by is null and expires_at>now()
        order by created_at desc limit 40 $function$;
CREATE OR REPLACE FUNCTION public.promoter_register_with_code(p_code text, p_full_name text, p_cpf text, p_phone text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
   declare inv repco_invite_codes; me uuid := auth.uid();
   begin
     if me is null then raise exception 'sem auth'; end if;
     select * into inv from repco_invite_codes where upper(code)=upper(trim(p_code)) and used_by is null and expires_at>now() and role_code='promotor' for update;
     if inv.id is null then raise exception 'codigo invalido ou expirado'; end if;
     if exists(select 1 from promoters where user_id=me) then raise exception 'ja cadastrado'; end if;
     insert into promoters(user_id, full_name, cpf, phone, status, company_id)
       values (me, p_full_name, p_cpf, p_phone, 'pending', inv.company_id);
     insert into user_roles(user_id, role_code, company_id)
       select me, 'promotor', inv.company_id
       where not exists (select 1 from user_roles where user_id=me and role_code='promotor' and company_id is not distinct from inv.company_id);
     update repco_invite_codes set used_by=me, used_at=now() where id=inv.id;
     return 'ok';
   end; $function$;
CREATE OR REPLACE FUNCTION public.promoter_ruptura_incident()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 BEGIN
   IF NEW.ruptura_status_antes = 'ruptura_total' THEN
     IF NOT EXISTS (SELECT 1 FROM promoter_incidents WHERE visit_id = NEW.visit_id AND product_id = NEW.product_id AND category = 'ruptura_total') THEN
       INSERT INTO promoter_incidents (visit_id, representative_client_id, product_id, promoter_id, assigned_representative_id, company_id, category, priority, status, description)
       SELECT NEW.visit_id, v.representative_client_id, NEW.product_id, v.promoter_id, c.representative_id, v.company_id,
              'ruptura_total', 'alta', 'aberta', 'Ruptura total detectada na auditoria da visita'
       FROM promoter_visits v JOIN representative_clients c ON c.id = v.representative_client_id
       WHERE v.id = NEW.visit_id;
     END IF;
   END IF;
   RETURN NEW;
 END; $function$;
CREATE OR REPLACE FUNCTION public.promoter_validate_invite(p_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$ select exists(select 1 from repco_invite_codes where upper(code)=upper(trim(p_code)) and used_by is null and expires_at>now() and role_code='promotor') $function$;
CREATE OR REPLACE FUNCTION public.promoters_guard_self_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 begin
   -- backend (service role, sem JWT) e admin podem tudo
   if auth.uid() is null or public.is_admin() then return new; end if;
   -- promotor logado: só pode mexer nas colunas de presença do próprio registro
   new.user_id := old.user_id; new.full_name := old.full_name; new.cpf := old.cpf;
   new.email := old.email; new.company_id := old.company_id;
   new.supervisor_user_id := old.supervisor_user_id; new.status := old.status;
   new.blocked_reason := old.blocked_reason; new.approved_at := old.approved_at;
   new.notes := old.notes; new.created_at := old.created_at;
   new.updated_at := now();
   return new;
 end; $function$;
CREATE OR REPLACE FUNCTION public.rastrear_envio(p_codigo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v jsonb;
  v_codigo text := upper(btrim(coalesce(p_codigo, '')));
begin
  -- Piso de tamanho: sem isto, uma string de 1 ou 2 caracteres viraria uma
  -- consulta ampla. O código de rastreio é o segredo — trate-o como um.
  if length(v_codigo) < 8 then
    return null;
  end if;

  select jsonb_build_object(
           'carrier_name',  s.carrier_name,
           'status',        s.status,
           'dispatch_date', s.dispatch_date
         )
    into v
    from public.shipments s
   where upper(s.tracking_code) = v_codigo
   limit 1;

  return v;   -- NULL quando não encontra: resposta idêntica à do código inválido
end $function$;
CREATE OR REPLACE FUNCTION public.repco_apply_stock_on_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.representative_orders WHERE id = NEW.order_id;

  PERFORM public.consume_stock_fifo(
    NEW.product_id, NEW.quantity, 'repco', 'representative_order', NEW.order_id, v_company, 'venda'
  );

  NEW.stock_applied := true;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.repco_code_used_by(p_user uuid)
 RETURNS TABLE(code text, used_at timestamp with time zone, note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$ select code, used_at, note from repco_invite_codes where is_admin() and used_by=p_user limit 1 $function$;
CREATE OR REPLACE FUNCTION public.repco_commission_cycle(p_date date, p_method text)
 RETURNS TABLE(cycle_start date, cycle_end date, scheduled date)
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT cf - 6, cf, CASE WHEN p_method = 'pix' THEN cf + 10 ELSE cf + 3 END
  FROM (SELECT p_date + ((5 - EXTRACT(DOW FROM p_date)::int + 7) % 7) AS cf) s;
$function$;
CREATE OR REPLACE FUNCTION public.repco_delete_invite(p_code text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$ delete from repco_invite_codes where upper(code)=upper(trim(p_code)) and is_admin() $function$;
CREATE OR REPLACE FUNCTION public.repco_delete_order(p_order_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_paths text[] := '{}';
  it RECORD;
  v_ord public.representative_orders%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas admin pode excluir pedido';
  END IF;
  SELECT * INTO v_ord FROM public.representative_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN v_paths; END IF;

  FOR it IN SELECT product_id, quantity FROM public.representative_order_items WHERE order_id = p_order_id AND stock_applied = true LOOP
    UPDATE public.products SET stock = stock + it.quantity, in_stock = true WHERE id = it.product_id;
  END LOOP;

  v_paths := array_remove(ARRAY[
    v_ord.invoice_pdf_url, v_ord.invoice_xml_url, v_ord.payment_proof_url,
    v_ord.commission_paid_proof_url, v_ord.service_invoice_url
  ], NULL);

  v_paths := v_paths || COALESCE((
    SELECT array_agg(x) FROM (
      SELECT boleto_url AS x FROM public.representative_order_installments WHERE order_id = p_order_id AND boleto_url IS NOT NULL
      UNION ALL SELECT proof_url FROM public.representative_order_installments WHERE order_id = p_order_id AND proof_url IS NOT NULL
      UNION ALL SELECT proof_url FROM public.representative_commissions WHERE order_id = p_order_id AND proof_url IS NOT NULL
      UNION ALL SELECT pay.proof_url FROM public.representative_commission_payouts pay
                JOIN public.representative_commissions c ON c.id = pay.commission_id
                WHERE c.order_id = p_order_id AND pay.proof_url IS NOT NULL
    ) q
  ), '{}'::text[]);

  DELETE FROM public.representative_commissions WHERE order_id = p_order_id;
  DELETE FROM public.representative_orders WHERE id = p_order_id;
  RETURN v_paths;
END;
$function$;
CREATE OR REPLACE FUNCTION public.repco_generate_invite(p_note text DEFAULT NULL::text)
 RETURNS TABLE(code text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ declare c text; begin if not is_admin() then raise exception 'apenas admin'; end if; loop c := upper(substr(md5(random()::text),1,6)); exit when not exists(select 1 from repco_invite_codes i where i.code=c); end loop; insert into repco_invite_codes(code,note,created_by,expires_at) values(c,p_note,auth.uid(),now()+interval '24 hours'); return query select c, (now()+interval '24 hours')::timestamptz; end; $function$;
CREATE OR REPLACE FUNCTION public.repco_list_invites()
 RETURNS TABLE(code text, note text, created_at timestamp with time zone, expires_at timestamp with time zone, used_by uuid, used_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$ select code,note,created_at,expires_at,used_by,used_at from repco_invite_codes
        where is_admin() and role_code='representante' and used_by is null and expires_at>now()
        order by created_at desc limit 40 $function$;
CREATE OR REPLACE FUNCTION public.repco_orders_delivery_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.delivery_dispatched_at IS NOT NULL THEN
    IF NEW.delivery_mode IS DISTINCT FROM OLD.delivery_mode THEN
      RAISE EXCEPTION 'delivery_mode imutável após despacho (pedido %).', OLD.order_number;
    END IF;
    IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'empresa contratante imutável após despacho (pedido %).', OLD.order_number;
    END IF;
  END IF;
  IF NEW.delivery_mode IS DISTINCT FROM OLD.delivery_mode THEN
    INSERT INTO public.delivery_dispatch_audit(order_id, changed_by, field, old_value, new_value)
      VALUES (OLD.id, auth.uid(), 'delivery_mode', OLD.delivery_mode, NEW.delivery_mode);
  END IF;
  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    INSERT INTO public.delivery_dispatch_audit(order_id, changed_by, field, old_value, new_value)
      VALUES (OLD.id, auth.uid(), 'company_id', OLD.company_id::text, NEW.company_id::text);
  END IF;
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.repco_register_with_code(p_code text, p_full_name text, p_cpf text, p_phone text, p_cnpj text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ declare inv repco_invite_codes; me uuid := auth.uid(); begin
   if me is null then raise exception 'sem auth'; end if;
   select * into inv from repco_invite_codes where upper(code)=upper(trim(p_code)) and used_by is null and expires_at>now() and role_code='representante' for update;
   if inv.id is null then raise exception 'codigo invalido ou expirado'; end if;
   if exists(select 1 from representatives where user_id=me) then raise exception 'ja cadastrado'; end if;
   insert into representatives(user_id,full_name,cpf,phone,cnpj,status) values(me,p_full_name,p_cpf,p_phone,nullif(p_cnpj,''),'pending');
   update repco_invite_codes set used_by=me, used_at=now() where id=inv.id;
   return 'ok';
 end; $function$;
CREATE OR REPLACE FUNCTION public.repco_return_stock_on_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'cancelled' AND coalesce(OLD.status, '') <> 'cancelled' THEN
    PERFORM public.return_stock_by_reference('representative_order', NEW.id, 'Pedido cancelado');
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.repco_revoke_invite(p_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas admin pode revogar convite.'; END IF;
  DELETE FROM public.repco_invite_codes WHERE code = p_code AND used_by IS NULL;
END $function$;
CREATE OR REPLACE FUNCTION public.repco_score_on_installment_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_client uuid;
  v_late   integer;
  v_delta  integer;
BEGIN
  IF NEW.status <> 'paid' OR (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  SELECT representative_client_id INTO v_client
    FROM public.representative_orders WHERE id = NEW.order_id;
  IF v_client IS NULL OR NEW.due_date IS NULL THEN
    RETURN NEW;
  END IF;

  v_late := COALESCE(NEW.paid_at::date, CURRENT_DATE) - NEW.due_date;
  v_delta := CASE
    WHEN v_late <= 0 THEN 20      -- em dia (ou adiantado)
    WHEN v_late <= 3 THEN -30     -- 1-3 dias de atraso
    WHEN v_late <= 7 THEN -50     -- 4-7 dias
    ELSE -50                      -- pago com muito atraso
  END;

  UPDATE public.representative_clients
     SET credito_score = GREATEST(0, LEAST(1000, COALESCE(credito_score, 500) + v_delta))
   WHERE id = v_client;

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.repco_update_delivery(p_order_id uuid, p_status text, p_proof_url text DEFAULT NULL::text, p_proof_filename text DEFAULT NULL::text, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.representative_orders o
     SET delivery_status = COALESCE(p_status, o.delivery_status),
         delivery_accepted_at = CASE WHEN p_status = 'em_rota' AND o.delivery_accepted_at IS NULL THEN now() ELSE o.delivery_accepted_at END,
         delivered_at = CASE WHEN p_status = 'entregue' THEN now() ELSE o.delivered_at END,
         delivery_proof_url = COALESCE(p_proof_url, o.delivery_proof_url),
         delivery_proof_filename = COALESCE(p_proof_filename, o.delivery_proof_filename),
         delivery_proof_lat = COALESCE(p_lat, o.delivery_proof_lat),
         delivery_proof_lng = COALESCE(p_lng, o.delivery_proof_lng)
   WHERE o.id = p_order_id
     AND o.representative_id = public.my_rep_id();
END; $function$;
CREATE OR REPLACE FUNCTION public.repco_update_my_contact(p_email text, p_phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.representatives
     SET email = NULLIF(btrim(p_email), ''),
         phone = NULLIF(btrim(p_phone), '')
   WHERE id = public.my_rep_id();
END;
$function$;
CREATE OR REPLACE FUNCTION public.repco_validate_invite(p_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$ select exists(select 1 from repco_invite_codes where upper(code)=upper(trim(p_code)) and used_by is null and expires_at>now() and role_code='representante') $function$;
CREATE OR REPLACE FUNCTION public.reset_client_snooze_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.representative_client_id IS NOT NULL THEN
    UPDATE public.representative_clients
    SET snooze_count = 0,
        snooze_admin_alert = FALSE,
        inactivity_snoozed_until = NULL,
        inactivity_alert_dismissed = FALSE,
        last_order_at = NOW()
    WHERE id = NEW.representative_client_id;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.return_stock_by_reference(p_reference_type text, p_reference_id uuid, p_notes text DEFAULT 'Cancelamento'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mov     record;
  v_total   int := 0;
BEGIN
  FOR v_mov IN
    SELECT * FROM public.stock_movements
     WHERE reference_type = p_reference_type
       AND reference_id = p_reference_id
       AND movement_type = 'venda'
       AND quantity < 0
  LOOP
    IF v_mov.lot_id IS NOT NULL THEN
      UPDATE public.green_coffee_lots
         SET quantity_packages = coalesce(quantity_packages, 0) + abs(v_mov.quantity),
             status = CASE WHEN status = 'consumed' THEN 'active' ELSE status END,
             updated_at = now()
       WHERE id = v_mov.lot_id;
    END IF;

    INSERT INTO public.stock_movements
      (product_id, lot_id, batch_number, quantity, movement_type, channel, company_id,
       reference_type, reference_id, notes)
    VALUES
      (v_mov.product_id, v_mov.lot_id, v_mov.batch_number, abs(v_mov.quantity), 'devolucao',
       v_mov.channel, v_mov.company_id, p_reference_type, p_reference_id, p_notes);

    v_total := v_total + abs(v_mov.quantity);
  END LOOP;

  RETURN jsonb_build_object('devolvido', v_total);
END;
$function$;
CREATE OR REPLACE FUNCTION public.return_stock_on_order_cancelled()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('rejected', 'refunded', 'cancelled') AND coalesce(OLD.status, '') = 'approved' THEN
    PERFORM public.return_stock_by_reference('order', NEW.id, 'Pedido ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.set_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  order_type TEXT;
BEGIN
  IF NEW.order_number IS NOT NULL AND NEW.order_number != '' THEN
    RETURN NEW;
  END IF;

  SELECT CASE
    WHEN up.is_admin = TRUE THEN 'PF'
    WHEN EXISTS (
      SELECT 1 FROM public.representatives r WHERE r.user_id = NEW.user_id
    ) THEN 'RC'
    WHEN NEW.order_type = 'PJ' THEN 'PJ'
    ELSE 'PF'
  END INTO order_type
  FROM public.user_profiles up
  WHERE up.id = NEW.user_id;

  NEW.order_number := generate_order_number(COALESCE(order_type, 'PF'));
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.set_rep_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'RC' || LPAD(nextval('repco_order_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.set_repco_client_default_fiscal_order_type(p_client_id uuid, p_fiscal_order_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rep_id UUID;
BEGIN
  IF p_fiscal_order_type NOT IN ('resale', 'taxpayer_consumer', 'non_taxpayer_consumer') THEN
    RAISE EXCEPTION 'Invalid fiscal order type';
  END IF;

  SELECT id INTO v_rep_id
  FROM public.representatives
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_rep_id IS NULL THEN
    RAISE EXCEPTION 'Representative not found';
  END IF;

  UPDATE public.representative_clients
  SET
    default_fiscal_order_type = p_fiscal_order_type,
    updated_at = now()
  WHERE id = p_client_id
    AND representative_id = v_rep_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found for current representative';
  END IF;
END;
$function$;
CREATE OR REPLACE FUNCTION public.storage_orphans(p_bucket text DEFAULT NULL::text, p_min_age_days integer DEFAULT 7)
 RETURNS TABLE(bucket_id text, name text, size_bytes bigint, created_at timestamp with time zone, age_days integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'storage'
AS $function$
  select o.bucket_id,
         o.name,
         coalesce((o.metadata->>'size')::bigint, 0),
         o.created_at,
         extract(day from now() - o.created_at)::int
    from storage.objects o
   where (p_bucket is null or o.bucket_id = p_bucket)
     and o.created_at < now() - make_interval(days => p_min_age_days)
     and not exists (
       select 1 from public.vw_storage_references r
        where r.ref is not null
          and length(r.ref) >= 12
          and (r.ref like '%' || o.name or o.name like '%' || r.ref)
     )
   order by o.bucket_id, o.created_at;
$function$;
CREATE OR REPLACE FUNCTION public.storage_orphans_summary(p_min_age_days integer DEFAULT 7)
 RETURNS TABLE(bucket_id text, orfaos bigint, total bigint, bytes bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'storage'
AS $function$
  select b.id,
         (select count(*) from public.storage_orphans(b.id, p_min_age_days)),
         (select count(*) from storage.objects o where o.bucket_id = b.id),
         coalesce((select sum(size_bytes) from public.storage_orphans(b.id, p_min_age_days)), 0)
    from storage.buckets b
   order by 2 desc, 1;
$function$;
CREATE OR REPLACE FUNCTION public.trigger_recalculate_batch_costs()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM calculate_batch_costs(NEW.id);
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_client_last_order()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.representative_clients
  SET last_order_at = NOW(),
      inactivity_alert_dismissed = FALSE,
      inactivity_snoozed_until = NULL
  WHERE id = NEW.representative_client_id;
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_product_order(p_id uuid, new_order integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE products SET display_order = display_order + 1
  WHERE display_order >= new_order AND id != p_id;

  UPDATE products SET display_order = new_order WHERE id = p_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_product_stock_from_batches()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE v_total int;
BEGIN
  SELECT COALESCE(SUM(quantity_packages),0) INTO v_total
  FROM product_batches WHERE product_id=COALESCE(NEW.product_id,OLD.product_id) AND status='active';
  UPDATE products SET stock=v_total WHERE id=COALESCE(NEW.product_id,OLD.product_id);
  IF TG_OP='UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
    SELECT COALESCE(SUM(quantity_packages),0) INTO v_total FROM product_batches WHERE product_id=OLD.product_id AND status='active';
    UPDATE products SET stock=v_total WHERE id=OLD.product_id;
  END IF;
  RETURN COALESCE(NEW,OLD);
END $function$;
CREATE OR REPLACE FUNCTION public.update_product_stock_from_lots()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE v_total int;
BEGIN
  SELECT COALESCE(SUM(quantity_packages),0) INTO v_total FROM green_coffee_lots WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) AND status = 'active';
  UPDATE products SET stock = v_total WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  IF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
    SELECT COALESCE(SUM(quantity_packages),0) INTO v_total FROM green_coffee_lots WHERE product_id = OLD.product_id AND status = 'active';
    UPDATE products SET stock = v_total WHERE id = OLD.product_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $function$;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;
CREATE OR REPLACE FUNCTION public.validar_cupom(p_codigo text, p_cpf text, p_subtotal numeric, p_frete numeric DEFAULT 0, p_empresa text DEFAULT 'CS'::text)
 RETURNS TABLE(valido boolean, motivo text, desconto numeric, zera_frete boolean, descricao text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c        record;
  v_cpf    text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_ja     integer;
begin
  select cu.* into c
    from coupons cu
    join companies co on co.id = cu.company_id
   where upper(cu.code) = upper(trim(coalesce(p_codigo, '')))
     and co.order_prefix = p_empresa
     and cu.is_active
   limit 1;

  if not found then
    return query select false, 'Cupom não encontrado.', 0::numeric, false, null::text;
    return;
  end if;

  if c.starts_at is not null and now() < c.starts_at then
    return query select false, 'Este cupom ainda não começou a valer.', 0::numeric, false, c.description;
    return;
  end if;

  if c.expires_at is not null and now() > c.expires_at then
    return query select false, 'Este cupom já expirou.', 0::numeric, false, c.description;
    return;
  end if;

  if c.max_uses is not null and c.uses >= c.max_uses then
    return query select false, 'Este cupom já foi todo utilizado.', 0::numeric, false, c.description;
    return;
  end if;

  if coalesce(p_subtotal, 0) < c.min_subtotal then
    return query select false,
      format('Este cupom vale a partir de R$ %s em produtos.', to_char(c.min_subtotal, 'FM999G990D00')),
      0::numeric, false, c.description;
    return;
  end if;

  -- A trava que faz a mecânica funcionar: já comprou antes, não ganha de novo.
  if c.first_purchase_only then
    if v_cpf is null then
      return query select false, 'Informe o CPF para usar este cupom.', 0::numeric, false, c.description;
      return;
    end if;
    select count(*)::int into v_ja from orders o
      where o.customer_cpf = v_cpf and o.status = 'approved';
    if v_ja > 0 then
      return query select false, 'Este cupom é só para a primeira compra.', 0::numeric, false, c.description;
      return;
    end if;
  end if;

  if c.kind = 'frete_gratis' then
    return query select true, null::text, round(coalesce(p_frete, 0), 2), true, c.description;
  elsif c.kind = 'valor' then
    return query select true, null::text, round(least(c.amount, coalesce(p_subtotal, 0)), 2), false, c.description;
  else
    return query select true, null::text,
      round(coalesce(p_subtotal, 0) * c.amount / 100.0, 2), false, c.description;
  end if;
end $function$;

-- Defaults de coluna
alter table public."admin_settings" alter column "id" set default gen_random_uuid();
alter table public."admin_settings" alter column "store_name" set default 'Café Saporino'::text;
alter table public."admin_settings" alter column "sender_name" set default 'Café Saporino'::text;
alter table public."admin_settings" alter column "created_at" set default now();
alter table public."admin_settings" alter column "updated_at" set default now();
alter table public."ai_usage_events" alter column "id" set default gen_random_uuid();
alter table public."ai_usage_events" alter column "created_at" set default now();
alter table public."ai_usage_events" alter column "status" set default 'ok'::text;
alter table public."b2b_leads" alter column "id" set default gen_random_uuid();
alter table public."b2b_leads" alter column "consent_lgpd" set default false;
alter table public."b2b_leads" alter column "status" set default 'novo'::text;
alter table public."b2b_leads" alter column "created_at" set default now();
alter table public."batch_photos" alter column "id" set default gen_random_uuid();
alter table public."batch_photos" alter column "photo_type" set default 'general'::text;
alter table public."batch_photos" alter column "taken_at" set default now();
alter table public."candidaturas_representante" alter column "id" set default gen_random_uuid();
alter table public."candidaturas_representante" alter column "ciente_condicoes" set default false;
alter table public."candidaturas_representante" alter column "status" set default 'pendente'::text;
alter table public."candidaturas_representante" alter column "created_at" set default now();
alter table public."chat_conversations" alter column "id" set default gen_random_uuid();
alter table public."chat_conversations" alter column "type" set default 'direct'::text;
alter table public."chat_conversations" alter column "created_at" set default now();
alter table public."chat_conversations" alter column "last_message_at" set default now();
alter table public."chat_messages" alter column "id" set default gen_random_uuid();
alter table public."chat_messages" alter column "created_at" set default now();
alter table public."chat_participants" alter column "role" set default 'member'::text;
alter table public."chat_participants" alter column "last_read_at" set default now();
alter table public."chat_participants" alter column "joined_at" set default now();
alter table public."coffee_market_index" alter column "source" set default 'cepea_manual'::text;
alter table public."coffee_market_index" alter column "created_at" set default now();
alter table public."coffee_matches" alter column "id" set default gen_random_uuid();
alter table public."coffee_matches" alter column "factors" set default '{}'::jsonb;
alter table public."coffee_matches" alter column "status" set default 'suggested'::text;
alter table public."coffee_matches" alter column "computed_at" set default now();
alter table public."coffee_matches" alter column "created_at" set default now();
alter table public."coffee_offer_photos" alter column "id" set default gen_random_uuid();
alter table public."coffee_offer_photos" alter column "moderation_status" set default 'pending'::text;
alter table public."coffee_offer_photos" alter column "uploaded_by" set default auth.uid();
alter table public."coffee_offer_photos" alter column "created_at" set default now();
alter table public."coffee_offers" alter column "id" set default gen_random_uuid();
alter table public."coffee_offers" alter column "bag_weight_kg" set default 60;
alter table public."coffee_offers" alter column "certifications" set default '{}'::text[];
alter table public."coffee_offers" alter column "status" set default 'draft'::text;
alter table public."coffee_offers" alter column "sold_externally" set default false;
alter table public."coffee_offers" alter column "created_by" set default auth.uid();
alter table public."coffee_offers" alter column "created_at" set default now();
alter table public."coffee_offers" alter column "updated_at" set default now();
alter table public."coffee_pilot_cases" alter column "id" set default gen_random_uuid();
alter table public."coffee_pilot_cases" alter column "data_inicio" set default CURRENT_DATE;
alter table public."coffee_pilot_cases" alter column "autoriza_divulgacao" set default false;
alter table public."coffee_pilot_cases" alter column "divulgacao_anonimizada" set default true;
alter table public."coffee_pilot_cases" alter column "created_by" set default auth.uid();
alter table public."coffee_pilot_cases" alter column "created_at" set default now();
alter table public."coffee_pilot_cases" alter column "updated_at" set default now();
alter table public."coffee_purchase_requests" alter column "id" set default gen_random_uuid();
alter table public."coffee_purchase_requests" alter column "species" set default 'arabica'::text;
alter table public."coffee_purchase_requests" alter column "process_accepted" set default '{}'::text[];
alter table public."coffee_purchase_requests" alter column "certifications_required" set default '{}'::text[];
alter table public."coffee_purchase_requests" alter column "sample_required" set default false;
alter table public."coffee_purchase_requests" alter column "status" set default 'draft'::text;
alter table public."coffee_purchase_requests" alter column "created_by" set default auth.uid();
alter table public."coffee_purchase_requests" alter column "created_at" set default now();
alter table public."coffee_purchase_requests" alter column "updated_at" set default now();
alter table public."commercial_accounts" alter column "id" set default gen_random_uuid();
alter table public."commercial_accounts" alter column "relationship_type" set default 'cliente'::text;
alter table public."commercial_accounts" alter column "status" set default 'active'::text;
alter table public."commercial_accounts" alter column "opened_at" set default now();
alter table public."commercial_accounts" alter column "opened_by" set default auth.uid();
alter table public."commercial_accounts" alter column "created_at" set default now();
alter table public."commercial_accounts" alter column "updated_at" set default now();
alter table public."companies" alter column "id" set default gen_random_uuid();
alter table public."companies" alter column "created_at" set default now();
alter table public."companies" alter column "is_active" set default true;
alter table public."companies" alter column "sort_order" set default 0;
alter table public."companies" alter column "commission_model" set default 'formula'::text;
alter table public."companies" alter column "allow_cash" set default true;
alter table public."companies" alter column "is_b2c" set default false;
alter table public."companies" alter column "is_operator" set default false;
alter table public."companies" alter column "studio_enabled" set default false;
alter table public."companies" alter column "shipping_subsidy_per_kg" set default 0;
alter table public."companies" alter column "shipping_discount_active" set default true;
alter table public."companies" alter column "shipping_discount_unit" set default 'kg'::text;
alter table public."companies" alter column "shipping_discount_min_packs" set default 1;
alter table public."companies" alter column "shipping_discount_max" set default 0;
alter table public."company_order_counters" alter column "last_number" set default 0;
alter table public."coupon_redemptions" alter column "id" set default gen_random_uuid();
alter table public."coupon_redemptions" alter column "amount" set default 0;
alter table public."coupon_redemptions" alter column "created_at" set default now();
alter table public."coupons" alter column "id" set default gen_random_uuid();
alter table public."coupons" alter column "kind" set default 'percent'::text;
alter table public."coupons" alter column "amount" set default 0;
alter table public."coupons" alter column "min_subtotal" set default 0;
alter table public."coupons" alter column "first_purchase_only" set default true;
alter table public."coupons" alter column "uses" set default 0;
alter table public."coupons" alter column "is_active" set default true;
alter table public."coupons" alter column "created_at" set default now();
alter table public."delivery_dispatch_audit" alter column "id" set default gen_random_uuid();
alter table public."delivery_dispatch_audit" alter column "created_at" set default now();
alter table public."delivery_routes" alter column "id" set default gen_random_uuid();
alter table public."delivery_routes" alter column "status" set default 'planned'::text;
alter table public."delivery_routes" alter column "origin_label" set default 'CD Várzea Paulista'::text;
alter table public."delivery_routes" alter column "origin_lat" set default '-23.21'::numeric;
alter table public."delivery_routes" alter column "origin_lng" set default '-46.83'::numeric;
alter table public."delivery_routes" alter column "total_stops" set default 0;
alter table public."delivery_routes" alter column "total_km" set default 0;
alter table public."delivery_routes" alter column "total_weight_kg" set default 0;
alter table public."delivery_routes" alter column "created_at" set default now();
alter table public."delivery_routes" alter column "updated_at" set default now();
alter table public."delivery_stops" alter column "id" set default gen_random_uuid();
alter table public."delivery_stops" alter column "point_type" set default 'loja'::text;
alter table public."delivery_stops" alter column "status" set default 'pending'::text;
alter table public."delivery_stops" alter column "created_at" set default now();
alter table public."delivery_stops" alter column "updated_at" set default now();
alter table public."discovery_campaigns" alter column "id" set default gen_random_uuid();
alter table public."discovery_campaigns" alter column "country" set default 'BR'::text;
alter table public."discovery_campaigns" alter column "sources" set default '{}'::text[];
alter table public."discovery_campaigns" alter column "keywords" set default '{}'::text[];
alter table public."discovery_campaigns" alter column "created_at" set default now();
alter table public."discovery_campaigns" alter column "objectives" set default '{}'::text[];
alter table public."discovery_keywords" alter column "id" set default gen_random_uuid();
alter table public."discovery_keywords" alter column "sources" set default '{}'::text[];
alter table public."discovery_keywords" alter column "active" set default true;
alter table public."discovery_keywords" alter column "created_at" set default now();
alter table public."discovery_results" alter column "id" set default gen_random_uuid();
alter table public."discovery_results" alter column "status" set default 'new'::text;
alter table public."discovery_results" alter column "discovered_at" set default now();
alter table public."discovery_results" alter column "created_at" set default now();
alter table public."distributed_brands" alter column "id" set default gen_random_uuid();
alter table public."distributed_brands" alter column "sort_order" set default 0;
alter table public."distributed_brands" alter column "is_active" set default true;
alter table public."distributed_brands" alter column "created_at" set default now();
alter table public."driver_documents" alter column "id" set default gen_random_uuid();
alter table public."driver_documents" alter column "tipo" set default 'outro'::text;
alter table public."driver_documents" alter column "created_at" set default now();
alter table public."drivers" alter column "id" set default gen_random_uuid();
alter table public."drivers" alter column "status" set default 'pending'::text;
alter table public."drivers" alter column "is_online" set default false;
alter table public."drivers" alter column "created_at" set default now();
alter table public."drivers" alter column "updated_at" set default now();
alter table public."drivers" alter column "driver_type" set default 'proprio'::text;
alter table public."ecommerce_price_snapshots" alter column "captured_at" set default now();
alter table public."ecommerce_price_snapshots" alter column "marketplace" set default 'mercadolivre'::text;
alter table public."ecommerce_price_snapshots" alter column "currency" set default 'BRL'::text;
alter table public."ecommerce_price_snapshots" alter column "is_sponsored" set default false;
alter table public."ecommerce_price_snapshots" alter column "is_arabica" set default false;
alter table public."ecommerce_price_snapshots" alter column "is_suspect" set default false;
alter table public."ecommerce_price_snapshots" alter column "raw" set default '{}'::jsonb;
alter table public."ecommerce_price_snapshots" alter column "created_at" set default now();
alter table public."ecommerce_sources" alter column "enabled" set default false;
alter table public."ecommerce_sources" alter column "updated_at" set default now();
alter table public."ecommerce_sources" alter column "kind" set default 'marketplace'::text;
alter table public."ecommerce_sources" alter column "visible_to_reps" set default false;
alter table public."ecommerce_sources" alter column "sort_order" set default 0;
alter table public."edge_logs" alter column "id" set default gen_random_uuid();
alter table public."edge_logs" alter column "ts" set default now();
alter table public."edge_logs" alter column "level" set default 'info'::text;
alter table public."edge_rate_limits" alter column "count" set default 0;
alter table public."fleet_documents" alter column "id" set default gen_random_uuid();
alter table public."fleet_documents" alter column "tipo" set default 'outro'::text;
alter table public."fleet_documents" alter column "created_at" set default now();
alter table public."fleet_maintenance" alter column "id" set default gen_random_uuid();
alter table public."fleet_maintenance" alter column "tipo" set default 'revisao'::text;
alter table public."fleet_maintenance" alter column "created_at" set default now();
alter table public."fleet_vehicles" alter column "id" set default gen_random_uuid();
alter table public."fleet_vehicles" alter column "tipo" set default 'utilitario'::text;
alter table public."fleet_vehicles" alter column "status" set default 'ativo'::text;
alter table public."fleet_vehicles" alter column "created_at" set default now();
alter table public."fleet_vehicles" alter column "updated_at" set default now();
alter table public."green_coffee_lots" alter column "id" set default gen_random_uuid();
alter table public."green_coffee_lots" alter column "status" set default 'active'::text;
alter table public."green_coffee_lots" alter column "green_weight_kg" set default 0;
alter table public."green_coffee_lots" alter column "green_cost_per_kg" set default 0;
alter table public."green_coffee_lots" alter column "roast_cost" set default 0;
alter table public."green_coffee_lots" alter column "pkg_cost_250g" set default 0;
alter table public."green_coffee_lots" alter column "pkg_cost_500g" set default 0;
alter table public."green_coffee_lots" alter column "pkg_cost_1kg" set default 0;
alter table public."green_coffee_lots" alter column "pkg_cost_fardo5kg" set default 0;
alter table public."green_coffee_lots" alter column "label_cost_per_unit" set default 0;
alter table public."green_coffee_lots" alter column "plastic_wrap_cost_per_unit" set default 0;
alter table public."green_coffee_lots" alter column "fuel_cost" set default 0;
alter table public."green_coffee_lots" alter column "toll_cost" set default 0;
alter table public."green_coffee_lots" alter column "hotel_cost" set default 0;
alter table public."green_coffee_lots" alter column "food_cost" set default 0;
alter table public."green_coffee_lots" alter column "other_costs" set default '[]'::jsonb;
alter table public."green_coffee_lots" alter column "samples_given_units" set default 0;
alter table public."green_coffee_lots" alter column "samples_unit_size_g" set default 500;
alter table public."green_coffee_lots" alter column "bonus_given_units" set default 0;
alter table public."green_coffee_lots" alter column "bonus_unit_size_g" set default 500;
alter table public."green_coffee_lots" alter column "total_variable_cost" set default 0;
alter table public."green_coffee_lots" alter column "total_bonus_cost" set default 0;
alter table public."green_coffee_lots" alter column "cost_per_100g" set default 0;
alter table public."green_coffee_lots" alter column "cost_per_250g" set default 0;
alter table public."green_coffee_lots" alter column "cost_per_500g" set default 0;
alter table public."green_coffee_lots" alter column "cost_per_1kg" set default 0;
alter table public."green_coffee_lots" alter column "cost_per_fardo5kg" set default 0;
alter table public."green_coffee_lots" alter column "units_produced_250g" set default 0;
alter table public."green_coffee_lots" alter column "units_produced_500g" set default 0;
alter table public."green_coffee_lots" alter column "units_produced_1kg" set default 0;
alter table public."green_coffee_lots" alter column "units_produced_fardo5kg" set default 0;
alter table public."green_coffee_lots" alter column "photo_urls" set default '{}'::text[];
alter table public."green_coffee_lots" alter column "created_at" set default now();
alter table public."green_coffee_lots" alter column "updated_at" set default now();
alter table public."green_coffee_lots" alter column "quantity_packages" set default 0;
alter table public."green_coffee_lots" alter column "logistics_cost_brl" set default 0;
alter table public."green_coffee_lots" alter column "packaging_cost_per_kg" set default 1.30;
alter table public."invoices" alter column "id" set default gen_random_uuid();
alter table public."invoices" alter column "invoice_series" set default '1'::text;
alter table public."invoices" alter column "invoice_total" set default 0;
alter table public."invoices" alter column "status" set default 'attached'::text;
alter table public."invoices" alter column "created_at" set default now();
alter table public."lead_rf_candidates" alter column "id" set default gen_random_uuid();
alter table public."lead_rf_candidates" alter column "status" set default 'pending'::text;
alter table public."lead_rf_candidates" alter column "created_at" set default now();
alter table public."lot_documents" alter column "id" set default gen_random_uuid();
alter table public."lot_documents" alter column "uploaded_at" set default now();
alter table public."lot_transfers" alter column "id" set default gen_random_uuid();
alter table public."lot_transfers" alter column "transferred_at" set default now();
alter table public."lv_attributes" alter column "id" set default gen_random_uuid();
alter table public."lv_attributes" alter column "tipo" set default 'texto'::text;
alter table public."lv_attributes" alter column "opcoes" set default '[]'::jsonb;
alter table public."lv_attributes" alter column "no_passport" set default false;
alter table public."lv_attributes" alter column "filtravel" set default false;
alter table public."lv_attributes" alter column "ordem" set default 0;
alter table public."lv_attributes" alter column "created_at" set default now();
alter table public."lv_b2b_empresas" alter column "id" set default gen_random_uuid();
alter table public."lv_b2b_empresas" alter column "is_demo" set default false;
alter table public."lv_b2b_empresas" alter column "created_at" set default now();
alter table public."lv_b2b_solicitacoes" alter column "id" set default gen_random_uuid();
alter table public."lv_b2b_solicitacoes" alter column "status" set default 'novo'::text;
alter table public."lv_b2b_solicitacoes" alter column "is_demo" set default false;
alter table public."lv_b2b_solicitacoes" alter column "created_at" set default now();
alter table public."lv_b2b_solicitacoes" alter column "updated_at" set default now();
alter table public."lv_categories" alter column "id" set default gen_random_uuid();
alter table public."lv_categories" alter column "ordem" set default 0;
alter table public."lv_categories" alter column "ativa" set default true;
alter table public."lv_categories" alter column "created_at" set default now();
alter table public."lv_category_attributes" alter column "obrigatorio" set default false;
alter table public."lv_category_attributes" alter column "ordem" set default 0;
alter table public."lv_demo_access" alter column "id" set default gen_random_uuid();
alter table public."lv_demo_access" alter column "ativo" set default true;
alter table public."lv_demo_access" alter column "uses" set default 0;
alter table public."lv_demo_access" alter column "created_at" set default now();
alter table public."lv_inventory_lots" alter column "id" set default gen_random_uuid();
alter table public."lv_inventory_lots" alter column "qtd_disponivel" set default 0;
alter table public."lv_inventory_lots" alter column "qtd_reservada" set default 0;
alter table public."lv_inventory_lots" alter column "is_demo" set default false;
alter table public."lv_inventory_lots" alter column "created_at" set default now();
alter table public."lv_plans" alter column "id" set default gen_random_uuid();
alter table public."lv_plans" alter column "mensalidade_cents" set default 0;
alter table public."lv_plans" alter column "destaques" set default '[]'::jsonb;
alter table public."lv_plans" alter column "ordem" set default 0;
alter table public."lv_plans" alter column "ativo" set default true;
alter table public."lv_plans" alter column "em_estudo" set default true;
alter table public."lv_plans" alter column "created_at" set default now();
alter table public."lv_price_history" alter column "id" set default gen_random_uuid();
alter table public."lv_price_history" alter column "is_demo" set default false;
alter table public."lv_price_history" alter column "created_at" set default clock_timestamp();
alter table public."lv_price_tiers" alter column "id" set default gen_random_uuid();
alter table public."lv_price_tiers" alter column "tipo" set default 'percentual'::text;
alter table public."lv_price_tiers" alter column "created_at" set default now();
alter table public."lv_product_images" alter column "id" set default gen_random_uuid();
alter table public."lv_product_images" alter column "ordem" set default 0;
alter table public."lv_product_images" alter column "created_at" set default now();
alter table public."lv_product_variants" alter column "id" set default gen_random_uuid();
alter table public."lv_product_variants" alter column "padrao" set default false;
alter table public."lv_product_variants" alter column "ativa" set default true;
alter table public."lv_product_variants" alter column "ordem" set default 0;
alter table public."lv_product_variants" alter column "is_demo" set default false;
alter table public."lv_product_variants" alter column "created_at" set default now();
alter table public."lv_product_variants" alter column "updated_at" set default now();
alter table public."lv_products" alter column "id" set default gen_random_uuid();
alter table public."lv_products" alter column "status" set default 'rascunho'::text;
alter table public."lv_products" alter column "destaque" set default false;
alter table public."lv_products" alter column "ordem" set default 0;
alter table public."lv_products" alter column "is_demo" set default false;
alter table public."lv_products" alter column "created_at" set default now();
alter table public."lv_products" alter column "updated_at" set default now();
alter table public."lv_products" alter column "venda_por_quantidade" set default false;
alter table public."lv_qr_codes" alter column "ativo" set default true;
alter table public."lv_qr_codes" alter column "is_demo" set default false;
alter table public."lv_qr_codes" alter column "created_at" set default now();
alter table public."lv_seller_applications" alter column "id" set default gen_random_uuid();
alter table public."lv_seller_applications" alter column "tipo" set default 'torrefacao'::text;
alter table public."lv_seller_applications" alter column "status" set default 'interessado'::text;
alter table public."lv_seller_applications" alter column "created_at" set default now();
alter table public."lv_seller_applications" alter column "updated_at" set default now();
alter table public."lv_seller_users" alter column "papel" set default 'seller_owner'::text;
alter table public."lv_seller_users" alter column "created_at" set default now();
alter table public."lv_sellers" alter column "id" set default gen_random_uuid();
alter table public."lv_sellers" alter column "tipo" set default 'torrefacao'::text;
alter table public."lv_sellers" alter column "status" set default 'rascunho'::text;
alter table public."lv_sellers" alter column "is_demo" set default false;
alter table public."lv_sellers" alter column "created_at" set default now();
alter table public."lv_sellers" alter column "updated_at" set default now();
alter table public."lv_sellers" alter column "pagamento_status" set default 'nao_iniciado'::text;
alter table public."lv_settings" alter column "value" set default '{}'::jsonb;
alter table public."lv_settings" alter column "updated_at" set default now();
alter table public."lv_simulacao_premissas" alter column "updated_at" set default now();
alter table public."lv_stores" alter column "id" set default gen_random_uuid();
alter table public."lv_stores" alter column "ativa" set default true;
alter table public."lv_stores" alter column "destaque" set default false;
alter table public."lv_stores" alter column "ordem" set default 0;
alter table public."lv_stores" alter column "is_demo" set default false;
alter table public."lv_stores" alter column "created_at" set default now();
alter table public."lv_stores" alter column "updated_at" set default now();
alter table public."lv_tarifas_simulacao" alter column "id" set default gen_random_uuid();
alter table public."lv_tarifas_simulacao" alter column "ordem" set default 0;
alter table public."lv_tarifas_simulacao" alter column "ativo" set default true;
alter table public."lv_tarifas_simulacao" alter column "created_at" set default now();
alter table public."lv_tarifas_simulacao" alter column "updated_at" set default now();
alter table public."lv_tarifas_simulacao" alter column "modelo" set default 'marketplace'::text;
alter table public."marketing_contacts" alter column "id" set default gen_random_uuid();
alter table public."marketing_contacts" alter column "is_mobile" set default true;
alter table public."marketing_contacts" alter column "segment" set default 'b2c'::text;
alter table public."marketing_contacts" alter column "consent" set default true;
alter table public."marketing_contacts" alter column "consent_at" set default now();
alter table public."marketing_contacts" alter column "orders_count" set default 0;
alter table public."marketing_contacts" alter column "created_at" set default now();
alter table public."marketing_contacts" alter column "updated_at" set default now();
alter table public."marketplace_stores" alter column "id" set default gen_random_uuid();
alter table public."marketplace_stores" alter column "is_active" set default true;
alter table public."marketplace_stores" alter column "sort_order" set default 0;
alter table public."marketplace_stores" alter column "created_at" set default now();
alter table public."network_audit_log" alter column "id" set default gen_random_uuid();
alter table public."network_audit_log" alter column "actor_user_id" set default auth.uid();
alter table public."network_audit_log" alter column "created_at" set default now();
alter table public."network_entities" alter column "id" set default gen_random_uuid();
alter table public."network_entities" alter column "status" set default 'pending'::text;
alter table public."network_entities" alter column "created_by" set default auth.uid();
alter table public."network_entities" alter column "created_at" set default now();
alter table public."network_entities" alter column "updated_at" set default now();
alter table public."network_entity_roles" alter column "id" set default gen_random_uuid();
alter table public."network_entity_roles" alter column "status" set default 'active'::text;
alter table public."network_entity_roles" alter column "granted_at" set default now();
alter table public."network_entity_roles" alter column "granted_by" set default auth.uid();
alter table public."network_properties" alter column "id" set default gen_random_uuid();
alter table public."network_properties" alter column "created_by" set default auth.uid();
alter table public."network_properties" alter column "created_at" set default now();
alter table public."network_properties" alter column "updated_at" set default now();
alter table public."network_roles" alter column "sort_order" set default 0;
alter table public."order_emails" alter column "id" set default gen_random_uuid();
alter table public."order_emails" alter column "status" set default 'enviado'::text;
alter table public."order_emails" alter column "created_at" set default now();
alter table public."order_items" alter column "id" set default gen_random_uuid();
alter table public."order_items" alter column "created_at" set default now();
alter table public."orders" alter column "id" set default gen_random_uuid();
alter table public."orders" alter column "status" set default 'pending'::text;
alter table public."orders" alter column "order_type" set default 'single'::text;
alter table public."orders" alter column "created_at" set default now();
alter table public."orders" alter column "updated_at" set default now();
alter table public."orders" alter column "order_status" set default 'created'::text;
alter table public."orders" alter column "label_format" set default 'PDF'::text;
alter table public."orders" alter column "is_gift" set default false;
alter table public."orders" alter column "shipping_cost" set default 0;
alter table public."orders" alter column "tracking_events" set default '[]'::jsonb;
alter table public."orders" alter column "channel" set default 'site'::text;
alter table public."orders" alter column "accepts_whatsapp_promos" set default false;
alter table public."orders" alter column "is_pickup" set default false;
alter table public."orders" alter column "discount_amount" set default 0;
alter table public."packaging_specs" alter column "id" set default gen_random_uuid();
alter table public."packaging_specs" alter column "is_estimate" set default false;
alter table public."payment_refunds" alter column "id" set default gen_random_uuid();
alter table public."payment_refunds" alter column "is_partial" set default false;
alter table public."payment_refunds" alter column "status" set default 'solicitado'::text;
alter table public."payment_refunds" alter column "created_at" set default now();
alter table public."popup_settings" alter column "id" set default gen_random_uuid();
alter table public."popup_settings" alter column "enabled" set default false;
alter table public."popup_settings" alter column "eyebrow" set default 'Café fresquinho, todo dia'::text;
alter table public."popup_settings" alter column "headline" set default 'Ganhe 10% na sua primeira compra'::text;
alter table public."popup_settings" alter column "subtext" set default 'Cadastre-se e receba um cupom exclusivo no seu e-mail.'::text;
alter table public."popup_settings" alter column "disclaimer" set default 'Cupom válido para a primeira compra, 1 por CPF. Não cumulativo com outros cupons.'::text;
alter table public."popup_settings" alter column "button_text" set default 'Quero meu cupom'::text;
alter table public."popup_settings" alter column "button_link" set default 'cadastro'::text;
alter table public."popup_settings" alter column "show_days" set default 30;
alter table public."popup_settings" alter column "updated_at" set default now();
alter table public."popup_settings" alter column "name" set default 'Popup'::text;
alter table public."popup_settings" alter column "sort_order" set default 0;
alter table public."popup_settings" alter column "logo_scale" set default 1;
alter table public."price_lists" alter column "id" set default gen_random_uuid();
alter table public."price_lists" alter column "volume_discount" set default 0;
alter table public."price_lists" alter column "volume_min_qty" set default 1;
alter table public."price_lists" alter column "is_active" set default true;
alter table public."price_lists" alter column "created_at" set default now();
alter table public."price_lists" alter column "updated_at" set default now();
alter table public."products" alter column "id" set default gen_random_uuid();
alter table public."products" alter column "weight_grams" set default 250;
alter table public."products" alter column "flavor_notes" set default '[]'::jsonb;
alter table public."products" alter column "in_stock" set default true;
alter table public."products" alter column "created_at" set default now();
alter table public."products" alter column "updated_at" set default now();
alter table public."products" alter column "is_active" set default true;
alter table public."products" alter column "featured" set default false;
alter table public."products" alter column "category" set default 'Café em Grãos'::text;
alter table public."products" alter column "display_order" set default 0;
alter table public."products" alter column "discount_percentage" set default 0;
alter table public."products" alter column "stock" set default 0;
alter table public."products" alter column "subscription_enabled" set default false;
alter table public."products" alter column "subscription_months" set default 6;
alter table public."products" alter column "subscription_discount_pct" set default 20;
alter table public."products" alter column "additional_images" set default '{}'::text[];
alter table public."products" alter column "pj_only" set default false;
alter table public."products" alter column "hidden_from_store" set default false;
alter table public."products" alter column "sales_channels" set default '{}'::text[];
alter table public."products" alter column "has_custom_image" set default false;
alter table public."promo_banners" alter column "id" set default gen_random_uuid();
alter table public."promo_banners" alter column "sort_order" set default 0;
alter table public."promo_banners" alter column "active" set default true;
alter table public."promo_banners" alter column "created_at" set default now();
alter table public."promo_banners" alter column "button_x" set default 50;
alter table public."promo_banners" alter column "button_y" set default 85;
alter table public."promo_banners" alter column "button_scale" set default 1;
alter table public."promo_banners" alter column "overlay_x" set default 50;
alter table public."promo_banners" alter column "overlay_y" set default 50;
alter table public."promo_banners" alter column "overlay_scale" set default 1;
alter table public."promo_banners" alter column "site" set default 'saporino'::text;
alter table public."promoter_audit_log" alter column "id" set default nextval('promoter_audit_log_id_seq'::regclass);
alter table public."promoter_audit_log" alter column "created_at" set default now();
alter table public."promoter_client_mix" alter column "id" set default gen_random_uuid();
alter table public."promoter_client_mix" alter column "is_active" set default true;
alter table public."promoter_client_mix" alter column "created_at" set default now();
alter table public."promoter_clients" alter column "id" set default gen_random_uuid();
alter table public."promoter_clients" alter column "is_active" set default true;
alter table public."promoter_clients" alter column "created_at" set default now();
alter table public."promoter_incidents" alter column "id" set default gen_random_uuid();
alter table public."promoter_incidents" alter column "priority" set default 'normal'::text;
alter table public."promoter_incidents" alter column "status" set default 'aberta'::text;
alter table public."promoter_incidents" alter column "opened_at" set default now();
alter table public."promoter_incidents" alter column "created_at" set default now();
alter table public."promoter_routes" alter column "id" set default gen_random_uuid();
alter table public."promoter_routes" alter column "status" set default 'draft'::text;
alter table public."promoter_routes" alter column "created_at" set default now();
alter table public."promoter_routes" alter column "updated_at" set default now();
alter table public."promoter_visit_audits" alter column "id" set default gen_random_uuid();
alter table public."promoter_visit_audits" alter column "nao_localizado" set default false;
alter table public."promoter_visit_audits" alter column "created_at" set default now();
alter table public."promoter_visit_audits" alter column "updated_at" set default now();
alter table public."promoter_visit_locations" alter column "id" set default nextval('promoter_visit_locations_id_seq'::regclass);
alter table public."promoter_visit_photos" alter column "id" set default gen_random_uuid();
alter table public."promoter_visit_photos" alter column "created_at" set default now();
alter table public."promoter_visits" alter column "id" set default gen_random_uuid();
alter table public."promoter_visits" alter column "status" set default 'nao_iniciada'::text;
alter table public."promoter_visits" alter column "is_scheduled" set default true;
alter table public."promoter_visits" alter column "created_at" set default now();
alter table public."promoter_visits" alter column "updated_at" set default now();
alter table public."promoters" alter column "id" set default gen_random_uuid();
alter table public."promoters" alter column "status" set default 'pending'::text;
alter table public."promoters" alter column "created_at" set default now();
alter table public."promoters" alter column "updated_at" set default now();
alter table public."prospect_leads" alter column "id" set default gen_random_uuid();
alter table public."prospect_leads" alter column "geocode_status" set default 'pending'::text;
alter table public."prospect_leads" alter column "raw_data" set default '{}'::jsonb;
alter table public."prospect_leads" alter column "status" set default 'new'::text;
alter table public."prospect_leads" alter column "created_at" set default now();
alter table public."prospect_leads" alter column "updated_at" set default now();
alter table public."prospect_leads" alter column "rf_match_status" set default 'none'::text;
alter table public."prospect_lists" alter column "id" set default gen_random_uuid();
alter table public."prospect_lists" alter column "source_type" set default 'csv'::text;
alter table public."prospect_lists" alter column "status" set default 'draft'::text;
alter table public."prospect_lists" alter column "total_count" set default 0;
alter table public."prospect_lists" alter column "pending_count" set default 0;
alter table public."prospect_lists" alter column "converted_count" set default 0;
alter table public."prospect_lists" alter column "rejected_count" set default 0;
alter table public."prospect_lists" alter column "duplicate_count" set default 0;
alter table public."prospect_lists" alter column "invalid_count" set default 0;
alter table public."prospect_lists" alter column "created_at" set default now();
alter table public."prospect_lists" alter column "updated_at" set default now();
alter table public."prospect_runs" alter column "id" set default gen_random_uuid();
alter table public."prospect_runs" alter column "keywords" set default '{}'::text[];
alter table public."prospect_runs" alter column "max_places" set default 100;
alter table public."prospect_runs" alter column "keyword_count" set default 0;
alter table public."prospect_runs" alter column "places_estimate" set default 0;
alter table public."prospect_runs" alter column "cost_estimate_usd" set default 0;
alter table public."prospect_runs" alter column "status" set default 'queued'::text;
alter table public."prospect_runs" alter column "created_at" set default now();
alter table public."prospects_b2b" alter column "id" set default gen_random_uuid();
alter table public."prospects_b2b" alter column "geocode_status" set default 'pending'::text;
alter table public."prospects_b2b" alter column "is_client" set default false;
alter table public."prospects_b2b" alter column "fonte" set default 'rf_dados_abertos'::text;
alter table public."prospects_b2b" alter column "atualizado_em" set default now();
alter table public."prospects_b2b" alter column "created_at" set default now();
alter table public."rep_daily_plans" alter column "id" set default gen_random_uuid();
alter table public."rep_daily_plans" alter column "plan_date" set default CURRENT_DATE;
alter table public."rep_daily_plans" alter column "created_at" set default now();
alter table public."repco_help_articles" alter column "id" set default gen_random_uuid();
alter table public."repco_help_articles" alter column "category" set default 'Geral'::text;
alter table public."repco_help_articles" alter column "sort_order" set default 0;
alter table public."repco_help_articles" alter column "is_active" set default true;
alter table public."repco_help_articles" alter column "created_at" set default now();
alter table public."repco_help_articles" alter column "audience" set default 'representante'::text;
alter table public."repco_invite_codes" alter column "id" set default gen_random_uuid();
alter table public."repco_invite_codes" alter column "created_at" set default now();
alter table public."repco_invite_codes" alter column "role_code" set default 'representante'::text;
alter table public."representative_clients" alter column "id" set default gen_random_uuid();
alter table public."representative_clients" alter column "limite_credito" set default 0;
alter table public."representative_clients" alter column "status" set default 'active'::text;
alter table public."representative_clients" alter column "created_at" set default now();
alter table public."representative_clients" alter column "updated_at" set default now();
alter table public."representative_clients" alter column "inactivity_alert_dismissed" set default false;
alter table public."representative_clients" alter column "snooze_count" set default 0;
alter table public."representative_clients" alter column "snooze_admin_alert" set default false;
alter table public."representative_clients" alter column "is_active_client" set default true;
alter table public."representative_clients" alter column "assigned_to_company" set default false;
alter table public."representative_clients" alter column "public_pos" set default false;
alter table public."representative_clients" alter column "geocode_status" set default 'pending'::text;
alter table public."representative_clients" alter column "desconto_financeiro_pct" set default 0;
alter table public."representative_clients" alter column "desconto_logistico_pct" set default 0;
alter table public."representative_clients" alter column "geofence_radius_m" set default 500;
alter table public."representative_commission_payouts" alter column "id" set default gen_random_uuid();
alter table public."representative_commission_payouts" alter column "status" set default 'scheduled'::text;
alter table public."representative_commission_payouts" alter column "created_at" set default now();
alter table public."representative_commissions" alter column "id" set default gen_random_uuid();
alter table public."representative_commissions" alter column "base_rate" set default 5.00;
alter table public."representative_commissions" alter column "pix_bonus" set default 0;
alter table public."representative_commissions" alter column "delivery_bonus" set default 0;
alter table public."representative_commissions" alter column "status" set default 'pending'::text;
alter table public."representative_commissions" alter column "created_at" set default now();
alter table public."representative_company_settings" alter column "commission_rate" set default 0;
alter table public."representative_company_settings" alter column "active" set default true;
alter table public."representative_company_settings" alter column "created_at" set default now();
alter table public."representative_documents" alter column "id" set default gen_random_uuid();
alter table public."representative_documents" alter column "uploaded_at" set default now();
alter table public."representative_order_installments" alter column "id" set default gen_random_uuid();
alter table public."representative_order_installments" alter column "amount" set default 0;
alter table public."representative_order_installments" alter column "status" set default 'pending'::text;
alter table public."representative_order_installments" alter column "created_at" set default now();
alter table public."representative_order_items" alter column "id" set default gen_random_uuid();
alter table public."representative_order_items" alter column "unit" set default 'pacote'::text;
alter table public."representative_order_items" alter column "stock_applied" set default false;
alter table public."representative_order_items" alter column "created_at" set default now();
alter table public."representative_order_items" alter column "is_bonus" set default false;
alter table public."representative_order_notes" alter column "id" set default gen_random_uuid();
alter table public."representative_order_notes" alter column "created_at" set default now();
alter table public."representative_orders" alter column "id" set default gen_random_uuid();
alter table public."representative_orders" alter column "total_amount" set default 0;
alter table public."representative_orders" alter column "is_personal_delivery" set default false;
alter table public."representative_orders" alter column "status" set default 'new'::text;
alter table public."representative_orders" alter column "created_at" set default now();
alter table public."representative_orders" alter column "has_client_order_number" set default true;
alter table public."representative_orders" alter column "payment_term" set default 0;
alter table public."representative_orders" alter column "discount_percentage" set default 0;
alter table public."representative_orders" alter column "channel" set default 'repco'::text;
alter table public."representative_orders" alter column "pix_bonus_eligible" set default false;
alter table public."representative_orders" alter column "delivery_status" set default 'pendente'::text;
alter table public."representative_orders" alter column "desconto_financeiro_pct" set default 0;
alter table public."representative_orders" alter column "desconto_logistico_pct" set default 0;
alter table public."representative_orders" alter column "freight_amount" set default 0;
alter table public."representative_routes" alter column "id" set default gen_random_uuid();
alter table public."representative_routes" alter column "status" set default 'active'::text;
alter table public."representative_routes" alter column "created_at" set default now();
alter table public."representative_routes" alter column "updated_at" set default now();
alter table public."representative_routes" alter column "route_type" set default 'visit'::text;
alter table public."representative_routes" alter column "max_weight_kg" set default 800;
alter table public."representative_routes" alter column "total_weight_kg" set default 0;
alter table public."representatives" alter column "id" set default gen_random_uuid();
alter table public."representatives" alter column "commission_rate" set default 5.00;
alter table public."representatives" alter column "has_personal_delivery" set default false;
alter table public."representatives" alter column "status" set default 'pending'::text;
alter table public."representatives" alter column "created_at" set default now();
alter table public."representatives" alter column "updated_at" set default now();
alter table public."representatives" alter column "is_online" set default false;
alter table public."roasting_companies" alter column "id" set default gen_random_uuid();
alter table public."roasting_companies" alter column "active" set default true;
alter table public."roasting_companies" alter column "created_at" set default now();
alter table public."roasting_company_contacts" alter column "id" set default gen_random_uuid();
alter table public."roasting_company_contacts" alter column "active" set default true;
alter table public."roasting_company_contacts" alter column "created_at" set default now();
alter table public."roles" alter column "created_at" set default now();
alter table public."route_stops" alter column "id" set default gen_random_uuid();
alter table public."route_stops" alter column "visit_status" set default 'pending'::text;
alter table public."route_stops" alter column "created_at" set default now();
alter table public."route_stops" alter column "updated_at" set default now();
alter table public."route_stops" alter column "geofence_triggered" set default false;
alter table public."route_stops" alter column "stop_type" set default 'visit'::text;
alter table public."route_stops" alter column "weight_kg" set default 0;
alter table public."shipments" alter column "id" set default gen_random_uuid();
alter table public."shipments" alter column "label_format" set default 'PDF'::text;
alter table public."shipments" alter column "status" set default 'pending'::text;
alter table public."shipments" alter column "tracking_events" set default '[]'::jsonb;
alter table public."shipments" alter column "created_at" set default now();
alter table public."shipping_carriers" alter column "id" set default gen_random_uuid();
alter table public."shipping_carriers" alter column "price_per_kg" set default 0;
alter table public."shipping_carriers" alter column "fixed_price" set default 0;
alter table public."shipping_carriers" alter column "delivery_time_days" set default 0;
alter table public."shipping_carriers" alter column "is_active" set default true;
alter table public."shipping_carriers" alter column "api_type" set default 'manual'::text;
alter table public."shipping_carriers" alter column "created_at" set default now();
alter table public."shipping_carriers" alter column "is_own" set default false;
alter table public."shipping_coverage" alter column "id" set default nextval('shipping_coverage_id_seq'::regclass);
alter table public."shipping_quotes" alter column "id" set default gen_random_uuid();
alter table public."shipping_quotes" alter column "goods_value" set default 0;
alter table public."shipping_quotes" alter column "discount" set default 0;
alter table public."shipping_quotes" alter column "expires_at" set default (now() + '00:15:00'::interval);
alter table public."shipping_quotes" alter column "created_at" set default now();
alter table public."shipping_rate_tables" alter column "id" set default gen_random_uuid();
alter table public."shipping_rate_tables" alter column "insurance_pct" set default 0;
alter table public."shipping_rate_tables" alter column "gris_pct" set default 0;
alter table public."shipping_rate_tables" alter column "gris_min" set default 0;
alter table public."shipping_rate_tables" alter column "is_active" set default true;
alter table public."shipping_rate_tables" alter column "created_at" set default now();
alter table public."shipping_rate_tables" alter column "allow_discount" set default false;
alter table public."shipping_rate_tables" alter column "toll_per_100kg" set default 0;
alter table public."shipping_rate_tables" alter column "tas_fee" set default 0;
alter table public."shipping_rate_tables" alter column "tde_pct" set default 0;
alter table public."shipping_rate_tables" alter column "tde_min" set default 0;
alter table public."shipping_rate_tables" alter column "tda_fee" set default 0;
alter table public."shipping_rates" alter column "id" set default gen_random_uuid();
alter table public."site_settings" alter column "value" set default false;
alter table public."site_settings" alter column "updated_at" set default now();
alter table public."site_visits" alter column "id" set default gen_random_uuid();
alter table public."site_visits" alter column "created_at" set default now();
alter table public."stock_movements" alter column "id" set default gen_random_uuid();
alter table public."stock_movements" alter column "sem_lote" set default false;
alter table public."stock_movements" alter column "created_by" set default auth.uid();
alter table public."stock_movements" alter column "created_at" set default now();
alter table public."storage_cleanup_log" alter column "id" set default gen_random_uuid();
alter table public."storage_cleanup_log" alter column "dry_run" set default true;
alter table public."storage_cleanup_log" alter column "candidates" set default 0;
alter table public."storage_cleanup_log" alter column "deleted" set default 0;
alter table public."storage_cleanup_log" alter column "created_at" set default now();
alter table public."studio_analyses" alter column "id" set default gen_random_uuid();
alter table public."studio_analyses" alter column "created_at" set default now();
alter table public."studio_analyses" alter column "do_not_copy" set default '[]'::jsonb;
alter table public."studio_analyses" alter column "originality_changes" set default '[]'::jsonb;
alter table public."studio_analyses" alter column "claims_used" set default '[]'::jsonb;
alter table public."studio_analyses" alter column "assets_required" set default '[]'::jsonb;
alter table public."studio_analyses" alter column "suggestions_not_facts" set default '[]'::jsonb;
alter table public."studio_analyses" alter column "validation_warnings" set default '[]'::jsonb;
alter table public."studio_brand_profiles" alter column "id" set default gen_random_uuid();
alter table public."studio_brand_profiles" alter column "is_primary" set default true;
alter table public."studio_brand_profiles" alter column "created_at" set default now();
alter table public."studio_brand_profiles" alter column "updated_at" set default now();
alter table public."studio_brand_profiles" alter column "guardrails" set default '{}'::jsonb;
alter table public."studio_campaigns" alter column "id" set default gen_random_uuid();
alter table public."studio_campaigns" alter column "status" set default 'draft'::text;
alter table public."studio_campaigns" alter column "created_at" set default now();
alter table public."studio_content_fingerprints" alter column "id" set default gen_random_uuid();
alter table public."studio_content_fingerprints" alter column "created_at" set default now();
alter table public."studio_generations" alter column "id" set default gen_random_uuid();
alter table public."studio_generations" alter column "created_at" set default now();
alter table public."studio_generations" alter column "provider" set default 'openai'::text;
alter table public."studio_generations" alter column "status" set default 'pendente'::text;
alter table public."studio_generations" alter column "brand_mode" set default 'perfil'::text;
alter table public."studio_members" alter column "id" set default gen_random_uuid();
alter table public."studio_members" alter column "role" set default 'member'::text;
alter table public."studio_members" alter column "created_at" set default now();
alter table public."studio_organizations" alter column "id" set default gen_random_uuid();
alter table public."studio_organizations" alter column "plan" set default 'beta'::text;
alter table public."studio_organizations" alter column "status" set default 'ativa'::text;
alter table public."studio_organizations" alter column "created_at" set default now();
alter table public."studio_organizations" alter column "updated_at" set default now();
alter table public."studio_profile_snapshots" alter column "id" set default gen_random_uuid();
alter table public."studio_profile_snapshots" alter column "captured_at" set default now();
alter table public."studio_reference_assets" alter column "id" set default gen_random_uuid();
alter table public."studio_reference_assets" alter column "brand_mode" set default 'perfil'::text;
alter table public."studio_reference_assets" alter column "created_at" set default now();
alter table public."studio_social_connections" alter column "id" set default gen_random_uuid();
alter table public."studio_social_connections" alter column "status" set default 'disconnected'::text;
alter table public."studio_social_connections" alter column "updated_at" set default now();
alter table public."studio_social_connections" alter column "created_at" set default now();
alter table public."studio_transcriptions" alter column "id" set default gen_random_uuid();
alter table public."studio_transcriptions" alter column "created_at" set default now();
alter table public."studio_videos" alter column "id" set default gen_random_uuid();
alter table public."studio_videos" alter column "status" set default 'pending'::text;
alter table public."studio_videos" alter column "created_at" set default now();
alter table public."studio_videos" alter column "media_type" set default 'video'::text;
alter table public."subscription_settings" alter column "id" set default gen_random_uuid();
alter table public."subscription_settings" alter column "accepting_new" set default true;
alter table public."subscription_settings" alter column "tiers" set default '[{"months": 1, "discount_pct": 5}, {"months": 3, "discount_pct": 10}, {"months": 6, "discount_pct": 15}, {"months": 12, "discount_pct": 20}]'::jsonb;
alter table public."subscription_settings" alter column "updated_at" set default now();
alter table public."subscriptions" alter column "id" set default gen_random_uuid();
alter table public."subscriptions" alter column "status" set default 'active'::text;
alter table public."subscriptions" alter column "started_at" set default now();
alter table public."subscriptions" alter column "created_at" set default now();
alter table public."superfrete_settings" alter column "id" set default gen_random_uuid();
alter table public."superfrete_settings" alter column "is_active" set default false;
alter table public."superfrete_settings" alter column "services" set default '1,2,17'::text;
alter table public."superfrete_settings" alter column "markup_pct" set default 0;
alter table public."superfrete_settings" alter column "markup_fixo" set default 0;
alter table public."superfrete_settings" alter column "updated_at" set default now();
alter table public."telegram_recipients" alter column "id" set default gen_random_uuid();
alter table public."telegram_recipients" alter column "is_active" set default true;
alter table public."telegram_recipients" alter column "created_at" set default now();
alter table public."user_addresses" alter column "id" set default gen_random_uuid();
alter table public."user_addresses" alter column "country" set default 'Brasil'::text;
alter table public."user_addresses" alter column "is_default" set default false;
alter table public."user_addresses" alter column "created_at" set default now();
alter table public."user_addresses" alter column "updated_at" set default now();
alter table public."user_profiles" alter column "is_admin" set default false;
alter table public."user_profiles" alter column "created_at" set default now();
alter table public."user_roles" alter column "id" set default gen_random_uuid();
alter table public."user_roles" alter column "is_active" set default true;
alter table public."user_roles" alter column "granted_at" set default now();

-- Donos de sequência
alter sequence public."promoter_visit_locations_id_seq" owned by public."promoter_visit_locations"."id";
alter sequence public."promoter_audit_log_id_seq" owned by public."promoter_audit_log"."id";
alter sequence public."shipping_coverage_id_seq" owned by public."shipping_coverage"."id";

-- Views
create or replace view public."client_sales_history" as
SELECT rc.id AS client_id,
    rc.representative_id,
    rc.cnpj,
    rc.razao_social,
    rc.nome_fantasia,
    rc.segment,
    ro.id AS order_id,
    ro.order_number,
    ro.total_amount,
    NULL::numeric AS original_amount,
    NULL::numeric AS discount_percentage,
    ro.payment_method,
    NULL::integer AS payment_term,
    ro.status AS order_status,
    ro.created_at AS order_date,
    ro.completed_at,
    ro.invoice_pdf_url,
    ro.invoice_number,
    rc2.commission_amount,
    rc2.total_rate AS commission_rate,
    rc2.status AS commission_status
   FROM ((representative_clients rc
     LEFT JOIN representative_orders ro ON ((ro.representative_client_id = rc.id)))
     LEFT JOIN representative_commissions rc2 ON ((rc2.order_id = ro.id)))
  ORDER BY ro.created_at DESC NULLS LAST;
create materialized view if not exists public."mv_repco_prospects_muni" as
SELECT uf,
    translate(lower(municipio), 'áàâãäéèêëíìîïóòôõöúùûüçñ'::text, 'aaaaaeeeeiiiiooooouuuucn'::text) AS muni_key,
    max(municipio) AS municipio,
    count(*) AS prospects,
    count(*) FILTER (WHERE (is_client = false)) AS prospects_nao_clientes,
    avg(lat) AS lat,
    avg(lng) AS lng
   FROM prospects_b2b
  WHERE (municipio IS NOT NULL)
  GROUP BY uf, (translate(lower(municipio), 'áàâãäéèêëíìîïóòôõöúùûüçñ'::text, 'aaaaaeeeeiiiiooooouuuucn'::text))
with no data;
create or replace view public."points_of_sale" as
SELECT id,
    COALESCE(NULLIF(TRIM(BOTH FROM nome_fantasia), ''::text), razao_social) AS nome,
    endereco_completo,
    bairro,
    municipio,
    uf,
    cep,
    whatsapp_comprador AS whatsapp,
    lat,
    lng
   FROM representative_clients
  WHERE ((public_pos = true) AND (COALESCE(is_active_client, true) = true) AND (lat IS NOT NULL) AND (lng IS NOT NULL));
create or replace view public."products_com_disponibilidade" as
SELECT p.id,
    p.name,
    p.description,
    p.price,
    p.promotional_price,
    p.image_url,
    p.weight_grams,
    p.roast_type,
    p.flavor_notes,
    p.in_stock,
    p.created_at,
    p.updated_at,
    p.is_active,
    p.featured,
    p.category,
    p.display_order,
    p.discount_percentage,
    p.stock,
    p.full_details,
    p.subscription_enabled,
    p.subscription_months,
    p.subscription_discount_pct,
    p.additional_images,
    p.barcode,
    p.product_line,
    p.company_id,
    p.pj_only,
    p.hidden_from_store,
    p.sales_channels,
    p.kit_of_product_id,
    p.kit_quantity,
    p.sku,
    p.has_custom_image,
        CASE
            WHEN (p.kit_of_product_id IS NULL) THEN COALESCE(p.stock, 0)
            ELSE (floor(((COALESCE(b.stock, 0))::numeric / (GREATEST(p.kit_quantity, 1))::numeric)))::integer
        END AS disponivel,
    b.stock AS estoque_do_cafe,
        CASE
            WHEN ((COALESCE(p.promotional_price, (0)::numeric) > (0)::numeric) AND (p.promotional_price < p.price)) THEN p.promotional_price
            ELSE p.price
        END AS preco_final,
    ((COALESCE(p.promotional_price, (0)::numeric) > (0)::numeric) AND (p.promotional_price < p.price)) AS em_promocao
   FROM (products p
     LEFT JOIN products b ON ((b.id = p.kit_of_product_id)));
create or replace view public."vw_campanha_whatsapp" as
SELECT mc.id,
    mc.phone_e164,
    mc.name,
    mc.segment,
    c.name AS empresa,
    mc.consent_at,
    mc.last_order_at,
    mc.orders_count
   FROM (marketing_contacts mc
     LEFT JOIN companies c ON ((c.id = mc.company_id)))
  WHERE (mc.consent AND (mc.opted_out_at IS NULL) AND mc.is_mobile)
  ORDER BY mc.consent_at DESC;
create or replace view public."vw_coffee_offers_shielded" with (security_invoker=off) as
SELECT o.id AS offer_id,
    'Produtor verificado'::text AS vendedor,
    (e.status = 'verified'::text) AS produtor_verificado,
    o.species,
    o.harvest_year,
    o.quantity_bags,
    o.bag_weight_kg,
    o.bebida,
    b.label AS bebida_label,
    o.screen_min,
    o.process,
    o.moisture_pct,
    o.defect_type,
    o.sca_score,
    o.certifications,
    o.sensory_notes,
    o.asking_price_brl_bag,
    o.origin_municipio,
    o.origin_uf,
    o.region_label,
    o.available_from,
    o.available_until,
    o.exclusive_until,
    o.published_at,
    o.status
   FROM ((coffee_offers o
     JOIN network_entities e ON ((e.id = o.entity_id)))
     LEFT JOIN coffee_bebida_scale b ON ((b.code = o.bebida)))
  WHERE (o.status = 'active'::text);
create or replace view public."vw_coffee_pilot_metrics" as
SELECT count(*) AS casos,
    count(*) FILTER (WHERE fechou) AS fechados,
    count(*) FILTER (WHERE (resultado = 'perdido'::text)) AS perdidos,
    count(*) FILTER (WHERE (resultado = 'em_andamento'::text)) AS em_andamento,
    count(*) FILTER (WHERE amostra_solicitada) AS com_amostra,
    count(*) FILTER (WHERE proposta_feita) AS com_proposta,
    round(avg(minutos_ate_oferta_ativa), 1) AS media_min_ate_oferta_ativa,
    round(avg(minutos_ate_primeiro_match), 1) AS media_min_ate_primeiro_match,
    round(avg(match_score), 1) AS media_score,
    round(avg(tempo_cofico_minutos), 1) AS media_min_equipe_cofico,
    sum(volume_sacas) AS sacas_envolvidas,
    sum(valor_potencial_brl) FILTER (WHERE fechou) AS valor_fechado_brl
   FROM coffee_pilot_cases;
create or replace view public."vw_coffee_requests_shielded" with (security_invoker=off) as
SELECT r.id AS request_id,
        CASE
            WHEN (e.entity_type = 'organization'::text) THEN 'Comprador empresarial verificado'::text
            ELSE 'Comprador verificado'::text
        END AS comprador,
    (e.status = 'verified'::text) AS comprador_verificado,
    r.species,
    r.harvest_year,
    r.quantity_bags,
    r.bebida_min,
    b.label AS bebida_min_label,
    r.screen_min,
    r.process_accepted,
    r.moisture_max,
    r.defect_type_max,
    r.sca_min,
    r.certifications_required,
    r.target_price_min,
    r.target_price_max,
    r.origin_uf AS origem_desejada_uf,
    r.destination_uf AS destino_uf,
    r.delivery_window_start,
    r.delivery_window_end,
    r.freight_terms,
    r.sample_required,
    r.status
   FROM ((coffee_purchase_requests r
     JOIN network_entities e ON ((e.id = r.entity_id)))
     LEFT JOIN coffee_bebida_scale b ON ((b.code = r.bebida_min)))
  WHERE (r.status = 'active'::text);
create or replace view public."vw_cofico_delivery_queue" with (security_invoker=true) as
SELECT o.id AS order_id,
    o.order_number,
    o.company_id,
    co.fantasia AS company_name,
    o.representative_id,
    o.representative_client_id,
    cl.razao_social AS client_name,
    cl.nome_fantasia AS client_fantasia,
    cl.endereco_completo AS address,
    cl.bairro,
    cl.uf,
    cl.lat,
    cl.lng,
    o.total_amount,
    o.freight_amount,
    o.status,
    o.created_at,
    (COALESCE(w.weight_kg, (0)::numeric))::numeric(12,2) AS weight_kg
   FROM (((representative_orders o
     JOIN companies co ON ((co.id = o.company_id)))
     LEFT JOIN representative_clients cl ON ((cl.id = o.representative_client_id)))
     LEFT JOIN LATERAL ( SELECT sum(
                CASE i.unit
                    WHEN 'kg'::text THEN (i.quantity)::numeric
                    WHEN 'fardo'::text THEN ((((i.quantity * 10) * COALESCE(p.weight_grams, 0)))::numeric / 1000.0)
                    ELSE (((i.quantity * COALESCE(p.weight_grams, 0)))::numeric / 1000.0)
                END) AS weight_kg
           FROM (representative_order_items i
             JOIN products p ON ((p.id = i.product_id)))
          WHERE ((i.order_id = o.id) AND (COALESCE(i.is_bonus, false) = false))) w ON (true))
  WHERE ((o.delivery_mode = 'cofico'::text) AND (o.delivery_dispatched_at IS NULL));
create or replace view public."vw_cofico_vitrine" as
SELECT p.id,
    p.name,
    p.description,
    p.image_url,
    p.additional_images,
    p.category,
    p.product_line,
    p.roast_type,
    p.flavor_notes,
    p.weight_grams,
    p.stock,
    p.display_order,
    c.name AS marca_empresa,
    c.id AS company_id,
    (p.stock > 0) AS disponivel
   FROM (products p
     LEFT JOIN companies c ON ((c.id = p.company_id)))
  WHERE (p.is_active AND (NOT COALESCE(p.hidden_from_store, false)) AND ('cofico'::text = ANY (p.sales_channels)))
  ORDER BY p.display_order, p.name;
create or replace view public."vw_ecommerce_latest" with (security_invoker=true) as
SELECT id,
    company_id,
    captured_at,
    marketplace,
    search_term,
    listing_sku,
    title,
    thumb_url,
    url,
    domain_id,
    price,
    price_before,
    discount_pct,
    currency,
    search_position,
    is_sponsored,
    weight_g,
    unit_type,
    is_arabica,
    price_per_kg,
    is_suspect,
    raw,
    created_at
   FROM ecommerce_price_snapshots e
  WHERE (captured_at = ( SELECT max(ecommerce_price_snapshots.captured_at) AS max
           FROM ecommerce_price_snapshots
          WHERE ((ecommerce_price_snapshots.company_id = e.company_id) AND (ecommerce_price_snapshots.marketplace = e.marketplace))));
create or replace view public."vw_empresa_recebimento" as
SELECT id AS company_id,
    name,
    cnpj,
    order_prefix,
    payment_account,
    (payment_account IS NOT NULL) AS pode_receber
   FROM companies c;
create or replace view public."vw_estoque_alertas" as
WITH venda_30d AS (
         SELECT stock_movements.product_id,
            (sum((- stock_movements.quantity)))::numeric AS vendidos
           FROM stock_movements
          WHERE ((stock_movements.quantity < 0) AND (stock_movements.movement_type = 'venda'::text) AND (stock_movements.created_at > (now() - '30 days'::interval)))
          GROUP BY stock_movements.product_id
        ), saldo AS (
         SELECT l.product_id,
            (sum(l.quantity_packages))::integer AS pacotes,
            min(l.expiry_date) FILTER (WHERE (l.quantity_packages > 0)) AS validade_mais_proxima
           FROM green_coffee_lots l
          WHERE (l.status = 'active'::text)
          GROUP BY l.product_id
        )
 SELECT p.id AS product_id,
    p.name AS produto,
    c.name AS empresa,
    COALESCE(s.pacotes, 0) AS pacotes_disponiveis,
    COALESCE(v.vendidos, (0)::numeric) AS vendidos_30d,
    round((COALESCE(v.vendidos, (0)::numeric) / 30.0), 2) AS media_por_dia,
        CASE
            WHEN (COALESCE(v.vendidos, (0)::numeric) > (0)::numeric) THEN (floor(((COALESCE(s.pacotes, 0))::numeric / (v.vendidos / 30.0))))::integer
            ELSE NULL::integer
        END AS dias_de_estoque,
    s.validade_mais_proxima,
        CASE
            WHEN (s.validade_mais_proxima IS NOT NULL) THEN (s.validade_mais_proxima - CURRENT_DATE)
            ELSE NULL::integer
        END AS dias_ate_vencer,
        CASE
            WHEN (COALESCE(s.pacotes, 0) = 0) THEN 'SEM ESTOQUE — produzir lote'::text
            WHEN ((s.validade_mais_proxima IS NOT NULL) AND (s.validade_mais_proxima <= (CURRENT_DATE + 60))) THEN 'VALIDADE PROXIMA — girar com desconto'::text
            WHEN ((COALESCE(v.vendidos, (0)::numeric) > (0)::numeric) AND (((COALESCE(s.pacotes, 0))::numeric / (v.vendidos / 30.0)) < (15)::numeric)) THEN 'ACABANDO — produzir lote'::text
            WHEN ((COALESCE(v.vendidos, (0)::numeric) > (0)::numeric) AND (((COALESCE(s.pacotes, 0))::numeric / (v.vendidos / 30.0)) < (30)::numeric)) THEN 'ATENCAO — planejar producao'::text
            ELSE 'OK'::text
        END AS alerta
   FROM (((products p
     LEFT JOIN saldo s ON ((s.product_id = p.id)))
     LEFT JOIN venda_30d v ON ((v.product_id = p.id)))
     LEFT JOIN companies c ON ((c.id = p.company_id)))
  WHERE p.is_active
  ORDER BY
        CASE
            WHEN (COALESCE(s.pacotes, 0) = 0) THEN 0
            WHEN (s.validade_mais_proxima <= (CURRENT_DATE + 60)) THEN 1
            ELSE 2
        END, p.name;
create or replace view public."vw_lote_destino" as
SELECT m.batch_number,
    p.name AS produto,
    c.name AS empresa,
    m.channel AS canal,
    sum((- m.quantity)) FILTER (WHERE (m.quantity < 0)) AS saiu,
    sum(m.quantity) FILTER (WHERE (m.quantity > 0)) AS voltou,
    count(*) AS movimentos,
    max(m.created_at) AS ultimo_movimento
   FROM ((stock_movements m
     JOIN products p ON ((p.id = m.product_id)))
     LEFT JOIN companies c ON ((c.id = m.company_id)))
  GROUP BY m.batch_number, p.name, c.name, m.channel
  ORDER BY (max(m.created_at)) DESC;
create or replace view public."vw_lv_coffee_passport" with (security_invoker=on) as
SELECT p.id AS product_id,
    p.slug AS product_slug,
    a.chave,
    a.rotulo,
    a.tipo,
    a.unidade,
    a.ordem,
    pa.valor
   FROM ((lv_products p
     JOIN lv_product_attributes pa ON ((pa.product_id = p.id)))
     JOIN lv_attributes a ON ((a.id = pa.attribute_id)))
  WHERE (a.no_passport AND (btrim(pa.valor) <> ''::text));
create or replace view public."vw_lv_vitrine" with (security_invoker=on) as
SELECT p.id,
    p.slug,
    p.titulo,
    p.marca,
    p.descricao,
    p.preco_cents,
    p.preco_de_cents,
    p.peso_g,
    p.destaque,
    p.ordem,
    p.is_demo,
    p.venda_por_quantidade,
    p.category_id,
    c.slug AS categoria_slug,
    c.nome AS categoria_nome,
    c.icone AS categoria_icone,
    raiz.slug AS categoria_raiz_slug,
    p.store_id,
    s.slug AS loja_slug,
    s.nome AS loja_nome,
    s.cidade AS loja_cidade,
    s.uf AS loja_uf,
    s.cor AS loja_cor,
    s.iniciais AS loja_iniciais,
    lv_nivel_do_passport(p.id) AS nivel_passport,
    ( SELECT pa.valor
           FROM (lv_product_attributes pa
             JOIN lv_attributes a ON ((a.id = pa.attribute_id)))
          WHERE ((pa.product_id = p.id) AND (a.chave = 'pontuacao'::text))
         LIMIT 1) AS pontuacao,
    vp.id AS variante_padrao_id,
    COALESCE(lv_vendavel_da_variante(vp.id), 0) AS disponivel,
    ( SELECT q.codigo
           FROM lv_qr_codes q
          WHERE ((q.product_id = p.id) AND (q.variant_id IS NULL) AND q.ativo)
          ORDER BY q.created_at
         LIMIT 1) AS qr_codigo
   FROM ((((lv_products p
     JOIN lv_stores s ON ((s.id = p.store_id)))
     LEFT JOIN lv_categories c ON ((c.id = p.category_id)))
     LEFT JOIN lv_categories raiz ON ((raiz.id = COALESCE(c.parent_id, c.id))))
     LEFT JOIN lv_product_variants vp ON (((vp.product_id = p.id) AND vp.padrao)))
  WHERE ((p.status = 'ativo'::text) AND s.ativa);
create or replace view public."vw_promoter_coverage" with (security_barrier=true) as
SELECT v.promoter_id,
    pr.full_name AS promotor,
    date(COALESCE(v.scheduled_at, v.created_at)) AS dia,
    v.company_id,
    count(*) FILTER (WHERE v.is_scheduled) AS programadas,
    count(*) FILTER (WHERE (v.status = ANY (ARRAY['concluida'::text, 'concluida_com_pendencia'::text]))) AS realizadas,
    count(*) FILTER (WHERE (v.status = 'nao_realizada'::text)) AS nao_realizadas,
    round(((100.0 * (count(*) FILTER (WHERE (v.status = ANY (ARRAY['concluida'::text, 'concluida_com_pendencia'::text]))))::numeric) / (NULLIF(count(*) FILTER (WHERE v.is_scheduled), 0))::numeric), 1) AS taxa_cobertura
   FROM (promoter_visits v
     JOIN promoters pr ON ((pr.id = v.promoter_id)))
  WHERE (is_admin() OR has_role('supervisor'::text, v.company_id))
  GROUP BY v.promoter_id, pr.full_name, (date(COALESCE(v.scheduled_at, v.created_at))), v.company_id;
create or replace view public."vw_promoter_expiry" with (security_barrier=true) as
SELECT au.product_id,
    p.name AS produto,
    v.representative_client_id,
    COALESCE(c.nome_fantasia, c.razao_social) AS loja,
    au.validade_mais_proxima,
    au.qty_proxima_vencimento,
    au.qty_vencida,
    au.qty_avariada,
    au.company_id,
    au.updated_at
   FROM (((promoter_visit_audits au
     JOIN promoter_visits v ON ((v.id = au.visit_id)))
     JOIN representative_clients c ON ((c.id = v.representative_client_id)))
     JOIN products p ON ((p.id = au.product_id)))
  WHERE (((au.validade_mais_proxima IS NOT NULL) OR (COALESCE(au.qty_vencida, 0) > 0) OR (COALESCE(au.qty_avariada, 0) > 0) OR (COALESCE(au.qty_proxima_vencimento, 0) > 0)) AND (is_admin() OR has_role('supervisor'::text, au.company_id)));
create or replace view public."vw_promoter_incidents" with (security_barrier=true) as
SELECT i.id,
    i.visit_id,
    i.representative_client_id,
    i.product_id,
    i.category,
    i.priority,
    i.description,
    i.status,
    i.opened_at,
    i.closed_at,
    COALESCE(c.nome_fantasia, c.razao_social) AS loja,
    p.name AS product_name,
    i.company_id
   FROM ((promoter_incidents i
     JOIN representative_clients c ON ((c.id = i.representative_client_id)))
     LEFT JOIN products p ON ((p.id = i.product_id)))
  WHERE (i.promoter_id = my_promoter_id());
create or replace view public."vw_promoter_incidents_summary" with (security_barrier=true) as
SELECT company_id,
    count(*) FILTER (WHERE (status <> ALL (ARRAY['resolvida'::text, 'cancelada'::text]))) AS abertas,
    count(*) FILTER (WHERE (status = 'resolvida'::text)) AS resolvidas,
    count(*) FILTER (WHERE (converted_to_order_id IS NOT NULL)) AS convertidas_em_pedido,
    count(*) AS total
   FROM promoter_incidents i
  WHERE (is_admin() OR has_role('supervisor'::text, company_id))
  GROUP BY company_id;
create or replace view public."vw_promoter_products" with (security_barrier=true) as
SELECT id,
    name,
    product_line,
    weight_grams,
    barcode,
    image_url,
    company_id
   FROM products p
  WHERE ((my_promoter_id() IS NOT NULL) AND (is_active = true));
create or replace view public."vw_promoter_reps" with (security_barrier=true) as
SELECT DISTINCT r.id,
    r.full_name,
    r.is_online
   FROM ((representatives r
     JOIN representative_clients c ON ((c.representative_id = r.id)))
     JOIN promoter_clients pc ON (((pc.representative_client_id = c.id) AND pc.is_active)))
  WHERE ((pc.promoter_id = my_promoter_id()) AND (c.tem_gondola = true));
create or replace view public."vw_promoter_stock_ops" with (security_barrier=true) as
SELECT v.promoter_id,
    pr.full_name AS promotor,
    date(v.created_at) AS dia,
    au.company_id,
    sum(COALESCE(au.qty_abastecida, 0)) AS abastecido,
    sum(COALESCE(au.qty_retirada_deposito, 0)) AS retirado_deposito,
    round(avg(au.frentes_antes), 1) AS frentes_antes_media,
    round(avg(au.frentes_depois), 1) AS frentes_depois_media
   FROM ((promoter_visit_audits au
     JOIN promoter_visits v ON ((v.id = au.visit_id)))
     JOIN promoters pr ON ((pr.id = v.promoter_id)))
  WHERE (is_admin() OR has_role('supervisor'::text, au.company_id))
  GROUP BY v.promoter_id, pr.full_name, (date(v.created_at)), au.company_id;
create or replace view public."vw_promoter_stores" with (security_barrier=true) as
SELECT c.id,
    c.razao_social,
    c.nome_fantasia,
    c.cnpj,
    c.endereco_completo,
    c.bairro,
    c.municipio,
    c.uf,
    c.cep,
    c.lat,
    c.lng,
    c.geofence_radius_m,
    c.tem_gondola,
    c.company_id,
    c.representative_id
   FROM (representative_clients c
     JOIN promoter_clients pc ON (((pc.representative_client_id = c.id) AND pc.is_active)))
  WHERE ((pc.promoter_id = my_promoter_id()) AND (c.tem_gondola = true));
create or replace view public."vw_promoter_time" with (security_barrier=true) as
SELECT v.promoter_id,
    pr.full_name AS promotor,
    v.company_id,
    round(avg(v.duration_minutes), 1) AS tempo_medio_min,
    count(*) FILTER (WHERE ((v.checkin_geofence_ok = false) OR (v.checkout_geofence_ok = false))) AS fora_geocerca,
    count(*) AS visitas
   FROM (promoter_visits v
     JOIN promoters pr ON ((pr.id = v.promoter_id)))
  WHERE (is_admin() OR has_role('supervisor'::text, v.company_id))
  GROUP BY v.promoter_id, pr.full_name, v.company_id;
create or replace view public."vw_promoter_visit_mix" with (security_barrier=true) as
SELECT m.representative_client_id,
    m.product_id,
    m.min_frentes,
    p.name,
    p.product_line,
    p.weight_grams,
    p.barcode,
    p.image_url
   FROM (promoter_client_mix m
     JOIN products p ON ((p.id = m.product_id)))
  WHERE (m.is_active AND (EXISTS ( SELECT 1
           FROM promoter_clients pc
          WHERE ((pc.representative_client_id = m.representative_client_id) AND (pc.promoter_id = my_promoter_id()) AND pc.is_active))));
create or replace view public."vw_repco_clientes_ativos_por_area" with (security_invoker=true) as
SELECT uf,
    municipio,
    count(*) FILTER (WHERE (status = 'active'::text)) AS clientes_ativos,
    count(*) AS clientes_total
   FROM representative_clients c
  GROUP BY uf, municipio;
create or replace view public."vw_repco_clientes_bloqueados" with (security_invoker=true) as
SELECT o.representative_client_id AS client_id,
    min(i.due_date) AS vencido_em,
    count(*) AS parcelas_vencidas
   FROM (representative_order_installments i
     JOIN representative_orders o ON ((o.id = i.order_id)))
  WHERE ((i.status <> 'paid'::text) AND (i.due_date IS NOT NULL) AND (i.due_date < CURRENT_DATE))
  GROUP BY o.representative_client_id;
create or replace view public."vw_repco_clientes_geo" with (security_invoker=true) as
SELECT id,
    COALESCE(nome_fantasia, razao_social, nome_completo) AS nome,
    municipio,
    uf,
    lat,
    lng,
    cnpj
   FROM representative_clients c
  WHERE ((status = 'active'::text) AND (lat IS NOT NULL) AND (lng IS NOT NULL));
create or replace view public."vw_repco_leads_geo" with (security_invoker=true) as
SELECT le.id,
    le.company_name,
    le.trade_name,
    le.cnpj,
    le.city AS municipio,
    le.state,
    le.lat,
    le.lng,
    le.status,
    le.prospect_list_id,
    COALESCE(le.representative_id, pl.assigned_representative_id) AS rep_id,
    r.full_name AS rep_nome
   FROM ((prospect_leads le
     JOIN prospect_lists pl ON ((pl.id = le.prospect_list_id)))
     LEFT JOIN representatives r ON ((r.id = COALESCE(le.representative_id, pl.assigned_representative_id))))
  WHERE ((le.lat IS NOT NULL) AND (le.lng IS NOT NULL));
create or replace view public."vw_repco_preco_praticado" with (security_invoker=true) as
SELECT COALESCE(p.product_line, 'Sem linha'::text) AS product_line,
    c.uf,
    round(avg(i.unit_price), 2) AS preco_medio,
    sum(i.quantity) AS itens
   FROM (((representative_orders o
     JOIN representative_order_items i ON ((i.order_id = o.id)))
     JOIN products p ON ((p.id = i.product_id)))
     JOIN representative_clients c ON ((c.id = o.representative_client_id)))
  WHERE (o.status = 'completed'::text)
  GROUP BY COALESCE(p.product_line, 'Sem linha'::text), c.uf;
create or replace view public."vw_repco_vendas_por_area" with (security_invoker=true) as
SELECT (date_trunc('month'::text, o.created_at))::date AS mes,
    c.uf,
    c.municipio,
    count(*) AS pedidos,
    sum(o.total_amount) AS faturamento,
    avg(c.lat) AS lat,
    avg(c.lng) AS lng
   FROM (representative_orders o
     JOIN representative_clients c ON ((c.id = o.representative_client_id)))
  WHERE (o.status = 'completed'::text)
  GROUP BY ((date_trunc('month'::text, o.created_at))::date), c.uf, c.municipio;
create or replace view public."vw_repco_vendas_por_canal" with (security_invoker=true) as
SELECT (date_trunc('month'::text, created_at))::date AS mes,
    COALESCE(channel, 'repco'::text) AS canal,
    count(*) AS pedidos,
    sum(total_amount) AS faturamento
   FROM representative_orders o
  WHERE (status = 'completed'::text)
  GROUP BY ((date_trunc('month'::text, created_at))::date), COALESCE(channel, 'repco'::text);
create or replace view public."vw_repco_vendas_por_linha" with (security_invoker=true) as
SELECT (date_trunc('month'::text, o.created_at))::date AS mes,
    COALESCE(p.product_line, 'Sem linha'::text) AS product_line,
    sum(i.quantity) AS itens,
    sum(((i.quantity)::numeric * i.unit_price)) AS faturamento
   FROM ((representative_orders o
     JOIN representative_order_items i ON ((i.order_id = o.id)))
     JOIN products p ON ((p.id = i.product_id)))
  WHERE (o.status = 'completed'::text)
  GROUP BY ((date_trunc('month'::text, o.created_at))::date), COALESCE(p.product_line, 'Sem linha'::text);
create or replace view public."vw_repco_vendas_por_rep" with (security_invoker=true) as
SELECT o.representative_id,
    r.full_name AS rep_nome,
    count(*) AS pedidos,
    sum(o.total_amount) AS faturamento,
    round(avg(o.total_amount), 2) AS ticket_medio,
    count(DISTINCT o.representative_client_id) AS clientes_com_pedido
   FROM (representative_orders o
     LEFT JOIN representatives r ON ((r.id = o.representative_id)))
  WHERE (o.status = 'completed'::text)
  GROUP BY o.representative_id, r.full_name;
create or replace view public."vw_repco_vitrine" as
SELECT id,
    name,
    image_url,
    stock,
    in_stock,
    company_id,
    product_line,
    category,
    weight_grams
   FROM products p
  WHERE (is_active AND ('repco'::text = ANY (sales_channels)))
  ORDER BY name;
create or replace view public."vw_ruptura_alerts" with (security_barrier=true) as
SELECT i.id,
    i.visit_id,
    i.representative_client_id,
    i.product_id,
    i.promoter_id,
    i.assigned_representative_id,
    i.category,
    i.priority,
    i.status,
    i.description,
    i.opened_at,
    i.closed_at,
    i.converted_to_order_id,
    i.company_id,
    COALESCE(c.nome_fantasia, c.razao_social) AS loja,
    p.name AS product_name,
    p.image_url AS product_image,
    pr.full_name AS promoter_name,
    (EXISTS ( SELECT 1
           FROM promoter_visits v
          WHERE ((v.id = i.visit_id) AND (v.status = 'em_atendimento'::text)))) AS na_loja_agora,
    ( SELECT max(o.created_at) AS max
           FROM (representative_orders o
             JOIN representative_order_items oi ON ((oi.order_id = o.id)))
          WHERE ((o.representative_client_id = i.representative_client_id) AND (oi.product_id = i.product_id))) AS ultimo_pedido_em,
    ( SELECT round(avg(oi.quantity), 1) AS round
           FROM (representative_orders o
             JOIN representative_order_items oi ON ((oi.order_id = o.id)))
          WHERE ((o.representative_client_id = i.representative_client_id) AND (oi.product_id = i.product_id))) AS volume_medio,
    ( SELECT json_agg(json_build_object('url', ph.photo_url, 'kind', ph.kind)) AS json_agg
           FROM promoter_visit_photos ph
          WHERE ((ph.visit_id = i.visit_id) AND ((ph.product_id = i.product_id) OR (ph.kind = ANY (ARRAY['gondola_antes'::text, 'gondola_depois'::text]))))) AS fotos
   FROM (((promoter_incidents i
     JOIN representative_clients c ON ((c.id = i.representative_client_id)))
     LEFT JOIN products p ON ((p.id = i.product_id)))
     LEFT JOIN promoters pr ON ((pr.id = i.promoter_id)))
  WHERE ((i.assigned_representative_id = my_rep_id()) OR is_admin() OR has_role('supervisor'::text, i.company_id));
create or replace view public."vw_ruptura_by_client" with (security_barrier=true) as
SELECT v.representative_client_id,
    COALESCE(c.nome_fantasia, c.razao_social) AS loja,
    c.municipio,
    c.uf,
    v.company_id,
    count(*) FILTER (WHERE (au.ruptura_status_antes = 'ruptura_total'::text)) AS rupturas_totais,
    count(*) FILTER (WHERE (au.ruptura_status_antes = 'ruptura_gondola'::text)) AS rupturas_gondola,
    count(*) AS auditorias
   FROM ((promoter_visit_audits au
     JOIN promoter_visits v ON ((v.id = au.visit_id)))
     JOIN representative_clients c ON ((c.id = v.representative_client_id)))
  WHERE (is_admin() OR has_role('supervisor'::text, v.company_id))
  GROUP BY v.representative_client_id, COALESCE(c.nome_fantasia, c.razao_social), c.municipio, c.uf, v.company_id;
create or replace view public."vw_ruptura_by_product" with (security_barrier=true) as
SELECT au.product_id,
    p.name AS produto,
    au.company_id,
    count(*) FILTER (WHERE (au.ruptura_status_antes = 'ruptura_total'::text)) AS rupturas_totais,
    count(*) FILTER (WHERE (au.ruptura_status_antes = 'ruptura_gondola'::text)) AS rupturas_gondola,
    count(*) AS auditorias
   FROM (promoter_visit_audits au
     JOIN products p ON ((p.id = au.product_id)))
  WHERE (is_admin() OR has_role('supervisor'::text, au.company_id))
  GROUP BY au.product_id, p.name, au.company_id;
create or replace view public."vw_ruptura_by_region" with (security_barrier=true) as
SELECT c.municipio,
    c.uf,
    v.company_id,
    count(*) FILTER (WHERE (au.ruptura_status_antes = 'ruptura_total'::text)) AS rupturas_totais,
    count(*) FILTER (WHERE (au.ruptura_status_antes = 'ruptura_gondola'::text)) AS rupturas_gondola,
    count(*) AS auditorias
   FROM ((promoter_visit_audits au
     JOIN promoter_visits v ON ((v.id = au.visit_id)))
     JOIN representative_clients c ON ((c.id = v.representative_client_id)))
  WHERE (is_admin() OR has_role('supervisor'::text, v.company_id))
  GROUP BY c.municipio, c.uf, v.company_id;
create or replace view public."vw_ruptura_open" with (security_barrier=true) as
SELECT i.id,
    i.company_id,
    i.category,
    i.priority,
    i.description,
    i.status,
    COALESCE(i.opened_at, i.created_at) AS aberta_em,
    GREATEST((0)::numeric, (EXTRACT(epoch FROM (now() - COALESCE(i.opened_at, i.created_at))) / 3600.0)) AS horas_aberta,
    c.id AS client_id,
    COALESCE(c.nome_fantasia, c.razao_social) AS loja,
    c.municipio,
    c.uf,
    c.whatsapp_comprador,
    p.name AS produto,
    r.full_name AS representante,
    pr.full_name AS promotor
   FROM ((((promoter_incidents i
     LEFT JOIN representative_clients c ON ((c.id = i.representative_client_id)))
     LEFT JOIN products p ON ((p.id = i.product_id)))
     LEFT JOIN representatives r ON ((r.id = i.assigned_representative_id)))
     LEFT JOIN promoters pr ON ((pr.id = i.promoter_id)))
  WHERE (i.status <> ALL (ARRAY['resolvida'::text, 'cancelada'::text]));
create or replace view public."vw_storage_references" as
SELECT 'representative_orders'::text AS origem,
    unnest(ARRAY[representative_orders.invoice_pdf_url, representative_orders.invoice_xml_url, representative_orders.payment_proof_url, representative_orders.commission_paid_proof_url, representative_orders.service_invoice_url, representative_orders.delivery_proof_url]) AS ref
   FROM representative_orders
UNION ALL
 SELECT 'representative_order_installments'::text AS origem,
    unnest(ARRAY[representative_order_installments.boleto_url, representative_order_installments.proof_url]) AS ref
   FROM representative_order_installments
UNION ALL
 SELECT 'representative_commissions'::text AS origem,
    representative_commissions.proof_url AS ref
   FROM representative_commissions
UNION ALL
 SELECT 'representative_commission_payouts'::text AS origem,
    representative_commission_payouts.proof_url AS ref
   FROM representative_commission_payouts
UNION ALL
 SELECT 'representative_clients'::text AS origem,
    representative_clients.score_serasa_pdf_url AS ref
   FROM representative_clients
UNION ALL
 SELECT 'representative_documents'::text AS origem,
    representative_documents.file_url AS ref
   FROM representative_documents
UNION ALL
 SELECT 'representative_routes'::text AS origem,
    representative_routes.report_pdf_url AS ref
   FROM representative_routes
UNION ALL
 SELECT 'invoices'::text AS origem,
    unnest(ARRAY[invoices.invoice_pdf_url, invoices.invoice_xml_url]) AS ref
   FROM invoices
UNION ALL
 SELECT 'chat_messages'::text AS origem,
    chat_messages.attachment_url AS ref
   FROM chat_messages
UNION ALL
 SELECT 'chat_conversations'::text AS origem,
    chat_conversations.avatar_url AS ref
   FROM chat_conversations
UNION ALL
 SELECT 'promoter_visit_photos'::text AS origem,
    promoter_visit_photos.photo_url AS ref
   FROM promoter_visit_photos
UNION ALL
 SELECT 'route_stops'::text AS origem,
    route_stops.proof_photo_url AS ref
   FROM route_stops
UNION ALL
 SELECT 'delivery_stops'::text AS origem,
    unnest(ARRAY[delivery_stops.pickup_photo_url, delivery_stops.delivery_photo_url, delivery_stops.canhoto_photo_url]) AS ref
   FROM delivery_stops
UNION ALL
 SELECT 'coffee_offer_photos'::text AS origem,
    coffee_offer_photos.storage_path AS ref
   FROM coffee_offer_photos
UNION ALL
 SELECT 'batch_photos'::text AS origem,
    batch_photos.photo_url AS ref
   FROM batch_photos
UNION ALL
 SELECT 'lot_documents'::text AS origem,
    lot_documents.storage_path AS ref
   FROM lot_documents
UNION ALL
 SELECT 'green_coffee_lots'::text AS origem,
    unnest(ARRAY[green_coffee_lots.nf_purchase_url, green_coffee_lots.nf_url, green_coffee_lots.supplier_certificate_url, green_coffee_lots.quality_report_url]) AS ref
   FROM green_coffee_lots
UNION ALL
 SELECT 'products'::text AS origem,
    products.image_url AS ref
   FROM products
UNION ALL
 SELECT 'promo_banners'::text AS origem,
    unnest(ARRAY[promo_banners.image_url, promo_banners.overlay_image_url]) AS ref
   FROM promo_banners
UNION ALL
 SELECT 'popup_settings'::text AS origem,
    unnest(ARRAY[popup_settings.image_url, popup_settings.logo_url]) AS ref
   FROM popup_settings
UNION ALL
 SELECT 'companies'::text AS origem,
    companies.logo_url AS ref
   FROM companies
UNION ALL
 SELECT 'shipping_carriers'::text AS origem,
    shipping_carriers.logo_url AS ref
   FROM shipping_carriers
UNION ALL
 SELECT 'studio_brand_profiles'::text AS origem,
    studio_brand_profiles.logo_url AS ref
   FROM studio_brand_profiles
UNION ALL
 SELECT 'orders'::text AS origem,
    orders.label_url AS ref
   FROM orders
UNION ALL
 SELECT 'shipments'::text AS origem,
    shipments.label_url AS ref
   FROM shipments
UNION ALL
 SELECT 'studio_videos'::text AS origem,
    unnest(ARRAY[studio_videos.storage_path, studio_videos.audio_path, studio_videos.thumbnail_path, studio_videos.source_url]) AS ref
   FROM studio_videos
UNION ALL
 SELECT 'studio_campaigns'::text AS origem,
    studio_campaigns.media_path AS ref
   FROM studio_campaigns
UNION ALL
 SELECT 'driver_documents'::text AS origem,
    driver_documents.doc_path AS ref
   FROM driver_documents
UNION ALL
 SELECT 'fleet_documents'::text AS origem,
    fleet_documents.doc_path AS ref
   FROM fleet_documents
UNION ALL
 SELECT 'fleet_maintenance'::text AS origem,
    fleet_maintenance.doc_path AS ref
   FROM fleet_maintenance
UNION ALL
 SELECT 'products.additional_images'::text AS origem,
    unnest(COALESCE(products.additional_images, '{}'::text[])) AS ref
   FROM products
UNION ALL
 SELECT 'green_coffee_lots.photo_urls'::text AS origem,
    unnest(COALESCE(green_coffee_lots.photo_urls, '{}'::text[])) AS ref
   FROM green_coffee_lots;
create or replace view public."vw_repco_cobertura" with (security_invoker=true) as
WITH cl AS (
         SELECT representative_clients.uf,
            translate(lower(representative_clients.municipio), 'áàâãäéèêëíìîïóòôõöúùûüçñ'::text, 'aaaaaeeeeiiiiooooouuuucn'::text) AS muni_key,
            max(representative_clients.municipio) AS municipio,
            count(*) AS clientes
           FROM representative_clients
          WHERE ((representative_clients.status = 'active'::text) AND (representative_clients.municipio IS NOT NULL))
          GROUP BY representative_clients.uf, (translate(lower(representative_clients.municipio), 'áàâãäéèêëíìîïóòôõöúùûüçñ'::text, 'aaaaaeeeeiiiiooooouuuucn'::text))
        )
 SELECT COALESCE(pr.uf, cl.uf) AS uf,
    COALESCE(pr.municipio, cl.municipio) AS municipio,
    COALESCE(cl.clientes, (0)::bigint) AS clientes,
    COALESCE(pr.prospects, (0)::bigint) AS prospects,
    COALESCE(pr.prospects_nao_clientes, (0)::bigint) AS prospects_nao_clientes,
    pr.lat,
    pr.lng
   FROM (mv_repco_prospects_muni pr
     FULL JOIN cl ON (((cl.uf = pr.uf) AND (cl.muni_key = pr.muni_key))))
  WHERE is_admin();

-- Funções que usam o tipo de uma view
CREATE OR REPLACE FUNCTION public.lv_buscar_produtos(termo text)
 RETURNS SETOF vw_lv_vitrine
 LANGUAGE sql
 STABLE
AS $function$
  select v.*
    from public.vw_lv_vitrine v
   where coalesce(btrim(termo), '') = ''
      or translate(lower(v.titulo || ' ' || coalesce(v.marca,'') || ' ' || coalesce(v.descricao,'')
                        || ' ' || coalesce(v.loja_nome,'') || ' ' || coalesce(v.categoria_nome,'')),
                   'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                   'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')
         like '%' || translate(lower(btrim(termo)),
                   'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                   'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC') || '%'
   order by v.destaque desc, v.ordem;
$function$;

-- Constraints (chaves estrangeiras por último)
alter table public."admin_settings" add constraint "admin_settings_pkey" PRIMARY KEY (id);
alter table public."ai_usage_events" add constraint "ai_usage_events_pkey" PRIMARY KEY (id);
alter table public."b2b_leads" add constraint "b2b_leads_pkey" PRIMARY KEY (id);
alter table public."batch_photos" add constraint "batch_photos_pkey" PRIMARY KEY (id);
alter table public."candidaturas_representante" add constraint "candidaturas_representante_pkey" PRIMARY KEY (id);
alter table public."chat_conversations" add constraint "chat_conversations_pkey" PRIMARY KEY (id);
alter table public."chat_messages" add constraint "chat_messages_pkey" PRIMARY KEY (id);
alter table public."chat_participants" add constraint "chat_participants_pkey" PRIMARY KEY (conversation_id, user_id);
alter table public."coffee_bebida_scale" add constraint "coffee_bebida_scale_pkey" PRIMARY KEY (code);
alter table public."coffee_market_index" add constraint "coffee_market_index_pkey" PRIMARY KEY (id);
alter table public."coffee_matches" add constraint "coffee_matches_pkey" PRIMARY KEY (id);
alter table public."coffee_offer_photos" add constraint "coffee_offer_photos_pkey" PRIMARY KEY (id);
alter table public."coffee_offers" add constraint "coffee_offers_pkey" PRIMARY KEY (id);
alter table public."coffee_pilot_cases" add constraint "coffee_pilot_cases_pkey" PRIMARY KEY (id);
alter table public."coffee_purchase_requests" add constraint "coffee_purchase_requests_pkey" PRIMARY KEY (id);
alter table public."commercial_accounts" add constraint "commercial_accounts_pkey" PRIMARY KEY (id);
alter table public."companies" add constraint "companies_pkey" PRIMARY KEY (id);
alter table public."company_order_counters" add constraint "company_order_counters_pkey" PRIMARY KEY (company_id);
alter table public."coupon_redemptions" add constraint "coupon_redemptions_pkey" PRIMARY KEY (id);
alter table public."coupons" add constraint "coupons_pkey" PRIMARY KEY (id);
alter table public."delivery_dispatch_audit" add constraint "delivery_dispatch_audit_pkey" PRIMARY KEY (id);
alter table public."delivery_routes" add constraint "delivery_routes_pkey" PRIMARY KEY (id);
alter table public."delivery_stops" add constraint "delivery_stops_pkey" PRIMARY KEY (id);
alter table public."discovery_campaigns" add constraint "discovery_campaigns_pkey" PRIMARY KEY (id);
alter table public."discovery_keywords" add constraint "discovery_keywords_pkey" PRIMARY KEY (id);
alter table public."discovery_results" add constraint "discovery_results_pkey" PRIMARY KEY (id);
alter table public."distributed_brands" add constraint "distributed_brands_pkey" PRIMARY KEY (id);
alter table public."driver_documents" add constraint "driver_documents_pkey" PRIMARY KEY (id);
alter table public."drivers" add constraint "drivers_pkey" PRIMARY KEY (id);
alter table public."ecommerce_price_snapshots" add constraint "ecommerce_price_snapshots_pkey" PRIMARY KEY (id);
alter table public."ecommerce_sources" add constraint "ecommerce_sources_pkey" PRIMARY KEY (marketplace);
alter table public."edge_logs" add constraint "edge_logs_pkey" PRIMARY KEY (id);
alter table public."edge_rate_limits" add constraint "edge_rate_limits_pkey" PRIMARY KEY (bucket_key, window_start);
alter table public."fleet_documents" add constraint "fleet_documents_pkey" PRIMARY KEY (id);
alter table public."fleet_maintenance" add constraint "fleet_maintenance_pkey" PRIMARY KEY (id);
alter table public."fleet_vehicles" add constraint "fleet_vehicles_pkey" PRIMARY KEY (id);
alter table public."green_coffee_lots" add constraint "product_batches_pkey" PRIMARY KEY (id);
alter table public."ibge_municipios" add constraint "ibge_municipios_pkey" PRIMARY KEY (codigo_ibge);
alter table public."invoices" add constraint "invoices_pkey" PRIMARY KEY (id);
alter table public."lead_rf_candidates" add constraint "lead_rf_candidates_pkey" PRIMARY KEY (id);
alter table public."lot_documents" add constraint "lot_documents_pkey" PRIMARY KEY (id);
alter table public."lot_transfers" add constraint "lot_transfers_pkey" PRIMARY KEY (id);
alter table public."lv_attributes" add constraint "lv_attributes_pkey" PRIMARY KEY (id);
alter table public."lv_b2b_empresas" add constraint "lv_b2b_empresas_pkey" PRIMARY KEY (id);
alter table public."lv_b2b_solicitacoes" add constraint "lv_b2b_solicitacoes_pkey" PRIMARY KEY (id);
alter table public."lv_categories" add constraint "lv_categories_pkey" PRIMARY KEY (id);
alter table public."lv_category_attributes" add constraint "lv_category_attributes_pkey" PRIMARY KEY (category_id, attribute_id);
alter table public."lv_demo_access" add constraint "lv_demo_access_pkey" PRIMARY KEY (id);
alter table public."lv_inventory_lots" add constraint "lv_inventory_lots_pkey" PRIMARY KEY (id);
alter table public."lv_plans" add constraint "lv_plans_pkey" PRIMARY KEY (id);
alter table public."lv_price_history" add constraint "lv_price_history_pkey" PRIMARY KEY (id);
alter table public."lv_price_tiers" add constraint "lv_price_tiers_pkey" PRIMARY KEY (id);
alter table public."lv_product_attributes" add constraint "lv_product_attributes_pkey" PRIMARY KEY (product_id, attribute_id);
alter table public."lv_product_images" add constraint "lv_product_images_pkey" PRIMARY KEY (id);
alter table public."lv_product_variants" add constraint "lv_product_variants_pkey" PRIMARY KEY (id);
alter table public."lv_products" add constraint "lv_products_pkey" PRIMARY KEY (id);
alter table public."lv_qr_codes" add constraint "lv_qr_codes_pkey" PRIMARY KEY (codigo);
alter table public."lv_seller_applications" add constraint "lv_seller_applications_pkey" PRIMARY KEY (id);
alter table public."lv_seller_users" add constraint "lv_seller_users_pkey" PRIMARY KEY (seller_id, user_id);
alter table public."lv_sellers" add constraint "lv_sellers_pkey" PRIMARY KEY (id);
alter table public."lv_settings" add constraint "lv_settings_pkey" PRIMARY KEY (key);
alter table public."lv_simulacao_premissas" add constraint "lv_simulacao_premissas_pkey" PRIMARY KEY (chave);
alter table public."lv_stores" add constraint "lv_stores_pkey" PRIMARY KEY (id);
alter table public."lv_tarifas_simulacao" add constraint "lv_tarifas_simulacao_pkey" PRIMARY KEY (id);
alter table public."marketing_contacts" add constraint "marketing_contacts_pkey" PRIMARY KEY (id);
alter table public."marketplace_stores" add constraint "marketplace_stores_pkey" PRIMARY KEY (id);
alter table public."network_audit_log" add constraint "network_audit_log_pkey" PRIMARY KEY (id);
alter table public."network_entities" add constraint "network_entities_pkey" PRIMARY KEY (id);
alter table public."network_entity_roles" add constraint "network_entity_roles_pkey" PRIMARY KEY (id);
alter table public."network_properties" add constraint "network_properties_pkey" PRIMARY KEY (id);
alter table public."network_roles" add constraint "network_roles_pkey" PRIMARY KEY (code);
alter table public."order_emails" add constraint "order_emails_pkey" PRIMARY KEY (id);
alter table public."order_items" add constraint "order_items_pkey" PRIMARY KEY (id);
alter table public."orders" add constraint "orders_pkey" PRIMARY KEY (id);
alter table public."packaging_specs" add constraint "packaging_specs_pkey" PRIMARY KEY (id);
alter table public."payment_refunds" add constraint "payment_refunds_pkey" PRIMARY KEY (id);
alter table public."popup_settings" add constraint "popup_settings_pkey" PRIMARY KEY (id);
alter table public."price_lists" add constraint "price_lists_pkey" PRIMARY KEY (id);
alter table public."products" add constraint "products_pkey" PRIMARY KEY (id);
alter table public."promo_banners" add constraint "promo_banners_pkey" PRIMARY KEY (id);
alter table public."promoter_audit_log" add constraint "promoter_audit_log_pkey" PRIMARY KEY (id);
alter table public."promoter_client_mix" add constraint "promoter_client_mix_pkey" PRIMARY KEY (id);
alter table public."promoter_clients" add constraint "promoter_clients_pkey" PRIMARY KEY (id);
alter table public."promoter_incidents" add constraint "promoter_incidents_pkey" PRIMARY KEY (id);
alter table public."promoter_routes" add constraint "promoter_routes_pkey" PRIMARY KEY (id);
alter table public."promoter_visit_audits" add constraint "promoter_visit_audits_pkey" PRIMARY KEY (id);
alter table public."promoter_visit_locations" add constraint "promoter_visit_locations_pkey" PRIMARY KEY (id);
alter table public."promoter_visit_photos" add constraint "promoter_visit_photos_pkey" PRIMARY KEY (id);
alter table public."promoter_visits" add constraint "promoter_visits_pkey" PRIMARY KEY (id);
alter table public."promoters" add constraint "promoters_pkey" PRIMARY KEY (id);
alter table public."prospect_leads" add constraint "prospect_leads_pkey" PRIMARY KEY (id);
alter table public."prospect_lists" add constraint "prospect_lists_pkey" PRIMARY KEY (id);
alter table public."prospect_runs" add constraint "prospect_runs_pkey" PRIMARY KEY (id);
alter table public."prospects_b2b" add constraint "prospects_b2b_pkey" PRIMARY KEY (id);
alter table public."rep_daily_plans" add constraint "rep_daily_plans_pkey" PRIMARY KEY (id);
alter table public."repco_help_articles" add constraint "repco_help_articles_pkey" PRIMARY KEY (id);
alter table public."repco_invite_codes" add constraint "repco_invite_codes_pkey" PRIMARY KEY (id);
alter table public."representative_clients" add constraint "representative_clients_pkey" PRIMARY KEY (id);
alter table public."representative_commission_payouts" add constraint "representative_commission_payouts_pkey" PRIMARY KEY (id);
alter table public."representative_commissions" add constraint "representative_commissions_pkey" PRIMARY KEY (id);
alter table public."representative_company_settings" add constraint "representative_company_settings_pkey" PRIMARY KEY (representative_id, company_id);
alter table public."representative_documents" add constraint "representative_documents_pkey" PRIMARY KEY (id);
alter table public."representative_order_installments" add constraint "representative_order_installments_pkey" PRIMARY KEY (id);
alter table public."representative_order_items" add constraint "representative_order_items_pkey" PRIMARY KEY (id);
alter table public."representative_order_notes" add constraint "representative_order_notes_pkey" PRIMARY KEY (id);
alter table public."representative_orders" add constraint "representative_orders_pkey" PRIMARY KEY (id);
alter table public."representative_routes" add constraint "representative_routes_pkey" PRIMARY KEY (id);
alter table public."representatives" add constraint "representatives_pkey" PRIMARY KEY (id);
alter table public."roasting_companies" add constraint "roasting_companies_pkey" PRIMARY KEY (id);
alter table public."roasting_company_contacts" add constraint "roasting_company_contacts_pkey" PRIMARY KEY (id);
alter table public."roles" add constraint "roles_pkey" PRIMARY KEY (code);
alter table public."route_stops" add constraint "route_stops_pkey" PRIMARY KEY (id);
alter table public."shipments" add constraint "shipments_pkey" PRIMARY KEY (id);
alter table public."shipping_carriers" add constraint "shipping_carriers_pkey" PRIMARY KEY (id);
alter table public."shipping_coverage" add constraint "shipping_coverage_pkey" PRIMARY KEY (id);
alter table public."shipping_quotes" add constraint "shipping_quotes_pkey" PRIMARY KEY (id);
alter table public."shipping_rate_tables" add constraint "shipping_rate_tables_pkey" PRIMARY KEY (id);
alter table public."shipping_rates" add constraint "shipping_rates_pkey" PRIMARY KEY (id);
alter table public."site_settings" add constraint "site_settings_pkey" PRIMARY KEY (key);
alter table public."site_visits" add constraint "site_visits_pkey" PRIMARY KEY (id);
alter table public."stock_movements" add constraint "stock_movements_pkey" PRIMARY KEY (id);
alter table public."storage_cleanup_log" add constraint "storage_cleanup_log_pkey" PRIMARY KEY (id);
alter table public."studio_analyses" add constraint "studio_analyses_pkey" PRIMARY KEY (id);
alter table public."studio_brand_profiles" add constraint "studio_brand_profiles_pkey" PRIMARY KEY (id);
alter table public."studio_campaigns" add constraint "studio_campaigns_pkey" PRIMARY KEY (id);
alter table public."studio_content_fingerprints" add constraint "studio_content_fingerprints_pkey" PRIMARY KEY (id);
alter table public."studio_generations" add constraint "studio_generations_pkey" PRIMARY KEY (id);
alter table public."studio_members" add constraint "studio_members_pkey" PRIMARY KEY (id);
alter table public."studio_organizations" add constraint "studio_organizations_pkey" PRIMARY KEY (id);
alter table public."studio_profile_snapshots" add constraint "studio_profile_snapshots_pkey" PRIMARY KEY (id);
alter table public."studio_reference_assets" add constraint "studio_reference_assets_pkey" PRIMARY KEY (id);
alter table public."studio_social_connections" add constraint "studio_social_connections_pkey" PRIMARY KEY (id);
alter table public."studio_transcriptions" add constraint "studio_transcriptions_pkey" PRIMARY KEY (id);
alter table public."studio_videos" add constraint "studio_videos_pkey" PRIMARY KEY (id);
alter table public."subscription_settings" add constraint "subscription_settings_pkey" PRIMARY KEY (id);
alter table public."subscriptions" add constraint "subscriptions_pkey" PRIMARY KEY (id);
alter table public."superfrete_settings" add constraint "superfrete_settings_pkey" PRIMARY KEY (id);
alter table public."telegram_recipients" add constraint "telegram_recipients_pkey" PRIMARY KEY (id);
alter table public."user_addresses" add constraint "user_addresses_pkey" PRIMARY KEY (id);
alter table public."user_profiles" add constraint "user_profiles_pkey" PRIMARY KEY (id);
alter table public."user_roles" add constraint "user_roles_pkey" PRIMARY KEY (id);
alter table public."coffee_bebida_scale" add constraint "coffee_bebida_scale_ordinal_key" UNIQUE (ordinal);
alter table public."coffee_market_index" add constraint "coffee_market_index_ref_date_key" UNIQUE (ref_date);
alter table public."coffee_matches" add constraint "coffee_matches_offer_id_request_id_key" UNIQUE (offer_id, request_id);
alter table public."coffee_pilot_cases" add constraint "coffee_pilot_cases_codigo_key" UNIQUE (codigo);
alter table public."commercial_accounts" add constraint "commercial_accounts_entity_id_company_id_relationship_type_key" UNIQUE (entity_id, company_id, relationship_type);
alter table public."coupon_redemptions" add constraint "coupon_redemptions_order_id_key" UNIQUE (order_id);
alter table public."coupons" add constraint "coupons_company_id_code_key" UNIQUE (company_id, code);
alter table public."discovery_keywords" add constraint "discovery_keywords_group_name_term_key" UNIQUE (group_name, term);
alter table public."green_coffee_lots" add constraint "product_batches_batch_number_key" UNIQUE (batch_number);
alter table public."lv_attributes" add constraint "lv_attributes_chave_key" UNIQUE (chave);
alter table public."lv_categories" add constraint "lv_categories_slug_key" UNIQUE (slug);
alter table public."lv_demo_access" add constraint "lv_demo_access_code_hash_key" UNIQUE (code_hash);
alter table public."lv_plans" add constraint "lv_plans_slug_key" UNIQUE (slug);
alter table public."lv_price_tiers" add constraint "lv_price_tiers_product_id_min_qty_key" UNIQUE (product_id, min_qty);
alter table public."lv_products" add constraint "lv_products_slug_key" UNIQUE (slug);
alter table public."lv_stores" add constraint "lv_stores_slug_key" UNIQUE (slug);
alter table public."marketing_contacts" add constraint "marketing_contacts_phone_e164_segment_company_id_key" UNIQUE (phone_e164, segment, company_id);
alter table public."network_entity_roles" add constraint "network_entity_roles_entity_id_role_code_key" UNIQUE (entity_id, role_code);
alter table public."order_emails" add constraint "order_emails_order_id_kind_key" UNIQUE (order_id, kind);
alter table public."orders" add constraint "orders_order_number_key" UNIQUE (order_number);
alter table public."packaging_specs" add constraint "packaging_specs_units_key" UNIQUE (units);
alter table public."price_lists" add constraint "price_lists_product_id_segment_key" UNIQUE (product_id, segment);
alter table public."promoter_client_mix" add constraint "promoter_client_mix_representative_client_id_product_id_key" UNIQUE (representative_client_id, product_id);
alter table public."promoter_clients" add constraint "promoter_clients_promoter_id_representative_client_id_key" UNIQUE (promoter_id, representative_client_id);
alter table public."promoter_routes" add constraint "promoter_routes_promoter_id_route_date_key" UNIQUE (promoter_id, route_date);
alter table public."promoter_visit_audits" add constraint "promoter_visit_audits_visit_id_product_id_key" UNIQUE (visit_id, product_id);
alter table public."promoters" add constraint "promoters_user_id_key" UNIQUE (user_id);
alter table public."rep_daily_plans" add constraint "rep_daily_plans_representative_id_lead_id_plan_date_key" UNIQUE (representative_id, lead_id, plan_date);
alter table public."repco_invite_codes" add constraint "repco_invite_codes_code_key" UNIQUE (code);
alter table public."representative_order_installments" add constraint "representative_order_installmen_order_id_installment_number_key" UNIQUE (order_id, installment_number);
alter table public."representative_orders" add constraint "representative_orders_order_number_key" UNIQUE (order_number);
alter table public."roasting_companies" add constraint "roasting_companies_company_code_key" UNIQUE (company_code);
alter table public."shipping_carriers" add constraint "shipping_carriers_code_key" UNIQUE (code);
alter table public."shipping_rates" add constraint "shipping_rates_table_id_zone_code_weight_kg_key" UNIQUE (table_id, zone_code, weight_kg);
alter table public."studio_members" add constraint "studio_members_organization_id_user_id_key" UNIQUE (organization_id, user_id);
alter table public."studio_organizations" add constraint "studio_organizations_slug_key" UNIQUE (slug);
alter table public."studio_reference_assets" add constraint "studio_reference_assets_path_key" UNIQUE (path);
alter table public."studio_social_connections" add constraint "studio_social_connections_company_id_platform_key" UNIQUE (company_id, platform);
alter table public."superfrete_settings" add constraint "superfrete_settings_company_id_key" UNIQUE (company_id);
alter table public."telegram_recipients" add constraint "telegram_recipients_chat_id_key" UNIQUE (chat_id);
alter table public."user_roles" add constraint "user_roles_user_id_role_code_company_id_key" UNIQUE (user_id, role_code, company_id);
alter table public."candidaturas_representante" add constraint "candidaturas_representante_status_check" CHECK ((status = ANY (ARRAY['pendente'::text, 'em_analise'::text, 'aprovado'::text, 'rejeitado'::text])));
alter table public."chat_conversations" add constraint "chat_conversations_type_check" CHECK ((type = ANY (ARRAY['direct'::text, 'group'::text])));
alter table public."chat_participants" add constraint "chat_participants_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text])));
alter table public."coffee_matches" add constraint "coffee_matches_status_check" CHECK ((status = ANY (ARRAY['suggested'::text, 'shortlisted'::text, 'contacted'::text, 'negotiating'::text, 'closed'::text, 'discarded'::text])));
alter table public."coffee_offer_photos" add constraint "coffee_offer_photos_moderation_status_check" CHECK ((moderation_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
alter table public."coffee_offers" add constraint "coffee_offers_origin_uf_check" CHECK (((origin_uf IS NULL) OR (char_length(origin_uf) = 2)));
alter table public."coffee_offers" add constraint "coffee_offers_process_check" CHECK ((process = ANY (ARRAY['natural'::text, 'cd'::text, 'lavado'::text, 'despolpado'::text, 'semi_lavado'::text])));
alter table public."coffee_offers" add constraint "coffee_offers_quantity_bags_check" CHECK ((quantity_bags > (0)::numeric));
alter table public."coffee_offers" add constraint "coffee_offers_species_check" CHECK ((species = ANY (ARRAY['arabica'::text, 'conilon'::text])));
alter table public."coffee_offers" add constraint "coffee_offers_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'approved'::text, 'active'::text, 'paused'::text, 'matched'::text, 'negotiating'::text, 'sold'::text, 'expired'::text, 'rejected'::text])));
alter table public."coffee_pilot_cases" add constraint "coffee_pilot_cases_resultado_check" CHECK (((resultado IS NULL) OR (resultado = ANY (ARRAY['em_andamento'::text, 'fechado'::text, 'perdido'::text, 'desistiu'::text, 'sem_match'::text]))));
alter table public."coffee_purchase_requests" add constraint "coffee_purchase_requests_destination_uf_check" CHECK (((destination_uf IS NULL) OR (char_length(destination_uf) = 2)));
alter table public."coffee_purchase_requests" add constraint "coffee_purchase_requests_freight_terms_check" CHECK ((freight_terms = ANY (ARRAY['cif'::text, 'fob'::text, 'a_combinar'::text])));
alter table public."coffee_purchase_requests" add constraint "coffee_purchase_requests_origin_uf_check" CHECK (((origin_uf IS NULL) OR (char_length(origin_uf) = 2)));
alter table public."coffee_purchase_requests" add constraint "coffee_purchase_requests_quantity_bags_check" CHECK ((quantity_bags > (0)::numeric));
alter table public."coffee_purchase_requests" add constraint "coffee_purchase_requests_species_check" CHECK ((species = ANY (ARRAY['arabica'::text, 'conilon'::text])));
alter table public."coffee_purchase_requests" add constraint "coffee_purchase_requests_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'matched'::text, 'closed'::text, 'expired'::text])));
alter table public."commercial_accounts" add constraint "commercial_accounts_relationship_type_check" CHECK ((relationship_type = ANY (ARRAY['cliente'::text, 'fornecedor'::text, 'prestador'::text, 'transportadora'::text])));
alter table public."commercial_accounts" add constraint "commercial_accounts_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'closed'::text])));
alter table public."companies" add constraint "companies_shipping_discount_unit_check" CHECK ((shipping_discount_unit = ANY (ARRAY['kg'::text, 'pacote'::text])));
alter table public."coupons" add constraint "coupons_kind_check" CHECK ((kind = ANY (ARRAY['percent'::text, 'valor'::text, 'frete_gratis'::text])));
alter table public."lead_rf_candidates" add constraint "lead_rf_candidates_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text])));
alter table public."lot_documents" add constraint "lot_documents_kind_check" CHECK ((kind = ANY (ARRAY['compra_verde'::text, 'pagamento_torra'::text, 'pagamento_embalagem'::text, 'nota_fiscal'::text])));
alter table public."lot_transfers" add constraint "lot_transfers_check" CHECK ((from_lot_id <> to_lot_id));
alter table public."lot_transfers" add constraint "lot_transfers_kg_amount_check" CHECK ((kg_amount > (0)::numeric));
alter table public."lot_transfers" add constraint "lot_transfers_kind_check" CHECK ((kind = ANY (ARRAY['green'::text, 'roasted'::text])));
alter table public."lv_b2b_empresas" add constraint "lv_b2b_empresas_tipo" CHECK ((tipo_negocio = ANY (ARRAY['cafeteria'::text, 'hotel'::text, 'restaurante'::text, 'padaria'::text, 'escritorio'::text, 'cozinha_industrial'::text, 'mercado'::text, 'distribuidor'::text, 'outro'::text])));
alter table public."lv_b2b_solicitacoes" add constraint "lv_b2b_solicitacoes_frequencia" CHECK ((frequencia = ANY (ARRAY['unica'::text, 'semanal'::text, 'quinzenal'::text, 'mensal'::text])));
alter table public."lv_b2b_solicitacoes" add constraint "lv_b2b_solicitacoes_gramatura" CHECK (((gramatura_g IS NULL) OR (gramatura_g > 0)));
alter table public."lv_b2b_solicitacoes" add constraint "lv_b2b_solicitacoes_quantidade" CHECK (((quantidade_kg > 0) AND (quantidade_kg <= 100000)));
alter table public."lv_b2b_solicitacoes" add constraint "lv_b2b_solicitacoes_status" CHECK ((status = ANY (ARRAY['novo'::text, 'em_analise'::text, 'atendido'::text, 'encerrado'::text])));
alter table public."lv_inventory_lots" add constraint "lv_inventory_lots_qtd_valida" CHECK (((qtd_disponivel >= 0) AND (qtd_reservada >= 0)));
alter table public."lv_price_history" add constraint "lv_price_history_origem" CHECK ((origem = ANY (ARRAY['manual'::text, 'copiloto'::text, 'promocao'::text, 'automatico'::text, 'desfazer'::text, 'admin'::text])));
alter table public."lv_price_tiers" add constraint "lv_price_tiers_qty_valida" CHECK ((min_qty >= 2));
alter table public."lv_price_tiers" add constraint "lv_price_tiers_tipo_valido" CHECK ((tipo = ANY (ARRAY['percentual'::text, 'reais'::text])));
alter table public."lv_price_tiers" add constraint "lv_price_tiers_valor_positivo" CHECK ((valor >= 0));
alter table public."lv_product_variants" add constraint "lv_product_variants_ean_valido" CHECK (((ean IS NULL) OR (ean ~ '^([0-9]{8}|[0-9]{12,14})$'::text)));
alter table public."lv_product_variants" add constraint "lv_product_variants_gramatura_valida" CHECK (((gramatura_g IS NULL) OR (gramatura_g > 0)));
alter table public."lv_product_variants" add constraint "lv_product_variants_preco_valido" CHECK (((preco_cents IS NULL) OR (preco_cents >= 0)));
alter table public."lv_products" add constraint "lv_products_preco_positivo" CHECK (((preco_cents IS NULL) OR (preco_cents >= 0)));
alter table public."lv_products" add constraint "lv_products_status_valido" CHECK ((status = ANY (ARRAY['rascunho'::text, 'em_moderacao'::text, 'ativo'::text, 'pausado'::text, 'recusado'::text, 'arquivado'::text])));
alter table public."lv_qr_codes" add constraint "lv_qr_codes_formato" CHECK ((codigo ~ '^[A-HJKMNP-Z2-9]{8}$'::text));
alter table public."lv_seller_applications" add constraint "lv_seller_applications_status_valido" CHECK ((status = ANY (ARRAY['interessado'::text, 'em_analise'::text, 'aprovado'::text, 'recusado'::text])));
alter table public."lv_seller_users" add constraint "lv_seller_users_papel_valido" CHECK ((papel = ANY (ARRAY['seller_owner'::text, 'seller_staff'::text])));
alter table public."lv_sellers" add constraint "lv_sellers_pagamento_status_valido" CHECK ((pagamento_status = ANY (ARRAY['nao_iniciado'::text, 'pendente'::text, 'verificado'::text, 'bloqueado'::text])));
alter table public."lv_sellers" add constraint "lv_sellers_status_valido" CHECK ((status = ANY (ARRAY['rascunho'::text, 'em_analise'::text, 'aprovado'::text, 'suspenso'::text, 'recusado'::text])));
alter table public."lv_tarifas_simulacao" add constraint "lv_tarifas_componente" CHECK ((componente = ANY (ARRAY['comissao'::text, 'tarifa_fixa_pedido'::text, 'tarifa_unidade'::text, 'logistica_pedido'::text, 'armazenagem_unidade'::text, 'pagamento'::text, 'mensalidade'::text, 'frete'::text, 'frete_gratis_limiar'::text])));
alter table public."lv_tarifas_simulacao" add constraint "lv_tarifas_confiabilidade" CHECK ((confiabilidade = ANY (ARRAY['verificado'::text, 'fonte_secundaria'::text, 'calculado'::text, 'premissa'::text, 'conflitante'::text, 'nao_publico'::text, 'em_estudo'::text, 'desatualizado'::text, 'nao_se_aplica'::text])));
alter table public."lv_tarifas_simulacao" add constraint "lv_tarifas_modelo" CHECK ((modelo = ANY (ARRAY['marketplace'::text, 'delivery_conveniencia'::text])));
alter table public."lv_tarifas_simulacao" add constraint "lv_tarifas_natureza" CHECK ((natureza = ANY (ARRAY['benchmark'::text, 'hipotese_livre'::text])));
alter table public."lv_tarifas_simulacao" add constraint "lv_tarifas_peso_sobre" CHECK (((peso_sobre IS NULL) OR (peso_sobre = ANY (ARRAY['envio'::text, 'unidade'::text]))));
alter table public."lv_tarifas_simulacao" add constraint "lv_tarifas_plataforma" CHECK ((plataforma = ANY (ARRAY['coffeelivre'::text, 'mercado_livre'::text, 'shopee'::text, 'amazon'::text, 'magalu'::text, 'ifood'::text])));
alter table public."lv_tarifas_simulacao" add constraint "lv_tarifas_valores_positivos" CHECK (((COALESCE(percentual_bps, 0) >= 0) AND (COALESCE(valor_cents, (0)::bigint) >= 0) AND (COALESCE(valor_micros, (0)::bigint) >= 0) AND (COALESCE(minimo_cents, (0)::bigint) >= 0)));
alter table public."marketing_contacts" add constraint "marketing_contacts_segment_check" CHECK ((segment = ANY (ARRAY['b2c'::text, 'b2b'::text])));
alter table public."network_entities" add constraint "network_entities_document_type_check" CHECK ((document_type = ANY (ARRAY['cpf'::text, 'cnpj'::text])));
alter table public."network_entities" add constraint "network_entities_entity_type_check" CHECK ((entity_type = ANY (ARRAY['person'::text, 'organization'::text])));
alter table public."network_entities" add constraint "network_entities_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'verified'::text, 'suspended'::text, 'rejected'::text])));
alter table public."network_entities" add constraint "network_entities_uf_check" CHECK (((uf IS NULL) OR (char_length(uf) = 2)));
alter table public."network_entity_roles" add constraint "network_entity_roles_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text])));
alter table public."network_properties" add constraint "network_properties_uf_check" CHECK (((uf IS NULL) OR (char_length(uf) = 2)));
alter table public."order_emails" add constraint "order_emails_kind_check" CHECK ((kind = ANY (ARRAY['pedido_confirmado'::text, 'pronto_retirada'::text, 'enviado'::text, 'entregue'::text, 'aviso_admin'::text])));
alter table public."order_emails" add constraint "order_emails_status_check" CHECK ((status = ANY (ARRAY['enviado'::text, 'falhou'::text])));
alter table public."order_items" add constraint "order_items_grind_type_check" CHECK ((grind_type = ANY (ARRAY['beans'::text, 'coado'::text, 'espresso'::text, NULL::text])));
alter table public."order_items" add constraint "order_items_quantity_check" CHECK ((quantity > 0));
alter table public."orders" add constraint "orders_order_type_check" CHECK ((order_type = ANY (ARRAY['single'::text, 'subscription'::text])));
alter table public."orders" add constraint "orders_payment_method_check" CHECK ((payment_method = ANY (ARRAY['credit_card'::text, 'debit_card'::text, 'pix'::text, 'boleto'::text, 'other'::text])));
alter table public."orders" add constraint "orders_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'in_process'::text, 'cancelled'::text, 'refunded'::text])));
alter table public."orders" add constraint "orders_subscription_frequency_check" CHECK ((subscription_frequency = ANY (ARRAY['monthly'::text, 'biweekly'::text, 'weekly'::text, NULL::text])));
alter table public."orders" add constraint "orders_subscription_shipping_date_check" CHECK ((subscription_shipping_date = ANY (ARRAY[1, 15, NULL::integer])));
alter table public."packaging_specs" add constraint "packaging_specs_minimo_correios" CHECK (((ship_w_cm IS NULL) OR (ship_d_cm IS NULL) OR (ship_h_cm IS NULL) OR ((GREATEST(ship_w_cm, ship_d_cm, ship_h_cm) >= (16)::numeric) AND (LEAST(ship_w_cm, ship_d_cm, ship_h_cm) >= (2)::numeric) AND (((ship_w_cm + ship_d_cm) + ship_h_cm) <= (200)::numeric))));
alter table public."payment_refunds" add constraint "payment_refunds_status_check" CHECK ((status = ANY (ARRAY['solicitado'::text, 'concluido'::text, 'falhou'::text])));
alter table public."products" add constraint "products_sales_channels_validos" CHECK ((sales_channels <@ ARRAY['saporino'::text, 'repco'::text, 'cofico'::text, 'marketplaces'::text]));
alter table public."promoter_visit_audits" add constraint "promoter_visit_audits_frentes_antes_check" CHECK ((frentes_antes >= 0));
alter table public."promoter_visit_audits" add constraint "promoter_visit_audits_frentes_depois_check" CHECK ((frentes_depois >= 0));
alter table public."promoter_visit_audits" add constraint "promoter_visit_audits_preco_gondola_check" CHECK ((preco_gondola >= (0)::numeric));
alter table public."promoter_visit_audits" add constraint "promoter_visit_audits_preco_promocional_check" CHECK ((preco_promocional >= (0)::numeric));
alter table public."promoter_visit_audits" add constraint "promoter_visit_audits_qty_abastecida_check" CHECK ((qty_abastecida >= 0));
alter table public."promoter_visit_audits" add constraint "promoter_visit_audits_qty_avariada_check" CHECK ((qty_avariada >= 0));
alter table public."promoter_visit_audits" add constraint "promoter_visit_audits_qty_deposito_check" CHECK ((qty_deposito >= 0));
alter table public."promoter_visit_audits" add constraint "promoter_visit_audits_qty_gondola_antes_check" CHECK ((qty_gondola_antes >= 0));
alter table public."promoter_visit_audits" add constraint "promoter_visit_audits_qty_proxima_vencimento_check" CHECK ((qty_proxima_vencimento >= 0));
alter table public."promoter_visit_audits" add constraint "promoter_visit_audits_qty_retirada_deposito_check" CHECK ((qty_retirada_deposito >= 0));
alter table public."promoter_visit_audits" add constraint "promoter_visit_audits_qty_vencida_check" CHECK ((qty_vencida >= 0));
alter table public."promoter_visit_audits" add constraint "promoter_visit_audits_saldo_deposito_check" CHECK ((saldo_deposito >= 0));
alter table public."prospect_leads" add constraint "prospect_leads_geocode_status_check" CHECK ((geocode_status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'manual'::text])));
alter table public."prospect_leads" add constraint "prospect_leads_rf_match_status_check" CHECK ((rf_match_status = ANY (ARRAY['none'::text, 'confirmed'::text, 'pending'::text])));
alter table public."prospect_leads" add constraint "prospect_leads_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'assigned'::text, 'pending_visit'::text, 'in_progress'::text, 'visited'::text, 'qualified'::text, 'converted'::text, 'rejected'::text, 'duplicate'::text, 'invalid'::text])));
alter table public."prospect_lists" add constraint "prospect_lists_source_type_check" CHECK ((source_type = ANY (ARRAY['csv'::text, 'scraper'::text, 'manual'::text])));
alter table public."prospect_lists" add constraint "prospect_lists_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'imported'::text, 'assigned'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])));
alter table public."prospect_runs" add constraint "prospect_runs_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text, 'no_credit'::text])));
alter table public."prospects_b2b" add constraint "prospects_b2b_geocode_status_check" CHECK ((geocode_status = ANY (ARRAY['pending'::text, 'municipio'::text, 'endereco'::text, 'cep'::text, 'manual'::text, 'failed'::text])));
alter table public."representative_clients" add constraint "representative_clients_default_fiscal_order_type_check" CHECK (((default_fiscal_order_type IS NULL) OR (default_fiscal_order_type = ANY (ARRAY['resale'::text, 'taxpayer_consumer'::text, 'non_taxpayer_consumer'::text]))));
alter table public."representative_clients" add constraint "representative_clients_document_required" CHECK (((NULLIF(btrim(cnpj), ''::text) IS NOT NULL) OR (NULLIF(btrim(cpf), ''::text) IS NOT NULL))) NOT VALID;
alter table public."representative_clients" add constraint "representative_clients_forma_pagamento_check" CHECK ((forma_pagamento = ANY (ARRAY['boleto'::text, 'pix'::text, 'a_vista'::text])));
alter table public."representative_clients" add constraint "representative_clients_geocode_status_check" CHECK ((geocode_status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'manual'::text])));
alter table public."representative_clients" add constraint "representative_clients_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));
alter table public."representative_commissions" add constraint "representative_commissions_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text])));
alter table public."representative_documents" add constraint "representative_documents_doc_type_check" CHECK ((doc_type = ANY (ARRAY['cnh'::text, 'cpf_doc'::text, 'cnpj_doc'::text, 'core'::text, 'contrato'::text, 'curriculo'::text])));
alter table public."representative_order_installments" add constraint "representative_order_installments_installment_number_check" CHECK (((installment_number >= 1) AND (installment_number <= 5)));
alter table public."representative_order_installments" add constraint "representative_order_installments_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text])));
alter table public."representative_orders" add constraint "representative_orders_delivery_mode_check" CHECK ((delivery_mode = ANY (ARRAY['propria'::text, 'retirada'::text, 'cofico'::text, 'transportadora'::text])));
alter table public."representative_orders" add constraint "representative_orders_fiscal_order_type_check" CHECK (((fiscal_order_type IS NULL) OR (fiscal_order_type = ANY (ARRAY['resale'::text, 'taxpayer_consumer'::text, 'non_taxpayer_consumer'::text]))));
alter table public."representative_orders" add constraint "representative_orders_payment_method_check" CHECK ((payment_method = ANY (ARRAY['boleto'::text, 'pix'::text, 'a_vista'::text])));
alter table public."representative_orders" add constraint "representative_orders_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'pending'::text, 'completed'::text, 'cancelled'::text])));
alter table public."representatives" add constraint "representatives_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'blocked'::text])));
alter table public."route_stops" add constraint "route_stops_visit_status_check" CHECK ((visit_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'not_attended'::text])));
alter table public."stock_movements" add constraint "stock_movements_channel_check" CHECK ((channel = ANY (ARRAY['saporino'::text, 'repco'::text, 'cofico'::text, 'marketplaces'::text, 'ajuste'::text])));
alter table public."stock_movements" add constraint "stock_movements_movement_type_check" CHECK ((movement_type = ANY (ARRAY['venda'::text, 'devolucao'::text, 'ajuste'::text, 'producao'::text, 'perda'::text])));
alter table public."ai_usage_events" add constraint "ai_usage_events_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
alter table public."ai_usage_events" add constraint "ai_usage_events_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES studio_organizations(id) ON DELETE SET NULL;
alter table public."ai_usage_events" add constraint "ai_usage_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."batch_photos" add constraint "batch_photos_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES green_coffee_lots(id) ON DELETE CASCADE;
alter table public."batch_photos" add constraint "batch_photos_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."batch_photos" add constraint "batch_photos_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);
alter table public."chat_conversations" add constraint "chat_conversations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."chat_conversations" add constraint "chat_conversations_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id);
alter table public."chat_messages" add constraint "chat_messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE;
alter table public."chat_participants" add constraint "chat_participants_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE;
alter table public."coffee_matches" add constraint "coffee_matches_offer_id_fkey" FOREIGN KEY (offer_id) REFERENCES coffee_offers(id) ON DELETE CASCADE;
alter table public."coffee_matches" add constraint "coffee_matches_request_id_fkey" FOREIGN KEY (request_id) REFERENCES coffee_purchase_requests(id) ON DELETE CASCADE;
alter table public."coffee_offer_photos" add constraint "coffee_offer_photos_offer_id_fkey" FOREIGN KEY (offer_id) REFERENCES coffee_offers(id) ON DELETE CASCADE;
alter table public."coffee_offer_photos" add constraint "coffee_offer_photos_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);
alter table public."coffee_offer_photos" add constraint "coffee_offer_photos_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);
alter table public."coffee_offers" add constraint "coffee_offers_bebida_fkey" FOREIGN KEY (bebida) REFERENCES coffee_bebida_scale(code);
alter table public."coffee_offers" add constraint "coffee_offers_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."coffee_offers" add constraint "coffee_offers_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES network_entities(id) ON DELETE RESTRICT;
alter table public."coffee_offers" add constraint "coffee_offers_property_id_fkey" FOREIGN KEY (property_id) REFERENCES network_properties(id) ON DELETE SET NULL;
alter table public."coffee_offers" add constraint "coffee_offers_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);
alter table public."coffee_pilot_cases" add constraint "coffee_pilot_cases_comprador_entity_id_fkey" FOREIGN KEY (comprador_entity_id) REFERENCES network_entities(id) ON DELETE SET NULL;
alter table public."coffee_pilot_cases" add constraint "coffee_pilot_cases_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."coffee_pilot_cases" add constraint "coffee_pilot_cases_match_id_fkey" FOREIGN KEY (match_id) REFERENCES coffee_matches(id) ON DELETE SET NULL;
alter table public."coffee_pilot_cases" add constraint "coffee_pilot_cases_offer_id_fkey" FOREIGN KEY (offer_id) REFERENCES coffee_offers(id) ON DELETE SET NULL;
alter table public."coffee_pilot_cases" add constraint "coffee_pilot_cases_produtor_entity_id_fkey" FOREIGN KEY (produtor_entity_id) REFERENCES network_entities(id) ON DELETE SET NULL;
alter table public."coffee_pilot_cases" add constraint "coffee_pilot_cases_request_id_fkey" FOREIGN KEY (request_id) REFERENCES coffee_purchase_requests(id) ON DELETE SET NULL;
alter table public."coffee_purchase_requests" add constraint "coffee_purchase_requests_bebida_min_fkey" FOREIGN KEY (bebida_min) REFERENCES coffee_bebida_scale(code);
alter table public."coffee_purchase_requests" add constraint "coffee_purchase_requests_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."coffee_purchase_requests" add constraint "coffee_purchase_requests_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES network_entities(id) ON DELETE RESTRICT;
alter table public."commercial_accounts" add constraint "commercial_accounts_assigned_representative_id_fkey" FOREIGN KEY (assigned_representative_id) REFERENCES representatives(id);
alter table public."commercial_accounts" add constraint "commercial_accounts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;
alter table public."commercial_accounts" add constraint "commercial_accounts_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES network_entities(id) ON DELETE RESTRICT;
alter table public."commercial_accounts" add constraint "commercial_accounts_opened_by_fkey" FOREIGN KEY (opened_by) REFERENCES auth.users(id);
alter table public."commercial_accounts" add constraint "commercial_accounts_representative_client_id_fkey" FOREIGN KEY (representative_client_id) REFERENCES representative_clients(id);
alter table public."company_order_counters" add constraint "company_order_counters_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."coupon_redemptions" add constraint "coupon_redemptions_coupon_id_fkey" FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE;
alter table public."coupon_redemptions" add constraint "coupon_redemptions_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public."coupons" add constraint "coupons_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."delivery_dispatch_audit" add constraint "delivery_dispatch_audit_order_id_fkey" FOREIGN KEY (order_id) REFERENCES representative_orders(id) ON DELETE CASCADE;
alter table public."delivery_routes" add constraint "delivery_routes_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES drivers(id);
alter table public."delivery_stops" add constraint "delivery_stops_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."delivery_stops" add constraint "delivery_stops_order_id_fkey" FOREIGN KEY (order_id) REFERENCES representative_orders(id);
alter table public."delivery_stops" add constraint "delivery_stops_route_id_fkey" FOREIGN KEY (route_id) REFERENCES delivery_routes(id) ON DELETE CASCADE;
alter table public."discovery_campaigns" add constraint "discovery_campaigns_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."discovery_keywords" add constraint "discovery_keywords_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."discovery_results" add constraint "discovery_results_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES discovery_campaigns(id) ON DELETE SET NULL;
alter table public."discovery_results" add constraint "discovery_results_converted_prospect_lead_id_fkey" FOREIGN KEY (converted_prospect_lead_id) REFERENCES prospect_leads(id) ON DELETE SET NULL;
alter table public."discovery_results" add constraint "discovery_results_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."discovery_results" add constraint "discovery_results_run_id_fkey" FOREIGN KEY (run_id) REFERENCES prospect_runs(id) ON DELETE SET NULL;
alter table public."driver_documents" add constraint "driver_documents_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE;
alter table public."drivers" add constraint "drivers_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."fleet_documents" add constraint "fleet_documents_vehicle_id_fkey" FOREIGN KEY (vehicle_id) REFERENCES fleet_vehicles(id) ON DELETE CASCADE;
alter table public."fleet_maintenance" add constraint "fleet_maintenance_vehicle_id_fkey" FOREIGN KEY (vehicle_id) REFERENCES fleet_vehicles(id) ON DELETE CASCADE;
alter table public."fleet_vehicles" add constraint "fleet_vehicles_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."fleet_vehicles" add constraint "fleet_vehicles_owner_driver_id_fkey" FOREIGN KEY (owner_driver_id) REFERENCES drivers(id) ON DELETE CASCADE;
alter table public."green_coffee_lots" add constraint "green_coffee_lots_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."green_coffee_lots" add constraint "green_coffee_lots_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id);
alter table public."green_coffee_lots" add constraint "product_batches_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."green_coffee_lots" add constraint "product_batches_roasting_company_id_fkey" FOREIGN KEY (roasting_company_id) REFERENCES roasting_companies(id);
alter table public."invoices" add constraint "invoices_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public."lead_rf_candidates" add constraint "lead_rf_candidates_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES prospect_leads(id) ON DELETE CASCADE;
alter table public."lot_documents" add constraint "lot_documents_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."lot_documents" add constraint "lot_documents_lot_id_fkey" FOREIGN KEY (lot_id) REFERENCES green_coffee_lots(id) ON DELETE CASCADE;
alter table public."lot_transfers" add constraint "lot_transfers_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."lot_transfers" add constraint "lot_transfers_from_lot_id_fkey" FOREIGN KEY (from_lot_id) REFERENCES green_coffee_lots(id) ON DELETE CASCADE;
alter table public."lot_transfers" add constraint "lot_transfers_to_lot_id_fkey" FOREIGN KEY (to_lot_id) REFERENCES green_coffee_lots(id) ON DELETE CASCADE;
alter table public."lv_b2b_solicitacoes" add constraint "lv_b2b_solicitacoes_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES lv_b2b_empresas(id) ON DELETE CASCADE;
alter table public."lv_categories" add constraint "lv_categories_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES lv_categories(id) ON DELETE SET NULL;
alter table public."lv_category_attributes" add constraint "lv_category_attributes_attribute_id_fkey" FOREIGN KEY (attribute_id) REFERENCES lv_attributes(id) ON DELETE CASCADE;
alter table public."lv_category_attributes" add constraint "lv_category_attributes_category_id_fkey" FOREIGN KEY (category_id) REFERENCES lv_categories(id) ON DELETE CASCADE;
alter table public."lv_demo_access" add constraint "lv_demo_access_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."lv_inventory_lots" add constraint "lv_inventory_lots_product_id_fkey" FOREIGN KEY (product_id) REFERENCES lv_products(id) ON DELETE CASCADE;
alter table public."lv_inventory_lots" add constraint "lv_inventory_lots_seller_id_fkey" FOREIGN KEY (seller_id) REFERENCES lv_sellers(id) ON DELETE CASCADE;
alter table public."lv_inventory_lots" add constraint "lv_inventory_lots_variant_id_fkey" FOREIGN KEY (variant_id) REFERENCES lv_product_variants(id) ON DELETE CASCADE;
alter table public."lv_price_history" add constraint "lv_price_history_desfaz_id_fkey" FOREIGN KEY (desfaz_id) REFERENCES lv_price_history(id) ON DELETE SET NULL;
alter table public."lv_price_history" add constraint "lv_price_history_product_id_fkey" FOREIGN KEY (product_id) REFERENCES lv_products(id) ON DELETE CASCADE;
alter table public."lv_price_history" add constraint "lv_price_history_seller_id_fkey" FOREIGN KEY (seller_id) REFERENCES lv_sellers(id) ON DELETE CASCADE;
alter table public."lv_price_history" add constraint "lv_price_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."lv_price_tiers" add constraint "lv_price_tiers_product_id_fkey" FOREIGN KEY (product_id) REFERENCES lv_products(id) ON DELETE CASCADE;
alter table public."lv_product_attributes" add constraint "lv_product_attributes_attribute_id_fkey" FOREIGN KEY (attribute_id) REFERENCES lv_attributes(id) ON DELETE CASCADE;
alter table public."lv_product_attributes" add constraint "lv_product_attributes_product_id_fkey" FOREIGN KEY (product_id) REFERENCES lv_products(id) ON DELETE CASCADE;
alter table public."lv_product_images" add constraint "lv_product_images_product_id_fkey" FOREIGN KEY (product_id) REFERENCES lv_products(id) ON DELETE CASCADE;
alter table public."lv_product_variants" add constraint "lv_product_variants_product_id_fkey" FOREIGN KEY (product_id) REFERENCES lv_products(id) ON DELETE CASCADE;
alter table public."lv_products" add constraint "lv_products_category_id_fkey" FOREIGN KEY (category_id) REFERENCES lv_categories(id) ON DELETE SET NULL;
alter table public."lv_products" add constraint "lv_products_seller_id_fkey" FOREIGN KEY (seller_id) REFERENCES lv_sellers(id) ON DELETE CASCADE;
alter table public."lv_products" add constraint "lv_products_store_id_fkey" FOREIGN KEY (store_id) REFERENCES lv_stores(id) ON DELETE CASCADE;
alter table public."lv_qr_codes" add constraint "lv_qr_codes_product_id_fkey" FOREIGN KEY (product_id) REFERENCES lv_products(id) ON DELETE CASCADE;
alter table public."lv_qr_codes" add constraint "lv_qr_codes_variant_id_fkey" FOREIGN KEY (variant_id) REFERENCES lv_product_variants(id) ON DELETE CASCADE;
alter table public."lv_seller_applications" add constraint "lv_seller_applications_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES lv_plans(id) ON DELETE SET NULL;
alter table public."lv_seller_applications" add constraint "lv_seller_applications_seller_id_fkey" FOREIGN KEY (seller_id) REFERENCES lv_sellers(id) ON DELETE SET NULL;
alter table public."lv_seller_users" add constraint "lv_seller_users_seller_id_fkey" FOREIGN KEY (seller_id) REFERENCES lv_sellers(id) ON DELETE CASCADE;
alter table public."lv_seller_users" add constraint "lv_seller_users_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."lv_settings" add constraint "lv_settings_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."lv_stores" add constraint "lv_stores_seller_id_fkey" FOREIGN KEY (seller_id) REFERENCES lv_sellers(id) ON DELETE CASCADE;
alter table public."lv_tarifas_simulacao" add constraint "lv_tarifas_simulacao_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."marketing_contacts" add constraint "marketing_contacts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."marketplace_stores" add constraint "marketplace_stores_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."network_audit_log" add constraint "network_audit_log_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id);
alter table public."network_entities" add constraint "network_entities_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."network_entities" add constraint "network_entities_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public."network_entities" add constraint "network_entities_verified_by_fkey" FOREIGN KEY (verified_by) REFERENCES auth.users(id);
alter table public."network_entity_roles" add constraint "network_entity_roles_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES network_entities(id) ON DELETE CASCADE;
alter table public."network_entity_roles" add constraint "network_entity_roles_granted_by_fkey" FOREIGN KEY (granted_by) REFERENCES auth.users(id);
alter table public."network_entity_roles" add constraint "network_entity_roles_role_code_fkey" FOREIGN KEY (role_code) REFERENCES network_roles(code);
alter table public."network_properties" add constraint "network_properties_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."network_properties" add constraint "network_properties_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES network_entities(id) ON DELETE CASCADE;
alter table public."order_emails" add constraint "order_emails_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public."order_items" add constraint "order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public."order_items" add constraint "order_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
alter table public."orders" add constraint "orders_seller_company_id_fkey" FOREIGN KEY (seller_company_id) REFERENCES companies(id);
alter table public."orders" add constraint "orders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."payment_refunds" add constraint "payment_refunds_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public."payment_refunds" add constraint "payment_refunds_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES auth.users(id);
alter table public."price_lists" add constraint "price_lists_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."price_lists" add constraint "price_lists_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public."products" add constraint "products_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."products" add constraint "products_kit_of_product_id_fkey" FOREIGN KEY (kit_of_product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public."promoter_client_mix" add constraint "promoter_client_mix_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id);
alter table public."promoter_client_mix" add constraint "promoter_client_mix_representative_client_id_fkey" FOREIGN KEY (representative_client_id) REFERENCES representative_clients(id) ON DELETE CASCADE;
alter table public."promoter_clients" add constraint "promoter_clients_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."promoter_clients" add constraint "promoter_clients_promoter_id_fkey" FOREIGN KEY (promoter_id) REFERENCES promoters(id) ON DELETE CASCADE;
alter table public."promoter_clients" add constraint "promoter_clients_representative_client_id_fkey" FOREIGN KEY (representative_client_id) REFERENCES representative_clients(id) ON DELETE CASCADE;
alter table public."promoter_incidents" add constraint "promoter_incidents_assigned_representative_id_fkey" FOREIGN KEY (assigned_representative_id) REFERENCES representatives(id);
alter table public."promoter_incidents" add constraint "promoter_incidents_converted_to_order_id_fkey" FOREIGN KEY (converted_to_order_id) REFERENCES representative_orders(id);
alter table public."promoter_incidents" add constraint "promoter_incidents_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id);
alter table public."promoter_incidents" add constraint "promoter_incidents_promoter_id_fkey" FOREIGN KEY (promoter_id) REFERENCES promoters(id);
alter table public."promoter_incidents" add constraint "promoter_incidents_visit_id_fkey" FOREIGN KEY (visit_id) REFERENCES promoter_visits(id);
alter table public."promoter_routes" add constraint "promoter_routes_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."promoter_routes" add constraint "promoter_routes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."promoter_routes" add constraint "promoter_routes_promoter_id_fkey" FOREIGN KEY (promoter_id) REFERENCES promoters(id) ON DELETE CASCADE;
alter table public."promoter_visit_audits" add constraint "promoter_visit_audits_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id);
alter table public."promoter_visit_audits" add constraint "promoter_visit_audits_visit_id_fkey" FOREIGN KEY (visit_id) REFERENCES promoter_visits(id) ON DELETE CASCADE;
alter table public."promoter_visit_locations" add constraint "promoter_visit_locations_visit_id_fkey" FOREIGN KEY (visit_id) REFERENCES promoter_visits(id) ON DELETE CASCADE;
alter table public."promoter_visit_photos" add constraint "promoter_visit_photos_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id);
alter table public."promoter_visit_photos" add constraint "promoter_visit_photos_visit_id_fkey" FOREIGN KEY (visit_id) REFERENCES promoter_visits(id) ON DELETE CASCADE;
alter table public."promoter_visits" add constraint "promoter_visits_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."promoter_visits" add constraint "promoter_visits_promoter_id_fkey" FOREIGN KEY (promoter_id) REFERENCES promoters(id);
alter table public."promoter_visits" add constraint "promoter_visits_representative_client_id_fkey" FOREIGN KEY (representative_client_id) REFERENCES representative_clients(id);
alter table public."promoter_visits" add constraint "promoter_visits_route_id_fkey" FOREIGN KEY (route_id) REFERENCES promoter_routes(id) ON DELETE CASCADE;
alter table public."promoters" add constraint "promoters_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."promoters" add constraint "promoters_supervisor_user_id_fkey" FOREIGN KEY (supervisor_user_id) REFERENCES auth.users(id);
alter table public."promoters" add constraint "promoters_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."prospect_leads" add constraint "prospect_leads_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."prospect_leads" add constraint "prospect_leads_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."prospect_leads" add constraint "prospect_leads_duplicate_of_client_id_fkey" FOREIGN KEY (duplicate_of_client_id) REFERENCES representative_clients(id) ON DELETE SET NULL;
alter table public."prospect_leads" add constraint "prospect_leads_duplicate_of_lead_id_fkey" FOREIGN KEY (duplicate_of_lead_id) REFERENCES prospect_leads(id) ON DELETE SET NULL;
alter table public."prospect_leads" add constraint "prospect_leads_prospect_list_id_fkey" FOREIGN KEY (prospect_list_id) REFERENCES prospect_lists(id) ON DELETE CASCADE;
alter table public."prospect_leads" add constraint "prospect_leads_representative_client_id_fkey" FOREIGN KEY (representative_client_id) REFERENCES representative_clients(id) ON DELETE SET NULL;
alter table public."prospect_leads" add constraint "prospect_leads_representative_id_fkey" FOREIGN KEY (representative_id) REFERENCES representatives(id) ON DELETE SET NULL;
alter table public."prospect_lists" add constraint "prospect_lists_assigned_representative_id_fkey" FOREIGN KEY (assigned_representative_id) REFERENCES representatives(id) ON DELETE SET NULL;
alter table public."prospect_lists" add constraint "prospect_lists_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."prospect_lists" add constraint "prospect_lists_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."prospect_runs" add constraint "prospect_runs_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES discovery_campaigns(id) ON DELETE SET NULL;
alter table public."prospect_runs" add constraint "prospect_runs_prospect_list_id_fkey" FOREIGN KEY (prospect_list_id) REFERENCES prospect_lists(id) ON DELETE SET NULL;
alter table public."prospect_runs" add constraint "prospect_runs_representative_id_fkey" FOREIGN KEY (representative_id) REFERENCES representatives(id) ON DELETE SET NULL;
alter table public."prospect_runs" add constraint "prospect_runs_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES auth.users(id);
alter table public."rep_daily_plans" add constraint "rep_daily_plans_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES prospect_leads(id) ON DELETE CASCADE;
alter table public."rep_daily_plans" add constraint "rep_daily_plans_representative_id_fkey" FOREIGN KEY (representative_id) REFERENCES representatives(id) ON DELETE CASCADE;
alter table public."repco_invite_codes" add constraint "repco_invite_codes_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."representative_clients" add constraint "representative_clients_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."representative_clients" add constraint "representative_clients_deactivated_by_fkey" FOREIGN KEY (deactivated_by) REFERENCES auth.users(id);
alter table public."representative_clients" add constraint "representative_clients_representative_id_fkey" FOREIGN KEY (representative_id) REFERENCES representatives(id) ON DELETE CASCADE;
alter table public."representative_commission_payouts" add constraint "representative_commission_payouts_commission_id_fkey" FOREIGN KEY (commission_id) REFERENCES representative_commissions(id) ON DELETE CASCADE;
alter table public."representative_commission_payouts" add constraint "representative_commission_payouts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."representative_commission_payouts" add constraint "representative_commission_payouts_installment_id_fkey" FOREIGN KEY (installment_id) REFERENCES representative_order_installments(id) ON DELETE CASCADE;
alter table public."representative_commission_payouts" add constraint "representative_commission_payouts_representative_id_fkey" FOREIGN KEY (representative_id) REFERENCES representatives(id) ON DELETE CASCADE;
alter table public."representative_commissions" add constraint "representative_commissions_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."representative_commissions" add constraint "representative_commissions_order_id_fkey" FOREIGN KEY (order_id) REFERENCES representative_orders(id);
alter table public."representative_commissions" add constraint "representative_commissions_paid_by_fkey" FOREIGN KEY (paid_by) REFERENCES auth.users(id);
alter table public."representative_commissions" add constraint "representative_commissions_representative_id_fkey" FOREIGN KEY (representative_id) REFERENCES representatives(id);
alter table public."representative_company_settings" add constraint "representative_company_settings_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."representative_company_settings" add constraint "representative_company_settings_representative_id_fkey" FOREIGN KEY (representative_id) REFERENCES representatives(id) ON DELETE CASCADE;
alter table public."representative_documents" add constraint "representative_documents_representative_id_fkey" FOREIGN KEY (representative_id) REFERENCES representatives(id) ON DELETE CASCADE;
alter table public."representative_order_installments" add constraint "representative_order_installments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."representative_order_installments" add constraint "representative_order_installments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES representative_orders(id) ON DELETE CASCADE;
alter table public."representative_order_items" add constraint "representative_order_items_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."representative_order_items" add constraint "representative_order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES representative_orders(id) ON DELETE CASCADE;
alter table public."representative_order_items" add constraint "representative_order_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id);
alter table public."representative_order_items" add constraint "representative_order_items_representative_id_fkey" FOREIGN KEY (representative_id) REFERENCES representatives(id) ON DELETE SET NULL;
alter table public."representative_order_notes" add constraint "representative_order_notes_order_id_fkey" FOREIGN KEY (order_id) REFERENCES representative_orders(id) ON DELETE CASCADE;
alter table public."representative_orders" add constraint "representative_orders_carrier_id_fkey" FOREIGN KEY (carrier_id) REFERENCES shipping_carriers(id);
alter table public."representative_orders" add constraint "representative_orders_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."representative_orders" add constraint "representative_orders_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."representative_orders" add constraint "representative_orders_representative_client_id_fkey" FOREIGN KEY (representative_client_id) REFERENCES representative_clients(id);
alter table public."representative_orders" add constraint "representative_orders_representative_id_fkey" FOREIGN KEY (representative_id) REFERENCES representatives(id);
alter table public."representative_routes" add constraint "representative_routes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."representative_routes" add constraint "representative_routes_finalized_by_fkey" FOREIGN KEY (finalized_by) REFERENCES auth.users(id);
alter table public."representative_routes" add constraint "representative_routes_representative_id_fkey" FOREIGN KEY (representative_id) REFERENCES representatives(id) ON DELETE CASCADE;
alter table public."representatives" add constraint "representatives_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."representatives" add constraint "representatives_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."roasting_companies" add constraint "roasting_companies_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."roasting_company_contacts" add constraint "roasting_company_contacts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES roasting_companies(id) ON DELETE CASCADE;
alter table public."route_stops" add constraint "route_stops_prospect_lead_id_fkey" FOREIGN KEY (prospect_lead_id) REFERENCES prospect_leads(id) ON DELETE SET NULL;
alter table public."route_stops" add constraint "route_stops_representative_client_id_fkey" FOREIGN KEY (representative_client_id) REFERENCES representative_clients(id) ON DELETE SET NULL;
alter table public."route_stops" add constraint "route_stops_route_id_fkey" FOREIGN KEY (route_id) REFERENCES representative_routes(id) ON DELETE CASCADE;
alter table public."shipments" add constraint "shipments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public."shipping_coverage" add constraint "shipping_coverage_table_id_fkey" FOREIGN KEY (table_id) REFERENCES shipping_rate_tables(id) ON DELETE CASCADE;
alter table public."shipping_quotes" add constraint "shipping_quotes_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."shipping_rate_tables" add constraint "shipping_rate_tables_carrier_id_fkey" FOREIGN KEY (carrier_id) REFERENCES shipping_carriers(id) ON DELETE CASCADE;
alter table public."shipping_rates" add constraint "shipping_rates_table_id_fkey" FOREIGN KEY (table_id) REFERENCES shipping_rate_tables(id) ON DELETE CASCADE;
alter table public."stock_movements" add constraint "stock_movements_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."stock_movements" add constraint "stock_movements_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."stock_movements" add constraint "stock_movements_lot_id_fkey" FOREIGN KEY (lot_id) REFERENCES green_coffee_lots(id) ON DELETE SET NULL;
alter table public."stock_movements" add constraint "stock_movements_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public."storage_cleanup_log" add constraint "storage_cleanup_log_executed_by_fkey" FOREIGN KEY (executed_by) REFERENCES auth.users(id);
alter table public."studio_analyses" add constraint "studio_analyses_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES studio_organizations(id) ON DELETE CASCADE;
alter table public."studio_analyses" add constraint "studio_analyses_video_id_fkey" FOREIGN KEY (video_id) REFERENCES studio_videos(id) ON DELETE CASCADE;
alter table public."studio_brand_profiles" add constraint "studio_brand_profiles_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."studio_brand_profiles" add constraint "studio_brand_profiles_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES studio_organizations(id) ON DELETE CASCADE;
alter table public."studio_campaigns" add constraint "studio_campaigns_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."studio_campaigns" add constraint "studio_campaigns_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES studio_organizations(id) ON DELETE CASCADE;
alter table public."studio_campaigns" add constraint "studio_campaigns_video_id_fkey" FOREIGN KEY (video_id) REFERENCES studio_videos(id) ON DELETE CASCADE;
alter table public."studio_content_fingerprints" add constraint "studio_content_fingerprints_generation_id_fkey" FOREIGN KEY (generation_id) REFERENCES studio_generations(id) ON DELETE SET NULL;
alter table public."studio_content_fingerprints" add constraint "studio_content_fingerprints_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES studio_organizations(id) ON DELETE CASCADE;
alter table public."studio_generations" add constraint "studio_generations_brand_id_fkey" FOREIGN KEY (brand_id) REFERENCES studio_brand_profiles(id) ON DELETE SET NULL;
alter table public."studio_generations" add constraint "studio_generations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."studio_generations" add constraint "studio_generations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."studio_generations" add constraint "studio_generations_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES studio_organizations(id) ON DELETE CASCADE;
alter table public."studio_generations" add constraint "studio_generations_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES studio_generations(id) ON DELETE SET NULL;
alter table public."studio_members" add constraint "studio_members_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES studio_organizations(id) ON DELETE CASCADE;
alter table public."studio_members" add constraint "studio_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."studio_organizations" add constraint "studio_organizations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
alter table public."studio_reference_assets" add constraint "studio_reference_assets_brand_id_fkey" FOREIGN KEY (brand_id) REFERENCES studio_brand_profiles(id) ON DELETE SET NULL;
alter table public."studio_reference_assets" add constraint "studio_reference_assets_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."studio_reference_assets" add constraint "studio_reference_assets_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."studio_reference_assets" add constraint "studio_reference_assets_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES studio_organizations(id) ON DELETE CASCADE;
alter table public."studio_social_connections" add constraint "studio_social_connections_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."studio_social_connections" add constraint "studio_social_connections_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES studio_organizations(id) ON DELETE CASCADE;
alter table public."studio_transcriptions" add constraint "studio_transcriptions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES studio_organizations(id) ON DELETE CASCADE;
alter table public."studio_transcriptions" add constraint "studio_transcriptions_video_id_fkey" FOREIGN KEY (video_id) REFERENCES studio_videos(id) ON DELETE CASCADE;
alter table public."studio_videos" add constraint "studio_videos_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."studio_videos" add constraint "studio_videos_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."studio_videos" add constraint "studio_videos_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES studio_organizations(id) ON DELETE CASCADE;
alter table public."superfrete_settings" add constraint "superfrete_settings_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."telegram_recipients" add constraint "telegram_recipients_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."user_addresses" add constraint "user_addresses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
alter table public."user_profiles" add constraint "user_profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."user_roles" add constraint "user_roles_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."user_roles" add constraint "user_roles_granted_by_fkey" FOREIGN KEY (granted_by) REFERENCES auth.users(id);
alter table public."user_roles" add constraint "user_roles_role_code_fkey" FOREIGN KEY (role_code) REFERENCES roles(code);
alter table public."user_roles" add constraint "user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Índices
CREATE INDEX IF NOT EXISTS ai_usage_assunto ON public.ai_usage_events USING btree (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS ai_usage_empresa_data ON public.ai_usage_events USING btree (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_por_org ON public.ai_usage_events USING btree (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS coffee_matches_offer_idx ON public.coffee_matches USING btree (offer_id, score DESC);
CREATE INDEX IF NOT EXISTS coffee_matches_request_idx ON public.coffee_matches USING btree (request_id, score DESC);
CREATE INDEX IF NOT EXISTS coffee_offer_photos_offer_idx ON public.coffee_offer_photos USING btree (offer_id);
CREATE INDEX IF NOT EXISTS coffee_offers_entity_idx ON public.coffee_offers USING btree (entity_id);
CREATE INDEX IF NOT EXISTS coffee_offers_species_idx ON public.coffee_offers USING btree (species, status);
CREATE INDEX IF NOT EXISTS coffee_offers_status_idx ON public.coffee_offers USING btree (status);
CREATE INDEX IF NOT EXISTS coffee_pilot_cases_resultado_idx ON public.coffee_pilot_cases USING btree (resultado);
CREATE INDEX IF NOT EXISTS coffee_requests_entity_idx ON public.coffee_purchase_requests USING btree (entity_id);
CREATE INDEX IF NOT EXISTS coffee_requests_status_idx ON public.coffee_purchase_requests USING btree (status);
CREATE INDEX IF NOT EXISTS commercial_accounts_company_idx ON public.commercial_accounts USING btree (company_id);
CREATE INDEX IF NOT EXISTS commercial_accounts_entity_idx ON public.commercial_accounts USING btree (entity_id);
CREATE INDEX IF NOT EXISTS coupon_redemptions_cpf_idx ON public.coupon_redemptions USING btree (cpf);
CREATE INDEX IF NOT EXISTS edge_logs_fn_idx ON public.edge_logs USING btree (function_name, ts DESC);
CREATE INDEX IF NOT EXISTS edge_logs_ts_idx ON public.edge_logs USING btree (ts DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_leads_status ON public.b2b_leads USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_photos_batch ON public.batch_photos USING btree (batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON public.green_coffee_lots USING btree (expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_product ON public.green_coffee_lots USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON public.green_coffee_lots USING btree (status);
CREATE INDEX IF NOT EXISTS idx_cand_rep_status ON public.candidaturas_representante USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_context ON public.chat_conversations USING btree (context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON public.chat_messages USING btree (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_part_user ON public.chat_participants USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON public.representative_clients USING btree (is_active_client);
CREATE INDEX IF NOT EXISTS idx_clients_last_order_at ON public.representative_clients USING btree (last_order_at);
CREATE INDEX IF NOT EXISTS idx_clients_snooze_alert ON public.representative_clients USING btree (snooze_admin_alert) WHERE (snooze_admin_alert = true);
CREATE INDEX IF NOT EXISTS idx_dda_order ON public.delivery_dispatch_audit USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_discovery_campaign ON public.discovery_results USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_discovery_run ON public.discovery_results USING btree (run_id);
CREATE INDEX IF NOT EXISTS idx_discovery_status ON public.discovery_results USING btree (status);
CREATE INDEX IF NOT EXISTS idx_driver_docs_driver ON public.driver_documents USING btree (driver_id);
CREATE INDEX IF NOT EXISTS idx_drivers_company ON public.drivers USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_drivers_user ON public.drivers USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_droutes_driver_date ON public.delivery_routes USING btree (driver_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_dstops_company ON public.delivery_stops USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_dstops_order ON public.delivery_stops USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_dstops_route ON public.delivery_stops USING btree (route_id);
CREATE INDEX IF NOT EXISTS idx_eps_batch ON public.ecommerce_price_snapshots USING btree (company_id, marketplace, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_eps_lookup ON public.ecommerce_price_snapshots USING btree (company_id, marketplace, listing_sku, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_company ON public.fleet_vehicles USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_fleet_docs_vehicle ON public.fleet_documents USING btree (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fleet_maint_vehicle ON public.fleet_maintenance USING btree (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fleet_owner_driver ON public.fleet_vehicles USING btree (owner_driver_id);
CREATE INDEX IF NOT EXISTS idx_ibge_municipios_uf_nome ON public.ibge_municipios USING btree (uf, nome_norm);
CREATE INDEX IF NOT EXISTS idx_lead_rf_candidates_lead ON public.lead_rf_candidates USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_rf_candidates_status ON public.lead_rf_candidates USING btree (status);
CREATE INDEX IF NOT EXISTS idx_lot_transfers_from ON public.lot_transfers USING btree (from_lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_transfers_to ON public.lot_transfers USING btree (to_lot_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_orders_carrier ON public.representative_orders USING btree (carrier_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_mercadopago_payment_id ON public.orders USING btree (mercadopago_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_mercadopago_preference_id ON public.orders USING btree (mercadopago_preference_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders USING btree (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders USING btree (status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_paudits_visit ON public.promoter_visit_audits USING btree (visit_id);
CREATE INDEX IF NOT EXISTS idx_pinc_client ON public.promoter_incidents USING btree (representative_client_id);
CREATE INDEX IF NOT EXISTS idx_pinc_rep_status ON public.promoter_incidents USING btree (assigned_representative_id, status);
CREATE INDEX IF NOT EXISTS idx_plocs_visit ON public.promoter_visit_locations USING btree (visit_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_pphotos_visit ON public.promoter_visit_photos USING btree (visit_id);
CREATE INDEX IF NOT EXISTS idx_promoter_clients_promoter ON public.promoter_clients USING btree (promoter_id);
CREATE INDEX IF NOT EXISTS idx_prospect_leads_client_id ON public.prospect_leads USING btree (representative_client_id);
CREATE INDEX IF NOT EXISTS idx_prospect_leads_cnpj ON public.prospect_leads USING btree (cnpj) WHERE (cnpj IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_prospect_leads_coords ON public.prospect_leads USING btree (lat, lng) WHERE ((lat IS NOT NULL) AND (lng IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_prospect_leads_duplicate_client ON public.prospect_leads USING btree (duplicate_of_client_id) WHERE (duplicate_of_client_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_prospect_leads_duplicate_lead ON public.prospect_leads USING btree (duplicate_of_lead_id) WHERE (duplicate_of_lead_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_prospect_leads_list_id ON public.prospect_leads USING btree (prospect_list_id);
CREATE INDEX IF NOT EXISTS idx_prospect_leads_rep_id ON public.prospect_leads USING btree (representative_id);
CREATE INDEX IF NOT EXISTS idx_prospect_leads_status ON public.prospect_leads USING btree (status);
CREATE INDEX IF NOT EXISTS idx_prospect_lists_assigned_rep ON public.prospect_lists USING btree (assigned_representative_id);
CREATE INDEX IF NOT EXISTS idx_prospect_lists_segment ON public.prospect_lists USING btree (segment);
CREATE INDEX IF NOT EXISTS idx_prospect_lists_status ON public.prospect_lists USING btree (status);
CREATE INDEX IF NOT EXISTS idx_prospect_runs_created ON public.prospect_runs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_prospect_runs_status ON public.prospect_runs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_prospects_b2b_cnae ON public.prospects_b2b USING btree (cnae_principal);
CREATE INDEX IF NOT EXISTS idx_prospects_b2b_coords ON public.prospects_b2b USING btree (lat, lng) WHERE ((lat IS NOT NULL) AND (lng IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_prospects_b2b_municipio ON public.prospects_b2b USING btree (uf, municipio);
CREATE INDEX IF NOT EXISTS idx_prospects_b2b_uf ON public.prospects_b2b USING btree (uf);
CREATE INDEX IF NOT EXISTS idx_pvisits_client ON public.promoter_visits USING btree (representative_client_id);
CREATE INDEX IF NOT EXISTS idx_pvisits_promoter_status ON public.promoter_visits USING btree (promoter_id, status);
CREATE INDEX IF NOT EXISTS idx_pvisits_route ON public.promoter_visits USING btree (route_id);
CREATE INDEX IF NOT EXISTS idx_rep_clients_cnpj ON public.representative_clients USING btree (cnpj);
CREATE INDEX IF NOT EXISTS idx_rep_clients_cpf ON public.representative_clients USING btree (cpf) WHERE ((cpf IS NOT NULL) AND (btrim(cpf) <> ''::text));
CREATE INDEX IF NOT EXISTS idx_rep_clients_rep_id ON public.representative_clients USING btree (representative_id);
CREATE INDEX IF NOT EXISTS idx_rep_commissions_rep_id ON public.representative_commissions USING btree (representative_id);
CREATE INDEX IF NOT EXISTS idx_rep_commissions_status ON public.representative_commissions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_rep_docs_rep_id ON public.representative_documents USING btree (representative_id);
CREATE INDEX IF NOT EXISTS idx_rep_orders_client_id ON public.representative_orders USING btree (representative_client_id);
CREATE INDEX IF NOT EXISTS idx_rep_orders_rep_id ON public.representative_orders USING btree (representative_id);
CREATE INDEX IF NOT EXISTS idx_rep_orders_status ON public.representative_orders USING btree (status);
CREATE INDEX IF NOT EXISTS idx_representatives_coords ON public.representatives USING btree (last_lat, last_lng) WHERE ((last_lat IS NOT NULL) AND (last_lng IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_representatives_online ON public.representatives USING btree (is_online, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_representatives_status ON public.representatives USING btree (status);
CREATE INDEX IF NOT EXISTS idx_representatives_user_id ON public.representatives USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_roi_order_id ON public.representative_order_installments USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_client_id ON public.route_stops USING btree (representative_client_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_geofence ON public.route_stops USING btree (geofence_triggered) WHERE (geofence_triggered = true);
CREATE INDEX IF NOT EXISTS idx_route_stops_prospect_lead_id ON public.route_stops USING btree (prospect_lead_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON public.route_stops USING btree (route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_scheduled_at ON public.route_stops USING btree (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_route_stops_status ON public.route_stops USING btree (visit_status);
CREATE INDEX IF NOT EXISTS idx_route_stops_type ON public.route_stops USING btree (stop_type);
CREATE INDEX IF NOT EXISTS idx_routes_region ON public.representative_routes USING btree (region);
CREATE INDEX IF NOT EXISTS idx_routes_representative_id ON public.representative_routes USING btree (representative_id);
CREATE INDEX IF NOT EXISTS idx_routes_type ON public.representative_routes USING btree (route_type);
CREATE INDEX IF NOT EXISTS idx_site_visits_created ON public.site_visits USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_snap_handle ON public.studio_profile_snapshots USING btree (company_id, handle, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles USING btree (user_id, role_code);
CREATE INDEX IF NOT EXISTS lot_documents_lot_id_kind_idx ON public.lot_documents USING btree (lot_id, kind);
CREATE INDEX IF NOT EXISTS lv_b2b_solicitacoes_por_status ON public.lv_b2b_solicitacoes USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS lv_categories_pai ON public.lv_categories USING btree (parent_id, ordem);
CREATE INDEX IF NOT EXISTS lv_demo_access_ativos ON public.lv_demo_access USING btree (ativo) WHERE ativo;
CREATE INDEX IF NOT EXISTS lv_inventory_lots_por_produto ON public.lv_inventory_lots USING btree (product_id);
CREATE INDEX IF NOT EXISTS lv_inventory_lots_por_variante ON public.lv_inventory_lots USING btree (variant_id);
CREATE INDEX IF NOT EXISTS lv_inventory_lots_por_vendedor ON public.lv_inventory_lots USING btree (seller_id);
CREATE INDEX IF NOT EXISTS lv_price_history_por_produto ON public.lv_price_history USING btree (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lv_price_history_por_vendedor ON public.lv_price_history USING btree (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lv_price_tiers_por_produto ON public.lv_price_tiers USING btree (product_id, min_qty);
CREATE INDEX IF NOT EXISTS lv_product_images_por_produto ON public.lv_product_images USING btree (product_id, ordem);
CREATE INDEX IF NOT EXISTS lv_product_variants_por_produto ON public.lv_product_variants USING btree (product_id, ordem);
CREATE INDEX IF NOT EXISTS lv_products_ativos ON public.lv_products USING btree (status, ordem) WHERE (status = 'ativo'::text);
CREATE INDEX IF NOT EXISTS lv_products_por_categoria ON public.lv_products USING btree (category_id);
CREATE INDEX IF NOT EXISTS lv_products_por_loja ON public.lv_products USING btree (store_id);
CREATE INDEX IF NOT EXISTS lv_qr_codes_por_produto ON public.lv_qr_codes USING btree (product_id);
CREATE INDEX IF NOT EXISTS lv_seller_applications_por_status ON public.lv_seller_applications USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS lv_seller_users_por_usuario ON public.lv_seller_users USING btree (user_id);
CREATE INDEX IF NOT EXISTS lv_sellers_status ON public.lv_sellers USING btree (status);
CREATE INDEX IF NOT EXISTS lv_stores_ativas ON public.lv_stores USING btree (ativa, ordem) WHERE ativa;
CREATE INDEX IF NOT EXISTS lv_stores_por_vendedor ON public.lv_stores USING btree (seller_id);
CREATE INDEX IF NOT EXISTS lv_tarifas_simulacao_busca ON public.lv_tarifas_simulacao USING btree (plataforma, componente) WHERE ativo;
CREATE INDEX IF NOT EXISTS marketing_contacts_ativos_idx ON public.marketing_contacts USING btree (segment, company_id) WHERE (consent AND (opted_out_at IS NULL) AND is_mobile);
CREATE INDEX IF NOT EXISTS network_audit_entity_idx ON public.network_audit_log USING btree (entity_table, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS network_entities_uf_idx ON public.network_entities USING btree (uf);
CREATE INDEX IF NOT EXISTS network_entities_user_idx ON public.network_entities USING btree (user_id);
CREATE INDEX IF NOT EXISTS network_entity_roles_entity_idx ON public.network_entity_roles USING btree (entity_id);
CREATE INDEX IF NOT EXISTS network_properties_entity_idx ON public.network_properties USING btree (entity_id);
CREATE INDEX IF NOT EXISTS order_emails_order_idx ON public.order_emails USING btree (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_product_idx ON public.order_items USING btree (product_id);
CREATE INDEX IF NOT EXISTS orders_customer_cpf_idx ON public.orders USING btree (customer_cpf) WHERE (customer_cpf IS NOT NULL);
CREATE INDEX IF NOT EXISTS orders_public_token_hash_idx ON public.orders USING btree (order_public_token_hash);
CREATE INDEX IF NOT EXISTS orders_seller_company_idx ON public.orders USING btree (seller_company_id);
CREATE INDEX IF NOT EXISTS orders_zona_de_frete ON public.orders USING btree (shipping_zone) WHERE (shipping_zone IS NOT NULL);
CREATE INDEX IF NOT EXISTS payment_refunds_order_idx ON public.payment_refunds USING btree (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS price_lists_company_idx ON public.price_lists USING btree (company_id);
CREATE INDEX IF NOT EXISTS products_company_idx ON public.products USING btree (company_id);
CREATE INDEX IF NOT EXISTS products_kit_of_idx ON public.products USING btree (kit_of_product_id) WHERE (kit_of_product_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS products_sales_channels_idx ON public.products USING gin (sales_channels);
CREATE INDEX IF NOT EXISTS prospect_leads_company_idx ON public.prospect_leads USING btree (company_id);
CREATE INDEX IF NOT EXISTS prospect_lists_company_idx ON public.prospect_lists USING btree (company_id);
CREATE INDEX IF NOT EXISTS rcp_rep_idx ON public.representative_commission_payouts USING btree (representative_id);
CREATE INDEX IF NOT EXISTS rcp_sched_idx ON public.representative_commission_payouts USING btree (scheduled_payment_date);
CREATE INDEX IF NOT EXISTS representative_clients_company_idx ON public.representative_clients USING btree (company_id);
CREATE INDEX IF NOT EXISTS representative_commission_payouts_company_idx ON public.representative_commission_payouts USING btree (company_id);
CREATE INDEX IF NOT EXISTS representative_commissions_company_idx ON public.representative_commissions USING btree (company_id);
CREATE INDEX IF NOT EXISTS representative_order_installments_company_idx ON public.representative_order_installments USING btree (company_id);
CREATE INDEX IF NOT EXISTS representative_order_items_company_idx ON public.representative_order_items USING btree (company_id);
CREATE INDEX IF NOT EXISTS representative_orders_company_idx ON public.representative_orders USING btree (company_id);
CREATE INDEX IF NOT EXISTS representatives_company_idx ON public.representatives USING btree (company_id);
CREATE INDEX IF NOT EXISTS roi_items_order_idx ON public.representative_order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS roi_items_product_idx ON public.representative_order_items USING btree (product_id);
CREATE INDEX IF NOT EXISTS roi_items_rep_idx ON public.representative_order_items USING btree (representative_id);
CREATE INDEX IF NOT EXISTS ron_order_idx ON public.representative_order_notes USING btree (order_id);
CREATE INDEX IF NOT EXISTS shipping_coverage_faixa ON public.shipping_coverage USING btree (table_id, cep_ini, cep_fim);
CREATE INDEX IF NOT EXISTS shipping_quotes_validade ON public.shipping_quotes USING btree (expires_at);
CREATE INDEX IF NOT EXISTS shipping_rates_lookup ON public.shipping_rates USING btree (table_id, zone_code, weight_kg);
CREATE INDEX IF NOT EXISTS stock_movements_lot_idx ON public.stock_movements USING btree (lot_id);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON public.stock_movements USING btree (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_ref_idx ON public.stock_movements USING btree (reference_type, reference_id);
CREATE INDEX IF NOT EXISTS studio_brands_por_org ON public.studio_brand_profiles USING btree (organization_id);
CREATE INDEX IF NOT EXISTS studio_gen_empresa ON public.studio_generations USING btree (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS studio_gen_pai ON public.studio_generations USING btree (parent_id) WHERE (parent_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS studio_gen_por_lote ON public.studio_generations USING btree (batch_id, batch_index);
CREATE INDEX IF NOT EXISTS studio_gen_por_org ON public.studio_generations USING btree (organization_id);
CREATE INDEX IF NOT EXISTS studio_members_por_usuario ON public.studio_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS studio_ref_assets_por_marca ON public.studio_reference_assets USING btree (brand_id);
CREATE INDEX IF NOT EXISTS studio_ref_assets_por_org ON public.studio_reference_assets USING btree (organization_id);
CREATE INDEX IF NOT EXISTS studio_videos_por_org ON public.studio_videos USING btree (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS lv_product_variants_sku_unico ON public.lv_product_variants USING btree (product_id, lower(sku)) WHERE (sku IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS lv_product_variants_uma_padrao ON public.lv_product_variants USING btree (product_id) WHERE padrao;
CREATE UNIQUE INDEX IF NOT EXISTS mv_repco_prospects_muni_key ON public.mv_repco_prospects_muni USING btree (uf, muni_key);
CREATE UNIQUE INDEX IF NOT EXISTS network_entities_document_uidx ON public.network_entities USING btree (document_type, document_number) WHERE (document_number IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique_idx ON public.products USING btree (barcode) WHERE (barcode IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS rcp_uniq_installment ON public.representative_commission_payouts USING btree (installment_id) WHERE (installment_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS rcp_uniq_pix ON public.representative_commission_payouts USING btree (commission_id) WHERE (installment_id IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS studio_fingerprint_headline_unica ON public.studio_content_fingerprints USING btree (headline_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uq_discovery_canonical ON public.discovery_results USING btree (company_id, canonical_url) WHERE (canonical_url IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_discovery_extid ON public.discovery_results USING btree (company_id, provider, external_id) WHERE (external_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_prospects_b2b_cnpj ON public.prospects_b2b USING btree (cnpj);
CREATE UNIQUE INDEX IF NOT EXISTS user_addresses_um_padrao_por_usuario ON public.user_addresses USING btree (user_id) WHERE is_default;

-- Materialized views: primeira carga (tabelas vazias)
refresh materialized view public."mv_repco_prospects_muni";

-- Triggers
CREATE TRIGGER lv_guarda_loja BEFORE UPDATE ON public.lv_stores FOR EACH ROW EXECUTE FUNCTION lv_guarda_loja();
CREATE TRIGGER lv_guarda_lote BEFORE INSERT OR UPDATE ON public.lv_inventory_lots FOR EACH ROW EXECUTE FUNCTION lv_guarda_lote();
CREATE TRIGGER lv_guarda_produto BEFORE INSERT OR UPDATE ON public.lv_products FOR EACH ROW EXECUTE FUNCTION lv_guarda_produto();
CREATE TRIGGER lv_guarda_qr BEFORE INSERT OR UPDATE ON public.lv_qr_codes FOR EACH ROW EXECUTE FUNCTION lv_guarda_qr();
CREATE TRIGGER lv_guarda_variante BEFORE INSERT OR UPDATE ON public.lv_product_variants FOR EACH ROW EXECUTE FUNCTION lv_guarda_variante();
CREATE TRIGGER lv_nasce_produto AFTER INSERT ON public.lv_products FOR EACH ROW EXECUTE FUNCTION lv_nasce_produto();
CREATE TRIGGER lv_registra_preco AFTER UPDATE OF preco_cents ON public.lv_products FOR EACH ROW EXECUTE FUNCTION lv_registra_preco();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER prospect_leads_updated_at BEFORE UPDATE ON public.prospect_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER prospect_lists_updated_at BEFORE UPDATE ON public.prospect_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER rep_clients_updated_at BEFORE UPDATE ON public.representative_clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER representatives_updated_at BEFORE UPDATE ON public.representatives FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER route_stops_updated_at BEFORE UPDATE ON public.route_stops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER routes_updated_at BEFORE UPDATE ON public.representative_routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_repco_order_number BEFORE INSERT ON public.representative_orders FOR EACH ROW EXECUTE FUNCTION generate_repco_order_number();
CREATE TRIGGER trg_boleto_commission_payout AFTER UPDATE ON public.representative_order_installments FOR EACH ROW EXECUTE FUNCTION create_boleto_commission_payout();
CREATE TRIGGER trg_chat_touch AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION chat_touch_conv();
CREATE TRIGGER trg_consume_stock_on_order_paid AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION consume_stock_on_order_paid();
CREATE TRIGGER trg_espelhar_foto_nos_kits AFTER UPDATE OF image_url ON public.products FOR EACH ROW EXECUTE FUNCTION espelhar_foto_nos_kits();
CREATE TRIGGER trg_gen_batch BEFORE INSERT ON public.green_coffee_lots FOR EACH ROW EXECUTE FUNCTION generate_batch_number();
CREATE TRIGGER trg_pix_commission_payout AFTER INSERT ON public.representative_commissions FOR EACH ROW EXECUTE FUNCTION create_pix_commission_payout();
CREATE TRIGGER trg_promoter_classify_ruptura BEFORE INSERT OR UPDATE ON public.promoter_visit_audits FOR EACH ROW EXECUTE FUNCTION promoter_classify_ruptura();
CREATE TRIGGER trg_promoter_ruptura_incident AFTER INSERT OR UPDATE ON public.promoter_visit_audits FOR EACH ROW EXECUTE FUNCTION promoter_ruptura_incident();
CREATE TRIGGER trg_promoters_guard_self_update BEFORE UPDATE ON public.promoters FOR EACH ROW EXECUTE FUNCTION promoters_guard_self_update();
CREATE TRIGGER trg_repco_apply_stock BEFORE INSERT ON public.representative_order_items FOR EACH ROW EXECUTE FUNCTION repco_apply_stock_on_item();
CREATE TRIGGER trg_repco_orders_delivery_guard BEFORE UPDATE ON public.representative_orders FOR EACH ROW EXECUTE FUNCTION repco_orders_delivery_guard();
CREATE TRIGGER trg_repco_return_stock AFTER UPDATE ON public.representative_orders FOR EACH ROW EXECUTE FUNCTION repco_return_stock_on_cancel();
CREATE TRIGGER trg_repco_score_on_installment AFTER UPDATE ON public.representative_order_installments FOR EACH ROW EXECUTE FUNCTION repco_score_on_installment_paid();
CREATE TRIGGER trg_return_stock_on_order_cancelled AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION return_stock_on_order_cancelled();
CREATE TRIGGER trg_update_stock AFTER INSERT OR DELETE OR UPDATE ON public.green_coffee_lots FOR EACH ROW EXECUTE FUNCTION update_product_stock_from_lots();
CREATE TRIGGER trigger_client_snooze BEFORE UPDATE ON public.representative_clients FOR EACH ROW EXECUTE FUNCTION handle_client_snooze();
CREATE TRIGGER trigger_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_repco_commission BEFORE UPDATE ON public.representative_orders FOR EACH ROW EXECUTE FUNCTION calculate_repco_commission();
CREATE TRIGGER trigger_reset_snooze_on_order AFTER INSERT ON public.representative_orders FOR EACH ROW EXECUTE FUNCTION reset_client_snooze_on_order();
CREATE TRIGGER trigger_set_order_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION set_order_number();
CREATE TRIGGER trigger_update_client_last_order AFTER INSERT ON public.representative_orders FOR EACH ROW WHEN ((new.representative_client_id IS NOT NULL)) EXECUTE FUNCTION update_client_last_order();

-- RLS
alter table public."admin_settings" enable row level security;
alter table public."ai_usage_events" enable row level security;
alter table public."b2b_leads" enable row level security;
alter table public."batch_photos" enable row level security;
alter table public."candidaturas_representante" enable row level security;
alter table public."chat_conversations" enable row level security;
alter table public."chat_messages" enable row level security;
alter table public."chat_participants" enable row level security;
alter table public."coffee_bebida_scale" enable row level security;
alter table public."coffee_market_index" enable row level security;
alter table public."coffee_matches" enable row level security;
alter table public."coffee_offer_photos" enable row level security;
alter table public."coffee_offers" enable row level security;
alter table public."coffee_pilot_cases" enable row level security;
alter table public."coffee_purchase_requests" enable row level security;
alter table public."commercial_accounts" enable row level security;
alter table public."companies" enable row level security;
alter table public."company_order_counters" enable row level security;
alter table public."coupon_redemptions" enable row level security;
alter table public."coupons" enable row level security;
alter table public."delivery_dispatch_audit" enable row level security;
alter table public."delivery_routes" enable row level security;
alter table public."delivery_stops" enable row level security;
alter table public."discovery_campaigns" enable row level security;
alter table public."discovery_keywords" enable row level security;
alter table public."discovery_results" enable row level security;
alter table public."distributed_brands" enable row level security;
alter table public."driver_documents" enable row level security;
alter table public."drivers" enable row level security;
alter table public."ecommerce_price_snapshots" enable row level security;
alter table public."ecommerce_sources" enable row level security;
alter table public."edge_logs" enable row level security;
alter table public."edge_rate_limits" enable row level security;
alter table public."fleet_documents" enable row level security;
alter table public."fleet_maintenance" enable row level security;
alter table public."fleet_vehicles" enable row level security;
alter table public."green_coffee_lots" enable row level security;
alter table public."ibge_municipios" enable row level security;
alter table public."invoices" enable row level security;
alter table public."lead_rf_candidates" enable row level security;
alter table public."lot_documents" enable row level security;
alter table public."lot_transfers" enable row level security;
alter table public."lv_attributes" enable row level security;
alter table public."lv_b2b_empresas" enable row level security;
alter table public."lv_b2b_solicitacoes" enable row level security;
alter table public."lv_categories" enable row level security;
alter table public."lv_category_attributes" enable row level security;
alter table public."lv_demo_access" enable row level security;
alter table public."lv_inventory_lots" enable row level security;
alter table public."lv_plans" enable row level security;
alter table public."lv_price_history" enable row level security;
alter table public."lv_price_tiers" enable row level security;
alter table public."lv_product_attributes" enable row level security;
alter table public."lv_product_images" enable row level security;
alter table public."lv_product_variants" enable row level security;
alter table public."lv_products" enable row level security;
alter table public."lv_qr_codes" enable row level security;
alter table public."lv_seller_applications" enable row level security;
alter table public."lv_seller_users" enable row level security;
alter table public."lv_sellers" enable row level security;
alter table public."lv_settings" enable row level security;
alter table public."lv_simulacao_premissas" enable row level security;
alter table public."lv_stores" enable row level security;
alter table public."lv_tarifas_simulacao" enable row level security;
alter table public."marketing_contacts" enable row level security;
alter table public."marketplace_stores" enable row level security;
alter table public."network_audit_log" enable row level security;
alter table public."network_entities" enable row level security;
alter table public."network_entity_roles" enable row level security;
alter table public."network_properties" enable row level security;
alter table public."network_roles" enable row level security;
alter table public."order_emails" enable row level security;
alter table public."order_items" enable row level security;
alter table public."orders" enable row level security;
alter table public."packaging_specs" enable row level security;
alter table public."payment_refunds" enable row level security;
alter table public."popup_settings" enable row level security;
alter table public."price_lists" enable row level security;
alter table public."products" enable row level security;
alter table public."promo_banners" enable row level security;
alter table public."promoter_audit_log" enable row level security;
alter table public."promoter_client_mix" enable row level security;
alter table public."promoter_clients" enable row level security;
alter table public."promoter_incidents" enable row level security;
alter table public."promoter_routes" enable row level security;
alter table public."promoter_visit_audits" enable row level security;
alter table public."promoter_visit_locations" enable row level security;
alter table public."promoter_visit_photos" enable row level security;
alter table public."promoter_visits" enable row level security;
alter table public."promoters" enable row level security;
alter table public."prospect_leads" enable row level security;
alter table public."prospect_lists" enable row level security;
alter table public."prospect_runs" enable row level security;
alter table public."prospects_b2b" enable row level security;
alter table public."rep_daily_plans" enable row level security;
alter table public."repco_help_articles" enable row level security;
alter table public."repco_invite_codes" enable row level security;
alter table public."representative_clients" enable row level security;
alter table public."representative_commission_payouts" enable row level security;
alter table public."representative_commissions" enable row level security;
alter table public."representative_company_settings" enable row level security;
alter table public."representative_documents" enable row level security;
alter table public."representative_order_installments" enable row level security;
alter table public."representative_order_items" enable row level security;
alter table public."representative_order_notes" enable row level security;
alter table public."representative_orders" enable row level security;
alter table public."representative_routes" enable row level security;
alter table public."representatives" enable row level security;
alter table public."roasting_companies" enable row level security;
alter table public."roasting_company_contacts" enable row level security;
alter table public."roles" enable row level security;
alter table public."route_stops" enable row level security;
alter table public."shipments" enable row level security;
alter table public."shipping_carriers" enable row level security;
alter table public."shipping_coverage" enable row level security;
alter table public."shipping_quotes" enable row level security;
alter table public."shipping_rate_tables" enable row level security;
alter table public."shipping_rates" enable row level security;
alter table public."site_settings" enable row level security;
alter table public."site_visits" enable row level security;
alter table public."stock_movements" enable row level security;
alter table public."storage_cleanup_log" enable row level security;
alter table public."studio_analyses" enable row level security;
alter table public."studio_brand_profiles" enable row level security;
alter table public."studio_campaigns" enable row level security;
alter table public."studio_content_fingerprints" enable row level security;
alter table public."studio_generations" enable row level security;
alter table public."studio_members" enable row level security;
alter table public."studio_organizations" enable row level security;
alter table public."studio_profile_snapshots" enable row level security;
alter table public."studio_reference_assets" enable row level security;
alter table public."studio_social_connections" enable row level security;
alter table public."studio_transcriptions" enable row level security;
alter table public."studio_videos" enable row level security;
alter table public."subscription_settings" enable row level security;
alter table public."subscriptions" enable row level security;
alter table public."superfrete_settings" enable row level security;
alter table public."telegram_recipients" enable row level security;
alter table public."user_addresses" enable row level security;
alter table public."user_profiles" enable row level security;
alter table public."user_roles" enable row level security;

-- Policies
drop policy if exists "Admins can insert settings" on "public"."admin_settings";
create policy "Admins can insert settings" on "public"."admin_settings" as permissive for insert to "authenticated" with check ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true)))));
drop policy if exists "Admins can update settings" on "public"."admin_settings";
create policy "Admins can update settings" on "public"."admin_settings" as permissive for update to "authenticated" using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true))))) with check ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true)))));
drop policy if exists "Admins can view settings" on "public"."admin_settings";
create policy "Admins can view settings" on "public"."admin_settings" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true)))));
drop policy if exists "ai_usage_admin" on "public"."ai_usage_events";
create policy "ai_usage_admin" on "public"."ai_usage_events" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "b2b_admin_all" on "public"."b2b_leads";
create policy "b2b_admin_all" on "public"."b2b_leads" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "b2b_insert_public" on "public"."b2b_leads";
create policy "b2b_insert_public" on "public"."b2b_leads" as permissive for insert to "anon", "authenticated" with check (true);
drop policy if exists "Admin manages batch photos" on "public"."batch_photos";
create policy "Admin manages batch photos" on "public"."batch_photos" as permissive for all to "authenticated" using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true)))));
drop policy if exists "cand_rep_admin_all" on "public"."candidaturas_representante";
create policy "cand_rep_admin_all" on "public"."candidaturas_representante" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "cand_rep_insert_public" on "public"."candidaturas_representante";
create policy "cand_rep_insert_public" on "public"."candidaturas_representante" as permissive for insert to "anon", "authenticated" with check (true);
drop policy if exists "chat_conv_sel" on "public"."chat_conversations";
create policy "chat_conv_sel" on "public"."chat_conversations" as permissive for select to "authenticated" using (is_chat_member(id));
drop policy if exists "chat_msg_ins" on "public"."chat_messages";
create policy "chat_msg_ins" on "public"."chat_messages" as permissive for insert to "authenticated" with check ((is_chat_member(conversation_id) AND (sender_id = auth.uid())));
drop policy if exists "chat_msg_sel" on "public"."chat_messages";
create policy "chat_msg_sel" on "public"."chat_messages" as permissive for select to "authenticated" using (is_chat_member(conversation_id));
drop policy if exists "chat_part_sel" on "public"."chat_participants";
create policy "chat_part_sel" on "public"."chat_participants" as permissive for select to "authenticated" using (is_chat_member(conversation_id));
drop policy if exists "cn_bebida_admin" on "public"."coffee_bebida_scale";
create policy "cn_bebida_admin" on "public"."coffee_bebida_scale" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "cn_bebida_read" on "public"."coffee_bebida_scale";
create policy "cn_bebida_read" on "public"."coffee_bebida_scale" as permissive for select to "authenticated" using (true);
drop policy if exists "Admin all coffee_index" on "public"."coffee_market_index";
create policy "Admin all coffee_index" on "public"."coffee_market_index" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "cn_matches_admin" on "public"."coffee_matches";
create policy "cn_matches_admin" on "public"."coffee_matches" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "cn_offer_photos_admin" on "public"."coffee_offer_photos";
create policy "cn_offer_photos_admin" on "public"."coffee_offer_photos" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "cn_offer_photos_owner" on "public"."coffee_offer_photos";
create policy "cn_offer_photos_owner" on "public"."coffee_offer_photos" as permissive for all to "authenticated" using ((offer_id IN ( SELECT coffee_offers.id
   FROM coffee_offers
  WHERE (coffee_offers.entity_id IN ( SELECT my_network_entity_ids() AS my_network_entity_ids))))) with check ((offer_id IN ( SELECT coffee_offers.id
   FROM coffee_offers
  WHERE (coffee_offers.entity_id IN ( SELECT my_network_entity_ids() AS my_network_entity_ids)))));
drop policy if exists "cn_offers_admin" on "public"."coffee_offers";
create policy "cn_offers_admin" on "public"."coffee_offers" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "cn_offers_owner" on "public"."coffee_offers";
create policy "cn_offers_owner" on "public"."coffee_offers" as permissive for all to "authenticated" using ((entity_id IN ( SELECT my_network_entity_ids() AS my_network_entity_ids))) with check ((entity_id IN ( SELECT my_network_entity_ids() AS my_network_entity_ids)));
drop policy if exists "cpc_admin" on "public"."coffee_pilot_cases";
create policy "cpc_admin" on "public"."coffee_pilot_cases" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "cn_requests_admin" on "public"."coffee_purchase_requests";
create policy "cn_requests_admin" on "public"."coffee_purchase_requests" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "cn_requests_owner" on "public"."coffee_purchase_requests";
create policy "cn_requests_owner" on "public"."coffee_purchase_requests" as permissive for all to "authenticated" using ((entity_id IN ( SELECT my_network_entity_ids() AS my_network_entity_ids))) with check ((entity_id IN ( SELECT my_network_entity_ids() AS my_network_entity_ids)));
drop policy if exists "cn_commercial_admin" on "public"."commercial_accounts";
create policy "cn_commercial_admin" on "public"."commercial_accounts" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "admin all companies" on "public"."companies";
create policy "admin all companies" on "public"."companies" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "public read companies" on "public"."companies";
create policy "public read companies" on "public"."companies" as permissive for select to public using (true);
drop policy if exists "coc_admin_read" on "public"."company_order_counters";
create policy "coc_admin_read" on "public"."company_order_counters" as permissive for select to "authenticated" using (is_admin());
drop policy if exists "cr_admin" on "public"."coupon_redemptions";
create policy "cr_admin" on "public"."coupon_redemptions" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "cp_admin" on "public"."coupons";
create policy "cp_admin" on "public"."coupons" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "dda_admin_sel" on "public"."delivery_dispatch_audit";
create policy "dda_admin_sel" on "public"."delivery_dispatch_audit" as permissive for select to public using (is_admin());
drop policy if exists "droutes_admin" on "public"."delivery_routes";
create policy "droutes_admin" on "public"."delivery_routes" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "droutes_driver" on "public"."delivery_routes";
create policy "droutes_driver" on "public"."delivery_routes" as permissive for select to public using ((driver_id = my_driver_id()));
drop policy if exists "dstops_admin" on "public"."delivery_stops";
create policy "dstops_admin" on "public"."delivery_stops" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "dstops_driver_sel" on "public"."delivery_stops";
create policy "dstops_driver_sel" on "public"."delivery_stops" as permissive for select to public using ((route_id IN ( SELECT delivery_routes.id
   FROM delivery_routes
  WHERE (delivery_routes.driver_id = my_driver_id()))));
drop policy if exists "dstops_driver_upd" on "public"."delivery_stops";
create policy "dstops_driver_upd" on "public"."delivery_stops" as permissive for update to public using ((route_id IN ( SELECT delivery_routes.id
   FROM delivery_routes
  WHERE (delivery_routes.driver_id = my_driver_id())))) with check ((route_id IN ( SELECT delivery_routes.id
   FROM delivery_routes
  WHERE (delivery_routes.driver_id = my_driver_id()))));
drop policy if exists "disc_camp_admin" on "public"."discovery_campaigns";
create policy "disc_camp_admin" on "public"."discovery_campaigns" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "disc_kw_admin" on "public"."discovery_keywords";
create policy "disc_kw_admin" on "public"."discovery_keywords" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "disc_res_admin" on "public"."discovery_results";
create policy "disc_res_admin" on "public"."discovery_results" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "dist_brands_read" on "public"."distributed_brands";
create policy "dist_brands_read" on "public"."distributed_brands" as permissive for select to public using (true);
drop policy if exists "dist_brands_write" on "public"."distributed_brands";
create policy "dist_brands_write" on "public"."distributed_brands" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "driver_d_admin" on "public"."driver_documents";
create policy "driver_d_admin" on "public"."driver_documents" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "drivers_admin" on "public"."drivers";
create policy "drivers_admin" on "public"."drivers" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "drivers_self" on "public"."drivers";
create policy "drivers_self" on "public"."drivers" as permissive for select to public using ((user_id = auth.uid()));
drop policy if exists "Admin all eps" on "public"."ecommerce_price_snapshots";
create policy "Admin all eps" on "public"."ecommerce_price_snapshots" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "Reps read visible snapshots" on "public"."ecommerce_price_snapshots";
create policy "Reps read visible snapshots" on "public"."ecommerce_price_snapshots" as permissive for select to "authenticated" using ((marketplace IN ( SELECT ecommerce_sources.marketplace
   FROM ecommerce_sources
  WHERE ecommerce_sources.visible_to_reps)));
drop policy if exists "Admin all sources" on "public"."ecommerce_sources";
create policy "Admin all sources" on "public"."ecommerce_sources" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "Reps read visible sources" on "public"."ecommerce_sources";
create policy "Reps read visible sources" on "public"."ecommerce_sources" as permissive for select to "authenticated" using (visible_to_reps);
drop policy if exists "Admins can read edge_logs" on "public"."edge_logs";
create policy "Admins can read edge_logs" on "public"."edge_logs" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true)))));
drop policy if exists "fleet_d_admin" on "public"."fleet_documents";
create policy "fleet_d_admin" on "public"."fleet_documents" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "fleet_m_admin" on "public"."fleet_maintenance";
create policy "fleet_m_admin" on "public"."fleet_maintenance" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "fleet_v_admin" on "public"."fleet_vehicles";
create policy "fleet_v_admin" on "public"."fleet_vehicles" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "Admin manages batches" on "public"."green_coffee_lots";
create policy "Admin manages batches" on "public"."green_coffee_lots" as permissive for all to "authenticated" using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true)))));
drop policy if exists "Admin read ibge_municipios" on "public"."ibge_municipios";
create policy "Admin read ibge_municipios" on "public"."ibge_municipios" as permissive for select to "authenticated" using (is_admin());
drop policy if exists "Service role can manage invoices" on "public"."invoices";
create policy "Service role can manage invoices" on "public"."invoices" as permissive for all to public using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));
drop policy if exists "Users can view own order invoices" on "public"."invoices";
create policy "Users can view own order invoices" on "public"."invoices" as permissive for select to public using ((order_id IN ( SELECT orders.id
   FROM orders
  WHERE (orders.user_id = auth.uid()))));
drop policy if exists "admin all invoices" on "public"."invoices";
create policy "admin all invoices" on "public"."invoices" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "Admin all on lead_rf_candidates" on "public"."lead_rf_candidates";
create policy "Admin all on lead_rf_candidates" on "public"."lead_rf_candidates" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lot_documents_admin" on "public"."lot_documents";
create policy "lot_documents_admin" on "public"."lot_documents" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lot_transfers_admin" on "public"."lot_transfers";
create policy "lot_transfers_admin" on "public"."lot_transfers" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "service_role_all" on "public"."lot_transfers";
create policy "service_role_all" on "public"."lot_transfers" as permissive for all to "service_role" using (true) with check (true);
drop policy if exists "lv_attributes_admin" on "public"."lv_attributes";
create policy "lv_attributes_admin" on "public"."lv_attributes" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_attributes_publicos" on "public"."lv_attributes";
create policy "lv_attributes_publicos" on "public"."lv_attributes" as permissive for select to "anon", "authenticated" using (true);
drop policy if exists "lv_b2b_empresas_admin" on "public"."lv_b2b_empresas";
create policy "lv_b2b_empresas_admin" on "public"."lv_b2b_empresas" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_b2b_solicitacoes_admin" on "public"."lv_b2b_solicitacoes";
create policy "lv_b2b_solicitacoes_admin" on "public"."lv_b2b_solicitacoes" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_categories_admin" on "public"."lv_categories";
create policy "lv_categories_admin" on "public"."lv_categories" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_categories_publicas" on "public"."lv_categories";
create policy "lv_categories_publicas" on "public"."lv_categories" as permissive for select to "anon", "authenticated" using (ativa);
drop policy if exists "lv_category_attributes_admin" on "public"."lv_category_attributes";
create policy "lv_category_attributes_admin" on "public"."lv_category_attributes" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_category_attributes_publicos" on "public"."lv_category_attributes";
create policy "lv_category_attributes_publicos" on "public"."lv_category_attributes" as permissive for select to "anon", "authenticated" using (true);
drop policy if exists "lv_demo_access_admin" on "public"."lv_demo_access";
create policy "lv_demo_access_admin" on "public"."lv_demo_access" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_inventory_lots_admin" on "public"."lv_inventory_lots";
create policy "lv_inventory_lots_admin" on "public"."lv_inventory_lots" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_inventory_lots_vendedor" on "public"."lv_inventory_lots";
create policy "lv_inventory_lots_vendedor" on "public"."lv_inventory_lots" as permissive for select to "authenticated" using ((seller_id = ANY (lv_meus_vendedores())));
drop policy if exists "lv_plans_admin" on "public"."lv_plans";
create policy "lv_plans_admin" on "public"."lv_plans" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_plans_publicos" on "public"."lv_plans";
create policy "lv_plans_publicos" on "public"."lv_plans" as permissive for select to "anon", "authenticated" using (ativo);
drop policy if exists "lv_price_history_admin" on "public"."lv_price_history";
create policy "lv_price_history_admin" on "public"."lv_price_history" as permissive for select to "authenticated" using (is_admin());
drop policy if exists "lv_price_history_vendedor" on "public"."lv_price_history";
create policy "lv_price_history_vendedor" on "public"."lv_price_history" as permissive for select to "authenticated" using ((seller_id = ANY (lv_meus_vendedores())));
drop policy if exists "lv_price_tiers_admin" on "public"."lv_price_tiers";
create policy "lv_price_tiers_admin" on "public"."lv_price_tiers" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_price_tiers_publicas" on "public"."lv_price_tiers";
create policy "lv_price_tiers_publicas" on "public"."lv_price_tiers" as permissive for select to "anon", "authenticated" using ((EXISTS ( SELECT 1
   FROM lv_products p
  WHERE ((p.id = lv_price_tiers.product_id) AND (p.status = 'ativo'::text)))));
drop policy if exists "lv_price_tiers_vendedor" on "public"."lv_price_tiers";
create policy "lv_price_tiers_vendedor" on "public"."lv_price_tiers" as permissive for all to "authenticated" using ((EXISTS ( SELECT 1
   FROM lv_products p
  WHERE ((p.id = lv_price_tiers.product_id) AND (p.seller_id = ANY (lv_meus_vendedores())))))) with check ((EXISTS ( SELECT 1
   FROM lv_products p
  WHERE ((p.id = lv_price_tiers.product_id) AND (p.seller_id = ANY (lv_meus_vendedores()))))));
drop policy if exists "lv_product_attributes_admin" on "public"."lv_product_attributes";
create policy "lv_product_attributes_admin" on "public"."lv_product_attributes" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_product_attributes_publicos" on "public"."lv_product_attributes";
create policy "lv_product_attributes_publicos" on "public"."lv_product_attributes" as permissive for select to "anon", "authenticated" using ((EXISTS ( SELECT 1
   FROM lv_products p
  WHERE ((p.id = lv_product_attributes.product_id) AND (p.status = 'ativo'::text)))));
drop policy if exists "lv_product_attributes_vendedor" on "public"."lv_product_attributes";
create policy "lv_product_attributes_vendedor" on "public"."lv_product_attributes" as permissive for all to "authenticated" using ((EXISTS ( SELECT 1
   FROM lv_products p
  WHERE ((p.id = lv_product_attributes.product_id) AND (p.seller_id = ANY (lv_meus_vendedores())))))) with check ((EXISTS ( SELECT 1
   FROM lv_products p
  WHERE ((p.id = lv_product_attributes.product_id) AND (p.seller_id = ANY (lv_meus_vendedores()))))));
drop policy if exists "lv_product_images_admin" on "public"."lv_product_images";
create policy "lv_product_images_admin" on "public"."lv_product_images" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_product_images_publicas" on "public"."lv_product_images";
create policy "lv_product_images_publicas" on "public"."lv_product_images" as permissive for select to "anon", "authenticated" using ((EXISTS ( SELECT 1
   FROM lv_products p
  WHERE ((p.id = lv_product_images.product_id) AND (p.status = 'ativo'::text)))));
drop policy if exists "lv_product_images_vendedor" on "public"."lv_product_images";
create policy "lv_product_images_vendedor" on "public"."lv_product_images" as permissive for all to "authenticated" using ((EXISTS ( SELECT 1
   FROM lv_products p
  WHERE ((p.id = lv_product_images.product_id) AND (p.seller_id = ANY (lv_meus_vendedores())))))) with check ((EXISTS ( SELECT 1
   FROM lv_products p
  WHERE ((p.id = lv_product_images.product_id) AND (p.seller_id = ANY (lv_meus_vendedores()))))));
drop policy if exists "lv_product_variants_admin" on "public"."lv_product_variants";
create policy "lv_product_variants_admin" on "public"."lv_product_variants" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_product_variants_publicas" on "public"."lv_product_variants";
create policy "lv_product_variants_publicas" on "public"."lv_product_variants" as permissive for select to "anon", "authenticated" using ((ativa AND (EXISTS ( SELECT 1
   FROM (lv_products p
     JOIN lv_stores s ON ((s.id = p.store_id)))
  WHERE ((p.id = lv_product_variants.product_id) AND (p.status = 'ativo'::text) AND s.ativa)))));
drop policy if exists "lv_product_variants_vendedor" on "public"."lv_product_variants";
create policy "lv_product_variants_vendedor" on "public"."lv_product_variants" as permissive for all to "authenticated" using ((EXISTS ( SELECT 1
   FROM lv_products p
  WHERE ((p.id = lv_product_variants.product_id) AND (p.seller_id = ANY (lv_meus_vendedores())))))) with check ((EXISTS ( SELECT 1
   FROM lv_products p
  WHERE ((p.id = lv_product_variants.product_id) AND (p.seller_id = ANY (lv_meus_vendedores()))))));
drop policy if exists "lv_products_admin" on "public"."lv_products";
create policy "lv_products_admin" on "public"."lv_products" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_products_ativos" on "public"."lv_products";
create policy "lv_products_ativos" on "public"."lv_products" as permissive for select to "anon", "authenticated" using ((status = 'ativo'::text));
drop policy if exists "lv_products_vendedor_apaga" on "public"."lv_products";
create policy "lv_products_vendedor_apaga" on "public"."lv_products" as permissive for delete to "authenticated" using (((seller_id = ANY (lv_meus_vendedores())) AND (status = 'rascunho'::text)));
drop policy if exists "lv_products_vendedor_cria" on "public"."lv_products";
create policy "lv_products_vendedor_cria" on "public"."lv_products" as permissive for insert to "authenticated" with check (((seller_id = ANY (lv_meus_vendedores())) AND (EXISTS ( SELECT 1
   FROM lv_stores s
  WHERE ((s.id = lv_products.store_id) AND (s.seller_id = lv_products.seller_id))))));
drop policy if exists "lv_products_vendedor_edita" on "public"."lv_products";
create policy "lv_products_vendedor_edita" on "public"."lv_products" as permissive for update to "authenticated" using ((seller_id = ANY (lv_meus_vendedores()))) with check ((seller_id = ANY (lv_meus_vendedores())));
drop policy if exists "lv_products_vendedor_le" on "public"."lv_products";
create policy "lv_products_vendedor_le" on "public"."lv_products" as permissive for select to "authenticated" using ((seller_id = ANY (lv_meus_vendedores())));
drop policy if exists "lv_qr_codes_admin" on "public"."lv_qr_codes";
create policy "lv_qr_codes_admin" on "public"."lv_qr_codes" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_qr_codes_publicos" on "public"."lv_qr_codes";
create policy "lv_qr_codes_publicos" on "public"."lv_qr_codes" as permissive for select to "anon", "authenticated" using ((ativo AND (EXISTS ( SELECT 1
   FROM (lv_products p
     JOIN lv_stores s ON ((s.id = p.store_id)))
  WHERE ((p.id = lv_qr_codes.product_id) AND (p.status = 'ativo'::text) AND s.ativa)))));
drop policy if exists "lv_qr_codes_vendedor" on "public"."lv_qr_codes";
create policy "lv_qr_codes_vendedor" on "public"."lv_qr_codes" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM lv_products p
  WHERE ((p.id = lv_qr_codes.product_id) AND (p.seller_id = ANY (lv_meus_vendedores()))))));
drop policy if exists "lv_seller_applications_admin" on "public"."lv_seller_applications";
create policy "lv_seller_applications_admin" on "public"."lv_seller_applications" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_seller_applications_envio" on "public"."lv_seller_applications";
create policy "lv_seller_applications_envio" on "public"."lv_seller_applications" as permissive for insert to "anon", "authenticated" with check (((status = 'interessado'::text) AND (seller_id IS NULL)));
drop policy if exists "lv_seller_users_admin" on "public"."lv_seller_users";
create policy "lv_seller_users_admin" on "public"."lv_seller_users" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_seller_users_proprio" on "public"."lv_seller_users";
create policy "lv_seller_users_proprio" on "public"."lv_seller_users" as permissive for select to "authenticated" using ((user_id = auth.uid()));
drop policy if exists "lv_sellers_admin" on "public"."lv_sellers";
create policy "lv_sellers_admin" on "public"."lv_sellers" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_sellers_vendedor" on "public"."lv_sellers";
create policy "lv_sellers_vendedor" on "public"."lv_sellers" as permissive for select to "authenticated" using ((id = ANY (lv_meus_vendedores())));
drop policy if exists "lv_settings_admin" on "public"."lv_settings";
create policy "lv_settings_admin" on "public"."lv_settings" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_simulacao_premissas_admin" on "public"."lv_simulacao_premissas";
create policy "lv_simulacao_premissas_admin" on "public"."lv_simulacao_premissas" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_simulacao_premissas_publicas" on "public"."lv_simulacao_premissas";
create policy "lv_simulacao_premissas_publicas" on "public"."lv_simulacao_premissas" as permissive for select to "anon", "authenticated" using (true);
drop policy if exists "lv_stores_admin" on "public"."lv_stores";
create policy "lv_stores_admin" on "public"."lv_stores" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_stores_publicas" on "public"."lv_stores";
create policy "lv_stores_publicas" on "public"."lv_stores" as permissive for select to "anon", "authenticated" using (ativa);
drop policy if exists "lv_stores_vendedor_edita" on "public"."lv_stores";
create policy "lv_stores_vendedor_edita" on "public"."lv_stores" as permissive for update to "authenticated" using ((seller_id = ANY (lv_meus_vendedores()))) with check ((seller_id = ANY (lv_meus_vendedores())));
drop policy if exists "lv_stores_vendedor_le" on "public"."lv_stores";
create policy "lv_stores_vendedor_le" on "public"."lv_stores" as permissive for select to "authenticated" using ((seller_id = ANY (lv_meus_vendedores())));
drop policy if exists "lv_tarifas_simulacao_admin" on "public"."lv_tarifas_simulacao";
create policy "lv_tarifas_simulacao_admin" on "public"."lv_tarifas_simulacao" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "lv_tarifas_simulacao_publicas" on "public"."lv_tarifas_simulacao";
create policy "lv_tarifas_simulacao_publicas" on "public"."lv_tarifas_simulacao" as permissive for select to "anon", "authenticated" using (ativo);
drop policy if exists "mc_admin" on "public"."marketing_contacts";
create policy "mc_admin" on "public"."marketing_contacts" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "marketplace_stores_admin" on "public"."marketplace_stores";
create policy "marketplace_stores_admin" on "public"."marketplace_stores" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "marketplace_stores_leitura" on "public"."marketplace_stores";
create policy "marketplace_stores_leitura" on "public"."marketplace_stores" as permissive for select to "anon", "authenticated" using (true);
drop policy if exists "cn_audit_admin_read" on "public"."network_audit_log";
create policy "cn_audit_admin_read" on "public"."network_audit_log" as permissive for select to "authenticated" using (is_admin());
drop policy if exists "cn_audit_insert" on "public"."network_audit_log";
create policy "cn_audit_insert" on "public"."network_audit_log" as permissive for insert to "authenticated" with check (true);
drop policy if exists "cn_entities_admin" on "public"."network_entities";
create policy "cn_entities_admin" on "public"."network_entities" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "cn_entities_self_read" on "public"."network_entities";
create policy "cn_entities_self_read" on "public"."network_entities" as permissive for select to "authenticated" using ((user_id = auth.uid()));
drop policy if exists "cn_entities_self_update" on "public"."network_entities";
create policy "cn_entities_self_update" on "public"."network_entities" as permissive for update to "authenticated" using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
drop policy if exists "cn_entity_roles_admin" on "public"."network_entity_roles";
create policy "cn_entity_roles_admin" on "public"."network_entity_roles" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "cn_entity_roles_self" on "public"."network_entity_roles";
create policy "cn_entity_roles_self" on "public"."network_entity_roles" as permissive for select to "authenticated" using ((entity_id IN ( SELECT my_network_entity_ids() AS my_network_entity_ids)));
drop policy if exists "cn_properties_admin" on "public"."network_properties";
create policy "cn_properties_admin" on "public"."network_properties" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "cn_properties_self" on "public"."network_properties";
create policy "cn_properties_self" on "public"."network_properties" as permissive for all to "authenticated" using ((entity_id IN ( SELECT my_network_entity_ids() AS my_network_entity_ids))) with check ((entity_id IN ( SELECT my_network_entity_ids() AS my_network_entity_ids)));
drop policy if exists "cn_roles_admin" on "public"."network_roles";
create policy "cn_roles_admin" on "public"."network_roles" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "cn_roles_read" on "public"."network_roles";
create policy "cn_roles_read" on "public"."network_roles" as permissive for select to "authenticated" using (true);
drop policy if exists "oe_admin" on "public"."order_emails";
create policy "oe_admin" on "public"."order_emails" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "order_items_admin_all" on "public"."order_items";
create policy "order_items_admin_all" on "public"."order_items" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "order_items_select_own" on "public"."order_items";
create policy "order_items_select_own" on "public"."order_items" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.user_id = auth.uid())))));
drop policy if exists "orders_admin_all" on "public"."orders";
create policy "orders_admin_all" on "public"."orders" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "orders_select_own" on "public"."orders";
create policy "orders_select_own" on "public"."orders" as permissive for select to "authenticated" using ((auth.uid() = user_id));
drop policy if exists "ps_admin" on "public"."packaging_specs";
create policy "ps_admin" on "public"."packaging_specs" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "ps_leitura" on "public"."packaging_specs";
create policy "ps_leitura" on "public"."packaging_specs" as permissive for select to "anon", "authenticated" using (true);
drop policy if exists "pr_admin" on "public"."payment_refunds";
create policy "pr_admin" on "public"."payment_refunds" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "popup_admin_all" on "public"."popup_settings";
create policy "popup_admin_all" on "public"."popup_settings" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "popup_public_read" on "public"."popup_settings";
create policy "popup_public_read" on "public"."popup_settings" as permissive for select to public using (true);
drop policy if exists "Admins manage price_lists" on "public"."price_lists";
create policy "Admins manage price_lists" on "public"."price_lists" as permissive for all to public using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true)))));
drop policy if exists "Reps read price_lists" on "public"."price_lists";
create policy "Reps read price_lists" on "public"."price_lists" as permissive for select to public using (((my_rep_id() IS NOT NULL) OR is_admin()));
drop policy if exists "price_lists_ger_sel" on "public"."price_lists";
create policy "price_lists_ger_sel" on "public"."price_lists" as permissive for select to "authenticated" using (has_role('gerente_comercial'::text));
drop policy if exists "Admin full access" on "public"."products";
create policy "Admin full access" on "public"."products" as permissive for all to public using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true)))));
drop policy if exists "Public can view products" on "public"."products";
create policy "Public can view products" on "public"."products" as permissive for select to public using (true);
drop policy if exists "promo_banners_admin_all" on "public"."promo_banners";
create policy "promo_banners_admin_all" on "public"."promo_banners" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "promo_banners_public_read" on "public"."promo_banners";
create policy "promo_banners_public_read" on "public"."promo_banners" as permissive for select to public using ((active = true));
drop policy if exists "paudit_insert" on "public"."promoter_audit_log";
create policy "paudit_insert" on "public"."promoter_audit_log" as permissive for insert to "authenticated" with check ((actor_user_id = auth.uid()));
drop policy if exists "paudit_select" on "public"."promoter_audit_log";
create policy "paudit_select" on "public"."promoter_audit_log" as permissive for select to "authenticated" using ((is_admin() OR has_role('supervisor'::text)));
drop policy if exists "pmix_admin_all" on "public"."promoter_client_mix";
create policy "pmix_admin_all" on "public"."promoter_client_mix" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "pmix_supervisor_select" on "public"."promoter_client_mix";
create policy "pmix_supervisor_select" on "public"."promoter_client_mix" as permissive for select to "authenticated" using (has_role('supervisor'::text, company_id));
drop policy if exists "promoter_client_mix_sup_all" on "public"."promoter_client_mix";
create policy "promoter_client_mix_sup_all" on "public"."promoter_client_mix" as permissive for all to "authenticated" using (has_role('supervisor'::text)) with check (has_role('supervisor'::text));
drop policy if exists "promoter_clients_admin_write" on "public"."promoter_clients";
create policy "promoter_clients_admin_write" on "public"."promoter_clients" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "promoter_clients_select" on "public"."promoter_clients";
create policy "promoter_clients_select" on "public"."promoter_clients" as permissive for select to "authenticated" using (((promoter_id = my_promoter_id()) OR is_admin() OR has_role('supervisor'::text, company_id)));
drop policy if exists "promoter_clients_sup_all" on "public"."promoter_clients";
create policy "promoter_clients_sup_all" on "public"."promoter_clients" as permissive for all to "authenticated" using (has_role('supervisor'::text)) with check (has_role('supervisor'::text));
drop policy if exists "pinc_promoter_insert" on "public"."promoter_incidents";
create policy "pinc_promoter_insert" on "public"."promoter_incidents" as permissive for insert to "authenticated" with check ((promoter_id = my_promoter_id()));
drop policy if exists "pinc_rep_select" on "public"."promoter_incidents";
create policy "pinc_rep_select" on "public"."promoter_incidents" as permissive for select to "authenticated" using (((assigned_representative_id = my_rep_id()) OR is_admin() OR has_role('supervisor'::text, company_id)));
drop policy if exists "pinc_rep_update" on "public"."promoter_incidents";
create policy "pinc_rep_update" on "public"."promoter_incidents" as permissive for update to "authenticated" using (((assigned_representative_id = my_rep_id()) OR is_admin())) with check (((assigned_representative_id = my_rep_id()) OR is_admin()));
drop policy if exists "promoter_incidents_sup_all" on "public"."promoter_incidents";
create policy "promoter_incidents_sup_all" on "public"."promoter_incidents" as permissive for all to "authenticated" using (has_role('supervisor'::text)) with check (has_role('supervisor'::text));
drop policy if exists "promoter_routes_sup_all" on "public"."promoter_routes";
create policy "promoter_routes_sup_all" on "public"."promoter_routes" as permissive for all to "authenticated" using (has_role('supervisor'::text)) with check (has_role('supervisor'::text));
drop policy if exists "proutes_admin_all" on "public"."promoter_routes";
create policy "proutes_admin_all" on "public"."promoter_routes" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "proutes_promoter_select" on "public"."promoter_routes";
create policy "proutes_promoter_select" on "public"."promoter_routes" as permissive for select to "authenticated" using (((promoter_id = my_promoter_id()) OR is_admin() OR has_role('supervisor'::text, company_id)));
drop policy if exists "proutes_promoter_update" on "public"."promoter_routes";
create policy "proutes_promoter_update" on "public"."promoter_routes" as permissive for update to "authenticated" using ((promoter_id = my_promoter_id())) with check ((promoter_id = my_promoter_id()));
drop policy if exists "paud_admin_all" on "public"."promoter_visit_audits";
create policy "paud_admin_all" on "public"."promoter_visit_audits" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "paud_insert" on "public"."promoter_visit_audits";
create policy "paud_insert" on "public"."promoter_visit_audits" as permissive for insert to "authenticated" with check ((EXISTS ( SELECT 1
   FROM promoter_visits v
  WHERE ((v.id = promoter_visit_audits.visit_id) AND (v.promoter_id = my_promoter_id())))));
drop policy if exists "paud_select" on "public"."promoter_visit_audits";
create policy "paud_select" on "public"."promoter_visit_audits" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM promoter_visits v
  WHERE ((v.id = promoter_visit_audits.visit_id) AND ((v.promoter_id = my_promoter_id()) OR is_admin() OR has_role('supervisor'::text, v.company_id))))));
drop policy if exists "paud_update" on "public"."promoter_visit_audits";
create policy "paud_update" on "public"."promoter_visit_audits" as permissive for update to "authenticated" using ((EXISTS ( SELECT 1
   FROM promoter_visits v
  WHERE ((v.id = promoter_visit_audits.visit_id) AND (v.promoter_id = my_promoter_id()))))) with check ((EXISTS ( SELECT 1
   FROM promoter_visits v
  WHERE ((v.id = promoter_visit_audits.visit_id) AND (v.promoter_id = my_promoter_id())))));
drop policy if exists "promoter_visit_audits_sup_sel" on "public"."promoter_visit_audits";
create policy "promoter_visit_audits_sup_sel" on "public"."promoter_visit_audits" as permissive for select to "authenticated" using (has_role('supervisor'::text));
drop policy if exists "plocs_admin_all" on "public"."promoter_visit_locations";
create policy "plocs_admin_all" on "public"."promoter_visit_locations" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "plocs_insert" on "public"."promoter_visit_locations";
create policy "plocs_insert" on "public"."promoter_visit_locations" as permissive for insert to "authenticated" with check ((EXISTS ( SELECT 1
   FROM promoter_visits v
  WHERE ((v.id = promoter_visit_locations.visit_id) AND (v.promoter_id = my_promoter_id())))));
drop policy if exists "plocs_select" on "public"."promoter_visit_locations";
create policy "plocs_select" on "public"."promoter_visit_locations" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM promoter_visits v
  WHERE ((v.id = promoter_visit_locations.visit_id) AND ((v.promoter_id = my_promoter_id()) OR is_admin() OR has_role('supervisor'::text, v.company_id))))));
drop policy if exists "pphotos_admin_all" on "public"."promoter_visit_photos";
create policy "pphotos_admin_all" on "public"."promoter_visit_photos" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "pphotos_insert" on "public"."promoter_visit_photos";
create policy "pphotos_insert" on "public"."promoter_visit_photos" as permissive for insert to "authenticated" with check ((EXISTS ( SELECT 1
   FROM promoter_visits v
  WHERE ((v.id = promoter_visit_photos.visit_id) AND (v.promoter_id = my_promoter_id())))));
drop policy if exists "pphotos_rep_select" on "public"."promoter_visit_photos";
create policy "pphotos_rep_select" on "public"."promoter_visit_photos" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM (promoter_visits v
     JOIN representative_clients c ON ((c.id = v.representative_client_id)))
  WHERE ((v.id = promoter_visit_photos.visit_id) AND (c.representative_id = my_rep_id())))));
drop policy if exists "pphotos_select" on "public"."promoter_visit_photos";
create policy "pphotos_select" on "public"."promoter_visit_photos" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM promoter_visits v
  WHERE ((v.id = promoter_visit_photos.visit_id) AND ((v.promoter_id = my_promoter_id()) OR is_admin() OR has_role('supervisor'::text, v.company_id))))));
drop policy if exists "promoter_visit_photos_sup_sel" on "public"."promoter_visit_photos";
create policy "promoter_visit_photos_sup_sel" on "public"."promoter_visit_photos" as permissive for select to "authenticated" using (has_role('supervisor'::text));
drop policy if exists "promoter_visits_sup_all" on "public"."promoter_visits";
create policy "promoter_visits_sup_all" on "public"."promoter_visits" as permissive for all to "authenticated" using (has_role('supervisor'::text)) with check (has_role('supervisor'::text));
drop policy if exists "pvisits_admin_all" on "public"."promoter_visits";
create policy "pvisits_admin_all" on "public"."promoter_visits" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "pvisits_promoter_insert" on "public"."promoter_visits";
create policy "pvisits_promoter_insert" on "public"."promoter_visits" as permissive for insert to "authenticated" with check ((promoter_id = my_promoter_id()));
drop policy if exists "pvisits_promoter_select" on "public"."promoter_visits";
create policy "pvisits_promoter_select" on "public"."promoter_visits" as permissive for select to "authenticated" using (((promoter_id = my_promoter_id()) OR is_admin() OR has_role('supervisor'::text, company_id)));
drop policy if exists "pvisits_promoter_update" on "public"."promoter_visits";
create policy "pvisits_promoter_update" on "public"."promoter_visits" as permissive for update to "authenticated" using ((promoter_id = my_promoter_id())) with check ((promoter_id = my_promoter_id()));
drop policy if exists "pvisits_rep_select" on "public"."promoter_visits";
create policy "pvisits_rep_select" on "public"."promoter_visits" as permissive for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM representative_clients c
  WHERE ((c.id = promoter_visits.representative_client_id) AND (c.representative_id = my_rep_id())))));
drop policy if exists "promoters_admin_all" on "public"."promoters";
create policy "promoters_admin_all" on "public"."promoters" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "promoters_select" on "public"."promoters";
create policy "promoters_select" on "public"."promoters" as permissive for select to "authenticated" using (((user_id = auth.uid()) OR is_admin() OR has_role('supervisor'::text, company_id)));
drop policy if exists "promoters_self_update" on "public"."promoters";
create policy "promoters_self_update" on "public"."promoters" as permissive for update to "authenticated" using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
drop policy if exists "promoters_sup_all" on "public"."promoters";
create policy "promoters_sup_all" on "public"."promoters" as permissive for all to "authenticated" using (has_role('supervisor'::text)) with check (has_role('supervisor'::text));
drop policy if exists "Admin can do everything on prospect_leads" on "public"."prospect_leads";
create policy "Admin can do everything on prospect_leads" on "public"."prospect_leads" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "RepCo can update assigned prospect_leads" on "public"."prospect_leads";
create policy "RepCo can update assigned prospect_leads" on "public"."prospect_leads" as permissive for update to "authenticated" using (((representative_id = my_rep_id()) OR (prospect_list_id IN ( SELECT prospect_lists.id
   FROM prospect_lists
  WHERE (prospect_lists.assigned_representative_id = my_rep_id()))))) with check (((representative_id = my_rep_id()) OR (prospect_list_id IN ( SELECT prospect_lists.id
   FROM prospect_lists
  WHERE (prospect_lists.assigned_representative_id = my_rep_id())))));
drop policy if exists "RepCo can view assigned prospect_leads" on "public"."prospect_leads";
create policy "RepCo can view assigned prospect_leads" on "public"."prospect_leads" as permissive for select to "authenticated" using (((representative_id = my_rep_id()) OR (prospect_list_id IN ( SELECT prospect_lists.id
   FROM prospect_lists
  WHERE (prospect_lists.assigned_representative_id = my_rep_id())))));
drop policy if exists "prospect_leads_ger_all" on "public"."prospect_leads";
create policy "prospect_leads_ger_all" on "public"."prospect_leads" as permissive for all to "authenticated" using (has_role('gerente_comercial'::text)) with check (has_role('gerente_comercial'::text));
drop policy if exists "Admin can do everything on prospect_lists" on "public"."prospect_lists";
create policy "Admin can do everything on prospect_lists" on "public"."prospect_lists" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "RepCo can view assigned prospect_lists" on "public"."prospect_lists";
create policy "RepCo can view assigned prospect_lists" on "public"."prospect_lists" as permissive for select to "authenticated" using ((assigned_representative_id = my_rep_id()));
drop policy if exists "prospect_lists_ger_all" on "public"."prospect_lists";
create policy "prospect_lists_ger_all" on "public"."prospect_lists" as permissive for all to "authenticated" using (has_role('gerente_comercial'::text)) with check (has_role('gerente_comercial'::text));
drop policy if exists "Admin all on prospect_runs" on "public"."prospect_runs";
create policy "Admin all on prospect_runs" on "public"."prospect_runs" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "Admin all on prospects_b2b" on "public"."prospects_b2b";
create policy "Admin all on prospects_b2b" on "public"."prospects_b2b" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "rep_daily_plans_admin" on "public"."rep_daily_plans";
create policy "rep_daily_plans_admin" on "public"."rep_daily_plans" as permissive for all to "authenticated" using (is_admin());
drop policy if exists "rep_daily_plans_own" on "public"."rep_daily_plans";
create policy "rep_daily_plans_own" on "public"."rep_daily_plans" as permissive for all to public using ((representative_id = my_rep_id())) with check ((representative_id = my_rep_id()));
drop policy if exists "help_admin_write" on "public"."repco_help_articles";
create policy "help_admin_write" on "public"."repco_help_articles" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "help_read" on "public"."repco_help_articles";
create policy "help_read" on "public"."repco_help_articles" as permissive for select to "authenticated" using (true);
drop policy if exists "repco_invite_codes_ger_all" on "public"."repco_invite_codes";
create policy "repco_invite_codes_ger_all" on "public"."repco_invite_codes" as permissive for all to "authenticated" using (has_role('gerente_comercial'::text)) with check (has_role('gerente_comercial'::text));
drop policy if exists "repco_invite_codes_sup_all" on "public"."repco_invite_codes";
create policy "repco_invite_codes_sup_all" on "public"."repco_invite_codes" as permissive for all to "authenticated" using (has_role('supervisor'::text)) with check (has_role('supervisor'::text));
drop policy if exists "Admin can do everything on rep_clients" on "public"."representative_clients";
create policy "Admin can do everything on rep_clients" on "public"."representative_clients" as permissive for all to public using (is_admin());
drop policy if exists "RepCo can delete own clients without orders" on "public"."representative_clients";
create policy "RepCo can delete own clients without orders" on "public"."representative_clients" as permissive for delete to "authenticated" using (((representative_id = my_rep_id()) AND (NOT (EXISTS ( SELECT 1
   FROM representative_orders ro
  WHERE (ro.representative_client_id = representative_clients.id))))));
drop policy if exists "RepCo can insert own clients" on "public"."representative_clients";
create policy "RepCo can insert own clients" on "public"."representative_clients" as permissive for insert to public with check ((representative_id = my_rep_id()));
drop policy if exists "RepCo can view own clients" on "public"."representative_clients";
create policy "RepCo can view own clients" on "public"."representative_clients" as permissive for select to public using ((representative_id = my_rep_id()));
drop policy if exists "representative_clients_cont_sel" on "public"."representative_clients";
create policy "representative_clients_cont_sel" on "public"."representative_clients" as permissive for select to "authenticated" using (has_role('contabilidade'::text));
drop policy if exists "representative_clients_ger_all" on "public"."representative_clients";
create policy "representative_clients_ger_all" on "public"."representative_clients" as permissive for all to "authenticated" using (has_role('gerente_comercial'::text)) with check (has_role('gerente_comercial'::text));
drop policy if exists "representative_clients_sup_sel" on "public"."representative_clients";
create policy "representative_clients_sup_sel" on "public"."representative_clients" as permissive for select to "authenticated" using (has_role('supervisor'::text));
drop policy if exists "rcp_admin_all" on "public"."representative_commission_payouts";
create policy "rcp_admin_all" on "public"."representative_commission_payouts" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "rcp_rep_select" on "public"."representative_commission_payouts";
create policy "rcp_rep_select" on "public"."representative_commission_payouts" as permissive for select to public using ((representative_id = my_rep_id()));
drop policy if exists "representative_commission_payouts_cont_all" on "public"."representative_commission_payouts";
create policy "representative_commission_payouts_cont_all" on "public"."representative_commission_payouts" as permissive for all to "authenticated" using (has_role('contabilidade'::text)) with check (has_role('contabilidade'::text));
drop policy if exists "Admin can do everything on rep_commissions" on "public"."representative_commissions";
create policy "Admin can do everything on rep_commissions" on "public"."representative_commissions" as permissive for all to public using (is_admin());
drop policy if exists "RepCo can view own commissions" on "public"."representative_commissions";
create policy "RepCo can view own commissions" on "public"."representative_commissions" as permissive for select to public using ((representative_id = my_rep_id()));
drop policy if exists "representative_commissions_cont_all" on "public"."representative_commissions";
create policy "representative_commissions_cont_all" on "public"."representative_commissions" as permissive for all to "authenticated" using (has_role('contabilidade'::text)) with check (has_role('contabilidade'::text));
drop policy if exists "representative_commissions_ger_sel" on "public"."representative_commissions";
create policy "representative_commissions_ger_sel" on "public"."representative_commissions" as permissive for select to "authenticated" using (has_role('gerente_comercial'::text));
drop policy if exists "Admin can do everything on rep_documents" on "public"."representative_documents";
create policy "Admin can do everything on rep_documents" on "public"."representative_documents" as permissive for all to public using (is_admin());
drop policy if exists "RepCo can upload own documents" on "public"."representative_documents";
create policy "RepCo can upload own documents" on "public"."representative_documents" as permissive for insert to public with check ((representative_id = my_rep_id()));
drop policy if exists "RepCo can view own documents" on "public"."representative_documents";
create policy "RepCo can view own documents" on "public"."representative_documents" as permissive for select to public using ((representative_id = my_rep_id()));
drop policy if exists "representative_order_installments_cont_all" on "public"."representative_order_installments";
create policy "representative_order_installments_cont_all" on "public"."representative_order_installments" as permissive for all to "authenticated" using (has_role('contabilidade'::text)) with check (has_role('contabilidade'::text));
drop policy if exists "representative_order_installments_ger_sel" on "public"."representative_order_installments";
create policy "representative_order_installments_ger_sel" on "public"."representative_order_installments" as permissive for select to "authenticated" using (has_role('gerente_comercial'::text));
drop policy if exists "roi_all" on "public"."representative_order_installments";
create policy "roi_all" on "public"."representative_order_installments" as permissive for all to public using ((EXISTS ( SELECT 1
   FROM representative_orders o
  WHERE (o.id = representative_order_installments.order_id)))) with check ((EXISTS ( SELECT 1
   FROM representative_orders o
  WHERE (o.id = representative_order_installments.order_id))));
drop policy if exists "representative_order_items_ger_all" on "public"."representative_order_items";
create policy "representative_order_items_ger_all" on "public"."representative_order_items" as permissive for all to "authenticated" using (has_role('gerente_comercial'::text)) with check (has_role('gerente_comercial'::text));
drop policy if exists "roi_items_admin_all" on "public"."representative_order_items";
create policy "roi_items_admin_all" on "public"."representative_order_items" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "roi_items_rep_insert" on "public"."representative_order_items";
create policy "roi_items_rep_insert" on "public"."representative_order_items" as permissive for insert to public with check ((representative_id = my_rep_id()));
drop policy if exists "roi_items_rep_select" on "public"."representative_order_items";
create policy "roi_items_rep_select" on "public"."representative_order_items" as permissive for select to public using ((representative_id = my_rep_id()));
drop policy if exists "ron_insert" on "public"."representative_order_notes";
create policy "ron_insert" on "public"."representative_order_notes" as permissive for insert to public with check ((is_admin() OR (EXISTS ( SELECT 1
   FROM representative_orders o
  WHERE ((o.id = representative_order_notes.order_id) AND (o.representative_id = my_rep_id()))))));
drop policy if exists "ron_select" on "public"."representative_order_notes";
create policy "ron_select" on "public"."representative_order_notes" as permissive for select to public using ((is_admin() OR (EXISTS ( SELECT 1
   FROM representative_orders o
  WHERE ((o.id = representative_order_notes.order_id) AND (o.representative_id = my_rep_id()))))));
drop policy if exists "Admin can do everything on rep_orders" on "public"."representative_orders";
create policy "Admin can do everything on rep_orders" on "public"."representative_orders" as permissive for all to public using (is_admin());
drop policy if exists "RepCo can view own orders" on "public"."representative_orders";
create policy "RepCo can view own orders" on "public"."representative_orders" as permissive for select to public using ((representative_id = my_rep_id()));
drop policy if exists "representative_orders_cont_sel" on "public"."representative_orders";
create policy "representative_orders_cont_sel" on "public"."representative_orders" as permissive for select to "authenticated" using (has_role('contabilidade'::text));
drop policy if exists "representative_orders_ger_all" on "public"."representative_orders";
create policy "representative_orders_ger_all" on "public"."representative_orders" as permissive for all to "authenticated" using (has_role('gerente_comercial'::text)) with check (has_role('gerente_comercial'::text));
drop policy if exists "Admin full access on routes" on "public"."representative_routes";
create policy "Admin full access on routes" on "public"."representative_routes" as permissive for all to "authenticated" using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true)))));
drop policy if exists "RepCo reads own routes" on "public"."representative_routes";
create policy "RepCo reads own routes" on "public"."representative_routes" as permissive for select to "authenticated" using ((representative_id IN ( SELECT representatives.id
   FROM representatives
  WHERE (representatives.user_id = auth.uid()))));
drop policy if exists "Admin can do everything on representatives" on "public"."representatives";
create policy "Admin can do everything on representatives" on "public"."representatives" as permissive for all to public using (is_admin());
drop policy if exists "Anyone authenticated can insert own registration" on "public"."representatives";
create policy "Anyone authenticated can insert own registration" on "public"."representatives" as permissive for insert to public with check ((user_id = auth.uid()));
drop policy if exists "Rep updates own presence" on "public"."representatives";
create policy "Rep updates own presence" on "public"."representatives" as permissive for update to "authenticated" using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
drop policy if exists "RepCo can update own record" on "public"."representatives";
create policy "RepCo can update own record" on "public"."representatives" as permissive for update to public using ((user_id = auth.uid()));
drop policy if exists "RepCo can view own record" on "public"."representatives";
create policy "RepCo can view own record" on "public"."representatives" as permissive for select to public using ((user_id = auth.uid()));
drop policy if exists "representatives_cont_sel" on "public"."representatives";
create policy "representatives_cont_sel" on "public"."representatives" as permissive for select to "authenticated" using (has_role('contabilidade'::text));
drop policy if exists "representatives_ger_all" on "public"."representatives";
create policy "representatives_ger_all" on "public"."representatives" as permissive for all to "authenticated" using (has_role('gerente_comercial'::text)) with check (has_role('gerente_comercial'::text));
drop policy if exists "representatives_sup_sel" on "public"."representatives";
create policy "representatives_sup_sel" on "public"."representatives" as permissive for select to "authenticated" using (has_role('supervisor'::text));
drop policy if exists "Admin roasting_companies" on "public"."roasting_companies";
create policy "Admin roasting_companies" on "public"."roasting_companies" as permissive for all to public using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true)))));
drop policy if exists "Admin contacts" on "public"."roasting_company_contacts";
create policy "Admin contacts" on "public"."roasting_company_contacts" as permissive for all to public using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true)))));
drop policy if exists "roles_admin_write" on "public"."roles";
create policy "roles_admin_write" on "public"."roles" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "roles_select" on "public"."roles";
create policy "roles_select" on "public"."roles" as permissive for select to "authenticated" using (true);
drop policy if exists "Admin full access on route_stops" on "public"."route_stops";
create policy "Admin full access on route_stops" on "public"."route_stops" as permissive for all to "authenticated" using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true)))));
drop policy if exists "RepCo reads and updates own route stops" on "public"."route_stops";
create policy "RepCo reads and updates own route stops" on "public"."route_stops" as permissive for all to "authenticated" using ((route_id IN ( SELECT r.id
   FROM (representative_routes r
     JOIN representatives rep ON ((rep.id = r.representative_id)))
  WHERE (rep.user_id = auth.uid()))));
drop policy if exists "Service role can manage shipments" on "public"."shipments";
create policy "Service role can manage shipments" on "public"."shipments" as permissive for all to public using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));
drop policy if exists "Users can view own shipments" on "public"."shipments";
create policy "Users can view own shipments" on "public"."shipments" as permissive for select to public using ((order_id IN ( SELECT orders.id
   FROM orders
  WHERE (orders.user_id = auth.uid()))));
drop policy if exists "admin all shipments" on "public"."shipments";
create policy "admin all shipments" on "public"."shipments" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "admin all carriers" on "public"."shipping_carriers";
create policy "admin all carriers" on "public"."shipping_carriers" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "public read carriers" on "public"."shipping_carriers";
create policy "public read carriers" on "public"."shipping_carriers" as permissive for select to public using (true);
drop policy if exists "shipping_coverage_admin" on "public"."shipping_coverage";
create policy "shipping_coverage_admin" on "public"."shipping_coverage" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "shipping_coverage_leitura" on "public"."shipping_coverage";
create policy "shipping_coverage_leitura" on "public"."shipping_coverage" as permissive for select to "anon", "authenticated" using (true);
drop policy if exists "sq_admin" on "public"."shipping_quotes";
create policy "sq_admin" on "public"."shipping_quotes" as permissive for select to "authenticated" using (is_admin());
drop policy if exists "shipping_rate_tables_admin" on "public"."shipping_rate_tables";
create policy "shipping_rate_tables_admin" on "public"."shipping_rate_tables" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "shipping_rate_tables_leitura" on "public"."shipping_rate_tables";
create policy "shipping_rate_tables_leitura" on "public"."shipping_rate_tables" as permissive for select to "anon", "authenticated" using (true);
drop policy if exists "shipping_rates_admin" on "public"."shipping_rates";
create policy "shipping_rates_admin" on "public"."shipping_rates" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "shipping_rates_leitura" on "public"."shipping_rates";
create policy "shipping_rates_leitura" on "public"."shipping_rates" as permissive for select to "anon", "authenticated" using (true);
drop policy if exists "site_settings_read" on "public"."site_settings";
create policy "site_settings_read" on "public"."site_settings" as permissive for select to public using (true);
drop policy if exists "site_settings_write" on "public"."site_settings";
create policy "site_settings_write" on "public"."site_settings" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "site_visits_insert_any" on "public"."site_visits";
create policy "site_visits_insert_any" on "public"."site_visits" as permissive for insert to public with check (true);
drop policy if exists "site_visits_select_admin" on "public"."site_visits";
create policy "site_visits_select_admin" on "public"."site_visits" as permissive for select to public using (is_admin());
drop policy if exists "sm_admin_all" on "public"."stock_movements";
create policy "sm_admin_all" on "public"."stock_movements" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "sm_rep_own" on "public"."stock_movements";
create policy "sm_rep_own" on "public"."stock_movements" as permissive for select to "authenticated" using (((reference_type = 'representative_order'::text) AND (EXISTS ( SELECT 1
   FROM representative_orders o
  WHERE ((o.id = stock_movements.reference_id) AND (o.representative_id = my_rep_id()))))));
drop policy if exists "scl_admin" on "public"."storage_cleanup_log";
create policy "scl_admin" on "public"."storage_cleanup_log" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "studio_analyses_admin_all" on "public"."studio_analyses";
create policy "studio_analyses_admin_all" on "public"."studio_analyses" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "studio_analyses_tenant" on "public"."studio_analyses";
create policy "studio_analyses_tenant" on "public"."studio_analyses" as permissive for all to "authenticated" using ((is_admin() OR (organization_id = ANY (my_studio_orgs())))) with check ((is_admin() OR (organization_id = ANY (my_studio_orgs()))));
drop policy if exists "sbp_admin_all" on "public"."studio_brand_profiles";
create policy "sbp_admin_all" on "public"."studio_brand_profiles" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "studio_brand_profiles_tenant" on "public"."studio_brand_profiles";
create policy "studio_brand_profiles_tenant" on "public"."studio_brand_profiles" as permissive for all to "authenticated" using ((is_admin() OR (organization_id = ANY (my_studio_orgs())))) with check ((is_admin() OR (organization_id = ANY (my_studio_orgs()))));
drop policy if exists "studio_campaigns_admin_all" on "public"."studio_campaigns";
create policy "studio_campaigns_admin_all" on "public"."studio_campaigns" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "studio_campaigns_tenant" on "public"."studio_campaigns";
create policy "studio_campaigns_tenant" on "public"."studio_campaigns" as permissive for all to "authenticated" using ((is_admin() OR (organization_id = ANY (my_studio_orgs())))) with check ((is_admin() OR (organization_id = ANY (my_studio_orgs()))));
drop policy if exists "studio_fingerprints_admin" on "public"."studio_content_fingerprints";
create policy "studio_fingerprints_admin" on "public"."studio_content_fingerprints" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "studio_gen_admin" on "public"."studio_generations";
create policy "studio_gen_admin" on "public"."studio_generations" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "studio_generations_tenant" on "public"."studio_generations";
create policy "studio_generations_tenant" on "public"."studio_generations" as permissive for all to "authenticated" using ((is_admin() OR (organization_id = ANY (my_studio_orgs())))) with check ((is_admin() OR (organization_id = ANY (my_studio_orgs()))));
drop policy if exists "studio_membros_admin" on "public"."studio_members";
create policy "studio_membros_admin" on "public"."studio_members" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "studio_membros_leitura" on "public"."studio_members";
create policy "studio_membros_leitura" on "public"."studio_members" as permissive for select to "authenticated" using ((is_admin() OR (organization_id = ANY (my_studio_orgs()))));
drop policy if exists "studio_org_membro" on "public"."studio_organizations";
create policy "studio_org_membro" on "public"."studio_organizations" as permissive for all to "authenticated" using ((is_admin() OR (id = ANY (my_studio_orgs())))) with check ((is_admin() OR (id = ANY (my_studio_orgs()))));
drop policy if exists "studio_snap_admin" on "public"."studio_profile_snapshots";
create policy "studio_snap_admin" on "public"."studio_profile_snapshots" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "studio_ref_assets_tenant" on "public"."studio_reference_assets";
create policy "studio_ref_assets_tenant" on "public"."studio_reference_assets" as permissive for all to "authenticated" using ((is_admin() OR (organization_id = ANY (my_studio_orgs())))) with check ((is_admin() OR (organization_id = ANY (my_studio_orgs()))));
drop policy if exists "ssc_admin_all" on "public"."studio_social_connections";
create policy "ssc_admin_all" on "public"."studio_social_connections" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "studio_social_connections_tenant" on "public"."studio_social_connections";
create policy "studio_social_connections_tenant" on "public"."studio_social_connections" as permissive for all to "authenticated" using ((is_admin() OR (organization_id = ANY (my_studio_orgs())))) with check ((is_admin() OR (organization_id = ANY (my_studio_orgs()))));
drop policy if exists "studio_transcriptions_admin_all" on "public"."studio_transcriptions";
create policy "studio_transcriptions_admin_all" on "public"."studio_transcriptions" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "studio_transcriptions_tenant" on "public"."studio_transcriptions";
create policy "studio_transcriptions_tenant" on "public"."studio_transcriptions" as permissive for all to "authenticated" using ((is_admin() OR (organization_id = ANY (my_studio_orgs())))) with check ((is_admin() OR (organization_id = ANY (my_studio_orgs()))));
drop policy if exists "studio_videos_admin_all" on "public"."studio_videos";
create policy "studio_videos_admin_all" on "public"."studio_videos" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "studio_videos_tenant" on "public"."studio_videos";
create policy "studio_videos_tenant" on "public"."studio_videos" as permissive for all to "authenticated" using ((is_admin() OR (organization_id = ANY (my_studio_orgs())))) with check ((is_admin() OR (organization_id = ANY (my_studio_orgs()))));
drop policy if exists "subsettings_admin_all" on "public"."subscription_settings";
create policy "subsettings_admin_all" on "public"."subscription_settings" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "subsettings_public_read" on "public"."subscription_settings";
create policy "subsettings_public_read" on "public"."subscription_settings" as permissive for select to public using (true);
drop policy if exists "subs_admin_all" on "public"."subscriptions";
create policy "subs_admin_all" on "public"."subscriptions" as permissive for all to public using (is_admin()) with check (is_admin());
drop policy if exists "subs_insert_own" on "public"."subscriptions";
create policy "subs_insert_own" on "public"."subscriptions" as permissive for insert to public with check ((auth.uid() = user_id));
drop policy if exists "subs_select_own_or_admin" on "public"."subscriptions";
create policy "subs_select_own_or_admin" on "public"."subscriptions" as permissive for select to public using (((auth.uid() = user_id) OR is_admin()));
drop policy if exists "sf_admin" on "public"."superfrete_settings";
create policy "sf_admin" on "public"."superfrete_settings" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "tr_admin" on "public"."telegram_recipients";
create policy "tr_admin" on "public"."telegram_recipients" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "Users can delete own addresses" on "public"."user_addresses";
create policy "Users can delete own addresses" on "public"."user_addresses" as permissive for delete to "authenticated" using ((auth.uid() = user_id));
drop policy if exists "Users can insert own addresses" on "public"."user_addresses";
create policy "Users can insert own addresses" on "public"."user_addresses" as permissive for insert to "authenticated" with check ((auth.uid() = user_id));
drop policy if exists "Users can update own addresses" on "public"."user_addresses";
create policy "Users can update own addresses" on "public"."user_addresses" as permissive for update to "authenticated" using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
drop policy if exists "Users can view own addresses" on "public"."user_addresses";
create policy "Users can view own addresses" on "public"."user_addresses" as permissive for select to "authenticated" using ((auth.uid() = user_id));
drop policy if exists "ua_own_delete" on "public"."user_addresses";
create policy "ua_own_delete" on "public"."user_addresses" as permissive for delete to "authenticated" using ((auth.uid() = user_id));
drop policy if exists "ua_own_insert" on "public"."user_addresses";
create policy "ua_own_insert" on "public"."user_addresses" as permissive for insert to "authenticated" with check ((auth.uid() = user_id));
drop policy if exists "ua_own_select" on "public"."user_addresses";
create policy "ua_own_select" on "public"."user_addresses" as permissive for select to "authenticated" using (((auth.uid() = user_id) OR is_admin()));
drop policy if exists "ua_own_update" on "public"."user_addresses";
create policy "ua_own_update" on "public"."user_addresses" as permissive for update to "authenticated" using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
drop policy if exists "Users fully manage profile" on "public"."user_profiles";
create policy "Users fully manage profile" on "public"."user_profiles" as permissive for all to "authenticated" using ((auth.uid() = id));
drop policy if exists "user_roles_admin_write" on "public"."user_roles";
create policy "user_roles_admin_write" on "public"."user_roles" as permissive for all to "authenticated" using (is_admin()) with check (is_admin());
drop policy if exists "user_roles_select_own" on "public"."user_roles";
create policy "user_roles_select_own" on "public"."user_roles" as permissive for select to "authenticated" using (((user_id = auth.uid()) OR is_admin()));
drop policy if exists "Admin can access all rep docs in storage" on "storage"."objects";
create policy "Admin can access all rep docs in storage" on "storage"."objects" as permissive for all to public using (((bucket_id = 'representative-docs'::text) AND is_admin()));
drop policy if exists "RepCo can upload own docs to storage" on "storage"."objects";
create policy "RepCo can upload own docs to storage" on "storage"."objects" as permissive for insert to public with check (((bucket_id = 'representative-docs'::text) AND (auth.uid() IS NOT NULL) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "RepCo can view own docs in storage" on "storage"."objects";
create policy "RepCo can view own docs in storage" on "storage"."objects" as permissive for select to public using (((bucket_id = 'representative-docs'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "st_batch_photos_admin_delete" on "storage"."objects";
create policy "st_batch_photos_admin_delete" on "storage"."objects" as permissive for delete to "authenticated" using (((bucket_id = 'batch-photos'::text) AND is_admin()));
drop policy if exists "st_batch_photos_admin_update" on "storage"."objects";
create policy "st_batch_photos_admin_update" on "storage"."objects" as permissive for update to "authenticated" using (((bucket_id = 'batch-photos'::text) AND is_admin()));
drop policy if exists "st_batch_photos_admin_write" on "storage"."objects";
create policy "st_batch_photos_admin_write" on "storage"."objects" as permissive for insert to "authenticated" with check (((bucket_id = 'batch-photos'::text) AND is_admin()));
drop policy if exists "st_batch_photos_public_read" on "storage"."objects";
create policy "st_batch_photos_public_read" on "storage"."objects" as permissive for select to public using ((bucket_id = 'batch-photos'::text));
drop policy if exists "st_carrier_logos_admin_delete" on "storage"."objects";
create policy "st_carrier_logos_admin_delete" on "storage"."objects" as permissive for delete to "authenticated" using (((bucket_id = 'carrier-logos'::text) AND is_admin()));
drop policy if exists "st_carrier_logos_admin_update" on "storage"."objects";
create policy "st_carrier_logos_admin_update" on "storage"."objects" as permissive for update to "authenticated" using (((bucket_id = 'carrier-logos'::text) AND is_admin()));
drop policy if exists "st_carrier_logos_admin_write" on "storage"."objects";
create policy "st_carrier_logos_admin_write" on "storage"."objects" as permissive for insert to "authenticated" with check (((bucket_id = 'carrier-logos'::text) AND is_admin()));
drop policy if exists "st_carrier_logos_public_read" on "storage"."objects";
create policy "st_carrier_logos_public_read" on "storage"."objects" as permissive for select to public using ((bucket_id = 'carrier-logos'::text));
drop policy if exists "st_chat_media_member_insert" on "storage"."objects";
create policy "st_chat_media_member_insert" on "storage"."objects" as permissive for insert to "authenticated" with check (((bucket_id = 'chat-media'::text) AND is_chat_member(chat_media_conversation(name)) AND ((storage.foldername(name))[2] = (auth.uid())::text)));
drop policy if exists "st_chat_media_member_read" on "storage"."objects";
create policy "st_chat_media_member_read" on "storage"."objects" as permissive for select to "authenticated" using (((bucket_id = 'chat-media'::text) AND (is_admin() OR is_chat_member(chat_media_conversation(name)))));
drop policy if exists "st_chat_media_own_delete" on "storage"."objects";
create policy "st_chat_media_own_delete" on "storage"."objects" as permissive for delete to "authenticated" using (((bucket_id = 'chat-media'::text) AND (is_admin() OR ((storage.foldername(name))[2] = (auth.uid())::text))));
drop policy if exists "st_delivery_pods_admin_delete" on "storage"."objects";
create policy "st_delivery_pods_admin_delete" on "storage"."objects" as permissive for delete to "authenticated" using (((bucket_id = 'delivery-pods'::text) AND is_admin()));
drop policy if exists "st_delivery_pods_auth_insert" on "storage"."objects";
create policy "st_delivery_pods_auth_insert" on "storage"."objects" as permissive for insert to "authenticated" with check ((bucket_id = 'delivery-pods'::text));
drop policy if exists "st_delivery_pods_auth_read" on "storage"."objects";
create policy "st_delivery_pods_auth_read" on "storage"."objects" as permissive for select to "authenticated" using ((bucket_id = 'delivery-pods'::text));
drop policy if exists "st_invoices_admin_delete" on "storage"."objects";
create policy "st_invoices_admin_delete" on "storage"."objects" as permissive for delete to "authenticated" using (((bucket_id = 'invoices'::text) AND is_admin()));
drop policy if exists "st_invoices_admin_update" on "storage"."objects";
create policy "st_invoices_admin_update" on "storage"."objects" as permissive for update to "authenticated" using (((bucket_id = 'invoices'::text) AND is_admin()));
drop policy if exists "st_invoices_auth_insert" on "storage"."objects";
create policy "st_invoices_auth_insert" on "storage"."objects" as permissive for insert to "authenticated" with check ((bucket_id = 'invoices'::text));
drop policy if exists "st_invoices_owner_read" on "storage"."objects";
create policy "st_invoices_owner_read" on "storage"."objects" as permissive for select to "authenticated" using (((bucket_id = 'invoices'::text) AND can_access_invoice_file(name)));
drop policy if exists "st_lot_documents_admin_all" on "storage"."objects";
create policy "st_lot_documents_admin_all" on "storage"."objects" as permissive for all to "authenticated" using (((bucket_id = 'lot-documents'::text) AND is_admin())) with check (((bucket_id = 'lot-documents'::text) AND is_admin()));
drop policy if exists "st_offer_photos_admin_all" on "storage"."objects";
create policy "st_offer_photos_admin_all" on "storage"."objects" as permissive for all to "authenticated" using (((bucket_id = 'offer-photos'::text) AND is_admin())) with check (((bucket_id = 'offer-photos'::text) AND is_admin()));
drop policy if exists "st_offer_photos_owner_insert" on "storage"."objects";
create policy "st_offer_photos_owner_insert" on "storage"."objects" as permissive for insert to "authenticated" with check (((bucket_id = 'offer-photos'::text) AND ((storage.foldername(name))[1] IN ( SELECT (o.id)::text AS id
   FROM coffee_offers o
  WHERE (o.entity_id IN ( SELECT my_network_entity_ids() AS my_network_entity_ids))))));
drop policy if exists "st_offer_photos_owner_read" on "storage"."objects";
create policy "st_offer_photos_owner_read" on "storage"."objects" as permissive for select to "authenticated" using (((bucket_id = 'offer-photos'::text) AND ((storage.foldername(name))[1] IN ( SELECT (o.id)::text AS id
   FROM coffee_offers o
  WHERE (o.entity_id IN ( SELECT my_network_entity_ids() AS my_network_entity_ids))))));
drop policy if exists "st_product_images_admin_delete" on "storage"."objects";
create policy "st_product_images_admin_delete" on "storage"."objects" as permissive for delete to "authenticated" using (((bucket_id = 'product-images'::text) AND is_admin()));
drop policy if exists "st_product_images_admin_update" on "storage"."objects";
create policy "st_product_images_admin_update" on "storage"."objects" as permissive for update to "authenticated" using (((bucket_id = 'product-images'::text) AND is_admin()));
drop policy if exists "st_product_images_admin_write" on "storage"."objects";
create policy "st_product_images_admin_write" on "storage"."objects" as permissive for insert to "authenticated" with check (((bucket_id = 'product-images'::text) AND is_admin()));
drop policy if exists "st_product_images_public_read" on "storage"."objects";
create policy "st_product_images_public_read" on "storage"."objects" as permissive for select to public using ((bucket_id = 'product-images'::text));
drop policy if exists "st_studio_videos_admin_all" on "storage"."objects";
create policy "st_studio_videos_admin_all" on "storage"."objects" as permissive for all to "authenticated" using (((bucket_id = 'studio-videos'::text) AND is_admin())) with check (((bucket_id = 'studio-videos'::text) AND is_admin()));
drop policy if exists "st_visit_photos_admin_delete" on "storage"."objects";
create policy "st_visit_photos_admin_delete" on "storage"."objects" as permissive for delete to "authenticated" using (((bucket_id = 'visit-photos'::text) AND is_admin()));
drop policy if exists "st_visit_photos_admin_update" on "storage"."objects";
create policy "st_visit_photos_admin_update" on "storage"."objects" as permissive for update to "authenticated" using (((bucket_id = 'visit-photos'::text) AND is_admin()));
drop policy if exists "st_visit_photos_auth_insert" on "storage"."objects";
create policy "st_visit_photos_auth_insert" on "storage"."objects" as permissive for insert to "authenticated" with check ((bucket_id = 'visit-photos'::text));
drop policy if exists "st_visit_photos_auth_read" on "storage"."objects";
create policy "st_visit_photos_auth_read" on "storage"."objects" as permissive for select to "authenticated" using ((bucket_id = 'visit-photos'::text));

-- Comentários
comment on column public."ai_usage_events"."cost_usd" is 'Custo calculado a partir do usage real devolvido pela API, multiplicado pelo preco oficial do modelo. Nunca estimado.';
comment on column public."ai_usage_events"."input_image_tokens" is 'Parte dos input_tokens que veio de IMAGEM de referencia. Custa mais que texto ($8/1M contra $5/1M), e e o que responde quanto a embalagem acrescentou ao custo. Nulo = nao informado, nao zero.';
comment on column public."ai_usage_events"."input_text_tokens" is 'Parte dos input_tokens que veio de TEXTO, quando a API informa em input_tokens_details. Nulo = nao informado, nao zero.';
comment on column public."ai_usage_events"."status" is 'ok | erro. Erro depois do processamento tambem é cobrado pelo provedor e precisa entrar na conta.';
comment on table public."ai_usage_events" is 'Uma linha por chamada de API de IA: consumo, custo e a que peca pertence. Base para custo por marca, por conteudo e por cliente. Gravacao é best-effort: falha aqui nunca derruba a geracao.';
comment on table public."coffee_pilot_cases" is 'Registro do piloto real assistido: quem, quanto tempo, o que faltou e por que fechou ou nao. Base para a vitrine futura de casos, sempre com autorizacao e anonimizacao.';
comment on table public."commercial_accounts" is 'Relação comercial entre um participante da rede e UMA empresa interna. Condição comercial nunca é copiada de outra empresa.';
comment on column public."companies"."is_operator" is 'Empresa que opera logistica (COFICO). NAO impede de vender: desde 06/09/2026 a operadora tambem aparece no seletor de empresa do painel.';
comment on column public."companies"."notify_email" is 'Para quem avisar quando entra pedido pago desta empresa. Vazio = ninguem e avisado.';
comment on column public."companies"."payment_account" is 'Chave do conjunto de credenciais Mercado Pago da empresa (ex.: saporino, cofico). NULL = empresa sem meio de recebimento configurado; pedido dela e recusado no create-payment.';
comment on column public."companies"."pickup_hours" is 'Horario de retirada, em texto livre (ex.: "Segunda a sexta, 9h as 17h"). Vai no e-mail de "pronto para retirada".';
comment on column public."companies"."shipping_discount_active" is 'Liga e desliga o desconto sem mexer no valor — serve de interruptor de campanha.';
comment on column public."companies"."shipping_discount_max" is 'Teto do desconto de envio, em reais. 0 = sem teto. Existe porque a regra por quilo, em carga grande, chega a zerar o frete e a loja acaba bancando o transporte inteiro.';
comment on column public."companies"."shipping_discount_min_packs" is 'A partir de quantos pacotes o desconto vale. 1 = sempre. 10 = so no fardo.';
comment on column public."companies"."shipping_discount_unit" is 'kg = valor x peso bruto. pacote = valor x quantidade de pacotes. Muda bastante o resultado: 5 kg dao 5,095 x valor; 10 pacotes dao 10 x valor.';
comment on column public."companies"."shipping_subsidy_per_kg" is 'Valor do desconto de envio que a loja banca. A unidade vem de shipping_discount_unit: por quilo ou por pacote.';
comment on table public."coupons" is 'Cupons de desconto. ADMIN-ONLY na leitura: cupom listavel publicamente deixa de ser incentivo dirigido. A validacao publica passa por validar_cupom().';
comment on column public."discovery_results"."result_type" is 'Vocabulário aberto: BUSINESS|B2B_LEAD|SALES_REP_CANDIDATE|INDEPENDENT_SELLER|AFFILIATE|CREATOR|UGC_CREATOR|INFLUENCER|DISTRIBUTOR|PUBLIC_WHATSAPP_GROUP|PUBLIC_WHATSAPP_CHANNEL|COMMUNITY|PUBLIC_SOCIAL_PROFILE|PUBLIC_SOCIAL_POST|OTHER';
comment on table public."lot_documents" is 'Documentos de custo do lote (compra do verde, NF, pagamento de torra e embalagem). ADMIN-ONLY.';
comment on table public."lot_transfers" is 'Transferencias entre lotes com custo unitario. ADMIN-ONLY: contem custo e margem. Nunca reabrir para authenticated sem is_admin().';
comment on table public."lv_attributes" is 'Catalogo de atributos possiveis. no_passport=true significa que o campo aparece no Coffee Passport quando houver valor — e so quando houver.';
comment on table public."lv_b2b_solicitacoes" is 'Demanda de comprador profissional: o que quer, quanto e com que frequencia. Frequencia e intencao, nao cobranca recorrente. So admin le.';
comment on table public."lv_categories" is 'Arvore de categorias do Coffee LiVRE. Cobre cafe E o ecossistema ao redor: equipamentos, acessorios e insumos.';
comment on table public."lv_category_attributes" is 'Quais atributos fazem sentido em cada categoria. E o que impede um moedor de ter variedade e pontuacao.';
comment on table public."lv_demo_access" is 'Codigos de acesso da demonstracao privada do Coffee LiVRE. Guarda HASH, nunca o codigo. Barreira de conveniencia para apresentacao a convidados — NAO e autenticacao de marketplace.';
comment on column public."lv_inventory_lots"."product_id" is 'Derivado da variante pelo banco. Mantido para consulta e RLS; nunca informado a mao.';
comment on table public."lv_inventory_lots" is 'Lote fisico de uma VARIANTE no CD. qtd_disponivel ja e o vendavel; qtd_reservada fica a parte. Lote vencido nao conta. Lote demo so existe em produto demo. O vendedor so le.';
comment on table public."lv_plans" is 'Planos do vendedor. Valores em ESTUDO ate a decisao D2. Nenhuma cobranca real nesta fase: a tabela existe para a vitrine comercial e para a arquitetura.';
comment on table public."lv_price_history" is 'Toda troca de preco de produto, gravada por trigger. Vendedor le o proprio historico e nao escreve. Origem vem do contexto da transacao (lv.preco_origem).';
comment on table public."lv_price_tiers" is 'Faixas de desconto por quantidade de UM produto. min_qty >= 2 porque a faixa de 1 unidade e o proprio preco do produto. NAO representa SKU: o estoque continua unitario.';
comment on table public."lv_product_attributes" is 'Valores de atributo por produto. Linha ausente = informacao ausente, e a tela nao mostra nada no lugar.';
comment on table public."lv_product_variants" is 'Variante fisica de um produto (gramatura, moagem, embalagem, SKU/EAN). O ESTOQUE e da variante, nunca do produto. Todo produto tem exatamente uma variante padrao.';
comment on column public."lv_products"."aprovado_em" is 'Ultima aprovacao da moderacao. Edicao sensivel (titulo, categoria, queda de preco > 50%) zera. Sem aprovacao vigente, pedir "ativo" vira "em_moderacao".';
comment on column public."lv_products"."preco_cents" is 'Preco em CENTAVOS, conforme a secao 10 do RAIO-X. Valor DEMO na fase 1.';
comment on column public."lv_products"."preco_minimo_cents" is 'Piso por unidade que o vendedor nao quer furar. NAO bloqueia a venda: serve para o sistema ALERTAR quando uma faixa cai abaixo. Nulo = sem piso.';
comment on column public."lv_products"."status" is 'rascunho | em_moderacao | ativo | pausado | recusado | arquivado — vocabulario da secao 10 do RAIO-X. So "ativo" aparece na vitrine.';
comment on column public."lv_products"."venda_por_quantidade" is 'Liga a escada de quantidade na pagina do produto. Sem isto, a PDP mostra so o preco unitario.';
comment on table public."lv_products" is 'Produto do catalogo. slug e PERMANENTE: e a URL do Coffee Passport e o destino de um eventual QR impresso na embalagem. preco e DEMO nesta fase.';
comment on table public."lv_qr_codes" is 'Identificador PERMANENTE impresso em QR. Nunca carrega slug: resolve para produto, variante e (futuro) lote. Codigo nao muda nem se reaproveita.';
comment on table public."lv_seller_applications" is 'Pedido de entrada de um vendedor. NUNCA aprova sozinho: nasce em "interessado" e so o administrador move adiante.';
comment on table public."lv_seller_users" is 'Vinculo usuario do Supabase Auth <-> vendedor. Base de todo isolamento da Seller Central: vendedor A nunca alcanca dado do B.';
comment on column public."lv_sellers"."pagamento_status" is 'Habilitacao para RECEBER vendas: nao_iniciado, pendente, verificado, bloqueado. So "verificado" recebe. O vendedor le e nao altera (sem policy de escrita). Venda real exige verificado.';
comment on table public."lv_sellers" is 'Vendedor do Coffee LiVRE: a entidade que responde pelo negocio. A presenca publica dele e a loja (lv_stores). is_demo=true marca dado de demonstracao.';
comment on table public."lv_settings" is 'Configuracao da plataforma Coffee LiVRE em chave/valor. Admin-only: nada aqui e publico.';
comment on table public."lv_stores" is 'Vitrine publica de um vendedor. Um vendedor tem uma loja hoje; o esquema ja aceita varias. slug e permanente: vai para URL e pode ir para embalagem.';
comment on column public."lv_tarifas_simulacao"."modelo" is 'marketplace = comparavel na Calculadora; delivery_conveniencia = economia diferente (entrega rapida, loja de bairro, item de cesta). Nunca comparar os dois como equivalentes.';
comment on table public."lv_tarifas_simulacao" is 'Regras da Calculadora de Economia LiVRE. benchmark = regra publica de outra plataforma, com fonte e data; hipotese_livre = valor do Coffee LiVRE EM ESTUDO. Desconhecido fica NULO, nunca zero.';
comment on table public."marketing_contacts" is 'Celulares que autorizaram receber promocoes, por segmento (b2c/b2b) e empresa. Base para as campanhas. Opt-in explicito, com data e origem.';
comment on table public."marketplace_stores" is 'Nossas lojas em marketplaces. Aparecem no checkout quando o CEP nao e atendido pela entrega propria.';
comment on table public."network_audit_log" is 'Trilha de auditoria do Coffee Network: ator, ação, estado anterior e novo. Política de retenção legal ainda NÃO definida (depende de revisão jurídica).';
comment on table public."network_entities" is 'Identidade canônica de um participante do Coffee Network (pessoa ou organização). Estar aqui NÃO significa ser cliente de nenhuma empresa.';
comment on table public."order_emails" is 'O que ja foi enviado a cada cliente, por pedido. A chave unica (order_id, kind) e o que impede e-mail repetido quando o Mercado Pago reenvia a notificacao.';
comment on table public."order_items" is 'Stores individual items for each order';
comment on column public."orders"."accepts_whatsapp_promos" is 'Consentimento explicito para receber promocoes por WhatsApp. Falso por padrao: opt-in, nunca opt-out.';
comment on column public."orders"."customer_cpf" is 'CPF do comprador, so digitos. Obrigatorio para emitir nota fiscal de pessoa fisica. Guardado no pedido porque compra de visitante nao tem cadastro de onde puxar.';
comment on column public."orders"."discount_amount" is 'Desconto do cupom, ja aplicado no total_amount. Guardado a parte para a nota e para o relatorio.';
comment on column public."orders"."is_pickup" is 'Pedido retirado no local, sem transportadora e sem frete.';
comment on column public."orders"."mercadopago_payment_id" is 'Mercado Pago payment ID after successful payment';
comment on column public."orders"."mercadopago_preference_id" is 'Mercado Pago preference ID for payment';
comment on column public."orders"."mp_account_key" is 'Conjunto de credenciais efetivamente usado ao criar a preferencia (companies.payment_account).';
comment on column public."orders"."mp_collector_id" is 'collector_id devolvido pelo Mercado Pago: prova de qual conta recebeu.';
comment on column public."orders"."order_number" is 'Unique order number in format ORD-YYYYMMDD-XXXXX';
comment on column public."orders"."order_type" is 'Type of order: single purchase or subscription';
comment on column public."orders"."phone_e164" is 'Telefone em formato internacional (+55DDDNUMERO). O campo customer_phone continua com o texto digitado.';
comment on column public."orders"."ready_at" is 'Quando o pedido foi separado e ficou disponivel para retirada.';
comment on column public."orders"."seller_company_id" is 'Empresa que vende e fatura este pedido. Define a conta Mercado Pago que recebe. NAO inferir pela marca do produto.';
comment on column public."orders"."shipped_at" is 'Quando o pedido foi postado/despachado.';
comment on column public."orders"."shipping_service_id" is 'Codigo do servico no agregador (1 PAC, 2 SEDEX, 3 Jadlog, 17 Mini Envios, 31 Loggi, 33 J&T). Nulo quando o frete veio da tabela propria ou e retirada.';
comment on column public."orders"."shipping_street" is 'Logradouro. Os demais campos (numero, complemento, bairro, cidade, uf, cep) ja existiam; shipping_address guarda o endereco completo em texto.';
comment on column public."orders"."shipping_zone" is 'Zona comercial de frete do destino (SPC, SPG, SP1...), da tabela COFICO. Acompanha o pedido ate a separacao e alimenta a contagem de pedidos por regiao.';
comment on column public."orders"."shipping_zone_days" is 'Prazo em dias que a tabela promete para essa zona, congelado no momento do pedido.';
comment on column public."orders"."status" is 'Order status: pending, approved, rejected, in_process, cancelled, refunded';
comment on column public."orders"."tracking_code" is 'Codigo de rastreio da transportadora, digitado no painel.';
comment on table public."orders" is 'Stores customer orders with Mercado Pago payment integration';
comment on column public."packaging_specs"."ship_w_cm" is 'Medida declarada na postagem, ja com folga do envelope e o minimo de 16 cm dos Correios. Diferente do bloco de pacotes, que e so o conteudo.';
comment on table public."packaging_specs" is 'Dimensoes do bloco e peso do envelope por quantidade de pacotes. O frete usa peso BRUTO (cafe + envelope): declarar so o liquido subestima o frete.';
comment on table public."payment_refunds" is 'Historico de estornos pedidos pelo painel: quem pediu, quanto, e o que o Mercado Pago respondeu.';
comment on column public."products"."has_custom_image" is 'Kit com foto propria, escolhida a mao. Enquanto for falso, o kit espelha a foto do cafe e acompanha as trocas dela.';
comment on column public."products"."kit_of_product_id" is 'Se preenchido, este produto e um kit do produto apontado. Nao tem estoque proprio: consome o do café.';
comment on column public."products"."kit_quantity" is 'Quantos pacotes vao dentro do kit. Um kit de 3 baixa 3 unidades do lote.';
comment on column public."products"."sales_channels" is 'Quem pode vender este produto: saporino (loja B2C), repco (representantes do portal), cofico (Casa Cofico e e-commerce), marketplaces. NAO confundir com company_id, que diz de quem e a marca.';
comment on column public."products"."sku" is 'Codigo interno do produto. Diferente de barcode, que e o EAN-13 do varejo.';
comment on view public."products_com_disponibilidade" is 'Produtos com `disponivel` (kit = estoque do cafe dividido pelo tamanho), `preco_final` (promocional quando menor que o cheio) e `em_promocao`.';
comment on table public."shipments" is 'Envios. Leitura restrita: dono do pedido, admin e service_role. O rastreio publico passa por rastrear_envio(), que devolve so transportadora, status e data de despacho.';
comment on table public."shipping_carriers" is 'Transportadoras. As colunas de credencial (api_key, api_username, api_password, api_endpoint) sao revogadas para anon: leitura publica cobre so nome, logo, prazo e preco. Nunca reconceder select dessas colunas ao anon.';
comment on table public."shipping_coverage" is 'Faixas de CEP atendidas e a zona comercial de cada uma. CEP fora de todas as faixas = destino nao atendido: o checkout oferece os marketplaces em vez de inventar um preco.';
comment on table public."shipping_quotes" is 'Cotacoes mostradas ao cliente, congeladas por 15 minutos. Na cobranca vale o valor gravado aqui, nao uma consulta nova — o agregador muda o preco entre chamadas.';
comment on column public."shipping_rate_tables"."allow_discount" is 'Se o desconto de envio da empresa (shipping_subsidy_per_kg) pode ser aplicado sobre esta tabela. A tabela da COFICO e entrega propria: o preco dela ja e o nosso preco, entao nao aceita desconto.';
comment on column public."shipping_rate_tables"."tas_fee" is 'TAS (Taxa de Administracao da Secretaria da Fazenda): por CT-e emitido em envio INTERESTADUAL. Aplicada automaticamente quando a UF do destino difere da UF de origem da tabela.';
comment on column public."shipping_rate_tables"."tda_fee" is 'TDA (Taxa de Dificuldade de Acesso): valor por conhecimento em destino de dificil acesso. NAO e aplicada automaticamente — depende do cadastro do destino na transportadora.';
comment on column public."shipping_rate_tables"."tde_min" is 'Piso da TDE, em reais. Guardado junto com o percentual; a cobranca e decisao de quem opera.';
comment on column public."shipping_rate_tables"."tde_pct" is 'TDE (Dificuldade de Entrega): percentual sobre o frete em entrega de shopping center. NAO e aplicada automaticamente — nao da para deduzir por CEP que o endereco e loja de shopping.';
comment on column public."shipping_rate_tables"."toll_per_100kg" is 'Pedagio: valor por 100 kg OU FRACAO, por CT-e. Nao e proporcional — qualquer peso abaixo de 100 kg paga uma fracao inteira. Incide em toda entrega.';
comment on table public."shipping_rate_tables" is 'Tabela de frete da COFICO: faixas de peso por zona, mais seguro e GRIS sobre o valor da mercadoria. Comecou como referencia de uma tabela comercial fracionada com origem em SP e vai sendo atualizada conforme chegam cotacoes reais.';
comment on table public."stock_movements" is 'Livro-razao do estoque: cada saida e entrada, com lote, canal e pedido de origem. Fonte do relatorio "de qual lote saiu e para onde foi".';
comment on table public."storage_cleanup_log" is 'Histórico de detecção e limpeza de arquivos órfãos. Toda execução fica registrada, inclusive as simulações (dry_run).';
comment on table public."studio_content_fingerprints" is 'Hash das frases e estruturas ja entregues, em TODOS os clientes. Guarda hash e nunca o texto: responde "isto ja existe" sem revelar o que e nem de quem era.';
comment on column public."studio_generations"."batch_id" is 'Levas: "gere 7 bom dias" nasce como 7 linhas com o mesmo batch_id e batch_index 1..7.';
comment on column public."studio_generations"."brand_mode" is 'perfil = marca cadastrada manda; livre = a embalagem anexada e o pedido escrito mandam, e NENHUM DNA e carregado.';
comment on column public."studio_generations"."brand_name" is 'Nome da marca que valeu para ESTA peca. Em modo livre e o que o cliente digitou. Guardado sempre, para auditar de quem era a peca sem depender de join.';
comment on column public."studio_generations"."briefing" is 'Briefing estruturado do Diretor Criativo: conceito, cena, luz, composicao, fatos permitidos e o prompt final. Auditavel — diz por que a imagem ficou como ficou.';
comment on column public."studio_generations"."content_type" is 'bom_dia | boa_tarde | produto | oferta | institucional | educativo | representante | livre. Escolhido por atalho, nunca digitado pelo cliente.';
comment on column public."studio_generations"."creative_director_status" is 'success = a peca nasceu do briefing do Diretor. fallback = o Diretor falhou e valeu o prompt montado por regra.';
comment on column public."studio_generations"."handle" is '@ do Instagram da marca, para virar assinatura discreta. Nunca traduzido.';
comment on column public."studio_generations"."reference_paths" is 'Todos os ativos de referencia da geracao, na ordem enviada. reference_path guarda o primeiro, por compatibilidade.';
comment on column public."studio_generations"."reference_roles" is 'Papel de cada anexo, na mesma ordem de reference_paths: oficial | inspiracao. Oficial se preserva; inspiracao se interpreta e se abandona.';
comment on column public."studio_generations"."style" is 'fotografico | post_pronto | comercial | premium | moderno. Escolha do cliente que define o modo de saida e o acabamento.';
comment on column public."studio_generations"."text_mode" is 'automatico | com_frase | sem_texto. Quem decide se a peca leva texto na arte.';
comment on table public."studio_generations" is 'Cada tentativa de geracao, aprovada ou nao. organization_id isola por cliente; brand_id diz de qual marca. parent_id liga as tentativas do mesmo pedido.';
comment on table public."studio_members" is 'Vinculo usuario <-> organizacao. owner administra e cuida da assinatura; member cria e aprova.';
comment on table public."studio_organizations" is 'Tenant do COFICO Studio. Uma organizacao tem varias marcas (studio_brand_profiles) e UMA assinatura. company_id so e preenchido para cliente interno (Saporino, COFICO).';
comment on table public."studio_reference_assets" is 'Cada arquivo anexado como ativo, com a marca que o enviou. Existe para uma pergunta so: este ativo e desta marca? Ativo registrado em OUTRA marca bloqueia a geracao.';
comment on table public."superfrete_settings" is 'Origem, servicos e MARKUP da loja sobre o frete. ADMIN-ONLY: markup e margem. A cotacao publica roda em superfrete-quote com service role.';
comment on table public."telegram_recipients" is 'Quem recebe aviso interno no Telegram. chat_id vem do proprio Telegram depois que a pessoa da START no bot — antes disso o Telegram nao deixa o bot mandar mensagem.';
comment on table public."user_addresses" is 'Endereco de entrega salvo do cliente. Preenche o checkout na compra seguinte para ninguem redigitar tudo.';
comment on view public."vw_coffee_offers_shielded" is 'Contact shield: o que um comprador vê de uma oferta. Sem nome, documento, contato, endereco exato ou nome de fazenda.';
comment on view public."vw_coffee_requests_shielded" is 'Contact shield: o que um produtor ve de uma solicitacao. Destino em nivel de UF; sem identidade nem contato do comprador.';
comment on view public."vw_estoque_alertas" is 'Alertas de estoque: sem estoque, validade em ate 60 dias e velocidade de venda (dias de estoque restantes). Base para decidir cadencia de producao.';
comment on view public."vw_lv_coffee_passport" is 'Coffee Passport de cada produto: so os campos de passaporte que TEM valor. Nao existe linha para campo vazio, e por isso a tela nunca inventa.';
comment on view public."vw_lv_vitrine" is 'Vitrine publica: produto ATIVO em loja ATIVA. Traz a variante padrao, o vendavel dela (esgotado continua visivel, sem compra) e o codigo permanente do QR.';

-- Permissões
revoke all on table public."admin_settings" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."admin_settings" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."admin_settings" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."admin_settings" to "service_role";
revoke all on table public."ai_usage_events" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."ai_usage_events" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."ai_usage_events" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."ai_usage_events" to "service_role";
revoke all on table public."b2b_leads" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."b2b_leads" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."b2b_leads" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."b2b_leads" to "service_role";
revoke all on sequence public."batch_number_seq" from public, anon, authenticated, service_role;
grant select, update, usage on sequence public."batch_number_seq" to "anon";
grant select, update, usage on sequence public."batch_number_seq" to "authenticated";
grant select, update, usage on sequence public."batch_number_seq" to "service_role";
revoke all on table public."batch_photos" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."batch_photos" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."batch_photos" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."batch_photos" to "service_role";
revoke all on table public."candidaturas_representante" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."candidaturas_representante" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."candidaturas_representante" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."candidaturas_representante" to "service_role";
revoke all on table public."chat_conversations" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."chat_conversations" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."chat_conversations" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."chat_conversations" to "service_role";
revoke all on table public."chat_messages" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."chat_messages" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."chat_messages" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."chat_messages" to "service_role";
revoke all on table public."chat_participants" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."chat_participants" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."chat_participants" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."chat_participants" to "service_role";
revoke all on table public."client_sales_history" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."client_sales_history" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."client_sales_history" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."client_sales_history" to "service_role";
revoke all on table public."coffee_bebida_scale" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_bebida_scale" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_bebida_scale" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_bebida_scale" to "service_role";
revoke all on table public."coffee_market_index" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_market_index" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_market_index" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_market_index" to "service_role";
revoke all on table public."coffee_matches" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_matches" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_matches" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_matches" to "service_role";
revoke all on table public."coffee_offer_photos" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_offer_photos" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_offer_photos" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_offer_photos" to "service_role";
revoke all on table public."coffee_offers" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_offers" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_offers" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_offers" to "service_role";
revoke all on table public."coffee_pilot_cases" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_pilot_cases" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_pilot_cases" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_pilot_cases" to "service_role";
revoke all on table public."coffee_purchase_requests" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_purchase_requests" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_purchase_requests" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coffee_purchase_requests" to "service_role";
revoke all on table public."commercial_accounts" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."commercial_accounts" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."commercial_accounts" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."commercial_accounts" to "service_role";
revoke all on table public."companies" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."companies" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."companies" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."companies" to "service_role";
revoke all on table public."company_order_counters" from public, anon, authenticated, service_role;
grant select on table public."company_order_counters" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."company_order_counters" to "service_role";
revoke all on table public."coupon_redemptions" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coupon_redemptions" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coupon_redemptions" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coupon_redemptions" to "service_role";
revoke all on table public."coupons" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coupons" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coupons" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."coupons" to "service_role";
revoke all on table public."delivery_dispatch_audit" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."delivery_dispatch_audit" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."delivery_dispatch_audit" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."delivery_dispatch_audit" to "service_role";
revoke all on table public."delivery_routes" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."delivery_routes" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."delivery_routes" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."delivery_routes" to "service_role";
revoke all on table public."delivery_stops" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."delivery_stops" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."delivery_stops" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."delivery_stops" to "service_role";
revoke all on table public."discovery_campaigns" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."discovery_campaigns" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."discovery_campaigns" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."discovery_campaigns" to "service_role";
revoke all on table public."discovery_keywords" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."discovery_keywords" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."discovery_keywords" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."discovery_keywords" to "service_role";
revoke all on table public."discovery_results" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."discovery_results" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."discovery_results" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."discovery_results" to "service_role";
revoke all on table public."distributed_brands" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."distributed_brands" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."distributed_brands" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."distributed_brands" to "service_role";
revoke all on table public."driver_documents" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."driver_documents" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."driver_documents" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."driver_documents" to "service_role";
revoke all on table public."drivers" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."drivers" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."drivers" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."drivers" to "service_role";
revoke all on table public."ecommerce_price_snapshots" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."ecommerce_price_snapshots" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."ecommerce_price_snapshots" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."ecommerce_price_snapshots" to "service_role";
revoke all on table public."ecommerce_sources" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."ecommerce_sources" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."ecommerce_sources" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."ecommerce_sources" to "service_role";
revoke all on table public."edge_logs" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."edge_logs" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."edge_logs" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."edge_logs" to "service_role";
revoke all on table public."edge_rate_limits" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."edge_rate_limits" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."edge_rate_limits" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."edge_rate_limits" to "service_role";
revoke all on table public."fleet_documents" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."fleet_documents" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."fleet_documents" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."fleet_documents" to "service_role";
revoke all on table public."fleet_maintenance" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."fleet_maintenance" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."fleet_maintenance" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."fleet_maintenance" to "service_role";
revoke all on table public."fleet_vehicles" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."fleet_vehicles" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."fleet_vehicles" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."fleet_vehicles" to "service_role";
revoke all on table public."green_coffee_lots" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."green_coffee_lots" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."green_coffee_lots" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."green_coffee_lots" to "service_role";
revoke all on table public."ibge_municipios" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."ibge_municipios" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."ibge_municipios" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."ibge_municipios" to "service_role";
revoke all on table public."invoices" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."invoices" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."invoices" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."invoices" to "service_role";
revoke all on table public."lead_rf_candidates" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lead_rf_candidates" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lead_rf_candidates" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lead_rf_candidates" to "service_role";
revoke all on table public."lot_documents" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lot_documents" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lot_documents" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lot_documents" to "service_role";
revoke all on table public."lot_transfers" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lot_transfers" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lot_transfers" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lot_transfers" to "service_role";
revoke all on table public."lv_attributes" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_attributes" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_attributes" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_attributes" to "service_role";
revoke all on table public."lv_b2b_empresas" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_b2b_empresas" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_b2b_empresas" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_b2b_empresas" to "service_role";
revoke all on table public."lv_b2b_solicitacoes" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_b2b_solicitacoes" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_b2b_solicitacoes" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_b2b_solicitacoes" to "service_role";
revoke all on table public."lv_categories" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_categories" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_categories" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_categories" to "service_role";
revoke all on table public."lv_category_attributes" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_category_attributes" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_category_attributes" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_category_attributes" to "service_role";
revoke all on table public."lv_demo_access" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_demo_access" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_demo_access" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_demo_access" to "service_role";
revoke all on table public."lv_inventory_lots" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_inventory_lots" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_inventory_lots" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_inventory_lots" to "service_role";
revoke all on table public."lv_plans" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_plans" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_plans" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_plans" to "service_role";
revoke all on table public."lv_price_history" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_price_history" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_price_history" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_price_history" to "service_role";
revoke all on table public."lv_price_tiers" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_price_tiers" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_price_tiers" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_price_tiers" to "service_role";
revoke all on table public."lv_product_attributes" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_product_attributes" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_product_attributes" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_product_attributes" to "service_role";
revoke all on table public."lv_product_images" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_product_images" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_product_images" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_product_images" to "service_role";
revoke all on table public."lv_product_variants" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_product_variants" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_product_variants" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_product_variants" to "service_role";
revoke all on table public."lv_products" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_products" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_products" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_products" to "service_role";
revoke all on table public."lv_qr_codes" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_qr_codes" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_qr_codes" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_qr_codes" to "service_role";
revoke all on table public."lv_seller_applications" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_seller_applications" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_seller_applications" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_seller_applications" to "service_role";
revoke all on table public."lv_seller_users" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_seller_users" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_seller_users" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_seller_users" to "service_role";
revoke all on table public."lv_sellers" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_sellers" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_sellers" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_sellers" to "service_role";
revoke all on table public."lv_settings" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_settings" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_settings" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_settings" to "service_role";
revoke all on table public."lv_simulacao_premissas" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_simulacao_premissas" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_simulacao_premissas" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_simulacao_premissas" to "service_role";
revoke all on table public."lv_stores" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_stores" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_stores" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_stores" to "service_role";
revoke all on table public."lv_tarifas_simulacao" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_tarifas_simulacao" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_tarifas_simulacao" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."lv_tarifas_simulacao" to "service_role";
revoke all on table public."marketing_contacts" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."marketing_contacts" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."marketing_contacts" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."marketing_contacts" to "service_role";
revoke all on table public."marketplace_stores" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."marketplace_stores" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."marketplace_stores" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."marketplace_stores" to "service_role";
revoke all on table public."mv_repco_prospects_muni" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."mv_repco_prospects_muni" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."mv_repco_prospects_muni" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."mv_repco_prospects_muni" to "service_role";
revoke all on table public."network_audit_log" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."network_audit_log" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."network_audit_log" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."network_audit_log" to "service_role";
revoke all on table public."network_entities" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."network_entities" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."network_entities" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."network_entities" to "service_role";
revoke all on table public."network_entity_roles" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."network_entity_roles" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."network_entity_roles" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."network_entity_roles" to "service_role";
revoke all on table public."network_properties" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."network_properties" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."network_properties" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."network_properties" to "service_role";
revoke all on table public."network_roles" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."network_roles" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."network_roles" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."network_roles" to "service_role";
revoke all on table public."order_emails" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."order_emails" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."order_emails" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."order_emails" to "service_role";
revoke all on table public."order_items" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."order_items" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."order_items" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."order_items" to "service_role";
revoke all on table public."orders" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."orders" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."orders" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."orders" to "service_role";
revoke all on table public."packaging_specs" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."packaging_specs" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."packaging_specs" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."packaging_specs" to "service_role";
revoke all on table public."payment_refunds" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."payment_refunds" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."payment_refunds" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."payment_refunds" to "service_role";
revoke all on table public."points_of_sale" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."points_of_sale" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."points_of_sale" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."points_of_sale" to "service_role";
revoke all on table public."popup_settings" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."popup_settings" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."popup_settings" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."popup_settings" to "service_role";
revoke all on table public."price_lists" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."price_lists" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."price_lists" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."price_lists" to "service_role";
revoke all on table public."products" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."products" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."products" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."products" to "service_role";
revoke all on table public."products_com_disponibilidade" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."products_com_disponibilidade" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."products_com_disponibilidade" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."products_com_disponibilidade" to "service_role";
revoke all on table public."promo_banners" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promo_banners" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promo_banners" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promo_banners" to "service_role";
revoke all on table public."promoter_audit_log" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_audit_log" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_audit_log" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_audit_log" to "service_role";
revoke all on sequence public."promoter_audit_log_id_seq" from public, anon, authenticated, service_role;
grant select, update, usage on sequence public."promoter_audit_log_id_seq" to "anon";
grant select, update, usage on sequence public."promoter_audit_log_id_seq" to "authenticated";
grant select, update, usage on sequence public."promoter_audit_log_id_seq" to "service_role";
revoke all on table public."promoter_client_mix" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_client_mix" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_client_mix" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_client_mix" to "service_role";
revoke all on table public."promoter_clients" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_clients" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_clients" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_clients" to "service_role";
revoke all on table public."promoter_incidents" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_incidents" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_incidents" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_incidents" to "service_role";
revoke all on table public."promoter_routes" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_routes" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_routes" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_routes" to "service_role";
revoke all on table public."promoter_visit_audits" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_visit_audits" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_visit_audits" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_visit_audits" to "service_role";
revoke all on table public."promoter_visit_locations" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_visit_locations" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_visit_locations" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_visit_locations" to "service_role";
revoke all on sequence public."promoter_visit_locations_id_seq" from public, anon, authenticated, service_role;
grant select, update, usage on sequence public."promoter_visit_locations_id_seq" to "anon";
grant select, update, usage on sequence public."promoter_visit_locations_id_seq" to "authenticated";
grant select, update, usage on sequence public."promoter_visit_locations_id_seq" to "service_role";
revoke all on table public."promoter_visit_photos" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_visit_photos" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_visit_photos" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_visit_photos" to "service_role";
revoke all on table public."promoter_visits" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_visits" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_visits" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoter_visits" to "service_role";
revoke all on table public."promoters" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoters" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoters" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."promoters" to "service_role";
revoke all on table public."prospect_leads" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."prospect_leads" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."prospect_leads" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."prospect_leads" to "service_role";
revoke all on table public."prospect_lists" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."prospect_lists" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."prospect_lists" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."prospect_lists" to "service_role";
revoke all on table public."prospect_runs" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."prospect_runs" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."prospect_runs" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."prospect_runs" to "service_role";
revoke all on table public."prospects_b2b" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."prospects_b2b" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."prospects_b2b" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."prospects_b2b" to "service_role";
revoke all on table public."rep_daily_plans" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."rep_daily_plans" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."rep_daily_plans" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."rep_daily_plans" to "service_role";
revoke all on table public."repco_help_articles" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."repco_help_articles" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."repco_help_articles" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."repco_help_articles" to "service_role";
revoke all on table public."repco_invite_codes" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."repco_invite_codes" to "service_role";
revoke all on sequence public."repco_order_seq" from public, anon, authenticated, service_role;
grant select, update, usage on sequence public."repco_order_seq" to "anon";
grant select, update, usage on sequence public."repco_order_seq" to "authenticated";
grant select, update, usage on sequence public."repco_order_seq" to "service_role";
revoke all on table public."representative_clients" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_clients" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_clients" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_clients" to "service_role";
revoke all on table public."representative_commission_payouts" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_commission_payouts" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_commission_payouts" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_commission_payouts" to "service_role";
revoke all on table public."representative_commissions" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_commissions" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_commissions" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_commissions" to "service_role";
revoke all on table public."representative_company_settings" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_company_settings" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_company_settings" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_company_settings" to "service_role";
revoke all on table public."representative_documents" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_documents" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_documents" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_documents" to "service_role";
revoke all on table public."representative_order_installments" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_order_installments" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_order_installments" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_order_installments" to "service_role";
revoke all on table public."representative_order_items" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_order_items" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_order_items" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_order_items" to "service_role";
revoke all on table public."representative_order_notes" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_order_notes" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_order_notes" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_order_notes" to "service_role";
revoke all on table public."representative_orders" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_orders" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_orders" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_orders" to "service_role";
revoke all on table public."representative_routes" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_routes" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_routes" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representative_routes" to "service_role";
revoke all on table public."representatives" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representatives" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representatives" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."representatives" to "service_role";
revoke all on table public."roasting_companies" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."roasting_companies" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."roasting_companies" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."roasting_companies" to "service_role";
revoke all on table public."roasting_company_contacts" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."roasting_company_contacts" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."roasting_company_contacts" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."roasting_company_contacts" to "service_role";
revoke all on table public."roles" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."roles" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."roles" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."roles" to "service_role";
revoke all on table public."route_stops" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."route_stops" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."route_stops" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."route_stops" to "service_role";
revoke all on table public."shipments" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipments" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipments" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipments" to "service_role";
revoke all on table public."shipping_carriers" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, trigger, truncate, update on table public."shipping_carriers" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipping_carriers" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipping_carriers" to "service_role";
revoke all on table public."shipping_coverage" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipping_coverage" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipping_coverage" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipping_coverage" to "service_role";
revoke all on sequence public."shipping_coverage_id_seq" from public, anon, authenticated, service_role;
grant select, update, usage on sequence public."shipping_coverage_id_seq" to "anon";
grant select, update, usage on sequence public."shipping_coverage_id_seq" to "authenticated";
grant select, update, usage on sequence public."shipping_coverage_id_seq" to "service_role";
revoke all on table public."shipping_quotes" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipping_quotes" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipping_quotes" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipping_quotes" to "service_role";
revoke all on table public."shipping_rate_tables" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipping_rate_tables" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipping_rate_tables" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipping_rate_tables" to "service_role";
revoke all on table public."shipping_rates" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipping_rates" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipping_rates" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."shipping_rates" to "service_role";
revoke all on table public."site_settings" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."site_settings" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."site_settings" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."site_settings" to "service_role";
revoke all on table public."site_visits" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."site_visits" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."site_visits" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."site_visits" to "service_role";
revoke all on table public."stock_movements" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."stock_movements" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."stock_movements" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."stock_movements" to "service_role";
revoke all on table public."storage_cleanup_log" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."storage_cleanup_log" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."storage_cleanup_log" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."storage_cleanup_log" to "service_role";
revoke all on table public."studio_analyses" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_analyses" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_analyses" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_analyses" to "service_role";
revoke all on table public."studio_brand_profiles" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_brand_profiles" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_brand_profiles" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_brand_profiles" to "service_role";
revoke all on table public."studio_campaigns" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_campaigns" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_campaigns" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_campaigns" to "service_role";
revoke all on table public."studio_content_fingerprints" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_content_fingerprints" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_content_fingerprints" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_content_fingerprints" to "service_role";
revoke all on table public."studio_generations" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_generations" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_generations" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_generations" to "service_role";
revoke all on table public."studio_members" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_members" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_members" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_members" to "service_role";
revoke all on table public."studio_organizations" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_organizations" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_organizations" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_organizations" to "service_role";
revoke all on table public."studio_profile_snapshots" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_profile_snapshots" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_profile_snapshots" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_profile_snapshots" to "service_role";
revoke all on table public."studio_reference_assets" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_reference_assets" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_reference_assets" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_reference_assets" to "service_role";
revoke all on table public."studio_social_connections" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_social_connections" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_social_connections" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_social_connections" to "service_role";
revoke all on table public."studio_transcriptions" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_transcriptions" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_transcriptions" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_transcriptions" to "service_role";
revoke all on table public."studio_videos" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_videos" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_videos" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."studio_videos" to "service_role";
revoke all on table public."subscription_settings" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."subscription_settings" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."subscription_settings" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."subscription_settings" to "service_role";
revoke all on table public."subscriptions" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."subscriptions" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."subscriptions" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."subscriptions" to "service_role";
revoke all on table public."superfrete_settings" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."superfrete_settings" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."superfrete_settings" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."superfrete_settings" to "service_role";
revoke all on table public."telegram_recipients" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."telegram_recipients" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."telegram_recipients" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."telegram_recipients" to "service_role";
revoke all on table public."user_addresses" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."user_addresses" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."user_addresses" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."user_addresses" to "service_role";
revoke all on table public."user_profiles" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."user_profiles" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."user_profiles" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."user_profiles" to "service_role";
revoke all on table public."user_roles" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."user_roles" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."user_roles" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."user_roles" to "service_role";
revoke all on table public."vw_campanha_whatsapp" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_campanha_whatsapp" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_campanha_whatsapp" to "service_role";
revoke all on table public."vw_coffee_offers_shielded" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_coffee_offers_shielded" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_coffee_offers_shielded" to "service_role";
revoke all on table public."vw_coffee_pilot_metrics" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_coffee_pilot_metrics" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_coffee_pilot_metrics" to "service_role";
revoke all on table public."vw_coffee_requests_shielded" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_coffee_requests_shielded" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_coffee_requests_shielded" to "service_role";
revoke all on table public."vw_cofico_delivery_queue" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_cofico_delivery_queue" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_cofico_delivery_queue" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_cofico_delivery_queue" to "service_role";
revoke all on table public."vw_cofico_vitrine" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_cofico_vitrine" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_cofico_vitrine" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_cofico_vitrine" to "service_role";
revoke all on table public."vw_ecommerce_latest" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ecommerce_latest" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ecommerce_latest" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ecommerce_latest" to "service_role";
revoke all on table public."vw_empresa_recebimento" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_empresa_recebimento" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_empresa_recebimento" to "service_role";
revoke all on table public."vw_estoque_alertas" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_estoque_alertas" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_estoque_alertas" to "service_role";
revoke all on table public."vw_lote_destino" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_lote_destino" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_lote_destino" to "service_role";
revoke all on table public."vw_lv_coffee_passport" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_lv_coffee_passport" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_lv_coffee_passport" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_lv_coffee_passport" to "service_role";
revoke all on table public."vw_lv_vitrine" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_lv_vitrine" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_lv_vitrine" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_lv_vitrine" to "service_role";
revoke all on table public."vw_promoter_coverage" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_coverage" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_coverage" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_coverage" to "service_role";
revoke all on table public."vw_promoter_expiry" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_expiry" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_expiry" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_expiry" to "service_role";
revoke all on table public."vw_promoter_incidents" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_incidents" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_incidents" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_incidents" to "service_role";
revoke all on table public."vw_promoter_incidents_summary" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_incidents_summary" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_incidents_summary" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_incidents_summary" to "service_role";
revoke all on table public."vw_promoter_products" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_products" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_products" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_products" to "service_role";
revoke all on table public."vw_promoter_reps" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_reps" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_reps" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_reps" to "service_role";
revoke all on table public."vw_promoter_stock_ops" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_stock_ops" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_stock_ops" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_stock_ops" to "service_role";
revoke all on table public."vw_promoter_stores" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_stores" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_stores" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_stores" to "service_role";
revoke all on table public."vw_promoter_time" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_time" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_time" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_time" to "service_role";
revoke all on table public."vw_promoter_visit_mix" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_visit_mix" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_visit_mix" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_promoter_visit_mix" to "service_role";
revoke all on table public."vw_repco_clientes_ativos_por_area" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_clientes_ativos_por_area" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_clientes_ativos_por_area" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_clientes_ativos_por_area" to "service_role";
revoke all on table public."vw_repco_clientes_bloqueados" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_clientes_bloqueados" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_clientes_bloqueados" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_clientes_bloqueados" to "service_role";
revoke all on table public."vw_repco_clientes_geo" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_clientes_geo" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_clientes_geo" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_clientes_geo" to "service_role";
revoke all on table public."vw_repco_cobertura" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_cobertura" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_cobertura" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_cobertura" to "service_role";
revoke all on table public."vw_repco_leads_geo" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_leads_geo" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_leads_geo" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_leads_geo" to "service_role";
revoke all on table public."vw_repco_preco_praticado" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_preco_praticado" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_preco_praticado" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_preco_praticado" to "service_role";
revoke all on table public."vw_repco_vendas_por_area" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_vendas_por_area" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_vendas_por_area" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_vendas_por_area" to "service_role";
revoke all on table public."vw_repco_vendas_por_canal" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_vendas_por_canal" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_vendas_por_canal" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_vendas_por_canal" to "service_role";
revoke all on table public."vw_repco_vendas_por_linha" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_vendas_por_linha" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_vendas_por_linha" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_vendas_por_linha" to "service_role";
revoke all on table public."vw_repco_vendas_por_rep" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_vendas_por_rep" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_vendas_por_rep" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_vendas_por_rep" to "service_role";
revoke all on table public."vw_repco_vitrine" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_vitrine" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_repco_vitrine" to "service_role";
revoke all on table public."vw_ruptura_alerts" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ruptura_alerts" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ruptura_alerts" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ruptura_alerts" to "service_role";
revoke all on table public."vw_ruptura_by_client" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ruptura_by_client" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ruptura_by_client" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ruptura_by_client" to "service_role";
revoke all on table public."vw_ruptura_by_product" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ruptura_by_product" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ruptura_by_product" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ruptura_by_product" to "service_role";
revoke all on table public."vw_ruptura_by_region" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ruptura_by_region" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ruptura_by_region" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ruptura_by_region" to "service_role";
revoke all on table public."vw_ruptura_open" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ruptura_open" to "anon";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ruptura_open" to "authenticated";
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_ruptura_open" to "service_role";
revoke all on table public."vw_storage_references" from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public."vw_storage_references" to "service_role";
grant select ("api_type", "code", "created_at", "delivery_time_days", "fixed_price", "id", "integration_notes", "is_active", "logo_url", "name", "price_per_kg") on table public."shipping_carriers" to "anon";
revoke all on function public."calculate_batch_costs"(p_batch_id uuid) from public, anon, authenticated, service_role;
grant execute on function public."calculate_batch_costs"(p_batch_id uuid) to public, "anon", "authenticated", "service_role";
revoke all on function public."calculate_repco_commission"() from public, anon, authenticated, service_role;
grant execute on function public."calculate_repco_commission"() to public, "anon", "authenticated", "service_role";
revoke all on function public."can_access_invoice_file"(p_name text) from public, anon, authenticated, service_role;
grant execute on function public."can_access_invoice_file"(p_name text) to "anon", "authenticated", "service_role";
revoke all on function public."chat_contacts"() from public, anon, authenticated, service_role;
grant execute on function public."chat_contacts"() to public, "anon", "authenticated", "service_role";
revoke all on function public."chat_create_group"(gname text, members uuid[], p_company uuid) from public, anon, authenticated, service_role;
grant execute on function public."chat_create_group"(gname text, members uuid[], p_company uuid) to public, "anon", "authenticated", "service_role";
revoke all on function public."chat_mark_read"(conv uuid) from public, anon, authenticated, service_role;
grant execute on function public."chat_mark_read"(conv uuid) to public, "anon", "authenticated", "service_role";
revoke all on function public."chat_media_conversation"(p_name text) from public, anon, authenticated, service_role;
grant execute on function public."chat_media_conversation"(p_name text) to "anon", "authenticated", "service_role";
revoke all on function public."chat_my_conversations"(p_company uuid) from public, anon, authenticated, service_role;
grant execute on function public."chat_my_conversations"(p_company uuid) to public, "anon", "authenticated", "service_role";
revoke all on function public."chat_start_direct"(other uuid, p_company uuid) from public, anon, authenticated, service_role;
grant execute on function public."chat_start_direct"(other uuid, p_company uuid) to public, "anon", "authenticated", "service_role";
revoke all on function public."chat_touch_conv"() from public, anon, authenticated, service_role;
grant execute on function public."chat_touch_conv"() to public, "anon", "authenticated", "service_role";
revoke all on function public."check_rate_limit"(p_key text, p_limit integer, p_window_seconds integer) from public, anon, authenticated, service_role;
grant execute on function public."check_rate_limit"(p_key text, p_limit integer, p_window_seconds integer) to public, "anon", "authenticated", "service_role";
revoke all on function public."coffee_compute_matches"(p_request_id uuid, p_min_score numeric) from public, anon, authenticated, service_role;
grant execute on function public."coffee_compute_matches"(p_request_id uuid, p_min_score numeric) to "anon", "authenticated", "service_role";
revoke all on function public."coffee_match_score"(p_offer_id uuid, p_request_id uuid) from public, anon, authenticated, service_role;
grant execute on function public."coffee_match_score"(p_offer_id uuid, p_request_id uuid) to "anon", "authenticated", "service_role";
revoke all on function public."coffee_offer_mark_sold"(p_offer_id uuid, p_externally boolean, p_note text) from public, anon, authenticated, service_role;
grant execute on function public."coffee_offer_mark_sold"(p_offer_id uuid, p_externally boolean, p_note text) to "anon", "authenticated", "service_role";
revoke all on function public."coffee_offer_moderate"(p_offer_id uuid, p_decision text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public."coffee_offer_moderate"(p_offer_id uuid, p_decision text, p_note text) to "anon", "authenticated", "service_role";
revoke all on function public."coffee_offer_photo_moderate"(p_photo_id uuid, p_decision text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public."coffee_offer_photo_moderate"(p_photo_id uuid, p_decision text, p_note text) to "anon", "authenticated", "service_role";
revoke all on function public."coffee_offer_publish"(p_offer_id uuid, p_hours integer) from public, anon, authenticated, service_role;
grant execute on function public."coffee_offer_publish"(p_offer_id uuid, p_hours integer) to "anon", "authenticated", "service_role";
revoke all on function public."cofico_dispatch_route"(p_driver_id uuid, p_scheduled_date date, p_order_ids uuid[]) from public, anon, authenticated, service_role;
grant execute on function public."cofico_dispatch_route"(p_driver_id uuid, p_scheduled_date date, p_order_ids uuid[]) to public, "anon", "authenticated", "service_role";
revoke all on function public."cofico_public_stats"() from public, anon, authenticated, service_role;
grant execute on function public."cofico_public_stats"() to "anon", "authenticated", "service_role";
revoke all on function public."consume_stock_fifo"(p_product_id uuid, p_quantity integer, p_channel text, p_reference_type text, p_reference_id uuid, p_company_id uuid, p_movement_type text) from public, anon, authenticated, service_role;
grant execute on function public."consume_stock_fifo"(p_product_id uuid, p_quantity integer, p_channel text, p_reference_type text, p_reference_id uuid, p_company_id uuid, p_movement_type text) to "authenticated", "service_role";
revoke all on function public."consume_stock_on_order_paid"() from public, anon, authenticated, service_role;
grant execute on function public."consume_stock_on_order_paid"() to public, "anon", "authenticated", "service_role";
revoke all on function public."cotar_frete"(p_table_id uuid, p_cep text, p_peso_kg numeric, p_valor numeric, p_subsidio_kg numeric) from public, anon, authenticated, service_role;
grant execute on function public."cotar_frete"(p_table_id uuid, p_cep text, p_peso_kg numeric, p_valor numeric, p_subsidio_kg numeric) to "anon", "authenticated", "service_role";
revoke all on function public."create_boleto_commission_payout"() from public, anon, authenticated, service_role;
grant execute on function public."create_boleto_commission_payout"() to public, "anon", "authenticated", "service_role";
revoke all on function public."create_pix_commission_payout"() from public, anon, authenticated, service_role;
grant execute on function public."create_pix_commission_payout"() to public, "anon", "authenticated", "service_role";
revoke all on function public."criar_kits"(p_produto_id uuid, p_degraus jsonb) from public, anon, authenticated, service_role;
grant execute on function public."criar_kits"(p_produto_id uuid, p_degraus jsonb) to "anon", "authenticated", "service_role";
revoke all on function public."decrement_stock_on_repco_order"() from public, anon, authenticated, service_role;
grant execute on function public."decrement_stock_on_repco_order"() to public, "anon", "authenticated", "service_role";
revoke all on function public."espelhar_foto_nos_kits"() from public, anon, authenticated, service_role;
grant execute on function public."espelhar_foto_nos_kits"() to public, "anon", "authenticated", "service_role";
revoke all on function public."exec_migration"(q text) from public, anon, authenticated, service_role;
grant execute on function public."exec_migration"(q text) to "service_role";
revoke all on function public."exec_select"(q text) from public, anon, authenticated, service_role;
grant execute on function public."exec_select"(q text) to "service_role";
revoke all on function public."generate_batch_number"() from public, anon, authenticated, service_role;
grant execute on function public."generate_batch_number"() to public, "anon", "authenticated", "service_role";
revoke all on function public."generate_order_number"() from public, anon, authenticated, service_role;
grant execute on function public."generate_order_number"() to public, "anon", "authenticated", "service_role";
revoke all on function public."generate_order_number"(p_order_type text) from public, anon, authenticated, service_role;
grant execute on function public."generate_order_number"(p_order_type text) to public, "anon", "authenticated", "service_role";
revoke all on function public."generate_repco_order_number"() from public, anon, authenticated, service_role;
grant execute on function public."generate_repco_order_number"() to public, "anon", "authenticated", "service_role";
revoke all on function public."get_order_public"(p_order_id uuid, p_token text) from public, anon, authenticated, service_role;
grant execute on function public."get_order_public"(p_order_id uuid, p_token text) to "anon", "authenticated", "service_role";
revoke all on function public."handle_client_snooze"() from public, anon, authenticated, service_role;
grant execute on function public."handle_client_snooze"() to public, "anon", "authenticated", "service_role";
revoke all on function public."handle_new_user"() from public, anon, authenticated, service_role;
grant execute on function public."handle_new_user"() to public, "anon", "authenticated", "service_role";
revoke all on function public."has_role"(p_role text) from public, anon, authenticated, service_role;
grant execute on function public."has_role"(p_role text) to public, "anon", "authenticated", "service_role";
revoke all on function public."has_role"(p_role text, p_company uuid) from public, anon, authenticated, service_role;
grant execute on function public."has_role"(p_role text, p_company uuid) to public, "anon", "authenticated", "service_role";
revoke all on function public."is_admin"() from public, anon, authenticated, service_role;
grant execute on function public."is_admin"() to public, "anon", "authenticated", "service_role";
revoke all on function public."is_chat_member"(conv uuid) from public, anon, authenticated, service_role;
grant execute on function public."is_chat_member"(conv uuid) to public, "anon", "authenticated", "service_role";
revoke all on function public."kit_disponivel"(p_produto_id uuid) from public, anon, authenticated, service_role;
grant execute on function public."kit_disponivel"(p_produto_id uuid) to public, "anon", "authenticated", "service_role";
revoke all on function public."kit_nome"(p_base text, p_qtd integer, p_gramas integer) from public, anon, authenticated, service_role;
grant execute on function public."kit_nome"(p_base text, p_qtd integer, p_gramas integer) to public, "anon", "authenticated", "service_role";
revoke all on function public."kit_peso_texto"(p_gramas numeric) from public, anon, authenticated, service_role;
grant execute on function public."kit_peso_texto"(p_gramas numeric) to public, "anon", "authenticated", "service_role";
revoke all on function public."kit_sku"(p_base_sku text, p_produto_id uuid, p_qtd integer) from public, anon, authenticated, service_role;
grant execute on function public."kit_sku"(p_base_sku text, p_produto_id uuid, p_qtd integer) to public, "anon", "authenticated", "service_role";
revoke all on function public."limpar_carrinhos_abandonados"(p_horas integer, p_aplicar boolean) from public, anon, authenticated, service_role;
grant execute on function public."limpar_carrinhos_abandonados"(p_horas integer, p_aplicar boolean) to "anon", "authenticated", "service_role";
revoke all on function public."limpar_cotacoes_vencidas"() from public, anon, authenticated, service_role;
grant execute on function public."limpar_cotacoes_vencidas"() to public, "anon", "authenticated", "service_role";
revoke all on function public."lv_aplicar_preco"(p_product uuid, p_preco_cents bigint, p_origem text, p_motivo text, p_recomendacao jsonb) from public, anon, authenticated, service_role;
grant execute on function public."lv_aplicar_preco"(p_product uuid, p_preco_cents bigint, p_origem text, p_motivo text, p_recomendacao jsonb) to "anon", "authenticated", "service_role";
revoke all on function public."lv_b2b_solicitar"(p jsonb) from public, anon, authenticated, service_role;
grant execute on function public."lv_b2b_solicitar"(p jsonb) to "anon", "authenticated", "service_role";
revoke all on function public."lv_buscar_produtos"(termo text) from public, anon, authenticated, service_role;
grant execute on function public."lv_buscar_produtos"(termo text) to "anon", "authenticated", "service_role";
revoke all on function public."lv_chamada_privilegiada"() from public, anon, authenticated, service_role;
grant execute on function public."lv_chamada_privilegiada"() to public, "anon", "authenticated", "service_role";
revoke all on function public."lv_desfazer_preco"(p_history uuid) from public, anon, authenticated, service_role;
grant execute on function public."lv_desfazer_preco"(p_history uuid) to "anon", "authenticated", "service_role";
revoke all on function public."lv_gerar_codigo_qr"() from public, anon, authenticated, service_role;
grant execute on function public."lv_gerar_codigo_qr"() to public, "anon", "authenticated", "service_role";
revoke all on function public."lv_guarda_loja"() from public, anon, authenticated, service_role;
grant execute on function public."lv_guarda_loja"() to public, "anon", "authenticated", "service_role";
revoke all on function public."lv_guarda_lote"() from public, anon, authenticated, service_role;
grant execute on function public."lv_guarda_lote"() to public, "anon", "authenticated", "service_role";
revoke all on function public."lv_guarda_produto"() from public, anon, authenticated, service_role;
grant execute on function public."lv_guarda_produto"() to public, "anon", "authenticated", "service_role";
revoke all on function public."lv_guarda_qr"() from public, anon, authenticated, service_role;
grant execute on function public."lv_guarda_qr"() to public, "anon", "authenticated", "service_role";
revoke all on function public."lv_guarda_variante"() from public, anon, authenticated, service_role;
grant execute on function public."lv_guarda_variante"() to public, "anon", "authenticated", "service_role";
revoke all on function public."lv_limpar_contexto_de_preco"() from public, anon, authenticated, service_role;
grant execute on function public."lv_limpar_contexto_de_preco"() to public, "anon", "authenticated", "service_role";
revoke all on function public."lv_meus_vendedores"() from public, anon, authenticated, service_role;
grant execute on function public."lv_meus_vendedores"() to "anon", "authenticated", "service_role";
revoke all on function public."lv_nasce_produto"() from public, anon, authenticated, service_role;
grant execute on function public."lv_nasce_produto"() to "anon", "authenticated", "service_role";
revoke all on function public."lv_nivel_do_passport"(p_product_id uuid) from public, anon, authenticated, service_role;
grant execute on function public."lv_nivel_do_passport"(p_product_id uuid) to public, "anon", "authenticated", "service_role";
revoke all on function public."lv_nome_da_variante"(p_gramatura integer, p_moagem text, p_embalagem text) from public, anon, authenticated, service_role;
grant execute on function public."lv_nome_da_variante"(p_gramatura integer, p_moagem text, p_embalagem text) to public, "anon", "authenticated", "service_role";
revoke all on function public."lv_normalizar_codigo"(bruto text) from public, anon, authenticated, service_role;
grant execute on function public."lv_normalizar_codigo"(bruto text) to "anon", "authenticated", "service_role";
revoke all on function public."lv_publicar_produto"(p_id uuid, p_publicar boolean) from public, anon, authenticated, service_role;
grant execute on function public."lv_publicar_produto"(p_id uuid, p_publicar boolean) to "anon", "authenticated", "service_role";
revoke all on function public."lv_registra_preco"() from public, anon, authenticated, service_role;
grant execute on function public."lv_registra_preco"() to "anon", "authenticated", "service_role";
revoke all on function public."lv_resolver_qr"(p_codigo text) from public, anon, authenticated, service_role;
grant execute on function public."lv_resolver_qr"(p_codigo text) to "anon", "authenticated", "service_role";
revoke all on function public."lv_salvar_produto"(p jsonb) from public, anon, authenticated, service_role;
grant execute on function public."lv_salvar_produto"(p jsonb) to "anon", "authenticated", "service_role";
revoke all on function public."lv_validar_acesso"(codigo text) from public, anon, authenticated, service_role;
grant execute on function public."lv_validar_acesso"(codigo text) to "anon", "authenticated", "service_role";
revoke all on function public."lv_variantes_a_venda"(p_product uuid) from public, anon, authenticated, service_role;
grant execute on function public."lv_variantes_a_venda"(p_product uuid) to "anon", "authenticated", "service_role";
revoke all on function public."lv_vendavel_da_variante"(p_variant uuid) from public, anon, authenticated, service_role;
grant execute on function public."lv_vendavel_da_variante"(p_variant uuid) to "anon", "authenticated", "service_role";
revoke all on function public."lv_vendedor_pode_receber"(p_seller uuid) from public, anon, authenticated, service_role;
grant execute on function public."lv_vendedor_pode_receber"(p_seller uuid) to "anon", "authenticated", "service_role";
revoke all on function public."mark_inactive_reps"() from public, anon, authenticated, service_role;
grant execute on function public."mark_inactive_reps"() to public, "anon", "authenticated", "service_role";
revoke all on function public."my_company_id"() from public, anon, authenticated, service_role;
grant execute on function public."my_company_id"() to public, "anon", "authenticated", "service_role";
revoke all on function public."my_driver_id"() from public, anon, authenticated, service_role;
grant execute on function public."my_driver_id"() to public, "anon", "authenticated", "service_role";
revoke all on function public."my_network_entity_ids"() from public, anon, authenticated, service_role;
grant execute on function public."my_network_entity_ids"() to "anon", "authenticated", "service_role";
revoke all on function public."my_promoter_id"() from public, anon, authenticated, service_role;
grant execute on function public."my_promoter_id"() to public, "anon", "authenticated", "service_role";
revoke all on function public."my_rep_id"() from public, anon, authenticated, service_role;
grant execute on function public."my_rep_id"() to public, "anon", "authenticated", "service_role";
revoke all on function public."my_studio_orgs"() from public, anon, authenticated, service_role;
grant execute on function public."my_studio_orgs"() to "anon", "authenticated", "service_role";
revoke all on function public."network_convert_to_client"(p_entity_id uuid, p_company_id uuid, p_relationship_type text, p_price_segment text, p_payment_method text, p_payment_term text, p_reason text) from public, anon, authenticated, service_role;
grant execute on function public."network_convert_to_client"(p_entity_id uuid, p_company_id uuid, p_relationship_type text, p_price_segment text, p_payment_method text, p_payment_term text, p_reason text) to "anon", "authenticated", "service_role";
revoke all on function public."open_ruptura_chat"(p_incident_id uuid) from public, anon, authenticated, service_role;
grant execute on function public."open_ruptura_chat"(p_incident_id uuid) to public, "anon", "authenticated", "service_role";
revoke all on function public."peso_bruto_kg"(p_unidades integer, p_g_por_unidade integer) from public, anon, authenticated, service_role;
grant execute on function public."peso_bruto_kg"(p_unidades integer, p_g_por_unidade integer) to public, "anon", "authenticated", "service_role";
revoke all on function public."promoter_classify_ruptura"() from public, anon, authenticated, service_role;
grant execute on function public."promoter_classify_ruptura"() to public, "anon", "authenticated", "service_role";
revoke all on function public."promoter_generate_invite"(p_note text) from public, anon, authenticated, service_role;
grant execute on function public."promoter_generate_invite"(p_note text) to public, "anon", "authenticated", "service_role";
revoke all on function public."promoter_generate_invite"(p_note text, p_company uuid) from public, anon, authenticated, service_role;
grant execute on function public."promoter_generate_invite"(p_note text, p_company uuid) to public, "anon", "authenticated", "service_role";
revoke all on function public."promoter_list_invites"() from public, anon, authenticated, service_role;
grant execute on function public."promoter_list_invites"() to public, "anon", "authenticated", "service_role";
revoke all on function public."promoter_register_with_code"(p_code text, p_full_name text, p_cpf text, p_phone text) from public, anon, authenticated, service_role;
grant execute on function public."promoter_register_with_code"(p_code text, p_full_name text, p_cpf text, p_phone text) to public, "anon", "authenticated", "service_role";
revoke all on function public."promoter_ruptura_incident"() from public, anon, authenticated, service_role;
grant execute on function public."promoter_ruptura_incident"() to public, "anon", "authenticated", "service_role";
revoke all on function public."promoter_validate_invite"(p_code text) from public, anon, authenticated, service_role;
grant execute on function public."promoter_validate_invite"(p_code text) to public, "anon", "authenticated", "service_role";
revoke all on function public."promoters_guard_self_update"() from public, anon, authenticated, service_role;
grant execute on function public."promoters_guard_self_update"() to public, "anon", "authenticated", "service_role";
revoke all on function public."rastrear_envio"(p_codigo text) from public, anon, authenticated, service_role;
grant execute on function public."rastrear_envio"(p_codigo text) to "anon", "authenticated", "service_role";
revoke all on function public."repco_apply_stock_on_item"() from public, anon, authenticated, service_role;
grant execute on function public."repco_apply_stock_on_item"() to public, "anon", "authenticated", "service_role";
revoke all on function public."repco_code_used_by"(p_user uuid) from public, anon, authenticated, service_role;
grant execute on function public."repco_code_used_by"(p_user uuid) to public, "anon", "authenticated", "service_role";
revoke all on function public."repco_commission_cycle"(p_date date, p_method text) from public, anon, authenticated, service_role;
grant execute on function public."repco_commission_cycle"(p_date date, p_method text) to public, "anon", "authenticated", "service_role";
revoke all on function public."repco_delete_invite"(p_code text) from public, anon, authenticated, service_role;
grant execute on function public."repco_delete_invite"(p_code text) to public, "anon", "authenticated", "service_role";
revoke all on function public."repco_delete_order"(p_order_id uuid) from public, anon, authenticated, service_role;
grant execute on function public."repco_delete_order"(p_order_id uuid) to public, "anon", "authenticated", "service_role";
revoke all on function public."repco_generate_invite"(p_note text) from public, anon, authenticated, service_role;
grant execute on function public."repco_generate_invite"(p_note text) to public, "anon", "authenticated", "service_role";
revoke all on function public."repco_list_invites"() from public, anon, authenticated, service_role;
grant execute on function public."repco_list_invites"() to public, "anon", "authenticated", "service_role";
revoke all on function public."repco_orders_delivery_guard"() from public, anon, authenticated, service_role;
grant execute on function public."repco_orders_delivery_guard"() to public, "anon", "authenticated", "service_role";
revoke all on function public."repco_register_with_code"(p_code text, p_full_name text, p_cpf text, p_phone text, p_cnpj text) from public, anon, authenticated, service_role;
grant execute on function public."repco_register_with_code"(p_code text, p_full_name text, p_cpf text, p_phone text, p_cnpj text) to public, "anon", "authenticated", "service_role";
revoke all on function public."repco_return_stock_on_cancel"() from public, anon, authenticated, service_role;
grant execute on function public."repco_return_stock_on_cancel"() to public, "anon", "authenticated", "service_role";
revoke all on function public."repco_revoke_invite"(p_code text) from public, anon, authenticated, service_role;
grant execute on function public."repco_revoke_invite"(p_code text) to public, "anon", "authenticated", "service_role";
revoke all on function public."repco_score_on_installment_paid"() from public, anon, authenticated, service_role;
grant execute on function public."repco_score_on_installment_paid"() to public, "anon", "authenticated", "service_role";
revoke all on function public."repco_update_delivery"(p_order_id uuid, p_status text, p_proof_url text, p_proof_filename text, p_lat double precision, p_lng double precision) from public, anon, authenticated, service_role;
grant execute on function public."repco_update_delivery"(p_order_id uuid, p_status text, p_proof_url text, p_proof_filename text, p_lat double precision, p_lng double precision) to public, "anon", "authenticated", "service_role";
revoke all on function public."repco_update_my_contact"(p_email text, p_phone text) from public, anon, authenticated, service_role;
grant execute on function public."repco_update_my_contact"(p_email text, p_phone text) to public, "anon", "authenticated", "service_role";
revoke all on function public."repco_validate_invite"(p_code text) from public, anon, authenticated, service_role;
grant execute on function public."repco_validate_invite"(p_code text) to public, "anon", "authenticated", "service_role";
revoke all on function public."reset_client_snooze_on_order"() from public, anon, authenticated, service_role;
grant execute on function public."reset_client_snooze_on_order"() to public, "anon", "authenticated", "service_role";
revoke all on function public."return_stock_by_reference"(p_reference_type text, p_reference_id uuid, p_notes text) from public, anon, authenticated, service_role;
grant execute on function public."return_stock_by_reference"(p_reference_type text, p_reference_id uuid, p_notes text) to "authenticated", "service_role";
revoke all on function public."return_stock_on_order_cancelled"() from public, anon, authenticated, service_role;
grant execute on function public."return_stock_on_order_cancelled"() to public, "anon", "authenticated", "service_role";
revoke all on function public."set_order_number"() from public, anon, authenticated, service_role;
grant execute on function public."set_order_number"() to public, "anon", "authenticated", "service_role";
revoke all on function public."set_rep_order_number"() from public, anon, authenticated, service_role;
grant execute on function public."set_rep_order_number"() to public, "anon", "authenticated", "service_role";
revoke all on function public."set_repco_client_default_fiscal_order_type"(p_client_id uuid, p_fiscal_order_type text) from public, anon, authenticated, service_role;
grant execute on function public."set_repco_client_default_fiscal_order_type"(p_client_id uuid, p_fiscal_order_type text) to public, "anon", "authenticated", "service_role";
revoke all on function public."storage_orphans"(p_bucket text, p_min_age_days integer) from public, anon, authenticated, service_role;
grant execute on function public."storage_orphans"(p_bucket text, p_min_age_days integer) to "authenticated", "service_role";
revoke all on function public."storage_orphans_summary"(p_min_age_days integer) from public, anon, authenticated, service_role;
grant execute on function public."storage_orphans_summary"(p_min_age_days integer) to "authenticated", "service_role";
revoke all on function public."trigger_recalculate_batch_costs"() from public, anon, authenticated, service_role;
grant execute on function public."trigger_recalculate_batch_costs"() to public, "anon", "authenticated", "service_role";
revoke all on function public."update_client_last_order"() from public, anon, authenticated, service_role;
grant execute on function public."update_client_last_order"() to public, "anon", "authenticated", "service_role";
revoke all on function public."update_product_order"(p_id uuid, new_order integer) from public, anon, authenticated, service_role;
grant execute on function public."update_product_order"(p_id uuid, new_order integer) to public, "anon", "authenticated", "service_role";
revoke all on function public."update_product_stock_from_batches"() from public, anon, authenticated, service_role;
grant execute on function public."update_product_stock_from_batches"() to public, "anon", "authenticated", "service_role";
revoke all on function public."update_product_stock_from_lots"() from public, anon, authenticated, service_role;
grant execute on function public."update_product_stock_from_lots"() to public, "anon", "authenticated", "service_role";
revoke all on function public."update_updated_at_column"() from public, anon, authenticated, service_role;
grant execute on function public."update_updated_at_column"() to public, "anon", "authenticated", "service_role";
revoke all on function public."validar_cupom"(p_codigo text, p_cpf text, p_subtotal numeric, p_frete numeric, p_empresa text) from public, anon, authenticated, service_role;
grant execute on function public."validar_cupom"(p_codigo text, p_cpf text, p_subtotal numeric, p_frete numeric, p_empresa text) to "anon", "authenticated", "service_role";

-- Realtime
do $$ begin alter publication supabase_realtime add table public."chat_conversations"; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public."chat_messages"; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public."price_lists"; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public."promoter_incidents"; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public."promoters"; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public."representative_clients"; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public."representative_order_installments"; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public."representative_orders"; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public."representatives"; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public."route_stops"; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public."studio_videos"; exception when duplicate_object then null; end $$;

-- Buckets (só a configuração; nenhum arquivo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('batch-photos', 'batch-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('carrier-logos', 'carrier-logos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('chat-media', 'chat-media', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('delivery-pods', 'delivery-pods', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('invoices', 'invoices', false, 20971520, array['application/pdf', 'application/xml', 'text/xml', 'image/jpeg', 'image/png', 'image/webp']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('lot-documents', 'lot-documents', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('offer-photos', 'offer-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('product-images', 'product-images', true, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('representative-docs', 'representative-docs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('studio-generations', 'studio-generations', false, 26214400, array['image/png', 'image/jpeg', 'image/webp']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('studio-videos', 'studio-videos', false, 524288000, array['video/mp4', 'video/quicktime', 'video/webm', 'image/png', 'image/jpeg', 'image/webp']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('visit-photos', 'visit-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']) on conflict (id) do nothing;
