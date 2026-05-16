DROP POLICY IF EXISTS "authenticated can create groups" ON groups;
DROP POLICY IF EXISTS "users can create groups" ON groups;

CREATE POLICY "authenticated can create groups" ON groups
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
