/*
  # Add User Profile and Address Fields

  1. Changes to `user_profiles` table
    - Add `account_type` (PF or PJ)
    - Add `cpf` for PF accounts
    - Add `birth_date` for PF accounts
    - Add `cnpj` for PJ accounts
    - Add `inscricao_estadual` for PJ accounts
    - Add `email_xml` for PJ accounts

  2. Changes to `user_addresses` table
    - Add `number` field for street number
    - Add `neighborhood` field
    - Add `billing_address` field for PJ accounts

  3. Security
    - Maintain existing RLS policies
*/

-- Add new columns to user_profiles table
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS account_type text CHECK (account_type IN ('PF', 'PJ')),
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS birth_date text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS email_xml text;

-- Add new columns to user_addresses table
ALTER TABLE user_addresses
  ADD COLUMN IF NOT EXISTS number text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS billing_address text;
