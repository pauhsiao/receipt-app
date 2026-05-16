-- 給 authenticated 使用者執行函數的權限
GRANT EXECUTE ON FUNCTION get_my_group_ids() TO authenticated;

-- 確認 groups INSERT 政策存在（重建以防遺失）
DROP POLICY IF EXISTS "users can create groups" ON groups;
CREATE POLICY "users can create groups" ON groups
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- 確認 group_members INSERT 政策存在
DROP POLICY IF EXISTS "users can join groups" ON group_members;
CREATE POLICY "users can join groups" ON group_members
  FOR INSERT WITH CHECK (user_id = auth.uid());
