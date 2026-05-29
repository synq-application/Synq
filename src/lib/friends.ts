import { doc, writeBatch } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

import { auth, app, db } from "./firebase";
import { pruneFriendFromAllGroups } from "./friendGroups";
import {
  friendsListCacheByUser,
  pruneSocialCachesToFriendIds,
} from "./socialCache";

const functions = getFunctions(app, "us-central1");

function pruneRemovedFriendFromCache(viewerId: string, removedFriendId: string) {
  const remaining = new Set(
    (friendsListCacheByUser[viewerId] ?? [])
      .map((f) => f.id)
      .filter((id) => id !== removedFriendId)
  );
  pruneSocialCachesToFriendIds(viewerId, remaining);
}

async function removeFriendMutualClient(uid: string, otherUid: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", uid, "friends", otherUid));
  batch.delete(doc(db, "users", otherUid, "friends", uid));
  batch.delete(doc(db, "users", uid, "friendRequests", otherUid));
  batch.delete(doc(db, "users", otherUid, "friendRequests", uid));
  batch.delete(doc(db, "users", uid, "outgoingFriendRequests", otherUid));
  await batch.commit();
  await pruneFriendFromAllGroups(uid, otherUid);
}

/** Removes friendship on both sides; falls back to client writes if the callable is unavailable. */
export async function removeFriendMutual(otherUid: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !otherUid || otherUid === uid) {
    throw new Error("Invalid friend.");
  }

  try {
    const fn = httpsCallable(functions, "removeFriendMutual");
    await fn({ otherUid });
  } catch (e: unknown) {
    const code = String((e as { code?: string })?.code || "");
    const canFallback =
      code.includes("not-found") ||
      code.includes("unavailable") ||
      code.includes("internal");
    if (!canFallback) {
      throw e;
    }
    await removeFriendMutualClient(uid, otherUid);
  }

  pruneRemovedFriendFromCache(uid, otherUid);
}

export function removeFriendMutualErrorMessage(err: unknown): string {
  const code = String((err as { code?: string })?.code || "");
  const msg = String((err as { message?: string })?.message || err || "");

  if (code.includes("unauthenticated")) {
    return "Please sign in again and try removing this friend.";
  }
  if (code.includes("permission-denied")) {
    return "You don't have permission to remove this friend.";
  }
  if (msg.trim()) return msg.trim();
  return "Please check your connection and try again.";
}
