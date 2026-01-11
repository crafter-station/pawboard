-- Pawboard Seed Data for Local Development
-- This file runs automatically on `supabase db reset`

-- Create test users
INSERT INTO users (id, username, created_at) VALUES
  ('user-alice-001', 'Alice', NOW()),
  ('user-bob-002', 'Bob', NOW()),
  ('user-charlie-003', 'Charlie', NOW())
ON CONFLICT (id) DO NOTHING;

-- Create a demo session
INSERT INTO sessions (id, name, is_locked, move_permission, delete_permission, created_at) VALUES
  ('demo-session', 'Demo Board', false, 'everyone', 'creator', NOW()),
  ('test-session', 'Test Board', false, 'everyone', 'everyone', NOW())
ON CONFLICT (id) DO NOTHING;

-- Add participants to demo session
INSERT INTO session_participants (user_id, session_id, role, joined_at) VALUES
  ('user-alice-001', 'demo-session', 'creator', NOW()),
  ('user-bob-002', 'demo-session', 'participant', NOW()),
  ('user-alice-001', 'test-session', 'creator', NOW())
ON CONFLICT (user_id, session_id) DO NOTHING;

-- Create sample cards for demo session
INSERT INTO cards (id, session_id, content, color, x, y, votes, voted_by, reactions, created_by_id, updated_at) VALUES
  ('card-welcome', 'demo-session', 'Welcome to Pawboard! This is a demo board with sample cards.', '#fef08a', 100, 100, 2, '["user-bob-002", "user-charlie-003"]', '{}', 'user-alice-001', NOW()),
  ('card-feature-1', 'demo-session', 'Real-time collaboration - see changes instantly!', '#fecaca', 350, 120, 1, '["user-alice-001"]', '{"heart": ["user-bob-002"]}', 'user-bob-002', NOW()),
  ('card-feature-2', 'demo-session', 'Drag cards around to organize your ideas', '#bbf7d0', 600, 100, 0, '[]', '{}', 'user-alice-001', NOW()),
  ('card-idea-1', 'demo-session', 'Add new features here...', '#ddd6fe', 200, 300, 0, '[]', '{}', 'user-charlie-003', NOW()),
  ('card-test-1', 'test-session', 'Test card for development', '#fef08a', 150, 150, 0, '[]', '{}', 'user-alice-001', NOW())
ON CONFLICT (id) DO NOTHING;
