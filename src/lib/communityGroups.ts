import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "./firebase";
import {
  MAX_COMMUNITY_GROUP_MEMBERS as MAX_MEMBERS,
  mergeCommunityGroupMemberIds as mergeMemberIdsCore,
} from "./communityGroupsCore.js";

export const MAX_COMMUNITY_GROUP_MEMBERS = MAX_MEMBERS;
export const MAX_COMMUNITY_GROUPS_JOINED = 50;
export const MAX_COMMUNITY_GROUPS_CREATED = 10;
export const COMMUNITY_GROUP_SEARCH_LIMIT = 25;

export type CommunityGroup = {
  id: string;
  name: string;
  nameLower: string;
  creatorId: string;
  memberIds: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
};

export function communityGroupsCollection() {
  return collection(db, "communityGroups");
}

export function communityGroupRef(groupId: string) {
  return doc(db, "communityGroups", groupId);
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeNameLower(name: string): string {
  return normalizeName(name).toLowerCase();
}

function normalizeMemberIds(memberIds: string[]): string[] {
  return [...new Set(memberIds.map((id) => String(id || "").trim()).filter(Boolean))].slice(
    0,
    MAX_COMMUNITY_GROUP_MEMBERS
  );
}

function mapCommunityGroupDoc(id: string, data: Record<string, unknown>): CommunityGroup {
  return {
    id,
    name: String(data.name || "").trim() || "Group",
    nameLower: String(data.nameLower || "").trim(),
    creatorId: String(data.creatorId || "").trim(),
    memberIds: normalizeMemberIds(
      Array.isArray(data.memberIds) ? (data.memberIds as string[]) : []
    ),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function subscribeJoinedCommunityGroups(
  uid: string,
  onData: (groups: CommunityGroup[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(communityGroupsCollection(), where("memberIds", "array-contains", uid));
  return onSnapshot(
    q,
    (snap) => {
      const groups = snap.docs
        .map((d) => mapCommunityGroupDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.name.localeCompare(b.name));
      onData(groups);
    },
    (err) => onError?.(err)
  );
}

export async function searchCommunityGroups(searchText: string): Promise<CommunityGroup[]> {
  const q = normalizeNameLower(searchText);
  if (!q) return [];

  const snap = await getDocs(
    query(
      communityGroupsCollection(),
      where("nameLower", ">=", q),
      where("nameLower", "<=", `${q}\uf8ff`),
      orderBy("nameLower"),
      limit(COMMUNITY_GROUP_SEARCH_LIMIT)
    )
  );

  return snap.docs.map((d) => mapCommunityGroupDoc(d.id, d.data() as Record<string, unknown>));
}

export async function createCommunityGroup(uid: string, name: string): Promise<string> {
  const trimmed = normalizeName(name);
  if (!trimmed) {
    throw new Error("Group name is required.");
  }

  const createdSnap = await getDocs(
    query(communityGroupsCollection(), where("creatorId", "==", uid))
  );
  if (createdSnap.size >= MAX_COMMUNITY_GROUPS_CREATED) {
    throw new Error(`You can create at most ${MAX_COMMUNITY_GROUPS_CREATED} community groups.`);
  }

  const joinedSnap = await getDocs(
    query(communityGroupsCollection(), where("memberIds", "array-contains", uid))
  );
  if (joinedSnap.size >= MAX_COMMUNITY_GROUPS_JOINED) {
    throw new Error(`You can join at most ${MAX_COMMUNITY_GROUPS_JOINED} community groups.`);
  }

  const ref = doc(communityGroupsCollection());
  await setDoc(ref, {
    name: trimmed,
    nameLower: normalizeNameLower(trimmed),
    creatorId: uid,
    memberIds: [uid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function joinCommunityGroup(
  uid: string,
  groupId: string,
  currentMemberIds: string[]
): Promise<string[]> {
  if (currentMemberIds.includes(uid)) {
    return currentMemberIds;
  }
  if (currentMemberIds.length >= MAX_COMMUNITY_GROUP_MEMBERS) {
    throw new Error("This group is full.");
  }

  const joinedSnap = await getDocs(
    query(communityGroupsCollection(), where("memberIds", "array-contains", uid))
  );
  if (joinedSnap.size >= MAX_COMMUNITY_GROUPS_JOINED) {
    throw new Error(`You can join at most ${MAX_COMMUNITY_GROUPS_JOINED} community groups.`);
  }

  const next = normalizeMemberIds([...currentMemberIds, uid]);
  await updateDoc(communityGroupRef(groupId), {
    memberIds: next,
    updatedAt: serverTimestamp(),
  });
  return next;
}

export async function leaveCommunityGroup(
  uid: string,
  groupId: string,
  currentMemberIds: string[]
): Promise<void> {
  const next = currentMemberIds.filter((id) => id !== uid);
  if (next.length === 0) {
    await deleteDoc(communityGroupRef(groupId));
    return;
  }
  await updateDoc(communityGroupRef(groupId), {
    memberIds: next,
    updatedAt: serverTimestamp(),
  });
}

export async function renameCommunityGroup(groupId: string, name: string): Promise<void> {
  const trimmed = normalizeName(name);
  if (!trimmed) {
    throw new Error("Group name is required.");
  }
  await updateDoc(communityGroupRef(groupId), {
    name: trimmed,
    nameLower: normalizeNameLower(trimmed),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCommunityGroup(groupId: string): Promise<void> {
  await deleteDoc(communityGroupRef(groupId));
}

export function mergeCommunityGroupMemberIds(
  currentMemberIds: string[],
  newMemberIds: string[]
): string[] {
  return mergeMemberIdsCore(currentMemberIds, newMemberIds);
}

export async function addMembersToCommunityGroup(
  groupId: string,
  currentMemberIds: string[],
  newMemberIds: string[]
): Promise<string[]> {
  const merged = mergeCommunityGroupMemberIds(currentMemberIds, newMemberIds);
  if (merged.length === currentMemberIds.length) {
    return merged;
  }
  await updateDoc(communityGroupRef(groupId), {
    memberIds: merged,
    updatedAt: serverTimestamp(),
  });
  return merged;
}

export async function removeMemberFromCommunityGroup(
  groupId: string,
  currentMemberIds: string[],
  memberId: string
): Promise<void> {
  const next = currentMemberIds.filter((id) => id !== memberId);
  if (next.length === 0) {
    await deleteDoc(communityGroupRef(groupId));
    return;
  }
  await updateDoc(communityGroupRef(groupId), {
    memberIds: next,
    updatedAt: serverTimestamp(),
  });
}
