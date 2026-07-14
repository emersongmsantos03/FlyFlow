-- Fluxo operacional integrado: CRM -> proposta -> entrada -> projeto -> entrega.
-- Esta migration preserva os dados existentes e adiciona vínculos e idempotência.

alter table public.company_settings alter column default_delivery_days set default 7;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role, is_primary_owner)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    'Administrador',
    lower(new.email) = 'herodronecwb@gmail.com'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.projects
  add column if not exists quote_id uuid references public.quotes(id) on delete restrict,
  add column if not exists manual_creation_reason text,
  add column if not exists actual_capture_at timestamptz,
  add column if not exists editing_started_at timestamptz,
  add column if not exists original_delivery_deadline date,
  add column if not exists review_sent_at timestamptz,
  add column if not exists final_delivery_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists exceptional_delivery_reason text,
  alter column capture_date drop not null,
  alter column delivery_deadline drop not null;

alter table public.projects drop constraint if exists project_deadline_after_capture;
alter table public.projects add constraint project_deadline_after_capture
  check (capture_date is null or delivery_deadline is null or delivery_deadline >= capture_date) not valid;

create unique index if not exists projects_one_per_quote_idx
  on public.projects(owner_user_id, quote_id) where quote_id is not null;

alter table public.quotes
  add column if not exists version integer not null default 0 check (version >= 0),
  add column if not exists parent_quote_id uuid references public.quotes(id) on delete restrict,
  add column if not exists project_id uuid references public.projects(id) on delete restrict,
  add column if not exists sent_at timestamptz,
  add column if not exists viewed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text,
  add column if not exists approval_method text,
  add column if not exists approval_notes text,
  add column if not exists refusal_reason text,
  add column if not exists validity_change_reason text,
  add column if not exists service_location text,
  add column if not exists responsible_user_id uuid references public.users(id) on delete set null;

alter table public.appointments
  add column if not exists quote_id uuid references public.quotes(id) on delete set null,
  add column if not exists external_event_id text,
  add column if not exists calendar_url text,
  add column if not exists create_google_calendar boolean not null default true,
  add column if not exists confirmation_status text not null default 'Pendente',
  add column if not exists reschedule_reason text;

create unique index if not exists appointments_one_active_capture_idx
  on public.appointments(owner_user_id, project_id)
  where project_id is not null and appointment_type = 'Captação' and status <> 'Cancelado';

alter table public.payments
  alter column project_id drop not null,
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists quote_id uuid references public.quotes(id) on delete restrict,
  add column if not exists account text,
  add column if not exists transaction_number text,
  add column if not exists confirmed_received boolean not null default false,
  add column if not exists confirmed_at timestamptz,
  add column if not exists source_key text;

create unique index if not exists payments_owner_source_key_idx
  on public.payments(owner_user_id, source_key) where source_key is not null;

alter table public.payments add constraint received_payment_requires_confirmation
  check (status <> 'Recebida' or (confirmed_received and paid_at is not null)) not valid;

alter table public.files
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists quote_id uuid references public.quotes(id) on delete set null,
  add column if not exists payment_id uuid references public.payments(id) on delete set null;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz not null,
  priority text not null default 'Média',
  status text not null default 'Pendente',
  lead_id uuid references public.leads(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  responsible_user_id uuid references public.users(id) on delete set null,
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tasks_owner_source_key_idx
  on public.tasks(owner_user_id, source_key) where source_key is not null;

create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  from_status text,
  to_status text,
  details text,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists status_history_entity_idx
  on public.status_history(owner_user_id, entity_type, entity_id, created_at desc);

create table if not exists public.project_adjustments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  version integer not null check (version > 0),
  description text not null,
  status text not null default 'Solicitado',
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, project_id, version)
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  payment_id uuid unique references public.payments(id) on delete restrict,
  client_id uuid references public.clients(id) on delete restrict,
  quote_id uuid references public.quotes(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  category text not null,
  transaction_type text not null default 'Receita',
  amount numeric(12,2) not null check (amount >= 0),
  expected_date date not null,
  received_at timestamptz,
  status text not null,
  payment_method text,
  account text,
  receipt_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_state_snapshots (
  owner_user_id uuid primary key references public.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.sync_payment_financial_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.financial_transactions (
    owner_user_id, payment_id, client_id, quote_id, project_id, category,
    amount, expected_date, received_at, status, payment_method, account, receipt_url, notes
  ) values (
    new.owner_user_id, new.id, new.client_id, new.quote_id, new.project_id, new.payment_type,
    new.amount, new.due_date, new.paid_at,
    case
      when new.status = 'Recebida' then 'Recebido'
      when new.status = 'Vencida' then 'Atrasado'
      when new.status in ('Cancelada', 'Reembolsada') then new.status
      else 'Previsto'
    end,
    new.payment_method, new.account, new.receipt_url, new.notes
  )
  on conflict (payment_id) do update set
    project_id = excluded.project_id,
    amount = excluded.amount,
    expected_date = excluded.expected_date,
    received_at = excluded.received_at,
    status = excluded.status,
    payment_method = excluded.payment_method,
    account = excluded.account,
    receipt_url = excluded.receipt_url,
    notes = excluded.notes,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists payments_sync_financial_transaction on public.payments;
create trigger payments_sync_financial_transaction
after insert or update on public.payments
for each row execute function public.sync_payment_financial_transaction();

create or replace function public.expire_due_quotes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare affected integer;
begin
  update public.quotes
  set status = 'Expirada', updated_at = now()
  where expiration_date < current_date
    and status in ('Rascunho', 'Gerada', 'Enviada', 'Visualizada', 'Em negociação');
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.validate_project_origin()
returns trigger
language plpgsql
as $$
declare proposal_status text;
begin
  if new.quote_id is null and length(trim(coalesce(new.manual_creation_reason, ''))) < 5 then
    raise exception 'Projeto manual exige justificativa.';
  end if;
  if new.quote_id is not null then
    select status into proposal_status from public.quotes where id = new.quote_id;
    if proposal_status not in ('Aprovada', 'Aguardando entrada', 'Entrada recebida', 'Convertida em projeto') then
      raise exception 'Projeto exige proposta aceita e entrada confirmada.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_validate_origin on public.projects;
create trigger projects_validate_origin
before insert or update of quote_id, manual_creation_reason on public.projects
for each row execute function public.validate_project_origin();

create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
create trigger project_adjustments_set_updated_at before update on public.project_adjustments
for each row execute function public.set_updated_at();
create trigger financial_transactions_set_updated_at before update on public.financial_transactions
for each row execute function public.set_updated_at();
create trigger app_state_snapshots_set_updated_at before update on public.app_state_snapshots
for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;
alter table public.status_history enable row level security;
alter table public.project_adjustments enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.app_state_snapshots enable row level security;

create policy "Owner can manage tasks" on public.tasks
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage status_history" on public.status_history
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage project_adjustments" on public.project_adjustments
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage financial_transactions" on public.financial_transactions
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage app_state_snapshots" on public.app_state_snapshots
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
