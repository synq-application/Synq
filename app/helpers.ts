import { DEFAULT_AVATAR } from "@/constants/Variables";
import * as ExpoImage from "expo-image";

export type SynqStatus = "idle" | "activating" | "finding" | "optimizing" | "active";

export const formatTime = (timestamp: any) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const getChatTitle = (chat: any, myId: string) => {
  if (!chat?.participantNames) return "Synq Chat";
  const otherNames = Object.entries(chat.participantNames)
    .filter(([uid]) => uid !== myId)
    .map(([_, name]) => name as string);

  if (otherNames.length === 0) return "Just You";
  if (otherNames.length === 1) return `${otherNames[0]}`;
  const last = otherNames.pop();
  return `You, ${otherNames.join(", ")} & ${last}`;
};

export const getLeadingEmoji = (text: string) => {
  if (!text) return null;
  const firstChar = Array.from(text.trim())[0];
  if (/\p{Extended_Pictographic}/u.test(firstChar)) {
    return firstChar;
  }
  return null;
};

export const formatLastSynq = (date: Date) => {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  return date.toLocaleDateString();
};

export const parseIdeaText = (text: string) => {
  const lines = (text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const name = lines[0] || "";
  const address = lines.slice(1).join(" ") || "";
  return { name, address };
};

export const resolveAvatar = (url?: any) => {
  if (typeof url === "string" && url.trim().startsWith("http")) {
    return url;
  }
  return DEFAULT_AVATAR;
};

/** Warm disk/memory cache for a remote avatar or default URL (no-op for invalid). */
export const prefetchResolvedAvatar = (url?: any) => {
  const resolved = resolveAvatar(url);
  if (typeof resolved === "string" && resolved.startsWith("http")) {
    ExpoImage.Image.prefetch(resolved, "memory-disk").catch(() => {});
  }
};

export const wrapChatTitle = (text: string, maxChars = 30) => {
    const tokens = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const token of tokens) {
      const testLine = currentLine
        ? `${currentLine} ${token}`
        : token;

      if (testLine.length <= maxChars) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = token;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  };

const EARTH_RADIUS_MI = 3958.7613;

/** Valid lat/lng pair from a Firestore user doc, or null. */
export function readLatLng(data: any): { lat: number; lng: number } | null {
  const lat = typeof data?.lat === "number" ? data.lat : null;
  const lng = typeof data?.lng === "number" ? data.lng : null;
  if (lat === null || lng === null) return null;
  return { lat, lng };
}

/** Great-circle distance in miles (WGS84 sphere). */
export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MI * c;
}

/** Short UI string for separation in miles (US-style). */
export function formatProximityMiles(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return "";
  if (miles < 1) return "< 1 mile away";
  if (miles < 10) {
    const r = Math.round(miles * 10) / 10;
    if (Math.abs(r - Math.round(r)) < 1e-6) return `${Math.round(r)} mi away`;
    return `${r.toFixed(1)} mi away`;
  }
  return `${Math.round(miles)} mi away`;
}

/**
 * One line for Synq active list: "City, ST - <1 mile away" when both users have coords;
 * otherwise city/locationDisplay only, or distance only if no place string.
 */
export function friendLocationLineWithProximity(me: any, friend: any): string | null {
  const loc =
    typeof friend?.locationDisplay === "string" && friend.locationDisplay.trim()
      ? friend.locationDisplay.trim()
      : friend?.city
        ? `${friend.city}${friend.state ? `, ${friend.state}` : ""}`
        : null;

  const a = readLatLng(me);
  const b = readLatLng(friend);
  const dist =
    a && b ? formatProximityMiles(haversineMiles(a.lat, a.lng, b.lat, b.lng)) : null;

  if (loc && dist) return `${loc} · ${dist}`;
  if (loc) return loc;
  if (dist) return dist;
  return null;
}
