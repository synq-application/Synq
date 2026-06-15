import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  matchesPlanEvent,
  sortOpenPlansByDateTime,
} from "./planEvents";

export type CommunityGroupPlan = {
  id: string;
  groupId: string;
  creatorId: string;
  creatorDisplayName: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  createdAt?: unknown;
};

export type CreateCommunityGroupPlanInput = {
  title: string;
  date: string;
  time?: string;
  location?: string;
};

function communityPlansCollection(groupId: string) {
  return collection(db, "communityGroups", groupId, "plans");
}

function communityPlanRef(groupId: string, planId: string) {
  return doc(db, "communityGroups", groupId, "plans", planId);
}

function mapPlanDoc(groupId: string, id: string, data: Record<string, unknown>): CommunityGroupPlan {
  return {
    id,
    groupId,
    creatorId: String(data.creatorId || "").trim(),
    creatorDisplayName: String(data.creatorDisplayName || "").trim() || "Member",
    title: String(data.title || "").trim(),
    date: String(data.date || "").trim(),
    time: String(data.time || "").trim() || undefined,
    location: String(data.location || "").trim() || undefined,
    createdAt: data.createdAt,
  };
}

export function subscribeCommunityGroupPlans(
  groupId: string,
  onData: (plans: CommunityGroupPlan[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(communityPlansCollection(groupId), orderBy("date", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const plans = snap.docs.map((d) =>
        mapPlanDoc(groupId, d.id, d.data() as Record<string, unknown>)
      );
      onData(plans);
    },
    (err) => onError?.(err)
  );
}

export async function createCommunityGroupPlan(
  groupId: string,
  uid: string,
  creatorDisplayName: string,
  input: CreateCommunityGroupPlanInput
): Promise<string> {
  const title = input.title.trim();
  const date = input.date.trim();
  if (!title) throw new Error("Plan title is required.");
  if (!date) throw new Error("Plan date is required.");

  const ref = doc(communityPlansCollection(groupId));
  await setDoc(ref, {
    groupId,
    creatorId: uid,
    creatorDisplayName: creatorDisplayName.trim() || "Member",
    title: title.slice(0, 80),
    date,
    time: input.time?.trim().slice(0, 32) || "",
    location: input.location?.trim().slice(0, 120) || "",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteCommunityGroupPlan(groupId: string, planId: string): Promise<void> {
  await deleteDoc(communityPlanRef(groupId, planId));
}

export function isCommunityPlanOnUserEvents(
  plan: CommunityGroupPlan,
  userEvents: unknown[]
): boolean {
  if (!Array.isArray(userEvents)) return false;
  const target = {
    title: plan.title,
    date: plan.date,
    time: plan.time || "",
    location: plan.location || "",
    planHostUid: plan.creatorId,
    communityPlanId: plan.id,
    communityGroupId: plan.groupId,
  };
  return userEvents.some(
    (e) =>
      String((e as { communityPlanId?: string })?.communityPlanId || "") === plan.id ||
      matchesPlanEvent(e, target, userEvents)
  );
}

export async function addCommunityPlanToUserEvents(
  uid: string,
  plan: CommunityGroupPlan,
  viewerDisplayName: string
): Promise<"added" | "already"> {
  const meRef = doc(db, "users", uid);
  const snap = await getDoc(meRef);
  const existing = snap.exists()
    ? Array.isArray((snap.data() as { events?: unknown }).events)
      ? ([...(snap.data() as { events: unknown[] }).events] as Record<string, unknown>[])
      : []
    : [];

  if (isCommunityPlanOnUserEvents(plan, existing)) {
    return "already";
  }

  const creatorName = plan.creatorDisplayName.trim() || "Member";
  const viewerName = viewerDisplayName.trim() || "You";
  const sourceIds = Array.from(new Set([plan.creatorId, uid].filter(Boolean)));
  const sourceNames = Array.from(new Set([creatorName, viewerName].filter(Boolean)));

  const newEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: plan.title,
    date: plan.date,
    time: plan.time || "",
    location: plan.location || "",
    planHostUid: plan.creatorId,
    joinedFromId: plan.creatorId,
    joinedFromIds: sourceIds,
    joinedFromName: sourceNames.join(", "),
    joinedFromNames: sourceNames,
    mergedIntoExisting: false,
    joinedFromFriendUid: plan.creatorId,
    communityGroupId: plan.groupId,
    communityPlanId: plan.id,
    attendeeDisplayNames: {
      [plan.creatorId]: creatorName,
      [uid]: viewerName,
    },
  };

  const nextEvents = sortOpenPlansByDateTime([...existing, newEvent]);
  await updateDoc(meRef, { events: nextEvents });
  return "added";
}

export function formatCommunityPlanDateLabel(dateStr: string): {
  weekday: string;
  day: number;
  month: string;
} {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return {
    weekday: date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    day: date.getDate(),
    month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
  };
}
