"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { zonedTimeToUtc } from "@/lib/dates";
import { eventSchema, idSchema } from "@/lib/validation";
import { createAction } from "@/server/actions/safe-action";
import { calendarEvents } from "@/server/db/schema";
import { UserFacingError } from "@/server/errors";
import { logActivity } from "@/server/services/activity";

export const createEvent = createAction({ schema: eventSchema, permission: "calendar:manage" }, async (input, ctx) => {
  const tz = ctx.workspace.timezone;
  const startsAt = input.allDay ? zonedTimeToUtc(input.date, "00:00", tz) : zonedTimeToUtc(input.date, input.startTime!, tz);
  const endsAt = !input.allDay && input.endTime ? zonedTimeToUtc(input.date, input.endTime, tz) : null;
  await ctx.db(async (tx) => {
    const [row] = await tx
      .insert(calendarEvents)
      .values({
        workspaceId: ctx.workspace.id,
        title: input.title,
        description: input.description,
        type: input.type,
        startsAt,
        endsAt,
        allDay: input.allDay,
        location: input.location,
        projectId: input.projectId,
        clientId: input.clientId,
        createdById: ctx.profile.id,
      })
      .returning();
    await logActivity(tx, ctx, {
      action: "event.created",
      entityType: "event",
      entityId: row.id,
      entityLabel: row.title,
      projectId: row.projectId,
      clientId: row.clientId,
    });
  });
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
});

export const deleteEvent = createAction({ schema: idSchema, permission: "calendar:manage" }, async ({ id }, ctx) => {
  const rows = await ctx.db((tx) =>
    tx
      .delete(calendarEvents)
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.workspaceId, ctx.workspace.id)))
      .returning(),
  );
  if (rows.length === 0) throw new UserFacingError("Only managers or the person who created this event can delete it.");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
});
