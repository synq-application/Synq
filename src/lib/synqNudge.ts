import { FirebaseError } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

const functions = getFunctions(app, "us-central1");

export function synqNudgeErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "functions/failed-precondition":
        return err.message || "You can't ask this friend right now.";
      case "functions/resource-exhausted":
        return err.message || "You can ask this friend again in a few hours.";
      case "functions/permission-denied":
        return "You can only ask friends.";
      case "functions/unauthenticated":
        return "Sign in to ask if a friend is free.";
      default:
        return err.message || "Could not send.";
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return "Could not send.";
}

export async function sendSynqNudge(toUserId: string): Promise<void> {
  const fn = httpsCallable<{ toUserId: string }, { ok: boolean }>(
    functions,
    "sendSynqNudge"
  );
  await fn({ toUserId });
}
