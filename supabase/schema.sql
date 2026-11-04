create extension if not exists pgcrypto;
create type public.member_role as enum ('owner','admin','dispatcher','technician','viewer');
create type public.job_status as enum ('draft','scheduled','dispatched','in_progress','submitted','needs_follow_up','closed','cancelled');
create type public.asset_kind as enum ('kitchen_suppression','portable_extinguisher');
create type public.inspection_result as enum ('pass','fail','deficient','na');
create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table public.organization_members (organization_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role public.member_role not null default 'technician', created_at timestamptz not null default now(), primary key(organization_id,user_id));
create table public.customers (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, billing_email text, billing_phone text, billing_address jsonb not null default '{}'::jsonb, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id));
create table public.sites (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, customer_id uuid not null, name text not null, address jsonb not null default '{}'::jsonb, site_contact text, access_instructions text, created_at timestamptz not null default now(), unique(organization_id,id), foreign key(organization_id,customer_id) references public.customers(organization_id,id) on delete cascade);
create table public.assets (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, site_id uuid not null, kind public.asset_kind not null, asset_tag text, manufacturer text, model text, serial_number text, location_detail text, installed_on date, last_service_on date, next_service_due date, metadata jsonb not null default '{}'::jsonb, retired_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id), foreign key(organization_id,site_id) references public.sites(organization_id,id) on delete cascade);
create table public.service_jobs (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, customer_id uuid not null, site_id uuid not null, assigned_to uuid references auth.users(id), job_number text not null, title text not null, kind public.asset_kind not null, status public.job_status not null default 'draft', scheduled_start timestamptz, scheduled_end timestamptz, instructions text, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,job_number), foreign key(organization_id,customer_id) references public.customers(organization_id,id), foreign key(organization_id,site_id) references public.sites(organization_id,id));
create table public.inspections (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, job_id uuid not null, asset_id uuid, form_key text not null, form_version integer not null default 1, standard_edition text, started_at timestamptz, submitted_at timestamptz, technician_id uuid references auth.users(id), overall_result text, customer_signature_path text, technician_notes text, created_at timestamptz not null default now(), unique(organization_id,id), foreign key(organization_id,job_id) references public.service_jobs(organization_id,id) on delete cascade, foreign key(organization_id,asset_id) references public.assets(organization_id,id));
create table public.inspection_responses (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, inspection_id uuid not null, question_key text not null, question_label text not null, result public.inspection_result, response_text text, measurement jsonb, created_at timestamptz not null default now(), unique(inspection_id,question_key), foreign key(organization_id,inspection_id) references public.inspections(organization_id,id) on delete cascade);
create table public.deficiencies (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, inspection_id uuid not null, asset_id uuid, title text not null, description text, severity text not null default 'normal', status text not null default 'open', discovered_at timestamptz not null default now(), resolved_at timestamptz, resolution_notes text, foreign key(organization_id,inspection_id) references public.inspections(organization_id,id) on delete cascade, foreign key(organization_id,asset_id) references public.assets(organization_id,id));
create table public.inventory_items (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, sku text, name text not null, category text not null, unit text not null default 'each', quantity numeric(12,2) not null default 0 check(quantity>=0), reorder_point numeric(12,2) not null default 0 check(reorder_point>=0), active boolean not null default true, created_at timestamptz not null default now(), unique(organization_id,id));
create table public.inventory_transactions (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, item_id uuid not null, job_id uuid, quantity_delta numeric(12,2) not null check(quantity_delta<>0), reason text not null, created_by uuid references auth.users(id), created_at timestamptz not null default now(), foreign key(organization_id,item_id) references public.inventory_items(organization_id,id), foreign key(organization_id,job_id) references public.service_jobs(organization_id,id));
create table public.quotes (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, customer_id uuid not null, job_id uuid, quote_number text not null, status text not null default 'draft', subtotal_cents bigint not null default 0, tax_cents bigint not null default 0, total_cents bigint not null default 0, valid_until date, customer_approved_at timestamptz, created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,quote_number), foreign key(organization_id,customer_id) references public.customers(organization_id,id), foreign key(organization_id,job_id) references public.service_jobs(organization_id,id));
create table public.quote_lines (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, quote_id uuid not null, description text not null, quantity numeric(12,2) not null default 1, unit_price_cents bigint not null default 0, foreign key(organization_id,quote_id) references public.quotes(organization_id,id) on delete cascade);
create table public.audit_events (id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id) on delete cascade, actor_id uuid references auth.users(id), action text not null, entity_type text not null, entity_id uuid, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create index on public.sites(organization_id,customer_id);
create index on public.assets(organization_id,site_id,kind);
create index on public.assets(organization_id,next_service_due);
create index on public.service_jobs(organization_id,status,scheduled_start);
create index on public.service_jobs(organization_id,assigned_to,scheduled_start);
create index on public.inspections(organization_id,job_id,submitted_at);
create index on public.deficiencies(organization_id,status,discovered_at);
create index on public.inventory_items(organization_id,active);
create index on public.audit_events(organization_id,created_at desc);
create or replace function public.is_org_member(target_org uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.organization_members m where m.organization_id=target_org and m.user_id=auth.uid()) $$;
create or replace function public.has_org_role(target_org uuid, allowed public.member_role[]) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.organization_members m where m.organization_id=target_org and m.user_id=auth.uid() and m.role=any(allowed)) $$;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid,public.member_role[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid,public.member_role[]) to authenticated;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
create policy org_read on public.organizations for select to authenticated using (public.is_org_member(id));
create policy member_read on public.organization_members for select to authenticated using (public.is_org_member(organization_id));
create policy org_admin_members on public.organization_members for all to authenticated using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
do $$ declare t text; begin foreach t in array array['customers','sites','assets','service_jobs','inspections','inspection_responses','deficiencies','inventory_items','inventory_transactions','quotes','quote_lines','audit_events'] loop execute format('alter table public.%I enable row level security',t); execute format('create policy tenant_select on public.%I for select to authenticated using (public.is_org_member(organization_id))',t); execute format('create policy tenant_insert on public.%I for insert to authenticated with check (public.has_org_role(organization_id,array[''owner'',''admin'',''dispatcher'',''technician'']::public.member_role[]))',t); execute format('create policy tenant_update on public.%I for update to authenticated using (public.has_org_role(organization_id,array[''owner'',''admin'',''dispatcher'',''technician'']::public.member_role[])) with check (public.has_org_role(organization_id,array[''owner'',''admin'',''dispatcher'',''technician'']::public.member_role[]))',t); execute format('create policy tenant_delete on public.%I for delete to authenticated using (public.has_org_role(organization_id,array[''owner'',''admin'']::public.member_role[]))',t); end loop; end $$;

