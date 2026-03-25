CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  venue TEXT NOT NULL,
  department_id INT REFERENCES departments(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
