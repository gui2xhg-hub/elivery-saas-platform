-- =====================================================================
-- DELIVERY — CORREÇÕES DE COMUNICAÇÃO ENTRE CARDÁPIO, COZINHA E ADMIN
-- Cole no Supabase (projeto do DELIVERY) > SQL Editor > Run.
-- Seguro: só cria o que falta. Não apaga nem altera pedidos, produtos ou lojas.
-- Pode rodar mais de uma vez.
-- =====================================================================

-- 1) Colunas que o painel admin e a cozinha usam (cria só se faltar)
alter table public.tenants add column if not exists cnpj text;
alter table public.tenants add column if not exists address text;
alter table public.tenants add column if not exists instagram_url text;
alter table public.tenants add column if not exists promo_banners text;
alter table public.tenants add column if not exists opening_time text;
alter table public.tenants add column if not exists closing_time text;
alter table public.tenants add column if not exists has_lunch_break boolean default false;
alter table public.tenants add column if not exists lunch_opening_time text;
alter table public.tenants add column if not exists lunch_closing_time text;
alter table public.tenants add column if not exists work_days jsonb;
alter table public.tenants add column if not exists weekly_schedule text;
alter table public.tenants add column if not exists pixel_id text;
alter table public.tenants add column if not exists custom_message text;
alter table public.tenants add column if not exists pix_enabled boolean default false;
alter table public.tenants add column if not exists pix_provider text default 'mercadopago';
alter table public.tenants add column if not exists pix_access_token text;
alter table public.tenants add column if not exists has_delivery boolean default true;
alter table public.tenants add column if not exists has_balcao boolean default true;
alter table public.tenants add column if not exists has_tables boolean default true;
alter table public.tenants add column if not exists has_waiters boolean default false;
alter table public.tenants add column if not exists auto_reset_orders boolean default false;
alter table public.tenants add column if not exists order_reset_at timestamptz;

alter table public.orders add column if not exists daily_number integer;
alter table public.orders add column if not exists archived boolean default false;
alter table public.orders add column if not exists is_paid boolean default false;
alter table public.orders add column if not exists paid_amount numeric;
alter table public.orders add column if not exists waiter_name text;
alter table public.orders add column if not exists table_number text;
alter table public.orders add column if not exists order_type text;
alter table public.orders add column if not exists change_for text;
alter table public.orders add column if not exists notes text;

create index if not exists idx_orders_tenant_created on public.orders (tenant_id, created_at desc);

-- 2) NÚMERO DO PEDIDO DO DIA, gravado no próprio pedido
--    O cliente, o WhatsApp, a cozinha e o admin passam a ver o MESMO número (#01, #02...).
--    Recomeça quando a loja clica em "Zerar contador" ou, com "zerar automático", a cada dia.
create or replace function public.orders_set_daily_number()
returns trigger
language plpgsql
as $$
declare
  v_t jsonb;
  v_reset timestamptz := '1970-01-01'::timestamptz;
  v_day timestamptz;
  v_next integer;
begin
  if new.daily_number is not null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('daily_number:' || new.tenant_id::text));

  select to_jsonb(t) into v_t from public.tenants t where t.id = new.tenant_id;
  begin
    if v_t ? 'order_reset_at' and coalesce(v_t->>'order_reset_at', '') <> '' then
      v_reset := (v_t->>'order_reset_at')::timestamptz;
    end if;
  exception when others then v_reset := '1970-01-01'::timestamptz;
  end;
  if coalesce((v_t->>'auto_reset_orders')::boolean, false) then
    v_day := (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
    if v_day > v_reset then v_reset := v_day; end if;
  end if;

  select greatest(count(*), coalesce(max(o.daily_number), 0)) + 1 into v_next
    from public.orders o
   where o.tenant_id = new.tenant_id and o.created_at >= v_reset;

  new.daily_number := v_next;
  return new;
end;
$$;

drop trigger if exists trg_orders_daily_number on public.orders;
create trigger trg_orders_daily_number before insert on public.orders
for each row execute function public.orders_set_daily_number();

-- 3) TEMPO REAL: a cozinha recebe o pedido novo na hora (sem precisar atualizar a página)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    execute 'alter publication supabase_realtime add table public.orders';
  end if;
end $$;
alter table public.orders replica identity full;

-- Pronto. Deve aparecer: orders | sim
select 'orders' as tabela,
       case when exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders') then 'sim' else 'não (ative em Database > Replication)' end as tempo_real_ligado;
