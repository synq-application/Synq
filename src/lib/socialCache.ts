import { Friend } from "@/constants/Variables";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image as ExpoImage } from "expo-image";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import { db } from "./firebase";
import type { FriendGroup } from "./friendGroups";

export type Connection = {
  id: string;
  name: string;
  imageUrl: string | null;
  synqCount: number;
};

export const friendsListCacheByUser: Record<string, Friend[]> = {};
export const friendProfileCacheByUser: Record<string, Record<string, Friend>> = {};
export const friendRelationCacheByUser: Record<string, Record<string, { synqCount: number; lastSynqAt?: any }>> = {};
export const connectionsCacheByUser: Record<string, Connection[]> = {};
export const connectionProfileCacheByUser: Record<string, Record<string, Omit<Connection, "synqCount">>> = {};
export const suggestedCacheByUser: Record<string, any[]> = {};
/** viewerId -> profileId -> mutual friend profiles (for instant Mutual Friends UI). */
export const mutualFriendsCacheByUser: Record<string, Record<string, Friend[]>> = {};
/** viewerId -> target user ids with an outgoing friend request. */
export const outgoingFriendRequestIdsCacheByUser: Record<string, Set<string>> = {};
export const friendGroupsCacheByUser: Record<string, FriendGroup[]> = {};

const warmFriendsInFlight: Record<string, Promise<void> | undefined> = {};
const warmOutgoingInFlight: Record<string, Promise<void> | undefined> = {};
const warmSuggestedInFlight: Record<string, Promise<void> | undefined> = {};
const hydrateInFlight: Record<string, Promise<void> | undefined> = {};
const CACHE_VERSION = 1;
const socialCacheKey = (userId: string) => `social-cache:${CACHE_VERSION}:${userId}`;

const isRemoteImageUri = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value);

const prefetchImage = (url?: string | null) => {
  if (!isRemoteImageUri(url)) return;
  ExpoImage.prefetch(url).catch(() => {});
};

const sortFriendsByName = (list: Friend[]) =>
  [...list].sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

type PersistedSocialCache = {
  friendsList: Friend[];
  friendProfiles: Record<string, Friend>;
  friendRelations: Record<string, { synqCount: number; lastSynqAt?: any }>;
  connections: Connection[];
  connectionProfiles: Record<string, Omit<Connection, "synqCount">>;
  suggested: any[];
  mutualFriends: Record<string, Friend[]>;
  outgoingFriendRequestIds: string[];
};

export function getCachedFriendRelationship(
  viewerId: string,
  friendKey: string
): { isFriend: boolean; requestSent: boolean } {
  if (!viewerId || !friendKey) {
    return { isFriend: false, requestSent: false };
  }
  const isFriend =
    (friendsListCacheByUser[viewerId]?.some((f) => f.id === friendKey) ?? false) ||
    friendRelationCacheByUser[viewerId]?.[friendKey] != null;
  const requestSent =
    outgoingFriendRequestIdsCacheByUser[viewerId]?.has(friendKey) ?? false;
  return { isFriend, requestSent };
}

export function setCachedOutgoingFriendRequest(
  viewerId: string,
  friendKey: string,
  pending: boolean
) {
  if (!viewerId || !friendKey) return;
  if (!outgoingFriendRequestIdsCacheByUser[viewerId]) {
    outgoingFriendRequestIdsCacheByUser[viewerId] = new Set();
  }
  const set = outgoingFriendRequestIdsCacheByUser[viewerId];
  if (pending) {
    set.add(friendKey);
  } else {
    set.delete(friendKey);
  }
  void persistSocialCache(viewerId);
}

export function syncOutgoingFriendRequestsCache(viewerId: string, targetIds: string[]) {
  if (!viewerId) return;
  outgoingFriendRequestIdsCacheByUser[viewerId] = new Set(targetIds.filter(Boolean));
  void persistSocialCache(viewerId);
}

export function pruneSocialCachesToFriendIds(userId: string, friendIds: Set<string>) {
  if (!userId) return;

  const pruneRecord = (obj: Record<string, unknown> | undefined) => {
    if (!obj) return;
    Object.keys(obj).forEach((id) => {
      if (!friendIds.has(id)) delete obj[id];
    });
  };

  pruneRecord(friendProfileCacheByUser[userId] as Record<string, unknown>);
  pruneRecord(connectionProfileCacheByUser[userId] as Record<string, unknown>);
  pruneRecord(friendRelationCacheByUser[userId] as Record<string, unknown>);

  const list = friendsListCacheByUser[userId];
  if (list?.length) {
    friendsListCacheByUser[userId] = list.filter((f) => friendIds.has(f.id));
  }

  const conns = connectionsCacheByUser[userId];
  if (conns?.length) {
    connectionsCacheByUser[userId] = conns.filter((c) => friendIds.has(c.id));
  }

  const mutuals = mutualFriendsCacheByUser[userId];
  if (mutuals) {
    Object.keys(mutuals).forEach((targetId) => {
      if (!friendIds.has(targetId)) delete mutuals[targetId];
    });
  }

  void persistSocialCache(userId);
}

