-- SELECT policies for projects and clients evaluated against the row's own
-- columns. The previous versions called can_view_project(id)/can_view_client(id),
-- which look the row up again in a separate query — that lookup can't see a row
-- that is being inserted, so INSERT ... RETURNING was rejected.

DROP POLICY IF EXISTS projects_select ON public.projects;
--> statement-breakpoint
CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated
  USING (
    app.is_manager(workspace_id)
    OR (app.is_staff(workspace_id) AND app.is_project_member(id))
    OR (client_id IS NOT NULL AND client_id = app.client_scope(workspace_id))
  );
--> statement-breakpoint

DROP POLICY IF EXISTS clients_select ON public.clients;
--> statement-breakpoint
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated
  USING (
    app.is_manager(workspace_id)
    OR id = app.client_scope(workspace_id)
    OR (
      app.is_staff(workspace_id) AND EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.project_members pm ON pm.project_id = p.id
        WHERE p.client_id = clients.id AND pm.profile_id = app.profile_id()
      )
    )
  );
