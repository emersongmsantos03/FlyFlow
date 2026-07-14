create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'Administrador'
    check (role in ('Administrador', 'Editor', 'Piloto', 'Financeiro', 'Assistente')),
  permissions text[] not null default array[
    'viewDashboard',
    'manageLeads',
    'manageClients',
    'manageProjects',
    'manageAgenda',
    'manageQuotes',
    'manageFinance',
    'manageEquipment',
    'viewReports',
    'manageSettings',
    'manageUsers'
  ],
  is_primary_owner boolean not null default false,
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_user_can_manage_users()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and active = true
      and (is_primary_owner = true or 'manageUsers' = any(permissions))
  );
$$;

create table public.company_settings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  company_name text not null default 'Hero Drone',
  logo_url text,
  document text,
  phone text,
  email text,
  instagram text,
  address text,
  base_city text not null default 'Curitiba, Paraná',
  pix_key text,
  pix_holder_name text,
  default_deposit_percentage numeric(5,2) not null default 50 check (default_deposit_percentage between 0 and 100),
  default_delivery_days integer not null default 5 check (default_delivery_days >= 1),
  default_free_revisions integer not null default 2 check (default_free_revisions >= 0),
  vehicle_average_consumption numeric(10,2) not null default 11 check (vehicle_average_consumption > 0),
  fuel_average_price numeric(10,2) not null default 5.89 check (fuel_average_price >= 0),
  price_per_km numeric(10,2) not null default 1.60 check (price_per_km >= 0),
  free_km numeric(10,2) not null default 10 check (free_km >= 0),
  currency text not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  date_format text not null default 'DD/MM/AAAA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  full_name text not null,
  company_name text not null,
  phone text not null,
  whatsapp text not null,
  email text,
  instagram text,
  city text not null,
  neighborhood text,
  address text,
  source text not null,
  service_interest text not null,
  pipeline_stage text not null default 'Novo lead',
  temperature text not null default 'Morno' check (temperature in ('Frio', 'Morno', 'Quente')),
  estimated_value numeric(12,2) not null default 0 check (estimated_value >= 0),
  probability numeric(5,2) not null default 0 check (probability between 0 and 100),
  entry_date date not null default current_date,
  last_contact_at timestamptz,
  next_contact_at timestamptz,
  loss_reason text,
  notes text,
  responsible_user_id uuid references public.users(id),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_interactions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  interaction_type text not null,
  description text not null,
  interaction_date timestamptz not null default now(),
  user_id uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  full_name text not null,
  company_name text not null,
  document text,
  phone text not null,
  whatsapp text not null,
  email text,
  instagram text,
  address text,
  city text not null,
  source text,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index clients_owner_whatsapp_idx on public.clients(owner_user_id, whatsapp) where whatsapp is not null and whatsapp <> '';
create unique index clients_owner_email_idx on public.clients(owner_user_id, email) where email is not null and email <> '';

