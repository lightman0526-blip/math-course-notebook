insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('exam-library','exam-library',false,16777216,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create policy exam_teacher_read on storage.objects for select to authenticated using (bucket_id='exam-library' and (select public.course_role())='teacher');
create policy exam_teacher_add on storage.objects for insert to authenticated with check (bucket_id='exam-library' and (select public.course_role())='teacher' and name ~ '^[a-f0-9]{64}[.](pdf|docx)$');
