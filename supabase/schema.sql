-- Fazenda Cria - schema online Supabase
-- Cole este arquivo no Supabase SQL Editor para criar a base online inicial.
-- Nunca use a service_role key no frontend. O app deve usar apenas a anon key com RLS.

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

create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.farm_members (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists farm_members_active_user_key
  on public.farm_members (farm_id, user_id)
  where deleted_at is null;

create or replace function public.is_farm_member(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.farm_members fm
    where fm.farm_id = target_farm_id
      and fm.user_id = auth.uid()
      and fm.deleted_at is null
  );
$$;

create or replace function public.is_farm_admin(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.farm_members fm
    where fm.farm_id = target_farm_id
      and fm.user_id = auth.uid()
      and fm.role in ('owner', 'admin')
      and fm.deleted_at is null
  );
$$;

create or replace function public.create_owner_membership_for_new_farm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.farm_members (farm_id, user_id, role, created_by)
  values (new.id, new.owner_id, 'owner', new.owner_id)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists farms_create_owner_membership on public.farms;
create trigger farms_create_owner_membership
after insert on public.farms
for each row
execute function public.create_owner_membership_for_new_farm();

create table if not exists public.lots (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  name text not null,
  type text not null default 'paddock' check (type in ('lot', 'paddock')),
  pasture_type text,
  area_hectares numeric(10, 2) check (area_hectares is null or area_hectares >= 0),
  description text,
  active boolean not null default true,
  status text not null default 'active' check (status in ('active', 'inactive', 'maintenance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, farm_id)
);

create table if not exists public.semen (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  code text,
  bull_name text not null,
  breed text,
  batch text,
  supplier text,
  semen_center text,
  quantity integer not null default 0 check (quantity >= 0),
  doses_available integer not null default 0 check (doses_available >= 0),
  price_per_dose numeric(12, 2) check (price_per_dose is null or price_per_dose >= 0),
  genetic_traits text,
  expiration_date date,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive', 'sold_out')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, farm_id)
);

create table if not exists public.animals (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  identification text not null,
  name text,
  sex text not null default 'unknown' check (sex in ('female', 'male', 'unknown')),
  category text not null check (category in ('matrix', 'bull', 'calf', 'heifer', 'steer', 'discard', 'other')),
  status text not null default 'active' check (status in ('active', 'sold', 'dead', 'discarded', 'inactive')),
  breed text,
  birth_date date,
  weight_kg numeric(10, 2) check (weight_kg is null or weight_kg >= 0),
  reproductive_status text check (
    reproductive_status is null
    or reproductive_status in ('empty', 'inseminated', 'pregnant', 'calved', 'discarded')
  ),
  lot_id uuid,
  mother_id uuid,
  father_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, farm_id),
  constraint animals_lot_same_farm_fk
    foreign key (lot_id, farm_id) references public.lots(id, farm_id),
  constraint animals_mother_same_farm_fk
    foreign key (mother_id, farm_id) references public.animals(id, farm_id),
  constraint animals_father_same_farm_fk
    foreign key (father_id, farm_id) references public.animals(id, farm_id)
);

create table if not exists public.inseminations (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  animal_id uuid not null,
  date date not null,
  semen_id uuid,
  bull_id uuid,
  technician text,
  protocol text,
  type text not null default 'iatf' check (type in ('iatf', 'conventional_ai', 'natural_mating')),
  status text not null default 'awaiting_diagnosis' check (
    status in ('awaiting_diagnosis', 'positive', 'negative', 'aborted')
  ),
  diagnosis_due_date date,
  birth_due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, farm_id),
  constraint inseminations_animal_same_farm_fk
    foreign key (animal_id, farm_id) references public.animals(id, farm_id),
  constraint inseminations_semen_same_farm_fk
    foreign key (semen_id, farm_id) references public.semen(id, farm_id),
  constraint inseminations_bull_same_farm_fk
    foreign key (bull_id, farm_id) references public.animals(id, farm_id)
);

create table if not exists public.pregnancy_diagnoses (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  animal_id uuid not null,
  insemination_id uuid,
  diagnosis_date date not null,
  method text not null default 'ultrasound' check (method in ('ultrasound', 'palpation', 'observation', 'other')),
  result text not null check (result in ('pregnant', 'empty', 'inconclusive')),
  expected_birth_date date,
  responsible text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, farm_id),
  constraint pregnancy_diagnoses_animal_same_farm_fk
    foreign key (animal_id, farm_id) references public.animals(id, farm_id),
  constraint pregnancy_diagnoses_insemination_same_farm_fk
    foreign key (insemination_id, farm_id) references public.inseminations(id, farm_id)
);

