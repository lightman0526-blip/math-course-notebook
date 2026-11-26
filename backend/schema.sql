create table public.course_notes (id text primary key, revision integer not null default 1, body jsonb not null);
alter table public.course_notes enable row level security;
revoke all on public.course_notes from public, anon, authenticated;
grant select,insert,update on public.course_notes to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('course-files','course-files',false,50331648,array['image/jpeg','image/png','image/webp','application/pdf']);