async function buildMutualFriendsIndex(
  viewerId: string,
  myFriendIds: string[],
  profileCache: Record<string, Friend>
): Promise<Record<string, Friend[]>> {
  const myFriendSet = new Set(myFriendIds);
  const friendsOfFriend = new Map<string, Set<string>>();

  await Promise.all(
    myFriendIds.map(async (fid) => {
      try {
        const theirFriendsSnap = await getDocs(
          collection(db, "users", fid, "friends")
        );
        friendsOfFriend.set(
          fid,
          new Set(theirFriendsSnap.docs.map((d) => d.id))
        );
      } catch {
        friendsOfFriend.set(fid, new Set());
      }
    })
  );

  const index: Record<string, Friend[]> = {};
  const byTarget = new Map<string, Map<string, Friend>>();

  for (const fid of myFriendIds) {
    const mutualProfile = profileCache[fid];
    if (!mutualProfile) continue;
    const theirFriends = friendsOfFriend.get(fid);
    if (!theirFriends) continue;

    theirFriends.forEach((targetId) => {
      if (targetId === fid || targetId === viewerId) return;

      if (myFriendSet.has(targetId)) {
        return;
      }

      let bucket = byTarget.get(targetId);
      if (!bucket) {
        bucket = new Map();
        byTarget.set(targetId, bucket);
      }
      bucket.set(fid, mutualProfile);
    });
  }

  byTarget.forEach((bucket, targetId) => {
    index[targetId] = sortFriendsByName([...bucket.values()]);
  });

  for (const targetId of myFriendIds) {
    const bucket = new Map<string, Friend>();
    for (const fid of myFriendIds) {
      if (fid === targetId) continue;
      const mutualProfile = profileCache[fid];
      if (!mutualProfile) continue;
      if (friendsOfFriend.get(fid)?.has(targetId)) {
        bucket.set(fid, mutualProfile);
      }
    }
    index[targetId] = sortFriendsByName([...bucket.values()]);
  }

  return index;
}

export function getCachedMutualFriends(
  viewerId: string,
  targetId: string
): Friend[] | undefined {
  if (!viewerId || !targetId) return undefined;
  const cache = mutualFriendsCacheByUser[viewerId];
  if (!cache || !Object.prototype.hasOwnProperty.call(cache, targetId)) {
    return undefined;
  }
  return cache[targetId];
}

export function setCachedMutualFriends(
  viewerId: string,
  targetId: string,
  list: Friend[]
) {
  if (!viewerId || !targetId) return;
  if (!mutualFriendsCacheByUser[viewerId]) {
    mutualFriendsCacheByUser[viewerId] = {};
  }
  mutualFriendsCacheByUser[viewerId][targetId] = list;
  void persistSocialCache(viewerId);
}

/** Loads mutual friends for a profile; uses memory/disk cache when available. */
export async function resolveMutualFriendsForTarget(
  viewerId: string,
  targetId: string
): Promise<Friend[]> {
  if (!viewerId || !targetId || viewerId === targetId) return [];

  const cached = getCachedMutualFriends(viewerId, targetId);
  if (cached) return cached;

  const myFriendIds = (
    friendsListCacheByUser[viewerId]?.map((f) => f.id) ??
    (await getDocs(collection(db, "users", viewerId, "friends"))).docs.map(
      (d) => d.id
    )
  ).filter((id) => id !== targetId);

  const profileCache = friendProfileCacheByUser[viewerId] ?? {};
  const mutualProfiles: Friend[] = [];

  await Promise.all(
    myFriendIds.map(async (fid) => {
      try {
        const snap = await getDoc(doc(db, "users", fid, "friends", targetId));
        if (!snap.exists()) return;
        const cachedProfile = profileCache[fid];
        if (cachedProfile) {
          mutualProfiles.push(cachedProfile);
          return;
        }
        const userSnap = await getDoc(doc(db, "users", fid));
        if (userSnap.exists()) {
          const row = { id: fid, ...(userSnap.data() as object) } as Friend;
          profileCache[fid] = row;
          mutualProfiles.push(row);
        }
      } catch {
        /* skip unreadable edge */
      }
    })
  );

  const sorted = sortFriendsByName(mutualProfiles);
  setCachedMutualFriends(viewerId, targetId, sorted);
  return sorted;
}

