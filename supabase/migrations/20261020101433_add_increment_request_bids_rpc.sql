/*
# Add increment_request_bids RPC

1. Changes
- Create a SECURITY DEFINER function to atomically increment a request's bids counter.
*/

CREATE OR REPLACE FUNCTION public.increment_request_bids(req_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.requests SET bids = bids + 1 WHERE id = req_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_request_bids(text) TO anon, authenticated;