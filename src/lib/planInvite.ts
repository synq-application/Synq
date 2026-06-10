import { FirebaseError } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

const functions = getFunctions(app, "us-central1");

const sendPlanInviteFn = httpsCallable<
  { toUserId: string; eventId: string },
  { ok: boolean }
>(functions, "sendPlanInvite");

const acceptPlanInviteFn = httpsCallable<
  { notificationId: string },
  { ok: boolean; status?: string }
>(functions, "acceptPlanInvite");

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
): Promise<void> {
  await sendPlanInviteFn({ toUserId, eventId });
}

export async function acceptPlanInvite(notificationId: string): Promise<void> {
  await acceptPlanInviteFn({ notificationId });
}
