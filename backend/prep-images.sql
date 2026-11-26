create table public.prep_images(
 week date not null,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 preview text not null check(length(preview) between 16 and 2000000 and preview like '/9j/%'),
 primary key(week,fingerprint)
);
alter table public.prep_images enable row level security;
revoke all on public.prep_images from public,anon,authenticated;
grant select on public.prep_images to authenticated;
create policy teacher_preview on public.prep_images for select to authenticated using ((select public.course_role())='teacher');
grant insert on public.prep_images to anon;
create policy submit_preview on public.prep_images for insert to anon with check (
 encode(sha256(convert_to(coalesce(current_setting('request.headers',true)::jsonb->>'x-family-link',''),'UTF8')),'hex')='ec40be76646616945914a076c8cc2b0fc22b3462f710185092906e4f9bc8981c'
);
