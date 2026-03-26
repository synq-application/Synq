import { Friend } from "@/constants/Variables";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { Image } from "react-native";

import { db } from "./firebase";

export type Connection = {
  id: string;
  name: string;
  imageUrl: string | null;
  synqCount: number;
};

export const friendsListCacheByUser: Record<string, Friend[]> = {};
export const friendProfileCacheByUser: Record<string, Record<string, Friend>> = {};
export const connectionsCacheByUser: Record<string, Connection[]> = {};
export const connectionProfileCacheByUser: Record<string, Record<string, Omit<Connection, "synqCount">>> = {};
export const suggestedCacheByUser: Record<string, any[]> = {};

const warmFriendsInFlight: Record<string, Promise<void> | undefined> = {};
const warmSuggestedInFlight: Record<string, Promise<void> | undefined> = {};

const isRemoteImageUri = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value);

const prefetchImage = (url?: string | null) => {
  if (!isRemoteImageUri(url)) return;
  Image.prefetch(url).catch(() => {});
};

const sortFriendsByName = (list: Friend[]) =>
  [...list].sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

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

    if (!friendProfileCacheByUser[userId]) {
      friendProfileCacheByUser[userId] = {};
    }
    if (!connectionProfileCacheByUser[userId]) {
      connectionProfileCacheByUser[userId] = {};
    }

    const profileCache = friendProfileCacheByUser[userId];
    const connectionCache = connectionProfileCacheByUser[userId];

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
    const myFriendsSnap = await getDocs(collection(db, "users", userId, "friends"));
    const myFriendIds = myFriendsSnap.docs.map((d) => d.id);
    const usersSnap = await getDocs(collection(db, "users"));
    const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    const suggestionsWithMutuals = await Promise.all(
      users.map(async (user) => {
        if (user.id === userId || myFriendIds.includes(user.id)) return null;
        try {
          const theirFriendsSnap = await getDocs(collection(db, "users", user.id, "friends"));
          const theirFriendIds = theirFriendsSnap.docs.map((d) => d.id);
          const mutuals = theirFriendIds.filter((id) => myFriendIds.includes(id));
          if (mutuals.length === 0) return null;
          return { ...user, mutualCount: mutuals.length };
        } catch {
          return null;
        }
      })
    );

    const nextSuggested = suggestionsWithMutuals
      .filter(Boolean)
      .sort((a: any, b: any) => b.mutualCount - a.mutualCount)
      .slice(0, 8);

    nextSuggested.forEach((user: any) => prefetchImage(user?.imageurl));
    suggestedCacheByUser[userId] = nextSuggested;
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
