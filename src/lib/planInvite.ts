import { FirebaseError } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

const functions = getFunctions(app, "us-central1");

const sendPlanInviteFn = httpsCallable<
  { toUserId: string; eventId: string },
  { ok: boolean; alreadyInvited?: boolean }
>(functions, "sendPlanInvite");

const acceptPlanInviteFn = httpsCallable<
  { notificationId: string },
  { ok: boolean; status?: string }
>(functions, "acceptPlanInvite");

const revokePlanInviteFn = httpsCallable<
  { toUserId: string; eventId: string },
  { ok: boolean; alreadyRevoked?: boolean }
>(functions, "revokePlanInvite");

export function planInviteNotifId(
  hostUid: string,
  recipientUid: string,
  eventId: string
): string {
  const safeEventId = String(eventId || "")
    .trim()
    .replace(/[/\s]/g, "_");
  return `plan_invite_${hostUid}_${recipientUid}_${safeEventId}`.slice(0, 1400);
}

export function planInviteErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "functions/failed-precondition":
        return err.message || "You can't invite this friend right now.";
      case "functions/permission-denied":
        return "You can only invite friends.";
      case "functions/not-found":
        return err.message || "Plan not found.";
      case "functions/unauthenticated":
        return "Sign in to invite friends to a plan.";
      default:
        return err.message || "Could not send invite.";
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return "Could not send invite.";
}

export function acceptPlanInviteErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "functions/not-found":
        return err.message || "This invite is no longer available.";
      case "functions/failed-precondition":
        return err.message || "Could not accept this invite.";
      case "functions/unauthenticated":
        return "Sign in to accept this invite.";
      default:
        return err.message || "Could not accept invite.";
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return "Could not accept invite.";
}

export async function sendPlanInvite(
  toUserId: string,
  eventId: string
): Promise<{ alreadyInvited: boolean }> {
  const result = await sendPlanInviteFn({ toUserId, eventId });
  return { alreadyInvited: !!result.data?.alreadyInvited };
}

export async function sendPlanInvites(
  toUserIds: string[],
  eventId: string
): Promise<{ invitedIds: string[]; alreadyInvitedIds: string[]; errors: string[] }> {
  const invitedIds: string[] = [];
  const alreadyInvitedIds: string[] = [];
  const errors: string[] = [];

  const ids = toUserIds
    .map((toUserId) => String(toUserId || "").trim())
    .filter(Boolean);

  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const { alreadyInvited } = await sendPlanInvite(id, eventId);
        return { id, alreadyInvited, error: null as string | null };
      } catch (err) {
        return { id, alreadyInvited: false, error: planInviteErrorMessage(err) };
      }
    })
  );

  for (const result of results) {
    if (result.error) {
      errors.push(result.error);
    } else if (result.alreadyInvited) {
      alreadyInvitedIds.push(result.id);
    } else {
      invitedIds.push(result.id);
    }
  }

  return { invitedIds, alreadyInvitedIds, errors };
}

export async function acceptPlanInvite(notificationId: string): Promise<void> {
  await acceptPlanInviteFn({ notificationId });
}

export function revokePlanInviteErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "functions/not-found":
        return err.message || "Plan not found.";
      case "functions/permission-denied":
        return "You can only manage invites on your own plans.";
      case "functions/unauthenticated":
        return "Sign in to manage plan invites.";
      default:
        return err.message || "Could not unsend invite.";
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return "Could not unsend invite.";
}

export async function revokePlanInvite(
  toUserId: string,
  eventId: string
): Promise<{ alreadyRevoked: boolean }> {
  const result = await revokePlanInviteFn({ toUserId, eventId });
  return { alreadyRevoked: !!result.data?.alreadyRevoked };
}
