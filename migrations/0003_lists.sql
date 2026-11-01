CREATE TABLE IF NOT EXISTS list (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_list_owner ON list (owner_id);

CREATE TABLE IF NOT EXISTS list_member (
  list_id TEXT NOT NULL REFERENCES list(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (list_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_list_member_user ON list_member (user_id);

-- Every existing user gets a "Personal" list that absorbs their current todos.
INSERT INTO list (id, name, owner_id, created_at)
SELECT lower(hex(randomblob(16))), 'Personal', id, created_at FROM user;

INSERT INTO list_member (list_id, user_id, role, created_at)
SELECT id, owner_id, 'owner', created_at FROM list;

CREATE TABLE todos_new (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES list(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

INSERT INTO todos_new (id, list_id, title, completed, created_at)
SELECT t.id, l.id, t.title, t.completed, t.created_at
FROM todos t
JOIN list l ON l.owner_id = t.user_id;

DROP TABLE todos;
ALTER TABLE todos_new RENAME TO todos;
CREATE INDEX IF NOT EXISTS idx_todos_list_created ON todos (list_id, created_at);