async function persistSocialCache(userId: string) {
  const payload: PersistedSocialCache = {
    friendsList: friendsListCacheByUser[userId] ?? [],
    friendProfiles: friendProfileCacheByUser[userId] ?? {},
    friendRelations: friendRelationCacheByUser[userId] ?? {},
    connections: connectionsCacheByUser[userId] ?? [],
    connectionProfiles: connectionProfileCacheByUser[userId] ?? {},
    suggested: suggestedCacheByUser[userId] ?? [],
    mutualFriends: mutualFriendsCacheByUser[userId] ?? {},
    outgoingFriendRequestIds: [
      ...Array.from(outgoingFriendRequestIdsCacheByUser[userId] ?? []),
    ],
  };
  try {
    await AsyncStorage.setItem(socialCacheKey(userId), JSON.stringify(payload));
  } catch {}
}

export async function hydrateSocialCachesFromDisk(userId: string): Promise<void> {
  if (!userId) return;
  if (hydrateInFlight[userId]) {
    await hydrateInFlight[userId];
    return;
  }

  hydrateInFlight[userId] = (async () => {
    try {
      const raw = await AsyncStorage.getItem(socialCacheKey(userId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedSocialCache;
      friendsListCacheByUser[userId] = parsed.friendsList ?? [];
      friendProfileCacheByUser[userId] = parsed.friendProfiles ?? {};
      friendRelationCacheByUser[userId] = parsed.friendRelations ?? {};
      connectionsCacheByUser[userId] = parsed.connections ?? [];
      connectionProfileCacheByUser[userId] = parsed.connectionProfiles ?? {};
      suggestedCacheByUser[userId] = parsed.suggested ?? [];
      mutualFriendsCacheByUser[userId] = parsed.mutualFriends ?? {};
      outgoingFriendRequestIdsCacheByUser[userId] = new Set(
        parsed.outgoingFriendRequestIds ?? []
      );

      Object.values(friendProfileCacheByUser[userId]).forEach((friend: any) => {
        prefetchImage(friend?.imageurl);
      });
      Object.values(connectionProfileCacheByUser[userId]).forEach((conn: any) => {
        prefetchImage(conn?.imageUrl);
      });
      suggestedCacheByUser[userId].forEach((user: any) => prefetchImage(user?.imageurl));
    } catch {}
  })();

  try {
    await hydrateInFlight[userId];
  } finally {
    hydrateInFlight[userId] = undefined;
  }
}

export async function warmFriendsAndConnectionsCache(userId: string): Promise<void> {
  if (!userId) return;
  if (warmFriendsInFlight[userId]) {
    await warmFriendsInFlight[userId];
    return;
  }

  warmFriendsInFlight[userId] = (async () => {
    const friendsSnap = await getDocs(collection(db, "users", userId, "friends"));
    const friendDocs = friendsSnap.docs.map((d) => ({
      id: d.id,
      synqCount: d.data().synqCount || 0,
    }));

    pruneSocialCachesToFriendIds(userId, new Set(friendDocs.map((d) => d.id)));

    if (!friendProfileCacheByUser[userId]) {
      friendProfileCacheByUser[userId] = {};
    }
    if (!connectionProfileCacheByUser[userId]) {
      connectionProfileCacheByUser[userId] = {};
    }
    if (!friendRelationCacheByUser[userId]) {
      friendRelationCacheByUser[userId] = {};
    }

    const profileCache = friendProfileCacheByUser[userId];
    const connectionCache = connectionProfileCacheByUser[userId];
    const relationCache = friendRelationCacheByUser[userId];

    const fetchedFriends: Friend[] = await Promise.all(
      friendDocs.map(async ({ id }) => {
        const uSnap = await getDoc(doc(db, "users", id));
        const fallback = profileCache[id];
        if (!uSnap.exists()) {
          return (
            fallback ??
            ({
              id,
              displayName: "Unknown",
              mutualCount: 0,
            } as Friend)
          );
        }

        const data = uSnap.data() as any;
        const friendObj = {
          id,
          ...(data as any),
          location: data.city && data.state ? `${data.city}, ${data.state}` : "",
        } as Friend;
        return friendObj;
      })
    );

    const sortedFriends = sortFriendsByName(fetchedFriends);
    sortedFriends.forEach((friend) => {
      profileCache[friend.id] = friend;
      const imageUrl = (friend as any)?.imageurl || null;
      prefetchImage(imageUrl);
      connectionCache[friend.id] = {
        id: friend.id,
        name: friend.displayName || "User",
        imageUrl,
      };
      const relationDoc = friendDocs.find((d) => d.id === friend.id);
      if (relationDoc) {
        relationCache[friend.id] = {
          synqCount: relationDoc.synqCount || 0,
          lastSynqAt: (friendsSnap.docs.find((d) => d.id === friend.id)?.data() as any)?.lastSynqAt,
        };
      }
    });

    const connections = friendDocs
      .map(({ id, synqCount }) => ({
        id,
        name: connectionCache[id]?.name || "User",
        imageUrl: connectionCache[id]?.imageUrl || null,
        synqCount,
      }))
      .sort((a, b) => b.synqCount - a.synqCount);

    friendsListCacheByUser[userId] = sortedFriends;
    connectionsCacheByUser[userId] = connections;
    const mutualIndex = await buildMutualFriendsIndex(
      userId,
      sortedFriends.map((f) => f.id),
      profileCache
    );
    if (!mutualFriendsCacheByUser[userId]) {
      mutualFriendsCacheByUser[userId] = {};
    }
    Object.assign(mutualFriendsCacheByUser[userId], mutualIndex);
    await persistSocialCache(userId);
  })();

  try {
    await warmFriendsInFlight[userId];
  } finally {
    warmFriendsInFlight[userId] = undefined;
  }
}

export async function warmOutgoingFriendRequestsCache(userId: string): Promise<void> {
  if (!userId) return;
  if (warmOutgoingInFlight[userId]) {
    await warmOutgoingInFlight[userId];
    return;
  }

  warmOutgoingInFlight[userId] = (async () => {
    try {
      const snap = await getDocs(
        collection(db, "users", userId, "outgoingFriendRequests")
      );
      syncOutgoingFriendRequestsCache(
        userId,
        snap.docs.map((d) => d.id)
      );
    } catch {
      /* non-fatal */
    }
  })();

  try {
    await warmOutgoingInFlight[userId];
  } finally {
    warmOutgoingInFlight[userId] = undefined;
  }
}

export async function warmSuggestedCache(userId: string): Promise<void> {
  if (!userId) return;
  if (warmSuggestedInFlight[userId]) {
    await warmSuggestedInFlight[userId];
    return;
  }

  warmSuggestedInFlight[userId] = (async () => {
    try {
    const myFriendsSnap = await getDocs(collection(db, "users", userId, "friends"));
    const myFriendIds = myFriendsSnap.docs.map((d) => d.id);
    const exclude = new Set([userId, ...myFriendIds]);
    const mutualCounts = new Map<string, number>();

    // Only read friends-of-friends through your friends' lists (allowed by rules).
    await Promise.all(
      myFriendIds.map(async (friendId) => {
        try {
          const theirFriendsSnap = await getDocs(
            collection(db, "users", friendId, "friends")
          );
          theirFriendsSnap.docs.forEach((d) => {
            const candidateId = d.id;
            if (exclude.has(candidateId)) return;
            mutualCounts.set(candidateId, (mutualCounts.get(candidateId) || 0) + 1);
          });
        } catch {
          // Skip if this friend's list is not readable.
        }
      })
    );

    const ranked = [...mutualCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const nextSuggested: any[] = [];
    for (const [candidateId, mutualCount] of ranked) {
      try {
        const profileSnap = await getDoc(doc(db, "users", candidateId));
        if (!profileSnap.exists()) continue;
        nextSuggested.push({
          id: candidateId,
          ...(profileSnap.data() as object),
          mutualCount,
        });
      } catch {
        // Profile not readable — skip.
      }
    }

    nextSuggested.forEach((user) => prefetchImage(user?.imageurl));
    suggestedCacheByUser[userId] = nextSuggested;
    await persistSocialCache(userId);
    } catch (err) {
      console.error("[warmSuggestedCache] failed:", err);
    }
  })();

  try {
    await warmSuggestedInFlight[userId];
  } finally {
    warmSuggestedInFlight[userId] = undefined;
  }
}

export function resolveMutualFriendCount(
  viewerId: string,
  targetId: string,
  fallback?: unknown
): number {
  const cached = getCachedMutualFriends(viewerId, targetId);
  if (cached !== undefined) return cached.length;
  if (typeof fallback === "number" && Number.isFinite(fallback)) return fallback;
  return 0;
}

export async function countMutualFriendsForTarget(
  viewerId: string,
  targetId: string
): Promise<number> {
  const list = await resolveMutualFriendsForTarget(viewerId, targetId);
  return list.length;
}

export async function hydrateMutualCountsForUsers(
  viewerId: string,
  targetIds: string[]
): Promise<Record<string, number>> {
  const uniqueIds = [...new Set(targetIds.filter(Boolean))];
  const counts: Record<string, number> = {};
  await Promise.all(
    uniqueIds.map(async (targetId) => {
      counts[targetId] = await countMutualFriendsForTarget(viewerId, targetId);
    })
  );
  return counts;
}

export function warmSocialCachesInBackground(userId: string) {
  if (!userId) return;
  warmFriendsAndConnectionsCache(userId).catch(() => {});
  warmOutgoingFriendRequestsCache(userId).catch(() => {});
  warmSuggestedCache(userId).catch(() => {});
}
