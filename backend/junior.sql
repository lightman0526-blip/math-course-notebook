create table public.junior_materials (
 id text primary key, section text not null, title text not null, filename text not null, sort_order int not null,
 teacher_only boolean not null default false, pdf text not null check (length(pdf)>0)
);
create table public.junior_submissions (
 lesson_date date not null, fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
 photo text not null check(length(photo) between 16 and 7000000 and photo like '/9j/%'),
 created_at timestamptz not null default now(), primary key(lesson_date,fingerprint)
);
alter table public.junior_materials enable row level security;
alter table public.junior_submissions enable row level security;
revoke all on public.junior_materials,public.junior_submissions from public,anon,authenticated;
grant select on public.junior_materials to anon,authenticated;
grant insert,update on public.junior_materials to authenticated;
grant insert(lesson_date,fingerprint,photo) on public.junior_submissions to anon;
grant select on public.junior_submissions to authenticated;
create function public.junior_family_link() returns boolean language sql stable security invoker set search_path='' as $$
 select encode(sha256(convert_to(coalesce(current_setting('request.headers',true)::jsonb->>'x-family-link',''),'UTF8')),'hex')='b96a9319cc2d3685647bfdc22f2a21a09862c87d261e823d011a2cdb92f56bee'
$$;
create policy junior_family_materials on public.junior_materials for select to anon using(not teacher_only and (select public.junior_family_link()));
create policy junior_teacher_materials on public.junior_materials for all to authenticated using((select public.course_role())='teacher') with check ((select public.course_role())='teacher');
create policy junior_family_submit on public.junior_submissions for insert to anon with check ((select public.junior_family_link()));
create policy junior_teacher_inbox on public.junior_submissions for select to authenticated using ((select public.course_role())='teacher');
