-- createOrFindPet (agent/src/lib/store.ts) does a case-insensitive
-- find-then-insert with no DB backstop: two near-simultaneous calls for the
-- same new pet name can both pass the find step and both insert, creating a
-- silent duplicate pet row. customers already has this protection
-- (customers_clinic_phone_unique_idx, 20260527000005) — pets never got the
-- equivalent. lower(name) matches the app's .ilike() lookup, so a case
-- variation ("Rex" vs "REX") is treated as the same conflict here too.
create unique index pets_clinic_customer_name_unique_idx
  on public.pets (clinic_id, customer_id, lower(name))
  where deleted_at is null;
