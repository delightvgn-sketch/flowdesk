-- ============================================================================
-- FlowDesk row level security
--
-- Identity: every policy resolves the caller from `auth.jwt() ->> 'sub'`, which
-- is the Clerk user id. The Next.js server verifies the Clerk session and then
-- runs queries inside a transaction with `role = authenticated` and
-- `request.jwt.claims = {"sub": <clerk id>}` (see src/server/db/index.ts).
-- The same policies therefore also work for direct Supabase access when Clerk
-- is configured as a Supabase third-party auth provider.
--
-- Roles: OWNER/ADMIN ("managers") see the whole workspace. MEMBERs see the
-- projects they are staffed on (and the clients behind them) but no financial
-- data. CLIENT users only see their own client's projects, non-draft invoices,
-- files explicitly shared with them and non-internal messages.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS app;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO authenticated;
--> statement-breakpoint

-- ---------------------------------------------------------------- helpers ---

CREATE OR REPLACE FUNCTION app.profile_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT id FROM public.profiles WHERE clerk_user_id = (auth.jwt() ->> 'sub')
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.member_role(ws uuid) RETURNS public.workspace_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = ws AND profile_id = app.profile_id()
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.is_member(ws uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT app.member_role(ws) IS NOT NULL $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.is_staff(ws uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT coalesce(app.member_role(ws) IN ('OWNER', 'ADMIN', 'MEMBER'), false) $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.is_manager(ws uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT coalesce(app.member_role(ws) IN ('OWNER', 'ADMIN'), false) $$;
--> statement-breakpoint

-- The CRM client a CLIENT user represents (NULL for staff).
CREATE OR REPLACE FUNCTION app.client_scope(ws uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT client_id FROM public.workspace_members
  WHERE workspace_id = ws AND profile_id = app.profile_id() AND role = 'CLIENT'
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.is_project_member(pid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = pid AND profile_id = app.profile_id()
  )
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.can_view_project(pid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = pid AND (
      app.is_manager(p.workspace_id)
      OR (app.is_staff(p.workspace_id) AND app.is_project_member(p.id))
      OR (p.client_id IS NOT NULL AND p.client_id = app.client_scope(p.workspace_id))
    )
  )
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app.can_view_client(cid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = cid AND (
      app.is_manager(c.workspace_id)
      OR c.id = app.client_scope(c.workspace_id)
      OR (
        app.is_staff(c.workspace_id) AND EXISTS (
          SELECT 1 FROM public.projects p
          JOIN public.project_members pm ON pm.project_id = p.id
          WHERE p.client_id = c.id AND pm.profile_id = app.profile_id()
        )
      )
    )
  )
$$;
--> statement-breakpoint

-- Profiles are visible to people who share at least one workspace.
CREATE OR REPLACE FUNCTION app.shares_workspace(other uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members mine
    JOIN public.workspace_members theirs ON theirs.workspace_id = mine.workspace_id
    WHERE mine.profile_id = app.profile_id() AND theirs.profile_id = other
  )
$$;
--> statement-breakpoint

-- Client approval of a milestone/deliverable. Clients may only change the
-- approval fields, so this goes through a narrow definer function instead of
-- granting them UPDATE on milestones.
CREATE OR REPLACE FUNCTION app.respond_to_milestone(mid uuid, decision public.approval_status, note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  m public.milestones;
BEGIN
  IF decision NOT IN ('APPROVED', 'CHANGES_REQUESTED') THEN
    RAISE EXCEPTION 'invalid decision' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO m FROM public.milestones WHERE id = mid;
  IF m.id IS NULL OR NOT app.can_view_project(m.project_id) THEN
    RAISE EXCEPTION 'not found' USING ERRCODE = '42501';
  END IF;
  IF m.approval_status NOT IN ('PENDING', 'CHANGES_REQUESTED') THEN
    RAISE EXCEPTION 'milestone is not awaiting approval' USING ERRCODE = '22023';
  END IF;
  UPDATE public.milestones SET
    approval_status = decision,
    approval_note = note,
    approved_by_id = app.profile_id(),
    approved_at = now(),
    status = CASE WHEN decision = 'APPROVED' THEN 'COMPLETED'::public.milestone_status ELSE status END
  WHERE id = mid;
END
$$;
--> statement-breakpoint

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO authenticated;
--> statement-breakpoint

-- ------------------------------------------------------------- enable RLS ---

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','workspaces','workspace_members','workspace_invitations','clients','client_contacts',
    'projects','project_members','milestones','labels','tasks','task_labels','task_comments',
    'invoices','invoice_items','payments','folders','files','messages','notifications',
    'activity_logs','calendar_events','ai_conversations','ai_messages'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- --------------------------------------------------------------- profiles ---

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (clerk_user_id = (auth.jwt() ->> 'sub') OR app.shares_workspace(id));
--> statement-breakpoint
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (clerk_user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (clerk_user_id = (auth.jwt() ->> 'sub'));
--> statement-breakpoint

-- ------------------------------------------------------------- workspaces ---

CREATE POLICY workspaces_select ON public.workspaces FOR SELECT TO authenticated
  USING (app.is_member(id));
--> statement-breakpoint
CREATE POLICY workspaces_update ON public.workspaces FOR UPDATE TO authenticated
  USING (app.is_manager(id)) WITH CHECK (app.is_manager(id));
--> statement-breakpoint
CREATE POLICY workspaces_delete ON public.workspaces FOR DELETE TO authenticated
  USING (app.member_role(id) = 'OWNER');
--> statement-breakpoint

-- Staff see the whole roster; client users only see staff and themselves.
CREATE POLICY members_select ON public.workspace_members FOR SELECT TO authenticated
  USING (
    app.is_staff(workspace_id)
    OR profile_id = app.profile_id()
    OR (app.is_member(workspace_id) AND role <> 'CLIENT')
  );
--> statement-breakpoint
-- Managers manage the roster, but only an OWNER may touch OWNER rows.
CREATE POLICY members_insert ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (app.is_manager(workspace_id) AND (role <> 'OWNER' OR app.member_role(workspace_id) = 'OWNER'));
--> statement-breakpoint
CREATE POLICY members_update ON public.workspace_members FOR UPDATE TO authenticated
  USING (app.is_manager(workspace_id) AND (role <> 'OWNER' OR app.member_role(workspace_id) = 'OWNER'))
  WITH CHECK (app.is_manager(workspace_id) AND (role <> 'OWNER' OR app.member_role(workspace_id) = 'OWNER'));
--> statement-breakpoint
CREATE POLICY members_delete ON public.workspace_members FOR DELETE TO authenticated
  USING (app.is_manager(workspace_id) AND (role <> 'OWNER' OR app.member_role(workspace_id) = 'OWNER'));
--> statement-breakpoint

CREATE POLICY invitations_all ON public.workspace_invitations FOR ALL TO authenticated
  USING (app.is_manager(workspace_id))
  WITH CHECK (app.is_manager(workspace_id) AND (role <> 'OWNER'));
--> statement-breakpoint

-- -------------------------------------------------------------------- CRM ---

CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated
  USING (app.can_view_client(id));
--> statement-breakpoint
CREATE POLICY clients_write ON public.clients FOR ALL TO authenticated
  USING (app.is_manager(workspace_id)) WITH CHECK (app.is_manager(workspace_id));
--> statement-breakpoint

CREATE POLICY client_contacts_select ON public.client_contacts FOR SELECT TO authenticated
  USING (app.can_view_client(client_id));
--> statement-breakpoint
CREATE POLICY client_contacts_write ON public.client_contacts FOR ALL TO authenticated
  USING (app.is_manager(workspace_id)) WITH CHECK (app.is_manager(workspace_id));
--> statement-breakpoint

-- --------------------------------------------------------------- projects ---

CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated
  USING (app.can_view_project(id));
--> statement-breakpoint
CREATE POLICY projects_insert ON public.projects FOR INSERT TO authenticated
  WITH CHECK (app.is_manager(workspace_id));
--> statement-breakpoint
CREATE POLICY projects_update ON public.projects FOR UPDATE TO authenticated
  USING (app.is_manager(workspace_id) OR (app.is_staff(workspace_id) AND app.is_project_member(id)))
  WITH CHECK (app.is_manager(workspace_id) OR (app.is_staff(workspace_id) AND app.is_project_member(id)));
--> statement-breakpoint
CREATE POLICY projects_delete ON public.projects FOR DELETE TO authenticated
  USING (app.is_manager(workspace_id));
--> statement-breakpoint

CREATE POLICY project_members_select ON public.project_members FOR SELECT TO authenticated
  USING (app.can_view_project(project_id));
--> statement-breakpoint
CREATE POLICY project_members_write ON public.project_members FOR ALL TO authenticated
  USING (app.is_manager(workspace_id)) WITH CHECK (app.is_manager(workspace_id));
--> statement-breakpoint

CREATE POLICY milestones_select ON public.milestones FOR SELECT TO authenticated
  USING (app.can_view_project(project_id));
--> statement-breakpoint
CREATE POLICY milestones_write ON public.milestones FOR ALL TO authenticated
  USING (app.is_staff(workspace_id) AND app.can_view_project(project_id))
  WITH CHECK (app.is_staff(workspace_id) AND app.can_view_project(project_id));
--> statement-breakpoint

-- ------------------------------------------------------------------ tasks ---

CREATE POLICY labels_select ON public.labels FOR SELECT TO authenticated
  USING (app.is_member(workspace_id));
--> statement-breakpoint
CREATE POLICY labels_write ON public.labels FOR ALL TO authenticated
  USING (app.is_staff(workspace_id)) WITH CHECK (app.is_staff(workspace_id));
--> statement-breakpoint

CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated
  USING (
    app.is_manager(workspace_id)
    OR (app.is_staff(workspace_id) AND (assignee_id = app.profile_id() OR created_by_id = app.profile_id()))
    OR (project_id IS NOT NULL AND app.can_view_project(project_id))
  );
--> statement-breakpoint
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    app.is_staff(workspace_id)
    AND created_by_id = app.profile_id()
    AND (app.is_manager(workspace_id) OR project_id IS NULL OR app.can_view_project(project_id))
  );
--> statement-breakpoint
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated
  USING (
    app.is_staff(workspace_id) AND (
      app.is_manager(workspace_id)
      OR assignee_id = app.profile_id()
      OR created_by_id = app.profile_id()
      OR (project_id IS NOT NULL AND app.can_view_project(project_id))
    )
  )
  WITH CHECK (
    app.is_staff(workspace_id)
    AND (app.is_manager(workspace_id) OR project_id IS NULL OR app.can_view_project(project_id))
  );
--> statement-breakpoint
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated
  USING (app.is_manager(workspace_id) OR (app.is_staff(workspace_id) AND created_by_id = app.profile_id()));
--> statement-breakpoint

-- Sub-resources of tasks inherit visibility from the (RLS-filtered) task row.
CREATE POLICY task_labels_select ON public.task_labels FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id));
--> statement-breakpoint
CREATE POLICY task_labels_write ON public.task_labels FOR ALL TO authenticated
  USING (app.is_staff(workspace_id) AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id))
  WITH CHECK (app.is_staff(workspace_id) AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id));
--> statement-breakpoint

CREATE POLICY task_comments_select ON public.task_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id));
--> statement-breakpoint
CREATE POLICY task_comments_insert ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = app.profile_id() AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id));
--> statement-breakpoint
CREATE POLICY task_comments_delete ON public.task_comments FOR DELETE TO authenticated
  USING (author_id = app.profile_id() OR app.is_manager(workspace_id));
