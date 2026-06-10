import { SYNQ_OPEN_WEB_BASE } from "@/constants/Variables";
import * as Linking from "expo-linking";

/** HTTPS link for sharing — opens the app if installed, otherwise the app store. */
export function buildProfileShareWebUrl(friendId: string): string {
  const id = friendId.trim();
  if (!id) return "";
  return `${SYNQ_OPEN_WEB_BASE}?friendId=${encodeURIComponent(id)}`;
}

/** Custom-scheme deep link for in-app use (e.g. QR scanned from within Synq). */
export function buildProfileDeepLinkUrl(friendId: string): string {
  const id = friendId.trim();
  if (!id) return "";
  return Linking.createURL("/friend-profile", {
    queryParams: { friendId: id },
  });
}
