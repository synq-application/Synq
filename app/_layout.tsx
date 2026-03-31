import Constants from "expo-constants";
import { Asset } from "expo-asset";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import {
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
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
  ActivityIndicator,
  DeviceEventEmitter,
  InteractionManager,
  Text,
  Platform,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ACCENT, BG, fonts, TYPE_CAPTION } from "../constants/Variables";
import { SynqBootProvider } from "../src/lib/synqBootContext";
import { auth, db } from "../src/lib/firebase";
import {
  computeSynqActiveFromUserData,
  readCachedSynqActive,
} from "../src/lib/synqSession";
import {
  hydrateSocialCachesFromDisk,
  warmSocialCachesInBackground,
} from "../src/lib/socialCache";
import { startSynqGlanceWidgetSync } from "../src/lib/syncSynqWidget";

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

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();

  const navState = useRootNavigationState();
  const navReady = !!navState?.key;

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [synqBoot, setSynqBoot] = useState<{
    cachedSynqActive: boolean;
  } | null>(null);
  const synqBootUidRef = useRef<string | null>(null);

  const [pendingNotificationTap, setPendingNotificationTap] = useState<
    | { kind: "chat"; chatId: string; messageId?: string }
    | { kind: "notifications" }
    | { kind: "friend_profile"; friendId: string }
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
        const friendId = str(data.fromUserId);
        if (friendId) {
          setPendingNotificationTap({ kind: "friend_profile", friendId });
        } else {
          setPendingNotificationTap({ kind: "notifications" });
        }
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
    let mounted = true;
    const preloadAssets = async () => {
      try {
        await Asset.loadAsync([
          require("../assets/SYNQ-2.png"),
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
      const handle = InteractionManager.runAfterInteractions(() => {
        timeoutId = setTimeout(() => {
          DeviceEventEmitter.emit("openChat", {
            chatId: pending.chatId,
            messageId: pending.messageId,
          });
        }, 500);
      });
      return () => {
        handle.cancel?.();
        if (timeoutId) clearTimeout(timeoutId);
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

  if (!authReady || !navReady || !assetsReady || !synqBootReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: BG,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={ACCENT} size="small" />
        <Text
          style={{
            marginTop: 10,
            color: "rgba(255,255,255,0.55)",
            fontFamily: fonts.medium,
            fontSize: TYPE_CAPTION,
          }}
        >
          Loading Synq...
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AuthContext.Provider value={{ refreshAuth }}>
          <SynqBootProvider
            value={synqBoot ?? { cachedSynqActive: false }}
          >
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="location" />
            <Stack.Screen name="(tabs)" />
          </Stack>
          </SynqBootProvider>
        </AuthContext.Provider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
