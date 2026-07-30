-- Provider profile defaults on public.users for Step 3 prefill
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS provider_name TEXT,
  ADD COLUMN IF NOT EXISTS provider_npi TEXT,
  ADD COLUMN IF NOT EXISTS provider_address TEXT,
  ADD COLUMN IF NOT EXISTS provider_phone TEXT,
  ADD COLUMN IF NOT EXISTS provider_fax TEXT,
  ADD COLUMN IF NOT EXISTS signer_name TEXT,
  ADD COLUMN IF NOT EXISTS signer_title TEXT,
  ADD COLUMN IF NOT EXISTS signer_credentials TEXT,
  ADD COLUMN IF NOT EXISTS signer_phone TEXT;
