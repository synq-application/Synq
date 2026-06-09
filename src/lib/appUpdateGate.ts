import Constants from "expo-constants";
import { doc, getDoc } from "firebase/firestore";
import { Linking, Platform } from "react-native";

import { MINIMUM_NATIVE_BUILD_NUMBER, IOS_APP_STORE_URL, ANDROID_PLAY_STORE_URL } from "@/constants/Variables";
import { db } from "./firebase";

export function getNativeBuildNumber(): number {
  const fromConfig =
    Platform.OS === "ios"
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode;
  const raw = fromConfig ?? Constants.nativeBuildVersion ?? "0";
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function defaultStoreUrl(): string {
  if (Platform.OS === "ios") {
    return IOS_APP_STORE_URL;
  }
  return ANDROID_PLAY_STORE_URL;
}

export async function checkAppUpdateRequired(): Promise<{
  required: boolean;
  storeUrl: string | null;
}> {
  if (__DEV__) {
    return { required: false, storeUrl: null };
  }

  const nativeBuild = getNativeBuildNumber();
  if (nativeBuild > 0 && nativeBuild < MINIMUM_NATIVE_BUILD_NUMBER) {
    return { required: true, storeUrl: defaultStoreUrl() };
  }

  try {
    const snap = await getDoc(doc(db, "appConfig", "global"));
    if (!snap.exists()) {
      return { required: false, storeUrl: null };
    }

    const data = snap.data() as Record<string, unknown>;
    const minBuild =
      Platform.OS === "ios"
        ? Number(data.minIosBuildNumber)
        : Number(data.minAndroidVersionCode);

    if (!Number.isFinite(minBuild) || minBuild <= 0) {
      return { required: false, storeUrl: null };
    }

    if (nativeBuild >= minBuild) {
      return { required: false, storeUrl: null };
    }

    const storeUrl =
      Platform.OS === "ios"
        ? String(data.iosStoreUrl || "").trim()
        : String(data.androidStoreUrl || "").trim();

    return {
      required: true,
      storeUrl: storeUrl || defaultStoreUrl(),
    };
  } catch {
    return { required: false, storeUrl: null };
  }
}

export async function openAppStore(storeUrl: string | null): Promise<void> {
  const url = storeUrl || defaultStoreUrl();
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  }
}
