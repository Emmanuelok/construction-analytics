-- AEC Data & Intelligence Studio — initial schema
-- Run this in the Supabase SQL editor (Dashboard → SQL) or via `supabase db push`.
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT and drops policies first.

-- ============================================================ profiles ===
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles readable by everyone" on public.profiles;
create policy "profiles readable by everyone" on public.profiles for select using (true);
drop policy if exists "users manage own profile" on public.profiles;
create policy "users manage own profile" on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'name')
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ============================================================ datasets ===
create table if not exists public.datasets (
  id text primary key,                 -- app-provided id (slug or seed id)
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null,
  provider text,
  category text,
  modality text,
  license text not null default 'Commercial',
  price numeric,                       -- null = on request, 0 = free
  quality int default 85,
  rating numeric default 0,
  downloads int default 0,
  records bigint default 0,
  size_gb numeric default 0,
  anonymized bool default true,
  description text,
  tags text[] default '{}',
  accent text default 'lime',
  published bool not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.datasets enable row level security;

drop policy if exists "datasets select" on public.datasets;
create policy "datasets select" on public.datasets for select
  using (published = true or auth.uid() = owner);
drop policy if exists "datasets insert" on public.datasets;
create policy "datasets insert" on public.datasets for insert with check (auth.uid() = owner);
drop policy if exists "datasets update" on public.datasets;
create policy "datasets update" on public.datasets for update using (auth.uid() = owner);
drop policy if exists "datasets delete" on public.datasets;
create policy "datasets delete" on public.datasets for delete using (auth.uid() = owner);

-- ======================================================= dataset_files ===
create table if not exists public.dataset_files (
  id uuid primary key default gen_random_uuid(),
  dataset_id text not null references public.datasets(id) on delete cascade,
  name text not null,
  format text not null,
  size text,
  rows int,
  free bool not null default false,
  storage_path text,                   -- path within the 'datasets' bucket
  created_at timestamptz not null default now()
);
alter table public.dataset_files enable row level security;

drop policy if exists "files select" on public.dataset_files;
create policy "files select" on public.dataset_files for select using (
  exists (select 1 from public.datasets d
          where d.id = dataset_id and (d.published = true or d.owner = auth.uid()))
);
drop policy if exists "files write" on public.dataset_files;
create policy "files write" on public.dataset_files for all
  using (exists (select 1 from public.datasets d where d.id = dataset_id and d.owner = auth.uid()))
  with check (exists (select 1 from public.datasets d where d.id = dataset_id and d.owner = auth.uid()));

-- ============================================================ licenses ===
create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dataset_id text not null,                -- seed catalog id OR a published dataset id (no FK)
  tier text,
  price numeric default 0,
  status text not null default 'active',   -- active | pending | revoked
  created_at timestamptz not null default now(),
  unique (user_id, dataset_id)
);
alter table public.licenses enable row level security;

drop policy if exists "licenses select" on public.licenses;
create policy "licenses select" on public.licenses for select using (auth.uid() = user_id);
drop policy if exists "licenses insert" on public.licenses;
create policy "licenses insert" on public.licenses for insert with check (auth.uid() = user_id);

-- =========================================================== downloads ===
create table if not exists public.downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dataset_id text,
  file_name text,
  created_at timestamptz not null default now()
);
alter table public.downloads enable row level security;

drop policy if exists "downloads select" on public.downloads;
create policy "downloads select" on public.downloads for select using (auth.uid() = user_id);
drop policy if exists "downloads insert" on public.downloads;
create policy "downloads insert" on public.downloads for insert with check (auth.uid() = user_id);

-- ====================================================== storage bucket ====
insert into storage.buckets (id, name, public)
values ('datasets', 'datasets', false)
on conflict (id) do nothing;

-- Sellers manage files under a folder named after their user id: {uid}/...
drop policy if exists "owners upload to their folder" on storage.objects;
create policy "owners upload to their folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'datasets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "owners manage their folder" on storage.objects;
create policy "owners manage their folder" on storage.objects for all to authenticated
  using (bucket_id = 'datasets' and (storage.foldername(name))[1] = auth.uid()::text);
-- NOTE: this lets any signed-in user read bucket files; tighten to require a
-- matching row in public.licenses for paid files when you go to production.
drop policy if exists "authenticated read dataset files" on storage.objects;
create policy "authenticated read dataset files" on storage.objects for select to authenticated
  using (bucket_id = 'datasets');
