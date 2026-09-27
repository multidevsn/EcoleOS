-- École OS — security hardening for public schema access
alter table public.parent_students enable row level security;
revoke all on public.parent_students from anon,authenticated;
grant select on public.parent_students to authenticated;
drop policy if exists parent_students_self on public.parent_students;
create policy parent_students_self on public.parent_students
for select to authenticated
using(parent_id=(select auth.uid()) or student_id=(select auth.uid()) or (select private.is_staff()));

revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke all on function public.ensure_default_community_spaces() from public,anon,authenticated;
grant execute on function public.ensure_default_community_spaces() to authenticated;
revoke all on function public.get_community_overview() from public,anon,authenticated;
grant execute on function public.get_community_overview() to authenticated;
revoke all on function public.mark_community_space_read(uuid) from public,anon,authenticated;
grant execute on function public.mark_community_space_read(uuid) to authenticated;
revoke all on function public.send_community_message(uuid,text) from public,anon,authenticated;
grant execute on function public.send_community_message(uuid,text) to authenticated;
revoke all on function public.report_community_message(uuid,text) from public,anon,authenticated;
grant execute on function public.report_community_message(uuid,text) to authenticated;
revoke all on function public.submit_community_idea(text,text) from public,anon,authenticated;
grant execute on function public.submit_community_idea(text,text) to authenticated;
revoke all on function public.vote_community_idea(uuid) from public,anon,authenticated;
grant execute on function public.vote_community_idea(uuid) to authenticated;
revoke all on function public.respond_community_survey(uuid,uuid) from public,anon,authenticated;
grant execute on function public.respond_community_survey(uuid,uuid) to authenticated;
revoke all on function public.redeem_reward(uuid) from public,anon,authenticated;
grant execute on function public.redeem_reward(uuid) to authenticated;
revoke all on function public.record_usage_event(text,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.record_usage_event(text,numeric,jsonb) to authenticated;

drop policy if exists food_read on public.food_items;
drop policy if exists community_space_reads_read on public.community_space_reads;
drop policy if exists community_space_reads_update on public.community_space_reads;
create policy community_space_reads_select on public.community_space_reads for select to authenticated using(user_id=(select auth.uid()));
create policy community_space_reads_insert on public.community_space_reads for insert to authenticated with check(user_id=(select auth.uid()));
create policy community_space_reads_update on public.community_space_reads for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
