import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DocumentData } from "firebase/firestore";

import { EXPIRATION_HOURS } from "../../constants/Variables";

export function synqStatusStorageKey(uid: string) {
  return `synq-status:${uid}`;
}

/** True when the user doc represents a non-expired Synq session (matches Synq tab init logic). */
export function computeSynqActiveFromUserData(data: DocumentData | undefined): boolean {
  if (!data || data.status !== "available" || !data.synqStartedAt) return false;
  const startTime = data.synqStartedAt.toDate().getTime();
  const hoursElapsed = (Date.now() - startTime) / (1000 * 60 * 60);
  return hoursElapsed <= EXPIRATION_HOURS;
}

export async function readCachedSynqActive(uid: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(synqStatusStorageKey(uid));
    return v === "active";
  } catch {
    return false;
  }
}
