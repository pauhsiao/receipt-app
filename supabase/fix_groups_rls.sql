-- 移除所有 groups 相關政策重建
DROP POLICY IF EXISTS "users can create groups" ON groups;
DROP POLICY IF EXISTS "creator can update group" ON groups;
DROP POLICY IF EXISTS "creator can delete group" ON groups;
DROP POLICY IF EXISTS "members can view their groups" ON groups;

-- 重建：只要登入就可以建立群組
CREATE POLICY "authenticated can create groups" ON groups
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 重建：只能看自己參與的群組
CREATE POLICY "members can view their groups" ON groups
  FOR SELECT USING (id IN (SELECT get_my_group_ids()));

-- 重建：建立者可以修改
CREATE POLICY "creator can update group" ON groups
  FOR UPDATE USING (created_by = auth.uid());

-- 重建：建立者可以刪除
CREATE POLICY "creator can delete group" ON groups
  FOR DELETE USING (created_by = auth.uid());
