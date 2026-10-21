/*
# Add attachment columns to messages

1. Changes
- Add nullable columns for inline attachments on messages: attachment_path, attachment_name, attachment_mimetype, attachment_size.
- Existing rows keep NULL (no attachment); new text rows keep them NULL.
2. Security
- RLS unchanged; columns inherit table-level grants.
*/

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_mimetype text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint;