-- =====================================================================
-- TTC Bystřice — databáze pro aktuality a fotogalerii (Supabase)
-- =====================================================================
-- Jak použít: v Supabase otevřete SQL Editor → New query, vložte CELÝ
-- tento soubor a klikněte na Run. Skript jde spustit i opakovaně.
--
-- Role uživatelů:
--   admin  — smí vše (přidávat, upravovat a mazat i cizí příspěvky a fotky)
--   editor — smí přidávat; upravovat a mazat jen svoje příspěvky a fotky
-- Návštěvníci webu (bez přihlášení) smí obsah jen číst.
-- =====================================================================


-- ---------- Role uživatelů ----------
create table if not exists public.role_uzivatelu (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role    text not null check (role in ('admin', 'editor')),
  jmeno   text
);

-- Vrátí roli přihlášeného uživatele ('admin' / 'editor' / null).
-- "security definer" = funkce smí číst tabulku rolí i tam, kde to běžnému
-- uživateli pravidla nedovolí (jinak by se pravidla zacyklila).
create or replace function public.moje_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.role_uzivatelu where user_id = auth.uid()
$$;

alter table public.role_uzivatelu enable row level security;

drop policy if exists "role: čte vlastní nebo admin" on public.role_uzivatelu;
create policy "role: čte vlastní nebo admin" on public.role_uzivatelu
  for select to authenticated
  using (user_id = auth.uid() or public.moje_role() = 'admin');
-- Zápis do tabulky rolí není přes web povolený vůbec — role se nastavují
-- jen v Supabase (SQL Editor / Table Editor), viz zapisky.md.


-- ---------- Aktuality ----------
create table if not exists public.aktuality (
  id         bigint generated always as identity primary key,
  nadpis     text not null,
  text       text not null,
  stitek     text not null default 'Klub',
  datum_text text,                                   -- zobrazené datum, např. "29. 10. 2026" nebo "Celoročně"
  pripnuto   boolean not null default false,         -- připnuté aktuality jsou vždy první
  foto       text,                                   -- fotka v úložišti "aktuality" (viz migrace-02)
  vytvoreno  timestamptz not null default now(),
  autor      uuid default auth.uid() references auth.users (id) on delete set null
);

alter table public.aktuality enable row level security;

drop policy if exists "aktuality: čtení pro všechny" on public.aktuality;
create policy "aktuality: čtení pro všechny" on public.aktuality
  for select to anon, authenticated using (true);

drop policy if exists "aktuality: přidání" on public.aktuality;
create policy "aktuality: přidání" on public.aktuality
  for insert to authenticated
  with check (public.moje_role() in ('admin', 'editor') and autor = auth.uid());

drop policy if exists "aktuality: úprava" on public.aktuality;
create policy "aktuality: úprava" on public.aktuality
  for update to authenticated
  using (public.moje_role() = 'admin' or (public.moje_role() = 'editor' and autor = auth.uid()))
  with check (public.moje_role() = 'admin' or (public.moje_role() = 'editor' and autor = auth.uid()));

drop policy if exists "aktuality: smazání" on public.aktuality;
create policy "aktuality: smazání" on public.aktuality
  for delete to authenticated
  using (public.moje_role() = 'admin' or (public.moje_role() = 'editor' and autor = auth.uid()));


-- ---------- Fotogalerie ----------
create table if not exists public.galerie (
  id        bigint generated always as identity primary key,
  cesta     text not null unique,                    -- název souboru v úložišti "galerie"
  popisek   text,
  rok       integer not null default extract(year from now() at time zone 'Europe/Prague')::integer
            check (rok between 2000 and 2100),       -- album (rok), do kterého fotka patří
  vytvoreno timestamptz not null default now(),
  autor     uuid default auth.uid() references auth.users (id) on delete set null
);

alter table public.galerie enable row level security;

drop policy if exists "galerie: čtení pro všechny" on public.galerie;
create policy "galerie: čtení pro všechny" on public.galerie
  for select to anon, authenticated using (true);

drop policy if exists "galerie: přidání" on public.galerie;
create policy "galerie: přidání" on public.galerie
  for insert to authenticated
  with check (public.moje_role() in ('admin', 'editor') and autor = auth.uid());

drop policy if exists "galerie: úprava" on public.galerie;
create policy "galerie: úprava" on public.galerie
  for update to authenticated
  using (public.moje_role() = 'admin' or (public.moje_role() = 'editor' and autor = auth.uid()))
  with check (public.moje_role() = 'admin' or (public.moje_role() = 'editor' and autor = auth.uid()));

drop policy if exists "galerie: smazání" on public.galerie;
create policy "galerie: smazání" on public.galerie
  for delete to authenticated
  using (public.moje_role() = 'admin' or (public.moje_role() = 'editor' and autor = auth.uid()));


-- ---------- Úložiště fotek (Storage) ----------
-- Veřejný "bucket" = fotky jde zobrazit na webu bez přihlášení,
-- nahrávat a mazat je ale smí jen přihlášení admini/editoři.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('galerie', 'galerie', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "galerie soubory: nahrání" on storage.objects;
create policy "galerie soubory: nahrání" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'galerie' and public.moje_role() in ('admin', 'editor'));

drop policy if exists "galerie soubory: smazání" on storage.objects;
create policy "galerie soubory: smazání" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'galerie' and (
      public.moje_role() = 'admin'
      or (public.moje_role() = 'editor' and exists (
        select 1 from public.galerie g where g.cesta = storage.objects.name and g.autor = auth.uid()
      ))
    )
  );


-- ---------- Přístupová práva pro web (Data API) ----------
-- Samotná pravidla výše říkají, KDO smí CO; tady se tabulky zpřístupní webu.
grant usage on schema public to anon, authenticated;
grant select on public.aktuality, public.galerie to anon, authenticated;
grant insert, update, delete on public.aktuality, public.galerie to authenticated;
grant select on public.role_uzivatelu to authenticated;
grant execute on function public.moje_role() to anon, authenticated;


-- ---------- Přenesení současných aktualit z webu (jen poprvé) ----------
insert into public.aktuality (nadpis, text, stitek, datum_text, pripnuto, vytvoreno, autor)
select * from (values
  ('Nové klubové stránky jsou tu!',
   'Spouštíme nový web TTC Bystřice, kde budeme přinášet aktuality, výsledky zápasů, tabulky soutěží a soupisky všech čtyř našich družstev. Sledujte nás i nadále.',
   'Klub', 'Srpen 2026', false, timestamptz '2026-08-15 12:00+02', null::uuid),
  ('Příprava na novou sezónu',
   'Rozlosování a tabulky soutěží pro ročník 2026/2027 zveřejní STIS ČAST před zahájením soutěží. Jakmile budou k dispozici první termíny, doplníme je zde i v sekcích jednotlivých družstev.',
   'Sezóna', 'Sezóna 2026/2027', false, timestamptz '2026-08-20 12:00+02', null::uuid),
  ('Hledáme nové hráče a hráčky',
   'Máte rádi stolní tenis a chcete si zahrát závodně i rekreačně? Ozvěte se nám na kontaktní e-mail níže — rádi vás přivítáme na tréninku v naší herně.',
   'Nábor', 'Celoročně', true, timestamptz '2026-08-01 12:00+02', null::uuid)
) as v
where not exists (select 1 from public.aktuality);
