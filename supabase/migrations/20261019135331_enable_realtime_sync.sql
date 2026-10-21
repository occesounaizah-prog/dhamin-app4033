/*
# Enable Realtime on conversations, messages, taameeds, requests

1. Changes
- Add tables `conversations`, `messages`, `taameeds`, `requests`, `offers` to the `supabase_realtime` publication so the browser can subscribe to live INSERT/UPDATE/DELETE events.
- No schema or policy changes.
2. Security
- RLS remains enabled and unchanged on all tables; Realtime respects RLS so clients only receive rows they can SELECT.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.taameeds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.offers;