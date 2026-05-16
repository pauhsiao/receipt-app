-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Groups
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group members
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Receipts
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  image_url TEXT,
  receipt_date DATE NOT NULL,
  receipt_time TIME NOT NULL,
  merchant_name TEXT,
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'TWD',
  is_split BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receipt items
CREATE TABLE receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL
);

-- Row Level Security
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

-- Groups: 成員才能看到群組
CREATE POLICY "members can view their groups" ON groups
  FOR SELECT USING (
    id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );
CREATE POLICY "users can create groups" ON groups
  FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "creator can update group" ON groups
  FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "creator can delete group" ON groups
  FOR DELETE USING (created_by = auth.uid());

-- Group members
CREATE POLICY "members can view group members" ON group_members
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );
CREATE POLICY "users can join groups" ON group_members
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can leave groups" ON group_members
  FOR DELETE USING (user_id = auth.uid());

-- Receipts: 個人帳單 or 群組成員帳單
CREATE POLICY "view own or group receipts" ON receipts
  FOR SELECT USING (
    user_id = auth.uid() OR
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );
CREATE POLICY "users can insert receipts" ON receipts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can update own receipts" ON receipts
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "users can delete own receipts" ON receipts
  FOR DELETE USING (user_id = auth.uid());

-- Receipt items
CREATE POLICY "view receipt items" ON receipt_items
  FOR SELECT USING (
    receipt_id IN (
      SELECT id FROM receipts WHERE
        user_id = auth.uid() OR
        group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "insert receipt items" ON receipt_items
  FOR INSERT WITH CHECK (
    receipt_id IN (SELECT id FROM receipts WHERE user_id = auth.uid())
  );
CREATE POLICY "delete receipt items" ON receipt_items
  FOR DELETE USING (
    receipt_id IN (SELECT id FROM receipts WHERE user_id = auth.uid())
  );

-- Storage bucket for receipt images
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

CREATE POLICY "users can upload receipt images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users can view own receipt images" ON storage.objects
  FOR SELECT USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users can delete own receipt images" ON storage.objects
  FOR DELETE USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
