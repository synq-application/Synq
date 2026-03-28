import AsyncStorage from "@react-native-async-storage/async-storage";

/** Persisted so cold start / reload can restore UI before Firestore returns. */
export function synqStatusStorageKey(uid: string) {
  return `synq-status:${uid}`;
}

export async function readCachedSynqActive(uid: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(synqStatusStorageKey(uid));
    return v === "active";
  } catch {
    return false;
  }
}