--> statement-breakpoint

-- -------------------------------------------------------------- invoicing ---

CREATE POLICY invoices_select ON public.invoices FOR SELECT TO authenticated
  USING (
    app.is_manager(workspace_id)
    OR (client_id = app.client_scope(workspace_id) AND status <> 'DRAFT')
  );
--> statement-breakpoint
CREATE POLICY invoices_write ON public.invoices FOR ALL TO authenticated
  USING (app.is_manager(workspace_id)) WITH CHECK (app.is_manager(workspace_id));
--> statement-breakpoint

CREATE POLICY invoice_items_select ON public.invoice_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id));
--> statement-breakpoint
CREATE POLICY invoice_items_write ON public.invoice_items FOR ALL TO authenticated
  USING (app.is_manager(workspace_id)) WITH CHECK (app.is_manager(workspace_id));
--> statement-breakpoint

CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id));
--> statement-breakpoint
CREATE POLICY payments_write ON public.payments FOR ALL TO authenticated
  USING (app.is_manager(workspace_id)) WITH CHECK (app.is_manager(workspace_id));
--> statement-breakpoint

-- ------------------------------------------------------------------ files ---

CREATE POLICY folders_select ON public.folders FOR SELECT TO authenticated
  USING (app.is_staff(workspace_id));