create table public.services (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  name text not null,
  category text,
  description text,
  default_price numeric(12,2) not null default 0 check (default_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  project_code text not null,
  name text not null,
  client_id uuid not null references public.clients(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  description text,
  capture_date date not null,
  capture_start_time time,
  capture_end_time time,
  delivery_deadline date not null,
  delivered_at timestamptz,
  address text,
  city text not null,
  contact_name text,
  contact_phone text,
  total_value numeric(12,2) not null default 0 check (total_value >= 0),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  travel_fee numeric(12,2) not null default 0 check (travel_fee >= 0),
  deposit_value numeric(12,2) not null default 0 check (deposit_value >= 0),
  remaining_value numeric(12,2) not null default 0 check (remaining_value >= 0),
  project_status text not null default 'Orçamento',
  financial_status text not null default 'Não faturado',
  payment_method text,
  notes text,
  responsible_user_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_deadline_after_capture check (delivery_deadline >= capture_date),
  constraint project_deposit_not_greater_total check (deposit_value <= total_value)
);

create unique index projects_owner_code_idx on public.projects(owner_user_id, project_code);

create table public.project_checklist_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  category text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  title text not null,
  appointment_type text not null,
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  address text,
  notes text,
  status text not null default 'Agendado',
  color text not null default '#d8a500',
  previous_start_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_end_after_start check (end_at >= start_at)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  quote_number text not null,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  issue_date date not null default current_date,
  expiration_date date not null,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  travel_fee numeric(12,2) not null default 0 check (travel_fee >= 0),
  urgency_fee numeric(12,2) not null default 0 check (urgency_fee >= 0),
  total_value numeric(12,2) not null default 0 check (total_value >= 0),
  deposit_value numeric(12,2) not null default 0 check (deposit_value >= 0),
  delivery_deadline date not null,
  payment_terms text,
  status text not null default 'Rascunho',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_deposit_not_greater_total check (deposit_value <= total_value)
);

create unique index quotes_owner_number_idx on public.quotes(owner_user_id, quote_number);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  total_price numeric(12,2) not null default 0 check (total_price >= 0),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  payment_type text not null,
  amount numeric(12,2) not null check (amount >= 0),
  due_date date not null,
  paid_at timestamptz,
  payment_method text,
  status text not null default 'Pendente',
  notes text,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  description text not null,
  category text not null,
  expense_type text not null,
  amount numeric(12,2) not null check (amount >= 0),
  expense_date date not null,
  due_date date,
  paid_at timestamptz,
  payment_method text,
  status text not null default 'Pendente',
  supplier text,
  recurring boolean not null default false,
  receipt_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  description text not null,
  category text not null,
  amount numeric(12,2) not null check (amount >= 0),
  frequency text not null check (frequency in ('Semanal', 'Mensal', 'Trimestral', 'Semestral', 'Anual')),
  next_charge_date date not null,
  start_date date not null,
  end_date date,
  payment_method text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_url text,
  external_link text,
  description text,
  client_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.project_revisions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  request_date date not null,
  description text not null,
  deadline date,
  status text not null default 'Solicitada',
  completed_at timestamptz,
  additional_charge boolean not null default false,
  additional_value numeric(12,2) not null default 0 check (additional_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  name text not null,
  category text not null,
  brand text,
  model text,
  serial_number text,
  purchase_date date,
  purchase_value numeric(12,2) not null default 0 check (purchase_value >= 0),
  condition text not null default 'Bom',
  last_maintenance_date date,
  next_maintenance_date date,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.equipment_maintenance (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  maintenance_date date not null,
  problem text,
  service_performed text not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  supplier text,
  next_maintenance_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  name text not null,
  color text not null default '#171717',
  created_at timestamptz not null default now()
);

create table public.entity_tags (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null,
  entity_type text,
  entity_id uuid,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.recalculate_project_balance()
returns trigger
language plpgsql
security definer
as $$
declare
  target_project_id uuid;
  project_total numeric(12,2);
  paid_total numeric(12,2);
  remaining_total numeric(12,2);
  has_overdue boolean;
begin
  target_project_id = coalesce(new.project_id, old.project_id);

  select total_value
    into project_total
  from public.projects
  where id = target_project_id;

  if project_total is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(amount), 0)
    into paid_total
  from public.payments
  where project_id = target_project_id
    and status = 'Recebida'
    and payment_type <> 'Reembolso';

  select exists(
    select 1
    from public.payments
    where project_id = target_project_id
      and status not in ('Recebida', 'Cancelada', 'Reembolsada')
      and due_date < current_date
  )
    into has_overdue;

  remaining_total = greatest(project_total - paid_total, 0);

  update public.projects
  set
    remaining_value = remaining_total,
    financial_status = case
      when paid_total >= project_total and project_total > 0 then 'Pago'
      when paid_total > 0 then 'Parcialmente pago'
      when has_overdue then 'Vencido'
      when deposit_value > 0 then 'Aguardando sinal'
      else 'Não faturado'
    end,
    updated_at = now()
  where id = target_project_id;

  return coalesce(new, old);
end;
$$;

create or replace function public.prevent_received_payment_delete()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'Recebida' then
    raise exception 'Pagamentos recebidos não podem ser excluídos. Cancele ou estorne o registro.';
  end if;
  return old;
end;
$$;

create trigger payments_recalculate_project_balance
after insert or update or delete on public.payments
for each row execute function public.recalculate_project_balance();

create trigger payments_prevent_received_delete
before delete on public.payments
for each row execute function public.prevent_received_payment_delete();

create trigger users_set_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger company_settings_set_updated_at before update on public.company_settings for each row execute function public.set_updated_at();
create trigger leads_set_updated_at before update on public.leads for each row execute function public.set_updated_at();
create trigger clients_set_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger services_set_updated_at before update on public.services for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger appointments_set_updated_at before update on public.appointments for each row execute function public.set_updated_at();
create trigger quotes_set_updated_at before update on public.quotes for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses for each row execute function public.set_updated_at();
create trigger recurring_expenses_set_updated_at before update on public.recurring_expenses for each row execute function public.set_updated_at();
create trigger project_revisions_set_updated_at before update on public.project_revisions for each row execute function public.set_updated_at();
create trigger equipment_set_updated_at before update on public.equipment for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.company_settings enable row level security;
alter table public.leads enable row level security;
alter table public.lead_interactions enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.projects enable row level security;
alter table public.project_checklist_items enable row level security;
alter table public.appointments enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.files enable row level security;
alter table public.project_revisions enable row level security;
alter table public.equipment enable row level security;
alter table public.equipment_maintenance enable row level security;
alter table public.tags enable row level security;
alter table public.entity_tags enable row level security;
alter table public.notifications enable row level security;

create policy "Users can read own profile" on public.users
  for select using (id = auth.uid());
create policy "Users can update own profile" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "Managers can manage users" on public.users
  for all using (public.current_user_can_manage_users()) with check (public.current_user_can_manage_users());

create policy "Owner can manage company_settings" on public.company_settings
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage leads" on public.leads
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage lead_interactions" on public.lead_interactions
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage clients" on public.clients
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage services" on public.services
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage projects" on public.projects
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage project_checklist_items" on public.project_checklist_items
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage appointments" on public.appointments
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage quotes" on public.quotes
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage quote_items" on public.quote_items
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage payments" on public.payments
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage expenses" on public.expenses
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage recurring_expenses" on public.recurring_expenses
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage files" on public.files
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage project_revisions" on public.project_revisions
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage equipment" on public.equipment
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage equipment_maintenance" on public.equipment_maintenance
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage tags" on public.tags
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage entity_tags" on public.entity_tags
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Owner can manage notifications" on public.notifications
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
