DROP POLICY IF EXISTS "members can view group members" ON group_members;
DROP POLICY IF EXISTS "members can view their groups" ON groups;
DROP POLICY IF EXISTS "view own or group receipts" ON receipts;
DROP POLICY IF EXISTS "view receipt items" ON receipt_items;

CREATE OR REPLACE FUNCTION get_my_group_ids()
RETURNS SETOF UUID SECURITY DEFINER LANGUAGE SQL AS $$
  SELECT group_id FROM group_members WHERE user_id = auth.uid()
$$;

CREATE POLICY "members can view group members" ON group_members
  FOR SELECT USING (user_id = auth.uid() OR group_id IN (SELECT get_my_group_ids()));

CREATE POLICY "members can view their groups" ON groups
  FOR SELECT USING (id IN (SELECT get_my_group_ids()));

CREATE POLICY "view own or group receipts" ON receipts
  FOR SELECT USING (user_id = auth.uid() OR group_id IN (SELECT get_my_group_ids()));

CREATE POLICY "view receipt items" ON receipt_items
  FOR SELECT USING (receipt_id IN (
    SELECT id FROM receipts WHERE user_id = auth.uid() OR group_id IN (SELECT get_my_group_ids())
  ));
