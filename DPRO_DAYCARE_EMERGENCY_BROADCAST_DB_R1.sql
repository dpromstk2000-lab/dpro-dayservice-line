-- ============================================================
-- DPRO DAYCARE 緊急・一斉連絡 STANDARD V1.0
-- DB R3 / 2026-09-25
-- Expected DB version: DAYCARE-DB-R3-20260925-EMERGENCY-BROADCAST-01
-- forward-only / rerun safe
-- ============================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.dayservice_line_delivery_targets (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.dayservice_facilities(id) on delete cascade,
  family_member_id uuid not null references public.dayservice_family_members(id) on delete cascade,
  user_id uuid references public.dayservice_users(id) on delete set null,
  line_user_id text not null,
  line_user_id_hash text not null,
  consent_status text not null default 'active'
    check (consent_status in ('active','revoked','pending')),
  is_active boolean not null default true,
  verified_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, line_user_id_hash)
);

create index if not exists dayservice_line_delivery_target_family_idx
  on public.dayservice_line_delivery_targets(facility_id, family_member_id);

create table if not exists public.dayservice_broadcast_templates (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references public.dayservice_facilities(id) on delete cascade,
  template_code text not null,
  category text not null,
  title text not null,
  subject text,
  message_body text not null,
  priority text not null default 'normal'
    check (priority in ('emergency','important','normal')),
  is_system boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dayservice_broadcast_templates_scope_code_uq
  on public.dayservice_broadcast_templates(
    coalesce(facility_id, '00000000-0000-0000-0000-000000000000'::uuid),
    template_code
  );

create table if not exists public.dayservice_broadcasts (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.dayservice_facilities(id) on delete cascade,
  priority text not null default 'normal'
    check (priority in ('emergency','important','normal')),
  broadcast_type text not null default 'general',
  subject text,
  message_body text not null,
  target_type text not null,
  target_filter jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','previewed','scheduled','sending','sent','partial','failed','cancelled')),
  idempotency_key text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_by text,
  approved_by text,
  target_user_count integer not null default 0,
  target_family_count integer not null default 0,
  deliverable_count integer not null default 0,
  unlinked_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  acknowledged_count integer not null default 0,
  source_broadcast_id uuid references public.dayservice_broadcasts(id) on delete set null,
  line_request_summary jsonb not null default '{}'::jsonb,
  error_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dayservice_broadcast_idempotency_uq
  on public.dayservice_broadcasts(facility_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists dayservice_broadcast_history_idx
  on public.dayservice_broadcasts(facility_id, created_at desc);

create index if not exists dayservice_broadcast_schedule_idx
  on public.dayservice_broadcasts(status, scheduled_at)
  where status = 'scheduled';

create table if not exists public.dayservice_broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.dayservice_broadcasts(id) on delete cascade,
  facility_id uuid not null references public.dayservice_facilities(id) on delete cascade,
  user_id uuid references public.dayservice_users(id) on delete set null,
  family_member_id uuid references public.dayservice_family_members(id) on delete set null,
  delivery_target_id uuid references public.dayservice_line_delivery_targets(id) on delete set null,
  delivery_channel text not null default 'line'
    check (delivery_channel in ('line','phone','sms','email')),
  send_status text not null default 'pending'
    check (send_status in ('pending','skipped','sending','sent','failed')),
  sent_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_note text,
  acknowledgement_token_hash text,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (broadcast_id, family_member_id, delivery_channel)
);

create index if not exists dayservice_broadcast_recipient_status_idx
  on public.dayservice_broadcast_recipients(broadcast_id, send_status);

create index if not exists dayservice_broadcast_recipient_ack_idx
  on public.dayservice_broadcast_recipients(broadcast_id, acknowledged_at);

create unique index if not exists dayservice_broadcast_ack_token_uq
  on public.dayservice_broadcast_recipients(acknowledgement_token_hash)
  where acknowledgement_token_hash is not null;

drop trigger if exists dayservice_line_delivery_targets_set_updated_at
  on public.dayservice_line_delivery_targets;
create trigger dayservice_line_delivery_targets_set_updated_at
before update on public.dayservice_line_delivery_targets
for each row execute function public.dayservice_set_updated_at();

drop trigger if exists dayservice_broadcast_templates_set_updated_at
  on public.dayservice_broadcast_templates;
create trigger dayservice_broadcast_templates_set_updated_at
before update on public.dayservice_broadcast_templates
for each row execute function public.dayservice_set_updated_at();

drop trigger if exists dayservice_broadcasts_set_updated_at
  on public.dayservice_broadcasts;
create trigger dayservice_broadcasts_set_updated_at
before update on public.dayservice_broadcasts
for each row execute function public.dayservice_set_updated_at();

drop trigger if exists dayservice_broadcast_recipients_set_updated_at
  on public.dayservice_broadcast_recipients;
create trigger dayservice_broadcast_recipients_set_updated_at
before update on public.dayservice_broadcast_recipients
for each row execute function public.dayservice_set_updated_at();

alter table public.dayservice_line_delivery_targets enable row level security;
alter table public.dayservice_broadcast_templates enable row level security;
alter table public.dayservice_broadcasts enable row level security;
alter table public.dayservice_broadcast_recipients enable row level security;

insert into public.dayservice_broadcast_templates
  (facility_id, template_code, category, title, subject, message_body, priority, is_system, display_order)
values
  (null,'earthquake','disaster','地震発生時','【重要】地震発生に伴うご連絡',
   E'地震発生に伴い、施設の状況についてご連絡いたします。\n安全を確認しながら対応しております。詳細が分かり次第、改めてご案内いたします。','emergency',true,10),
  (null,'typhoon','disaster','台風接近','【重要】台風接近に伴うご連絡',
   E'台風接近に伴い、営業・送迎について確認しております。\n安全を最優先に対応し、変更がある場合は改めてご案内いたします。','important',true,20),
  (null,'heavy_rain','disaster','大雨・避難','【重要】大雨に伴うご連絡',
   E'大雨の影響について確認しております。\n安全を最優先に対応し、営業・送迎等に変更がある場合は改めてご案内いたします。','emergency',true,30),
  (null,'temporary_close','operation','臨時休業','【重要】臨時休業のお知らせ',
   E'本日の営業について、臨時休業とさせていただきます。\nご利用予定の皆様にはご迷惑をおかけいたします。','important',true,40),
  (null,'transport_delay','transport','送迎遅延','送迎遅延のお知らせ',
   E'道路状況等の影響により、送迎に遅れが生じております。\n到着まで今しばらくお待ちください。','important',true,50),
  (null,'transport_cancel','transport','送迎中止','【重要】送迎中止のお知らせ',
   E'安全上の理由により、送迎を中止いたします。\n詳細については施設から改めてご案内いたします。','emergency',true,60)
on conflict do nothing;

update public.dayservice_system_versions
set database_version = 'DAYCARE-DB-R3-20260925-EMERGENCY-BROADCAST-01'
where id = 'current';

commit;
