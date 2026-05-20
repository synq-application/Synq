import AsyncStorage from "@react-native-async-storage/async-storage";
import { Friend } from "@/constants/Variables";
import { Image as ExpoImage } from "expo-image";

import { resolveAvatar } from "../../app/helpers";
import {
  friendRelationCacheByUser,
  friendsListCacheByUser,
} from "./socialCache";

export type CachedRecentSynq = {
  friendId: string;
  displayName: string;
  imageurl: string | null;
  lastSynqAt: string;
};

export type OwnProfileSnapshot = {
  imageurl: string | null;
  interests: string[];
  events: unknown[];
  city: string | null;
  state: string | null;
  recentSynqs: CachedRecentSynq[];
};

export type RecentSynqRow = { friend: Friend; at: Date };

export const ownProfileCacheByUser: Record<string, OwnProfileSnapshot> = {};

const CACHE_VERSION = 2;
const ownProfileCacheKey = (userId: string) =>
  `own-profile-cache:${CACHE_VERSION}:${userId}`;

const hydrateInFlight: Record<string, Promise<void> | undefined> = {};

const emptySnapshot = (): OwnProfileSnapshot => ({
  imageurl: null,
  interests: [],
  events: [],
  city: null,
  state: null,
  recentSynqs: [],
});

const prefetchProfileImage = (url: string | null | undefined) => {
  const resolved = resolveAvatar(url);
  if (typeof resolved === "string" && resolved.startsWith("http")) {
    ExpoImage.prefetch(resolved, "memory-disk").catch(() => {});
  }
};

const prefetchRecentSynqAvatars = (rows: CachedRecentSynq[]) => {
  rows.forEach((row) => prefetchProfileImage(row.imageurl));
};

