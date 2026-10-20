-- Deleting a design failed with "permission denied": make_delete removed the design's pictures
-- straight from storage.objects, and Supabase now refuses any delete there that does not come
-- through the Storage API (the storage.protect_delete trigger, error 42501). The app now removes
-- the pictures through the Storage API first (the "make images: editors remove them" policy lets
-- owners do that), and make_delete only deletes the design.

-- Owners delete; people it was shared with leave it.
create or replace function public.make_delete(p_id uuid) returns void
language plpgsql security definer set search_path = make, public as $$
declare
  v_role text := make.require_role(p_id, 'viewer');
begin
  if v_role = 'owner' then
    delete from make.designs where id = p_id;
  else
    delete from make.shares where design_id = p_id and user_id = auth.uid();
  end if;
end $$;

revoke all on function public.make_delete(uuid) from public, anon;
grant execute on function public.make_delete(uuid) to authenticated;