-- Safe first-organization bootstrap: a signed-in user can create an organization
-- and become its owner in one transaction, without opening membership writes.
create or replace function public.create_organization_with_owner(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_org uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(org_name,''))) < 2 then raise exception 'Organization name is required'; end if;
  insert into public.organizations(name) values (trim(org_name)) returning id into new_org;
  insert into public.organization_members(organization_id,user_id,role)
    values (new_org,auth.uid(),'owner');
  return new_org;
end;
$$;
revoke all on function public.create_organization_with_owner(text) from public;
grant execute on function public.create_organization_with_owner(text) to authenticated;

-- Replace broad write policies with least-privilege role grants by record type.
do $$ declare t text; begin
  foreach t in array array['customers','sites','assets','service_jobs','inspections','inspection_responses','deficiencies','inventory_items','inventory_transactions','quotes','quote_lines','audit_events'] loop
    execute format('drop policy if exists tenant_insert on public.%I',t);
    execute format('drop policy if exists tenant_update on public.%I',t);
    execute format('drop policy if exists tenant_delete on public.%I',t);
  end loop;
end $$;

create policy customer_insert on public.customers for insert to authenticated
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher']::public.member_role[]));
create policy customer_update on public.customers for update to authenticated
  using (public.has_org_role(organization_id,array['owner','admin','dispatcher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher']::public.member_role[]));
