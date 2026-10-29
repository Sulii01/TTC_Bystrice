-- =====================================================================
-- TTC Bystřice — úprava databáze: fotka u aktuality
-- =====================================================================
-- Jak použít: Supabase → SQL Editor → New query → vložit celý soubor → Run.
-- Jde spustit i opakovaně.

-- název souboru fotky v úložišti "aktuality" (prázdné = aktualita bez fotky)
alter table public.aktuality add column if not exists foto text;

-- veřejné úložiště pro fotky aktualit (zobrazit je smí každý, nahrávat jen admin/editor)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aktuality', 'aktuality', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "aktuality soubory: nahrání" on storage.objects;
create policy "aktuality soubory: nahrání" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'aktuality' and public.moje_role() in ('admin', 'editor'));

-- smazat fotku smí admin, editor jen fotku své aktuality
drop policy if exists "aktuality soubory: smazání" on storage.objects;
create policy "aktuality soubory: smazání" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'aktuality' and (
      public.moje_role() = 'admin'
      or (public.moje_role() = 'editor' and exists (
        select 1 from public.aktuality a where a.foto = storage.objects.name and a.autor = auth.uid()
      ))
    )
  );