--> statement-breakpoint
CREATE POLICY folders_insert ON public.folders FOR INSERT TO authenticated
  WITH CHECK (app.is_staff(workspace_id) AND created_by_id = app.profile_id());
--> statement-breakpoint
CREATE POLICY folders_update ON public.folders FOR UPDATE TO authenticated
  USING (app.is_staff(workspace_id)) WITH CHECK (app.is_staff(workspace_id));
--> statement-breakpoint
CREATE POLICY folders_delete ON public.folders FOR DELETE TO authenticated
  USING (app.is_manager(workspace_id) OR (app.is_staff(workspace_id) AND created_by_id = app.profile_id()));
--> statement-breakpoint

CREATE POLICY files_select ON public.files FOR SELECT TO authenticated
  USING (
    uploaded_by_id = app.profile_id()
    OR app.is_manager(workspace_id)
    OR (
      app.is_staff(workspace_id) AND (
        (project_id IS NOT NULL AND app.can_view_project(project_id))
        OR (project_id IS NULL AND client_id IS NOT NULL AND app.can_view_client(client_id))
        OR (project_id IS NULL AND client_id IS NULL)
      )
    )
    OR (
      shared_with_client AND app.client_scope(workspace_id) IS NOT NULL AND (
        client_id = app.client_scope(workspace_id)
        OR (project_id IS NOT NULL AND app.can_view_project(project_id))
      )
    )
  );
