import { Asset } from "expo-asset";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Image as ExpoImage } from "expo-image";
import * as Notifications from "expo-notifications";
import {
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  DeviceEventEmitter,
  InteractionManager,
  Platform,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { initSentry } from "../src/lib/sentryInit";

initSentry();
import LocationUpdateModal from "../components/LocationUpdateModal";
import { ACCENT, BG } from "../constants/Variables";
import { auth, db } from "../src/lib/firebase";
import { LOCATION_PROMPT_CHECK_REQUEST } from "../src/lib/locationPromptEvents";
import {
  hydrateSocialCachesFromDisk,
  warmSocialCachesInBackground,
} from "../src/lib/socialCache";
import { startSynqGlanceWidgetSync } from "../src/lib/syncSynqWidget";
import { SynqBootProvider } from "../src/lib/synqBootContext";
import {
  computeSynqActiveFromUserData,
  readCachedSynqActive,
} from "../src/lib/synqSession";

void SplashScreen.preventAutoHideAsync();

/** Must match app.json expo.splash.backgroundColor (BG) */
const SPLASH_LOGO = require("../assets/logo.png");

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync() {
  let token: string | null = null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: ACCENT,
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;
  }

  return token;
}

const AuthContext = createContext({ refreshAuth: () => {} });
export const useAuthRefresh = () => useContext(AuthContext);

