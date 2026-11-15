-- Roles are explicit and default to least privilege.
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'customer'
  CHECK (role IN ('customer','admin'));
