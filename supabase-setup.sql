-- ============================================================
-- SimpleSaltwater — Supabase SQL setup
-- Kjør dette i Supabase Dashboard > SQL Editor
-- ============================================================

-- Profiles (auto-opprettet ved registrering)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  created_at timestamptz default now()
);

-- Favorittsteder
create table if not exists favorite_locations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  lat double precision not null,
  lon double precision not null,
  created_at timestamptz default now()
);

-- Fiskelogg
create table if not exists fishing_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  location_name text not null,
  lat double precision,
  lon double precision,
  date date not null default current_date,
  score integer,
  notes text,
  catch_description text,
  created_at timestamptz default now()
);

-- Row Level Security
alter table profiles enable row level security;
alter table favorite_locations enable row level security;
alter table fishing_log enable row level security;

create policy "Users see own profile"
  on profiles for all using (auth.uid() = id);

create policy "Users manage own favorites"
  on favorite_locations for all using (auth.uid() = user_id);

create policy "Users manage own log"
  on fishing_log for all using (auth.uid() = user_id);

-- Auto-opprett profile ved signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