create table if not exists public.births (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  animal_id uuid not null,
  birth_date date not null,
  birth_type text default 'normal' check (birth_type is null or birth_type in ('normal', 'assisted', 'cesarean')),
  calf_count integer not null default 1 check (calf_count >= 1),
  outcome text not null default 'unknown' check (outcome in ('alive', 'stillborn', 'abortion', 'unknown')),
  calf_id uuid,
  calf_identification text,
  calf_sex text check (calf_sex is null or calf_sex in ('female', 'male', 'unknown')),
  calf_status text check (calf_status is null or calf_status in ('alive', 'dead', 'weak', 'sold')),
  birth_weight_kg numeric(10, 2) check (birth_weight_kg is null or birth_weight_kg >= 0),
  responsible text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, farm_id),
  constraint births_animal_same_farm_fk
    foreign key (animal_id, farm_id) references public.animals(id, farm_id),
  constraint births_calf_same_farm_fk
    foreign key (calf_id, farm_id) references public.animals(id, farm_id)
);

create table if not exists public.sanitary_management (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  animal_id uuid,
  lot_id uuid,
  date date not null,
  procedure_type text not null check (
    procedure_type in ('vaccine', 'deworming', 'medication', 'veterinary_procedure', 'exam', 'other')
  ),
  next_application_date date,
  product text,
  dosage text,
  responsible text,
  notes text,
  status text not null default 'done' check (status in ('done', 'pending', 'overdue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, farm_id),
  constraint sanitary_target_required_check
    check (
      (animal_id is not null and lot_id is null)
      or (animal_id is null and lot_id is not null)
    ),
  constraint sanitary_animal_same_farm_fk
    foreign key (animal_id, farm_id) references public.animals(id, farm_id),
  constraint sanitary_lot_same_farm_fk
    foreign key (lot_id, farm_id) references public.lots(id, farm_id)
);

create table if not exists public.farm_settings (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  farm_name text not null,
  owner_name text,
  document text,
  city text,
  state text,
  area_total_hectares numeric(12, 2) check (area_total_hectares is null or area_total_hectares >= 0),
  app_preferences jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, farm_id)
);

create unique index if not exists farm_settings_one_active_per_farm_key
  on public.farm_settings (farm_id)
  where deleted_at is null;

alter table public.farm_settings
  add column if not exists area_total_hectares numeric(12, 2)
    check (area_total_hectares is null or area_total_hectares >= 0),
  add column if not exists app_preferences jsonb not null default '{}'::jsonb;

create unique index if not exists animals_farm_identification_active_key
  on public.animals (farm_id, lower(identification))
  where deleted_at is null;

create unique index if not exists lots_farm_name_active_key
  on public.lots (farm_id, lower(name))
  where deleted_at is null;

create unique index if not exists semen_farm_code_active_key
  on public.semen (farm_id, lower(code))
  where code is not null and deleted_at is null;

create index if not exists farms_owner_id_idx on public.farms (owner_id);
create index if not exists farm_members_user_id_idx on public.farm_members (user_id);
create index if not exists farm_members_farm_id_idx on public.farm_members (farm_id);

create index if not exists animals_farm_id_idx on public.animals (farm_id);
create index if not exists animals_farm_category_idx on public.animals (farm_id, category) where deleted_at is null;
create index if not exists animals_farm_lot_idx on public.animals (farm_id, lot_id) where deleted_at is null;
create index if not exists animals_farm_status_idx on public.animals (farm_id, status) where deleted_at is null;

create index if not exists inseminations_farm_date_idx on public.inseminations (farm_id, date desc) where deleted_at is null;
create index if not exists inseminations_animal_idx on public.inseminations (animal_id) where deleted_at is null;
create index if not exists inseminations_birth_due_idx on public.inseminations (farm_id, birth_due_date) where deleted_at is null;
create index if not exists inseminations_diagnosis_due_idx on public.inseminations (farm_id, diagnosis_due_date) where deleted_at is null;

create index if not exists pregnancy_diagnoses_farm_date_idx on public.pregnancy_diagnoses (farm_id, diagnosis_date desc) where deleted_at is null;
create index if not exists pregnancy_diagnoses_animal_idx on public.pregnancy_diagnoses (animal_id) where deleted_at is null;

create index if not exists births_farm_date_idx on public.births (farm_id, birth_date desc) where deleted_at is null;
create index if not exists births_animal_idx on public.births (animal_id) where deleted_at is null;

create index if not exists semen_farm_status_idx on public.semen (farm_id, status) where deleted_at is null;
create index if not exists semen_low_stock_idx on public.semen (farm_id, doses_available) where deleted_at is null;

create index if not exists sanitary_farm_date_idx on public.sanitary_management (farm_id, date desc) where deleted_at is null;
create index if not exists sanitary_farm_next_date_idx on public.sanitary_management (farm_id, next_application_date) where deleted_at is null;
create index if not exists sanitary_farm_status_idx on public.sanitary_management (farm_id, status) where deleted_at is null;

create index if not exists lots_farm_status_idx on public.lots (farm_id, status) where deleted_at is null;

drop trigger if exists farms_set_updated_at on public.farms;
create trigger farms_set_updated_at before update on public.farms
for each row execute function public.set_updated_at();

drop trigger if exists farm_members_set_updated_at on public.farm_members;
create trigger farm_members_set_updated_at before update on public.farm_members
for each row execute function public.set_updated_at();

drop trigger if exists animals_set_updated_at on public.animals;
create trigger animals_set_updated_at before update on public.animals
for each row execute function public.set_updated_at();

drop trigger if exists inseminations_set_updated_at on public.inseminations;
create trigger inseminations_set_updated_at before update on public.inseminations
for each row execute function public.set_updated_at();

drop trigger if exists pregnancy_diagnoses_set_updated_at on public.pregnancy_diagnoses;
create trigger pregnancy_diagnoses_set_updated_at before update on public.pregnancy_diagnoses
for each row execute function public.set_updated_at();

drop trigger if exists births_set_updated_at on public.births;
create trigger births_set_updated_at before update on public.births
for each row execute function public.set_updated_at();

drop trigger if exists semen_set_updated_at on public.semen;
create trigger semen_set_updated_at before update on public.semen
for each row execute function public.set_updated_at();

drop trigger if exists sanitary_management_set_updated_at on public.sanitary_management;
create trigger sanitary_management_set_updated_at before update on public.sanitary_management
for each row execute function public.set_updated_at();

drop trigger if exists lots_set_updated_at on public.lots;
create trigger lots_set_updated_at before update on public.lots
for each row execute function public.set_updated_at();

drop trigger if exists farm_settings_set_updated_at on public.farm_settings;
create trigger farm_settings_set_updated_at before update on public.farm_settings
for each row execute function public.set_updated_at();

alter table public.farms enable row level security;
alter table public.farm_members enable row level security;
alter table public.animals enable row level security;
alter table public.inseminations enable row level security;
alter table public.pregnancy_diagnoses enable row level security;
alter table public.births enable row level security;
alter table public.semen enable row level security;
alter table public.sanitary_management enable row level security;
alter table public.lots enable row level security;
alter table public.farm_settings enable row level security;

drop policy if exists "farms_select_member" on public.farms;
create policy "farms_select_member"
on public.farms
for select
to authenticated
using (public.is_farm_member(id));

drop policy if exists "farms_insert_owner" on public.farms;
create policy "farms_insert_owner"
on public.farms
for insert
to authenticated
with check (auth.uid() is not null and owner_id = auth.uid() and created_by = auth.uid());

drop policy if exists "farms_update_admin" on public.farms;
create policy "farms_update_admin"
on public.farms
for update
to authenticated
using (public.is_farm_admin(id))
with check (public.is_farm_admin(id));

drop policy if exists "farms_delete_admin" on public.farms;
create policy "farms_delete_admin"
on public.farms
for delete
to authenticated
using (public.is_farm_admin(id));

drop policy if exists "farm_members_select_member" on public.farm_members;
create policy "farm_members_select_member"
on public.farm_members
for select
to authenticated
using (public.is_farm_member(farm_id));

drop policy if exists "farm_members_insert_admin" on public.farm_members;
create policy "farm_members_insert_admin"
on public.farm_members
for insert
to authenticated
with check (public.is_farm_admin(farm_id));

drop policy if exists "farm_members_update_admin" on public.farm_members;
create policy "farm_members_update_admin"
on public.farm_members
for update
to authenticated
using (public.is_farm_admin(farm_id))
with check (public.is_farm_admin(farm_id));

drop policy if exists "farm_members_delete_admin" on public.farm_members;
create policy "farm_members_delete_admin"
on public.farm_members
for delete
to authenticated
using (public.is_farm_admin(farm_id));

drop policy if exists "animals_select_member" on public.animals;
create policy "animals_select_member" on public.animals
for select to authenticated
using (public.is_farm_member(farm_id));

drop policy if exists "animals_insert_member" on public.animals;
create policy "animals_insert_member" on public.animals
for insert to authenticated
with check (public.is_farm_member(farm_id) and created_by = auth.uid());

drop policy if exists "animals_update_member" on public.animals;
create policy "animals_update_member" on public.animals
for update to authenticated
using (public.is_farm_member(farm_id))
with check (public.is_farm_member(farm_id));

drop policy if exists "animals_delete_admin" on public.animals;
create policy "animals_delete_admin" on public.animals
for delete to authenticated
using (public.is_farm_admin(farm_id));

drop policy if exists "inseminations_select_member" on public.inseminations;
create policy "inseminations_select_member" on public.inseminations
for select to authenticated
using (public.is_farm_member(farm_id));

drop policy if exists "inseminations_insert_member" on public.inseminations;
create policy "inseminations_insert_member" on public.inseminations
for insert to authenticated
with check (public.is_farm_member(farm_id) and created_by = auth.uid());

drop policy if exists "inseminations_update_member" on public.inseminations;
create policy "inseminations_update_member" on public.inseminations
for update to authenticated
using (public.is_farm_member(farm_id))
with check (public.is_farm_member(farm_id));

drop policy if exists "inseminations_delete_admin" on public.inseminations;
create policy "inseminations_delete_admin" on public.inseminations
for delete to authenticated
using (public.is_farm_admin(farm_id));

drop policy if exists "pregnancy_diagnoses_select_member" on public.pregnancy_diagnoses;
create policy "pregnancy_diagnoses_select_member" on public.pregnancy_diagnoses
for select to authenticated
using (public.is_farm_member(farm_id));

drop policy if exists "pregnancy_diagnoses_insert_member" on public.pregnancy_diagnoses;
create policy "pregnancy_diagnoses_insert_member" on public.pregnancy_diagnoses
for insert to authenticated
with check (public.is_farm_member(farm_id) and created_by = auth.uid());

drop policy if exists "pregnancy_diagnoses_update_member" on public.pregnancy_diagnoses;
create policy "pregnancy_diagnoses_update_member" on public.pregnancy_diagnoses
for update to authenticated
using (public.is_farm_member(farm_id))
with check (public.is_farm_member(farm_id));

drop policy if exists "pregnancy_diagnoses_delete_admin" on public.pregnancy_diagnoses;
create policy "pregnancy_diagnoses_delete_admin" on public.pregnancy_diagnoses
for delete to authenticated
using (public.is_farm_admin(farm_id));

drop policy if exists "births_select_member" on public.births;
create policy "births_select_member" on public.births
for select to authenticated
using (public.is_farm_member(farm_id));

drop policy if exists "births_insert_member" on public.births;
create policy "births_insert_member" on public.births
for insert to authenticated
with check (public.is_farm_member(farm_id) and created_by = auth.uid());

drop policy if exists "births_update_member" on public.births;
create policy "births_update_member" on public.births
for update to authenticated
using (public.is_farm_member(farm_id))
with check (public.is_farm_member(farm_id));

drop policy if exists "births_delete_admin" on public.births;
create policy "births_delete_admin" on public.births
for delete to authenticated
using (public.is_farm_admin(farm_id));

drop policy if exists "semen_select_member" on public.semen;
create policy "semen_select_member" on public.semen
for select to authenticated
using (public.is_farm_member(farm_id));

drop policy if exists "semen_insert_member" on public.semen;
create policy "semen_insert_member" on public.semen
for insert to authenticated
with check (public.is_farm_member(farm_id) and created_by = auth.uid());

drop policy if exists "semen_update_member" on public.semen;
create policy "semen_update_member" on public.semen
for update to authenticated
using (public.is_farm_member(farm_id))
with check (public.is_farm_member(farm_id));

drop policy if exists "semen_delete_admin" on public.semen;
create policy "semen_delete_admin" on public.semen
for delete to authenticated
using (public.is_farm_admin(farm_id));

drop policy if exists "sanitary_management_select_member" on public.sanitary_management;
create policy "sanitary_management_select_member" on public.sanitary_management
for select to authenticated
using (public.is_farm_member(farm_id));

drop policy if exists "sanitary_management_insert_member" on public.sanitary_management;
create policy "sanitary_management_insert_member" on public.sanitary_management
for insert to authenticated
with check (public.is_farm_member(farm_id) and created_by = auth.uid());

drop policy if exists "sanitary_management_update_member" on public.sanitary_management;
create policy "sanitary_management_update_member" on public.sanitary_management
for update to authenticated
using (public.is_farm_member(farm_id))
with check (public.is_farm_member(farm_id));

drop policy if exists "sanitary_management_delete_admin" on public.sanitary_management;
create policy "sanitary_management_delete_admin" on public.sanitary_management
for delete to authenticated
using (public.is_farm_admin(farm_id));

drop policy if exists "lots_select_member" on public.lots;
create policy "lots_select_member" on public.lots
for select to authenticated
using (public.is_farm_member(farm_id));

drop policy if exists "lots_insert_member" on public.lots;
create policy "lots_insert_member" on public.lots
for insert to authenticated
with check (public.is_farm_member(farm_id) and created_by = auth.uid());

drop policy if exists "lots_update_member" on public.lots;
create policy "lots_update_member" on public.lots
for update to authenticated
using (public.is_farm_member(farm_id))
with check (public.is_farm_member(farm_id));

drop policy if exists "lots_delete_admin" on public.lots;
create policy "lots_delete_admin" on public.lots
for delete to authenticated
using (public.is_farm_admin(farm_id));

drop policy if exists "farm_settings_select_member" on public.farm_settings;
create policy "farm_settings_select_member" on public.farm_settings
for select to authenticated
using (public.is_farm_member(farm_id));

drop policy if exists "farm_settings_insert_admin" on public.farm_settings;
create policy "farm_settings_insert_admin" on public.farm_settings
for insert to authenticated
with check (public.is_farm_admin(farm_id) and created_by = auth.uid());

drop policy if exists "farm_settings_update_admin" on public.farm_settings;
create policy "farm_settings_update_admin" on public.farm_settings
for update to authenticated
using (public.is_farm_admin(farm_id))
with check (public.is_farm_admin(farm_id));

drop policy if exists "farm_settings_delete_admin" on public.farm_settings;
create policy "farm_settings_delete_admin" on public.farm_settings
for delete to authenticated
using (public.is_farm_admin(farm_id));

grant usage on schema public to authenticated;

revoke all on table
  public.farms,
  public.farm_members,
  public.animals,
  public.inseminations,
  public.pregnancy_diagnoses,
  public.births,
  public.semen,
  public.sanitary_management,
  public.lots,
  public.farm_settings
from public;

grant select, insert, update, delete on table
  public.farms,
  public.farm_members,
  public.animals,
  public.inseminations,
  public.pregnancy_diagnoses,
  public.births,
  public.semen,
  public.sanitary_management,
  public.lots,
  public.farm_settings
to authenticated;

revoke all on function public.is_farm_member(uuid) from public;
revoke all on function public.is_farm_admin(uuid) from public;

grant execute on function public.is_farm_member(uuid) to authenticated;
grant execute on function public.is_farm_admin(uuid) to authenticated;
