import { Friend } from "@/constants/Variables";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image as ExpoImage } from "expo-image";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import { db } from "./firebase";

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

const warmFriendsInFlight: Record<string, Promise<void> | undefined> = {};
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
};

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

  void persistSocialCache(userId);
}

async function persistSocialCache(userId: string) {
  const payload: PersistedSocialCache = {
    friendsList: friendsListCacheByUser[userId] ?? [],
    friendProfiles: friendProfileCacheByUser[userId] ?? {},
    friendRelations: friendRelationCacheByUser[userId] ?? {},
    connections: connectionsCacheByUser[userId] ?? [],
    connectionProfiles: connectionProfileCacheByUser[userId] ?? {},
    suggested: suggestedCacheByUser[userId] ?? [],
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
    await persistSocialCache(userId);
  })();

  try {
    await warmFriendsInFlight[userId];
  } finally {
    warmFriendsInFlight[userId] = undefined;
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

export function warmSocialCachesInBackground(userId: string) {
  if (!userId) return;
  warmFriendsAndConnectionsCache(userId).catch(() => {});
  warmSuggestedCache(userId).catch(() => {});
}
