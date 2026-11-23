-- Invitees see their invites through public.my_invites() (security definer),
-- so this extra policy isn't needed (and slowed down invite queries).
drop policy "invites: invitee reads own" on public.workspace_invites;
