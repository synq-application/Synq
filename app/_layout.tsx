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
import { doc, updateDoc } from "firebase/firestore";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Text,
  Platform,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ACCENT, BG, fonts, TYPE_CAPTION } from "../constants/Variables";
import { auth, db } from "../src/lib/firebase";
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

  /** Set when user taps a push so navigation runs even if auth/user state does not change. */
  const [pendingNotificationTap, setPendingNotificationTap] = useState<
    | { kind: "chat"; chatId: string }
    | { kind: "notifications" }
    | null
  >(null);

  const refreshAuth = () => {
    setUser(auth.currentUser ? ({ ...auth.currentUser } as User) : null);
  };

  useEffect(() => {
    const applyNotificationData = (data: Record<string, unknown> | undefined) => {
      if (!data) return;
      const chatRaw = data.chatId;
      const chatId =
        typeof chatRaw === "string"
          ? chatRaw
          : chatRaw != null
            ? String(chatRaw)
            : undefined;
      const type = typeof data.type === "string" ? data.type : undefined;
      if (chatId) {
        setPendingNotificationTap({ kind: "chat", chatId });
        return;
      }
      if (type === "friend_request") {
        setPendingNotificationTap({ kind: "notifications" });
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
    let mounted = true;
    const preloadAssets = async () => {
      try {
        await Asset.loadAsync([
          require("../assets/SYNQ-2.png"),
          require("../assets/pulse.gif"),
        ]);
      } catch (e) {
        console.error("Asset preload failed:", e);
      } finally {
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
          } catch (e) {
            console.error("Error saving push token:", e);
          }
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
    if (!authReady || !navReady) return;
    if (!user) return;
    if (!pendingNotificationTap) return;

    const pending = pendingNotificationTap;
    setPendingNotificationTap(null);

    if (pending.kind === "notifications") {
      router.push("/notifications");
      return;
    }

    router.push("/(tabs)");
    setTimeout(() => {
      DeviceEventEmitter.emit("openChat", { chatId: pending.chatId });
    }, 500);
  }, [authReady, navReady, user, pendingNotificationTap, router]);

  if (!authReady || !navReady || !assetsReady) {
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
      <AuthContext.Provider value={{ refreshAuth }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="location" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthContext.Provider>
    </GestureHandlerRootView>
  );
}
