create policy family_link_upload on storage.objects for insert to anon with check(
 bucket_id='course-photos'
 and name ~ '^photos/[0-9]{4}-[0-9]{2}-[0-9]{2}/[a-f0-9]{64}_[a-f0-9]{64}[.](jpg|png|webp)$'
 and encode(sha256(convert_to(split_part(split_part(name,'/',3),'_',1),'UTF8')),'hex')='ec40be76646616945914a076c8cc2b0fc22b3462f710185092906e4f9bc8981c'
);
