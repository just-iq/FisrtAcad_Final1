-- Fix user_roles table to allow NULL scope fields for roles like ADMIN
-- First drop the old primary key that includes scope fields
ALTER TABLE user_roles DROP CONSTRAINT user_roles_pkey;

-- Allow NULL in scope columns
ALTER TABLE user_roles 
  ALTER COLUMN scope_department_id DROP NOT NULL,
  ALTER COLUMN scope_level_id DROP NOT NULL,
  ALTER COLUMN scope_group_id DROP NOT NULL;

-- Create a new primary key that only uses user_id and role_id
-- This allows multiple NULL scopes for system-wide roles like ADMIN
ALTER TABLE user_roles 
  ADD PRIMARY KEY (user_id, role_id);

-- Add a unique constraint for scoped roles to prevent duplicates
ALTER TABLE user_roles 
  ADD CONSTRAINT user_roles_unique_scope 
  UNIQUE (user_id, role_id, scope_department_id, scope_level_id, scope_group_id);
