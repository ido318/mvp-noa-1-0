-- invoice.service.ts computed the next invoice_number as
-- "count(*) + 1" in application code, then inserted in a separate query —
-- two concurrent createInvoice calls for the same clinic could both read the
-- same count and both attempt the same invoice_number, hitting
-- invoices_clinic_number_unique (23505) as a generic 500 instead of the
-- request that actually needed the number just getting the next one. This
-- RPC makes numbering-and-insert one atomic operation: pg_advisory_xact_lock
-- serializes concurrent callers for the same clinic (held only for the
-- duration of this transaction, released automatically), so the count each
-- one reads is never stale.
--
-- security invoker (the default — stated explicitly) so this runs as the
-- calling user: the same invoices_insert_admin RLS policy that already
-- gates a plain insert() still applies here.
create or replace function public.create_invoice(
  p_clinic_id uuid,
  p_customer_id uuid,
  p_pet_id uuid,
  p_items jsonb,
  p_total numeric,
  p_notes text,
  p_created_by_user_id uuid
)
returns public.invoices
language plpgsql
security invoker
as $$
declare
  v_seq int;
  v_invoice_number text;
  v_row public.invoices;
begin
  perform pg_advisory_xact_lock(hashtext(p_clinic_id::text));

  select count(*) + 1 into v_seq
  from public.invoices
  where clinic_id = p_clinic_id;

  v_invoice_number := 'INV-' || extract(year from now())::int || '-' || lpad(v_seq::text, 3, '0');

  insert into public.invoices (
    clinic_id, customer_id, pet_id, invoice_number, items, total, notes, created_by_user_id
  ) values (
    p_clinic_id, p_customer_id, p_pet_id, v_invoice_number, p_items, p_total, p_notes, p_created_by_user_id
  )
  returning * into v_row;

  return v_row;
end;
$$;
