insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('course-photos','course-photos',false,8388608,array['image/jpeg','image/png','image/webp']);
drop policy submit_photo on storage.objects;
drop policy add_book on storage.objects;
create policy submit_photo on storage.objects for insert to authenticated with check(bucket_id='course-photos' and (select public.course_role()) in ('family','teacher') and name ~ '^photos/[0-9]{4}-[0-9]{2}-[0-9]{2}/[a-f0-9]{64}[.](png|jpg|webp)$');
create policy read_photo on storage.objects for select to authenticated using(bucket_id='course-photos' and (select public.course_role())='teacher');
create policy add_book on storage.objects for insert to authenticated with check(bucket_id='course-files' and (select public.course_role())='teacher' and name ~ '^books/(b[1-4]|s3)[.]pdf$');
