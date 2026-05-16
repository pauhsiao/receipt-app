-- Drop old functions if exist
DROP FUNCTION IF EXISTS create_group_for_me(TEXT);
DROP FUNCTION IF EXISTS join_group_by_code(TEXT);
DROP FUNCTION IF EXISTS get_my_groups();

-- Create group + add self as member atomically (bypasses RLS for INSERT)
CREATE OR REPLACE FUNCTION create_group_for_me(p_name TEXT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid UUID;
  v_group_id UUID;
  v_invite_code TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '未登入：請重新登入後再試';
  END IF;

  v_invite_code := upper(substr(md5(random()::text), 1, 8));

  INSERT INTO groups (name, created_by, invite_code)
  VALUES (p_name, v_uid, v_invite_code)
  RETURNING id INTO v_group_id;

  INSERT INTO group_members (group_id, user_id)
  VALUES (v_group_id, v_uid);

  RETURN json_build_object(
    'id', v_group_id,
    'name', p_name,
    'invite_code', v_invite_code,
    'created_by', v_uid
  );
END;
$$;
GRANT EXECUTE ON FUNCTION create_group_for_me(TEXT) TO authenticated;

-- Join a group by invite code (bypasses SELECT RLS so non-members can look up by code)
CREATE OR REPLACE FUNCTION join_group_by_code(p_code TEXT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid UUID;
  v_group_id UUID;
  v_group_name TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '未登入：請重新登入後再試';
  END IF;

  SELECT id, name INTO v_group_id, v_group_name
  FROM groups WHERE lower(invite_code) = lower(p_code);

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION '找不到此邀請碼';
  END IF;

  INSERT INTO group_members (group_id, user_id)
  VALUES (v_group_id, v_uid)
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN json_build_object(
    'id', v_group_id,
    'name', v_group_name
  );
END;
$$;
GRANT EXECUTE ON FUNCTION join_group_by_code(TEXT) TO authenticated;

-- Get all groups for the current user (avoids circular RLS on group_members)
CREATE OR REPLACE FUNCTION get_my_groups()
RETURNS TABLE(
  id UUID,
  name TEXT,
  invite_code TEXT,
  created_by UUID,
  joined_at TIMESTAMPTZ
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT g.id, g.name, g.invite_code, g.created_by, gm.joined_at
  FROM group_members gm
  JOIN groups g ON g.id = gm.group_id
  WHERE gm.user_id = auth.uid()
  ORDER BY gm.joined_at ASC;
$$;
GRANT EXECUTE ON FUNCTION get_my_groups() TO authenticated;
