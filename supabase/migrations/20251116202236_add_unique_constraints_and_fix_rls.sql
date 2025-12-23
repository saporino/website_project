/*
  # Fix Registration Issues

  ## Changes
  1. Add unique constraints for CPF and phone to prevent duplicates
  2. Update RLS policies to allow user profile creation during signup
  3. Ensure proper data validation

  ## Security
  - Maintain strict RLS for authenticated users
  - Allow profile creation only for the signing up user
*/

-- Add unique constraint for CPF (only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_cpf_unique 
ON user_profiles(cpf) 
WHERE cpf IS NOT NULL;

-- Add unique constraint for phone (only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_phone_unique 
ON user_profiles(phone) 
WHERE phone IS NOT NULL;

-- Drop old INSERT policy
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Create new INSERT policy that works during signup
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Ensure user can immediately read their profile after creation
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;

CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);