function snoozedUntilMsFromField(raw: unknown): number {
  if (typeof raw === "string") return Date.parse(raw);
  if (
    raw &&
    typeof raw === "object" &&
    typeof (raw as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (raw as { toMillis: () => number }).toMillis();
  }
  return Number.NaN;
}

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();

  const navState = useRootNavigationState();
  const navReady = !!navState?.key;

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  const [synqBoot, setSynqBoot] = useState<{
    cachedSynqActive: boolean;
  } | null>(null);
  const synqBootUidRef = useRef<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const [pendingNotificationTap, setPendingNotificationTap] = useState<
    | { kind: "chat"; chatId: string; messageId?: string }
    | { kind: "notifications" }
    | { kind: "friend_profile"; friendId: string }
    | { kind: "synq_home" }
    | { kind: "me"; focusEventId?: string }
    | null
  >(null);

  const refreshAuth = () => {
    setUser(auth.currentUser ? ({ ...auth.currentUser } as User) : null);
  };

  useEffect(() => {
    const str = (v: unknown): string | undefined => {
      if (typeof v === "string" && v.trim()) return v.trim();
      return undefined;
    };

    const applyNotificationData = (data: Record<string, unknown> | undefined) => {
      if (!data) return;
      const chatRaw = data.chatId;
      const chatId =
        typeof chatRaw === "string"
          ? chatRaw
          : chatRaw != null
            ? String(chatRaw)
            : undefined;
      const messageId = str(data.messageId);
      const type = typeof data.type === "string" ? data.type : undefined;

      if (chatId) {
        setPendingNotificationTap({
          kind: "chat",
          chatId,
          messageId: messageId || undefined,
        });
        return;
      }

      if (type === "friend_request") {
        setPendingNotificationTap({ kind: "notifications" });
        return;
      }

      if (type === "friend_accepted") {
        const friendId = str(data.fromUserId);
        if (friendId) {
          setPendingNotificationTap({ kind: "friend_profile", friendId });
        } else {
          setPendingNotificationTap({ kind: "notifications" });
        }
        return;
      }

      if (type === "friend_synq_active") {
        setPendingNotificationTap({ kind: "synq_home" });
        return;
      }

      if (type === "open_plan_interest") {
        setPendingNotificationTap({
          kind: "me",
          focusEventId: str(data.eventId),
        });
        return;
      }
    };

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        applyNotificationData(
          response.notification.request.content.data as Record<string, unknown> | undefined
        );
      }
    );

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      applyNotificationData(
        response.notification.request.content.data as Record<string, unknown> | undefined
      );
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    return startSynqGlanceWidgetSync();
  }, []);

  useEffect(() => {
    if (!user) {
      synqBootUidRef.current = null;
      setSynqBoot(null);
      return;
    }
    let cancelled = false;
    if (synqBootUidRef.current !== user.uid) {
      synqBootUidRef.current = user.uid;
      setSynqBoot(null);
    }
    (async () => {
      let cachedSynqActive = false;
      try {
        const [cached, userSnap] = await Promise.all([
          readCachedSynqActive(user.uid),
          getDoc(doc(db, "users", user.uid)),
        ]);
        cachedSynqActive = userSnap.exists()
          ? computeSynqActiveFromUserData(userSnap.data())
          : cached;
      } catch {
        try {
          cachedSynqActive = await readCachedSynqActive(user.uid);
        } catch {
          cachedSynqActive = false;
        }
      }
      if (!cancelled) {
        setSynqBoot({ cachedSynqActive });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setMinimumSplashElapsed(true);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!assetsReady) return;
    void SplashScreen.hideAsync();
  }, [assetsReady]);

  useEffect(() => {
    let mounted = true;
    const preloadAssets = async () => {
      try {
        await Asset.loadAsync([
          require("../assets/logo.png"),
          require("../assets/pulse.gif"),
        ]);
      } catch {} finally {
        if (mounted) setAssetsReady(true);
      }
    };
    preloadAssets();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        await hydrateSocialCachesFromDisk(u.uid);
      }
      setUser(u);
      setAuthReady(true);

      if (u) {
        warmSocialCachesInBackground(u.uid);
        const token = await registerForPushNotificationsAsync();
        if (token) {
          try {
            await updateDoc(doc(db, "users", u.uid), { pushToken: token });
          } catch {}
        }
      }
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (!user || !authReady || !navReady) return;

    const maybePromptForLocationUpdate = async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists()) return;
        const data = userSnap.data() as any;
        const hasCoords =
          typeof data?.lat === "number" && typeof data?.lng === "number";
        const hasCityState =
          typeof data?.city === "string" &&
          data.city.trim().length > 0 &&
          typeof data?.state === "string" &&
          data.state.trim().length > 0;
        if (hasCoords && hasCityState) return;

        const now = Date.now();
        const snoozedUntilMs = snoozedUntilMsFromField(
          data?.locationPromptSnoozedUntil
        );
        if (!Number.isNaN(snoozedUntilMs) && snoozedUntilMs > now) return;

        setShowLocationModal(true);
      } catch {}
    };

    const sub = DeviceEventEmitter.addListener(
      LOCATION_PROMPT_CHECK_REQUEST,
      () => {
        void maybePromptForLocationUpdate();
      }
    );
    return () => sub.remove();
  }, [user?.uid, authReady, navReady]);

  const markLocationPromptSnoozed = async () => {
    if (!user) return;
    const snoozeDays = 7;
    const snoozedUntil = new Date(Date.now() + snoozeDays * 24 * 60 * 60 * 1000).toISOString();
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const currentCount =
        snap.exists() && typeof (snap.data() as any)?.locationPromptCount === "number"
          ? (snap.data() as any).locationPromptCount
          : 0;
      await updateDoc(doc(db, "users", user.uid), {
        locationPromptCount: currentCount + 1,
        lastLocationPromptAt: new Date().toISOString(),
        locationPromptSnoozedUntil: snoozedUntil,
      });
    } catch {}
  };

  useEffect(() => {
    if (!authReady || !navReady) return;

    const inAuthGroup = segments[0] === "(auth)";
    const onLocationPage = segments[0] === "location";
    const onDetailsPage = segments[1] === "details";
    const hasName = !!user?.displayName;

    if (!user) {
      if (!inAuthGroup) router.replace("/(auth)/welcome");
      return;
    }

    if (!hasName) {
      if (!onDetailsPage) router.replace("/(auth)/details");
      return;
    }

    if (onLocationPage) return;

    if (inAuthGroup) router.replace("/(tabs)");
  }, [authReady, navReady, user, segments]);

  useEffect(() => {
    if (!authReady || !navReady || !assetsReady) return;
    if (!user) return;
    if (synqBoot === null) return;
    if (!pendingNotificationTap) return;

    const pending = pendingNotificationTap;
    setPendingNotificationTap(null);

    if (pending.kind === "notifications") {
      router.push("/notifications");
      return;
    }

    if (pending.kind === "friend_profile") {
      router.push({
        pathname: "/friend-profile",
        params: { friendId: pending.friendId },
      });
      return;
    }

    if (pending.kind === "synq_home") {
      router.push("/(tabs)");
      return;
    }

    if (pending.kind === "me") {
      if (pending.focusEventId) {
        router.push(
          `/(tabs)/me?focusEventId=${encodeURIComponent(pending.focusEventId)}`
        );
      } else {
        router.push("/(tabs)/me");
      }
      return;
    }

    if (pending.kind === "chat") {
      router.push("/(tabs)");
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let timeoutId2: ReturnType<typeof setTimeout> | undefined;
      const handle = InteractionManager.runAfterInteractions(() => {
        timeoutId = setTimeout(() => {
          DeviceEventEmitter.emit("openChat", {
            chatId: pending.chatId,
            messageId: pending.messageId,
          });
        }, 700);
        timeoutId2 = setTimeout(() => {
          DeviceEventEmitter.emit("openChat", {
            chatId: pending.chatId,
            messageId: pending.messageId,
          });
        }, 1400);
      });
      return () => {
        handle.cancel?.();
        if (timeoutId) clearTimeout(timeoutId);
        if (timeoutId2) clearTimeout(timeoutId2);
      };
    }
  }, [
    authReady,
    navReady,
    assetsReady,
    user,
    synqBoot,
    pendingNotificationTap,
    router,
  ]);

  const synqBootReady = user == null || synqBoot !== null;
  const appReady =
    authReady && navReady && assetsReady && synqBootReady;
  const showSplash = !appReady || !minimumSplashElapsed;

  const locationModals =
    user && authReady ? (
      <LocationUpdateModal
        visible={showLocationModal}
        onClose={async () => {
          setShowLocationModal(false);
          await markLocationPromptSnoozed();
        }}
        onSaved={async () => {
          setShowLocationModal(false);
          await markLocationPromptSnoozed();
        }}
      />
    ) : null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AuthContext.Provider value={{ refreshAuth }}>
          <SynqBootProvider
            value={synqBoot ?? { cachedSynqActive: false }}
          >
            {showSplash ? (
              <View
                style={{
                  flex: 1,
                  backgroundColor: BG,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ExpoImage
                  source={SPLASH_LOGO}
                  style={{ width: 300, height: 220 }}
                  contentFit="contain"
                  transition={0}
                  cachePolicy="memory-disk"
                  accessibilityRole="image"
                  accessibilityLabel="Synq"
                />
              </View>
            ) : (
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="location" />
                <Stack.Screen name="(tabs)" />
              </Stack>
            )}
            {locationModals}
          </SynqBootProvider>
        </AuthContext.Provider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
