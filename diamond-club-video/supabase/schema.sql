-- Diamond Club 99 of Ekiti backend schema
-- Run this in Supabase SQL Editor before starting the Node server.

create extension if not exists pgcrypto;

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  member_id text unique not null,
  full_name text not null,
  email text,
  phone text,
  photo text,
  date_joined date,
  status text not null default 'Pending' check (status in ('Active','Pending','Inactive')),
  account_enabled boolean not null default true,
  password_hash text,
  address text,
  branch text,
  dues_status text,
  dues_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  date date,
  image text,
  excerpt text,
  body text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  date date,
  image text,
  excerpt text,
  body text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affirmations (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  date date,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'upcoming' check (status in ('ongoing','completed','upcoming')),
  date text,
  image text,
  description text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  category text,
  caption text not null,
  image_path text not null,
  published boolean not null default true,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Safe to re-run: adds the column if this table already existed before this change.
alter table public.gallery add column if not exists is_public boolean not null default false;

create table if not exists public.leadership (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position text not null,
  photo text,
  description text,
  tenure text,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.president (
  id integer primary key default 1 check (id = 1),
  name text,
  position text default 'President',
  photo text,
  description text,
  tenure text,
  updated_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'upcoming' check (status in ('upcoming','past')),
  title text not null,
  date date,
  time text,
  location text,
  type text,
  notice text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  club_name text default 'Diamond Club 99 of Ekiti',
  motto text default 'United We Stand',
  contact_email text,
  contact_phone text,
  updated_at timestamptz not null default now()
);

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  item text,
  admin_email text,
  created_at timestamptz not null default now()
);

-- Prevent direct anonymous client access. The Node server uses the service-role key.
alter table public.admins enable row level security;
alter table public.members enable row level security;
alter table public.announcements enable row level security;
alter table public.news enable row level security;
alter table public.affirmations enable row level security;
alter table public.projects enable row level security;
alter table public.gallery enable row level security;
alter table public.leadership enable row level security;
alter table public.president enable row level security;
alter table public.meetings enable row level security;
alter table public.settings enable row level security;
alter table public.activity enable row level security;

insert into public.president (id, name, position, description, tenure)
values (1, 'President information not yet configured', 'President', '', '')
on conflict (id) do nothing;

insert into public.settings (id, club_name, motto)
values (1, 'Diamond Club 99 of Ekiti', 'United We Stand')
on conflict (id) do nothing;

-- Private storage bucket. The server creates signed URLs for members.
insert into storage.buckets (id, name, public)
values ('club-gallery', 'club-gallery', false)
on conflict (id) do nothing;