create policy customer_delete on public.customers for delete to authenticated
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy site_insert on public.sites for insert to authenticated
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher']::public.member_role[]));
create policy site_update on public.sites for update to authenticated
  using (public.has_org_role(organization_id,array['owner','admin','dispatcher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher']::public.member_role[]));
create policy site_delete on public.sites for delete to authenticated
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy asset_insert on public.assets for insert to authenticated
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher','technician']::public.member_role[]));
create policy asset_update on public.assets for update to authenticated
  using (public.has_org_role(organization_id,array['owner','admin','dispatcher','technician']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher','technician']::public.member_role[]));
create policy asset_delete on public.assets for delete to authenticated
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy job_insert on public.service_jobs for insert to authenticated
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher']::public.member_role[]));
create policy job_update on public.service_jobs for update to authenticated
  using (public.has_org_role(organization_id,array['owner','admin','dispatcher','technician']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher','technician']::public.member_role[]));
create policy job_delete on public.service_jobs for delete to authenticated
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy inspection_insert on public.inspections for insert to authenticated
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher','technician']::public.member_role[]));
create policy inspection_update on public.inspections for update to authenticated
  using (public.has_org_role(organization_id,array['owner','admin','dispatcher','technician']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher','technician']::public.member_role[]));
create policy inspection_delete on public.inspections for delete to authenticated
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy response_insert on public.inspection_responses for insert to authenticated
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher','technician']::public.member_role[]));
create policy response_update on public.inspection_responses for update to authenticated
  using (public.has_org_role(organization_id,array['owner','admin','dispatcher','technician']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher','technician']::public.member_role[]));
create policy response_delete on public.inspection_responses for delete to authenticated
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy deficiency_insert on public.deficiencies for insert to authenticated
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher','technician']::public.member_role[]));
create policy deficiency_update on public.deficiencies for update to authenticated
  using (public.has_org_role(organization_id,array['owner','admin','dispatcher','technician']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher','technician']::public.member_role[]));
create policy deficiency_delete on public.deficiencies for delete to authenticated
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy inventory_insert on public.inventory_items for insert to authenticated
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher']::public.member_role[]));
create policy inventory_update on public.inventory_items for update to authenticated
  using (public.has_org_role(organization_id,array['owner','admin','dispatcher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher']::public.member_role[]));
create policy inventory_delete on public.inventory_items for delete to authenticated
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy inventory_tx_insert on public.inventory_transactions for insert to authenticated
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher','technician']::public.member_role[]));
create policy inventory_tx_update on public.inventory_transactions for update to authenticated
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy inventory_tx_delete on public.inventory_transactions for delete to authenticated
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy quote_insert on public.quotes for insert to authenticated
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher']::public.member_role[]));
create policy quote_update on public.quotes for update to authenticated
  using (public.has_org_role(organization_id,array['owner','admin','dispatcher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher']::public.member_role[]));
create policy quote_delete on public.quotes for delete to authenticated
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy quote_line_insert on public.quote_lines for insert to authenticated
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher']::public.member_role[]));
create policy quote_line_update on public.quote_lines for update to authenticated
  using (public.has_org_role(organization_id,array['owner','admin','dispatcher']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher']::public.member_role[]));
create policy quote_line_delete on public.quote_lines for delete to authenticated
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));

create policy audit_insert on public.audit_events for insert to authenticated
  with check (public.has_org_role(organization_id,array['owner','admin','dispatcher','technician']::public.member_role[]));
create policy audit_update on public.audit_events for update to authenticated
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
create policy audit_delete on public.audit_events for delete to authenticated
  using (public.has_org_role(organization_id,array['owner','admin']::public.member_role[]));
