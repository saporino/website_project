/*
  # Add Roast Type and Flavor Notes to Products

  ## Changes
  1. Add roast_type column (torra média, torra escura, etc)
  2. Add flavor_notes column (notas de chocolate, caramelo, etc)
  
  ## Purpose
  - Allow admin to specify roast type for each coffee
  - Allow admin to describe flavor notes/profiles
*/

-- Add roast_type column
ALTER TABLE products
ADD COLUMN IF NOT EXISTS roast_type TEXT;

-- Add flavor_notes column  
ALTER TABLE products
ADD COLUMN IF NOT EXISTS flavor_notes TEXT;