const lastSynqToDate = (raw: unknown): Date | null => {
  if (raw == null) return null;
  try {
    const d =
      typeof (raw as { toDate?: () => Date }).toDate === "function"
        ? (raw as { toDate: () => Date }).toDate()
        : new Date(raw as string | number);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

export function computeRecentSynqRows(
  userId: string,
  friends: Friend[]
): RecentSynqRow[] {
  if (!userId) return [];
  const rel = friendRelationCacheByUser[userId];
  if (!rel) return [];
  const rows: RecentSynqRow[] = [];
  for (const friend of friends) {
    const at = lastSynqToDate(rel[friend.id]?.lastSynqAt);
    if (!at) continue;
    rows.push({ friend, at });
  }
  rows.sort((a, b) => b.at.getTime() - a.at.getTime());
  return rows.slice(0, 3);
}

export function recentSynqRowsEqual(a: RecentSynqRow[], b: RecentSynqRow[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (row, i) =>
      row.friend.id === b[i]?.friend.id && row.at.getTime() === b[i]?.at.getTime()
  );
}

export function recentSynqRowsFromCache(
  cached: CachedRecentSynq[] | undefined
): RecentSynqRow[] {
  if (!cached?.length) return [];
  return cached
    .map((row) => {
      const at = new Date(row.lastSynqAt);
      if (Number.isNaN(at.getTime())) return null;
      return {
        friend: {
          id: row.friendId,
          displayName: row.displayName,
          imageurl: row.imageurl,
          mutualCount: 0,
        } as Friend,
        at,
      };
    })
    .filter((row): row is RecentSynqRow => row != null);
}

export function recentSynqRowsToCache(rows: RecentSynqRow[]): CachedRecentSynq[] {
  return rows.map(({ friend, at }) => ({
    friendId: friend.id,
    displayName: friend.displayName || "Friend",
    imageurl:
      typeof friend.imageurl === "string" && friend.imageurl.trim().startsWith("http")
        ? friend.imageurl
        : null,
    lastSynqAt: at.toISOString(),
  }));
}

export function getCachedOwnProfile(
  userId: string
): OwnProfileSnapshot | undefined {
  return ownProfileCacheByUser[userId];
}

export function setCachedOwnProfile(userId: string, snapshot: OwnProfileSnapshot) {
  if (!userId) return;
  const next: OwnProfileSnapshot = {
    ...emptySnapshot(),
    ...snapshot,
    recentSynqs: snapshot.recentSynqs ?? [],
  };
  ownProfileCacheByUser[userId] = next;
  prefetchProfileImage(next.imageurl);
  prefetchRecentSynqAvatars(next.recentSynqs);
  void AsyncStorage.setItem(ownProfileCacheKey(userId), JSON.stringify(next)).catch(
    () => {}
  );
}

export function mergeCachedOwnProfile(
  userId: string,
  partial: Partial<OwnProfileSnapshot>
) {
  const prev = ownProfileCacheByUser[userId] ?? emptySnapshot();
  setCachedOwnProfile(userId, { ...prev, ...partial });
}

export type MeTabInitialState = {
  profileImage: string | null;
  interests: string[];
  selectedInterests: string[];
  city: string | null;
  state: string | null;
  events: unknown[];
  friendsForHostNames: Friend[];
  recentSynqRows: RecentSynqRow[];
  recentSynqsReady: boolean;
};

/** Synchronous snapshot for Me tab first paint (after disk hydrate at app boot). */
export function getMeTabInitialState(userId: string): MeTabInitialState {
  const profile = getCachedOwnProfile(userId);
  const friends = friendsListCacheByUser[userId] ?? [];
  const cachedRecent = recentSynqRowsFromCache(profile?.recentSynqs);
  const recentSynqRows =
    cachedRecent.length > 0 ? cachedRecent : computeRecentSynqRows(userId, friends);
  const socialCacheReady = friendsListCacheByUser[userId] !== undefined;

  return {
    profileImage: profile?.imageurl ?? null,
    interests: profile?.interests ?? [],
    selectedInterests: profile?.interests ?? [],
    city: profile?.city ?? null,
    state: profile?.state ?? null,
    events: profile?.events ?? [],
    friendsForHostNames: friends,
    recentSynqRows,
    recentSynqsReady: recentSynqRows.length > 0 || socialCacheReady,
  };
}

/** Prefetch Me tab images after auth hydrate so first open does not flash. */
export function prewarmMeTabScreen(userId: string): void {
  if (!userId) return;
  const profile = getCachedOwnProfile(userId);
  if (profile) {
    prefetchProfileImage(profile.imageurl);
    prefetchRecentSynqAvatars(profile.recentSynqs);
  }
  const friends = friendsListCacheByUser[userId] ?? [];
  friends.slice(0, 3).forEach((friend) => prefetchProfileImage(friend.imageurl));
}

export async function hydrateOwnProfileFromDisk(userId: string): Promise<void> {
  if (!userId) return;
  if (ownProfileCacheByUser[userId]) return;
  if (hydrateInFlight[userId]) {
    await hydrateInFlight[userId];
    return;
  }

  hydrateInFlight[userId] = (async () => {
    try {
      const raw = await AsyncStorage.getItem(ownProfileCacheKey(userId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<OwnProfileSnapshot>;
      ownProfileCacheByUser[userId] = {
        imageurl: parsed.imageurl ?? null,
        interests: Array.isArray(parsed.interests) ? parsed.interests : [],
        events: Array.isArray(parsed.events) ? parsed.events : [],
        city: parsed.city ?? null,
        state: parsed.state ?? null,
        recentSynqs: Array.isArray(parsed.recentSynqs) ? parsed.recentSynqs : [],
      };
      prefetchProfileImage(ownProfileCacheByUser[userId].imageurl);
      prefetchRecentSynqAvatars(ownProfileCacheByUser[userId].recentSynqs);
    } catch {}
  })();

  try {
    await hydrateInFlight[userId];
  } finally {
    hydrateInFlight[userId] = undefined;
  }
}
