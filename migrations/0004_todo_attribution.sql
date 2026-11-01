ALTER TABLE todos ADD COLUMN created_by TEXT REFERENCES user(id) ON DELETE SET NULL;
ALTER TABLE todos ADD COLUMN completed_by TEXT REFERENCES user(id) ON DELETE SET NULL;
ALTER TABLE todos ADD COLUMN completed_at INTEGER;

-- Existing items predate attribution; credit them to the list owner.
UPDATE todos SET created_by = (SELECT owner_id FROM list WHERE list.id = todos.list_id)
WHERE created_by IS NULL;
