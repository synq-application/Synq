import Constants from "expo-constants";
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
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Platform,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { auth, db } from "../src/lib/firebase";

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
      lightColor: "#7DFFA6",
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

  const pendingChatIdRef = useRef<string | null>(null);

  const refreshAuth = () => {
    setUser(auth.currentUser ? ({ ...auth.currentUser } as User) : null);
  };

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data: any = response.notification.request.content.data;
        if (data?.chatId) {
          pendingChatIdRef.current = String(data.chatId);
        }
      }
    );

    Notifications.getLastNotificationResponseAsync().then((response) => {
      const data: any = response?.notification.request.content.data;
      if (data?.chatId) {
        pendingChatIdRef.current = String(data.chatId);
      }
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthReady(true);

      if (u) {
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

    const chatId = pendingChatIdRef.current;
    if (!chatId) return;

    pendingChatIdRef.current = null;

    router.push("/(tabs)");
    setTimeout(() => {
      DeviceEventEmitter.emit("openChat", { chatId });
    }, 500);
  }, [authReady, navReady, user]);

  if (!authReady || !navReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "black",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
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
