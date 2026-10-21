/*
# Create conversation attachment storage

1. Storage
- Create the private `conversation-attachments` bucket for documents and images shared inside conversations.
- Limit files to 10 MB and allow common document and image formats.

2. Security
- Enable separate read, insert, update, and delete policies for the no-auth prototype.
- Scope every policy to the dedicated bucket and require a conversation-prefixed object path.
- The bucket remains private; the application uses signed download URLs.

3. Important notes
- The current sign-in screen is a prototype and does not establish a Supabase user session.
- Policies therefore allow the anon and authenticated roles for this shared prototype, while object paths isolate each conversation's files.
- No existing tables or user data are modified.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'conversation-attachments',
  'conversation-attachments',
  false,
  10485760,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "conversation attachments read" ON storage.objects;
CREATE POLICY "conversation attachments read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'conversation-attachments'
  AND split_part(name, '/', 1) = 'conversations'
);

DROP POLICY IF EXISTS "conversation attachments insert" ON storage.objects;
CREATE POLICY "conversation attachments insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'conversation-attachments'
  AND split_part(name, '/', 1) = 'conversations'
);

DROP POLICY IF EXISTS "conversation attachments update" ON storage.objects;
CREATE POLICY "conversation attachments update"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (
  bucket_id = 'conversation-attachments'
  AND split_part(name, '/', 1) = 'conversations'
)
WITH CHECK (
  bucket_id = 'conversation-attachments'
  AND split_part(name, '/', 1) = 'conversations'
);

DROP POLICY IF EXISTS "conversation attachments delete" ON storage.objects;
CREATE POLICY "conversation attachments delete"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (
  bucket_id = 'conversation-attachments'
  AND split_part(name, '/', 1) = 'conversations'
);