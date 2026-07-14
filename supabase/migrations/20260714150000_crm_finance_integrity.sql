-- Integridade comercial e financeira: cancelamento auditavel, soft delete,
-- comprovantes verificaveis e oportunidades independentes.

alter table public.leads
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete set null,
  add column if not exists deletion_reason text;

alter table public.quotes
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_notes text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.users(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete set null,
  add column if not exists deletion_reason text;

alter table public.projects
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete set null,
  add column if not exists deletion_reason text;

alter table public.payments
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete set null,
  add column if not exists deletion_reason text;

alter table public.expenses
  add column if not exists account text,
  add column if not exists transaction_number text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete set null,
  add column if not exists deletion_reason text;

alter table public.files
  add column if not exists file_size bigint check (file_size is null or file_size >= 0),
  add column if not exists uploaded_by uuid references public.users(id) on delete set null,
  add column if not exists receipt_status text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.users(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users(id) on delete set null,
  add column if not exists deletion_reason text;

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete restrict,
  service_name text not null,
  potential_value numeric(12,2) not null default 0 check (potential_value >= 0),
  pipeline_stage text not null default 'Entrada',
  next_activity_at timestamptz,
  next_activity_description text,
  quote_id uuid references public.quotes(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  probability numeric(5,2) not null default 0 check (probability between 0 and 100),
  estimated_close_date date,
  responsible_user_id uuid references public.users(id) on delete set null,
  archived_at timestamptz,
  deleted_at timestamptz,
  deletion_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunities_pipeline_idx
  on public.opportunities(owner_user_id, pipeline_stage, updated_at desc)
  where deleted_at is null and archived_at is null;

create unique index if not exists payments_transaction_number_idx
  on public.payments(owner_user_id, transaction_number)
  where transaction_number is not null and length(trim(transaction_number)) > 0 and deleted_at is null;

create unique index if not exists expenses_transaction_number_idx
  on public.expenses(owner_user_id, transaction_number)
  where transaction_number is not null and length(trim(transaction_number)) > 0 and deleted_at is null;

create index if not exists quotes_active_idx
  on public.quotes(owner_user_id, status, updated_at desc)
  where deleted_at is null and archived_at is null;

create index if not exists payments_active_due_idx
  on public.payments(owner_user_id, status, due_date)
  where deleted_at is null and archived_at is null;

create index if not exists expenses_active_date_idx
  on public.expenses(owner_user_id, expense_date desc)
  where deleted_at is null and archived_at is null;

drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at before update on public.opportunities
for each row execute function public.set_updated_at();

alter table public.opportunities enable row level security;
create policy "Owner can manage opportunities" on public.opportunities
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

-- A proposta com vinculos e preservada. A interface usa estes campos em vez de DELETE.
create or replace function public.prevent_linked_quote_delete()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.payments where quote_id = old.id)
     or exists (select 1 from public.projects where quote_id = old.id)
     or exists (select 1 from public.files where quote_id = old.id) then
    raise exception 'Proposta com vinculos nao pode ser removida fisicamente; use cancelamento, arquivo ou soft delete.';
  end if;
  return old;
end;
$$;

drop trigger if exists quotes_prevent_linked_delete on public.quotes;
create trigger quotes_prevent_linked_delete
before delete on public.quotes
for each row execute function public.prevent_linked_quote_delete();
