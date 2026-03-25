-- Core reference tables
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS levels (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  "order" INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  department_id INT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  level_id INT NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  UNIQUE (department_id, level_id, name)
);

-- Users & RBAC
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  department_id INT NULL REFERENCES departments(id) ON DELETE SET NULL,
  level_id INT NULL REFERENCES levels(id) ON DELETE SET NULL,
  group_id INT NULL REFERENCES groups(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  scope_department_id INT NULL REFERENCES departments(id) ON DELETE SET NULL,
  scope_level_id INT NULL REFERENCES levels(id) ON DELETE SET NULL,
  scope_group_id INT NULL REFERENCES groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id, scope_department_id, scope_level_id, scope_group_id)
);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role_context TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('SCHOOL','DEPARTMENT_LEVEL','GROUP')),
  department_id INT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  level_id INT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  group_id INT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  priority TEXT NULL CHECK (priority IN ('HIGH','MEDIUM','LOW')),
  summary TEXT NULL,
  ai_score NUMERIC NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcement_ai_metadata (
  announcement_id UUID PRIMARY KEY REFERENCES announcements(id) ON DELETE CASCADE,
  embedding BYTEA NULL,
  extra JSONB NULL
);

CREATE TABLE IF NOT EXISTS user_announcement_reads (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);

-- Messages (restricted one-directional)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('LECTURER','COURSE_REP','STUDENT_EXEC')),
  channel_type TEXT NOT NULL CHECK (channel_type IN ('DEPARTMENT_LEVEL','GROUP')),
  department_id INT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  level_id INT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  group_id INT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_message_receipts (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ NULL,
  read_at TIMESTAMPTZ NULL,
  PRIMARY KEY (user_id, message_id)
);

-- Timetable
CREATE TABLE IF NOT EXISTS timetable_entries (
  id UUID PRIMARY KEY,
  course_rep_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  department_id INT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  level_id INT NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  group_id INT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  course_code TEXT NOT NULL,
  course_title TEXT NOT NULL,
  location TEXT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS timetable_notifications (
  id SERIAL PRIMARY KEY,
  timetable_entry_id UUID NOT NULL REFERENCES timetable_entries(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL
);

-- Resources & assignments
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY,
  lecturer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT NULL,
  file_key TEXT NOT NULL,
  mime_type TEXT NULL,
  size_bytes BIGINT NULL,
  department_id INT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  level_id INT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  group_id INT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY,
  lecturer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT NULL,
  department_id INT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  level_id INT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  group_id INT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  due_at TIMESTAMPTZ NULL,
  permit_resubmission BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  file_key TEXT NOT NULL,
  mime_type TEXT NULL,
  size_bytes BIGINT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_latest BOOLEAN NOT NULL DEFAULT TRUE
);

-- User interactions for recommendations
CREATE TABLE IF NOT EXISTS user_resource_interactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('VIEW','DOWNLOAD')),
  weight DOUBLE PRECISION NOT NULL DEFAULT 1.0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_dept_level_group ON users(department_id, level_id, group_id);
CREATE INDEX IF NOT EXISTS idx_announcements_scope_time ON announcements(department_id, level_id, group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_scope_time ON messages(department_id, level_id, group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_user_resource ON user_resource_interactions(user_id, resource_id, viewed_at DESC);

-- Seed roles
INSERT INTO roles (name) VALUES
  ('ADMIN'),
  ('LECTURER'),
  ('STUDENT_EXEC'),
  ('COURSE_REP'),
  ('STUDENT')
ON CONFLICT (name) DO NOTHING;

