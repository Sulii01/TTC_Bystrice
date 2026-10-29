-- =====================================================================
-- TTC Bystřice — úprava databáze: alba fotogalerie podle roku
-- =====================================================================
-- Jak použít: Supabase → SQL Editor → New query → vložit celý soubor → Run.
-- Jde spustit i opakovaně. Stávající fotky dostanou rok podle data nahrání.

alter table public.galerie
  add column if not exists rok integer;

update public.galerie
  set rok = extract(year from vytvoreno at time zone 'Europe/Prague')::integer
  where rok is null;

alter table public.galerie
  alter column rok set default extract(year from now() at time zone 'Europe/Prague')::integer,
  alter column rok set not null;

alter table public.galerie drop constraint if exists galerie_rok_rozsah;
alter table public.galerie
  add constraint galerie_rok_rozsah check (rok between 2000 and 2100);

create index if not exists galerie_rok_idx on public.galerie (rok, vytvoreno desc);