--> statement-breakpoint
CREATE POLICY files_insert ON public.files FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by_id = app.profile_id() AND (
      app.is_staff(workspace_id)
      OR (
        shared_with_client AND app.client_scope(workspace_id) IS NOT NULL AND folder_id IS NULL AND (
          client_id = app.client_scope(workspace_id)
          OR (project_id IS NOT NULL AND app.can_view_project(project_id))
        )
      )
    )
  );
--> statement-breakpoint
CREATE POLICY files_update ON public.files FOR UPDATE TO authenticated
  USING (app.is_staff(workspace_id)) WITH CHECK (app.is_staff(workspace_id));
--> statement-breakpoint
CREATE POLICY files_delete ON public.files FOR DELETE TO authenticated
  USING (app.is_manager(workspace_id) OR uploaded_by_id = app.profile_id());
--> statement-breakpoint

-- ---------------------------------------------------------- collaboration ---

CREATE OR REPLACE FUNCTION app.can_view_message(ws uuid, pid uuid, cid uuid, is_internal boolean) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN app.is_manager(ws) THEN true
    WHEN app.is_staff(ws) THEN
      (pid IS NOT NULL AND app.can_view_project(pid))
      OR (pid IS NULL AND cid IS NOT NULL AND app.can_view_client(cid))
      OR (pid IS NULL AND cid IS NULL)
    WHEN app.client_scope(ws) IS NOT NULL THEN
      NOT is_internal AND (
        (pid IS NOT NULL AND app.can_view_project(pid))
        OR (pid IS NULL AND cid = app.client_scope(ws))
      )
    ELSE false
  END
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.can_view_message(uuid, uuid, uuid, boolean) TO authenticated;
--> statement-breakpoint

CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated
  USING (app.can_view_message(workspace_id, project_id, client_id, internal));
--> statement-breakpoint
CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (author_id = app.profile_id() AND app.can_view_message(workspace_id, project_id, client_id, internal));
--> statement-breakpoint
CREATE POLICY messages_delete ON public.messages FOR DELETE TO authenticated
  USING (author_id = app.profile_id() OR app.is_manager(workspace_id));
--> statement-breakpoint

CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = app.profile_id());
--> statement-breakpoint
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = app.profile_id()) WITH CHECK (recipient_id = app.profile_id());
--> statement-breakpoint
CREATE POLICY notifications_delete ON public.notifications FOR DELETE TO authenticated
  USING (recipient_id = app.profile_id());
--> statement-breakpoint
-- Any workspace member may notify another member of the same workspace.
CREATE POLICY notifications_insert ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    app.is_member(workspace_id)
    AND (actor_id IS NULL OR actor_id = app.profile_id())
    AND EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = notifications.workspace_id AND m.profile_id = recipient_id
    )
  );
--> statement-breakpoint

CREATE POLICY activity_select ON public.activity_logs FOR SELECT TO authenticated
  USING (
    app.is_manager(workspace_id)
    OR (
      app.is_staff(workspace_id) AND (
        actor_id = app.profile_id()
        OR (
          entity_type NOT IN ('invoice', 'payment')
          AND project_id IS NOT NULL AND app.can_view_project(project_id)
        )
      )
    )
  );
--> statement-breakpoint
CREATE POLICY activity_insert ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (app.is_member(workspace_id) AND actor_id = app.profile_id());
--> statement-breakpoint

CREATE POLICY events_select ON public.calendar_events FOR SELECT TO authenticated
  USING (app.is_staff(workspace_id) AND (project_id IS NULL OR app.can_view_project(project_id)));
--> statement-breakpoint
CREATE POLICY events_insert ON public.calendar_events FOR INSERT TO authenticated
  WITH CHECK (
    app.is_staff(workspace_id) AND created_by_id = app.profile_id()
    AND (project_id IS NULL OR app.can_view_project(project_id))
  );
--> statement-breakpoint
CREATE POLICY events_update ON public.calendar_events FOR UPDATE TO authenticated
  USING (app.is_manager(workspace_id) OR created_by_id = app.profile_id())
  WITH CHECK (app.is_staff(workspace_id));
--> statement-breakpoint
CREATE POLICY events_delete ON public.calendar_events FOR DELETE TO authenticated
  USING (app.is_manager(workspace_id) OR created_by_id = app.profile_id());
--> statement-breakpoint

-- --------------------------------------------------------------------- AI ---

CREATE POLICY ai_conversations_owner ON public.ai_conversations FOR ALL TO authenticated
  USING (profile_id = app.profile_id() AND app.is_staff(workspace_id))
  WITH CHECK (profile_id = app.profile_id() AND app.is_staff(workspace_id));
--> statement-breakpoint
CREATE POLICY ai_messages_owner ON public.ai_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id));
--> statement-breakpoint

-- ---------------------------------------------------------------- storage ---

-- Private bucket. The browser never talks to Storage with its own credentials:
-- the server authorises each request and hands out short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace-files', 'workspace-files', false, 26214400,
  ARRAY[
    'image/png','image/jpeg','image/webp','image/gif','image/svg+xml',
    'application/pdf','text/plain','text/csv','text/markdown',
    'application/zip','application/x-zip-compressed',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/json','video/mp4','audio/mpeg'
  ]
)
ON CONFLICT (id) DO NOTHING;
