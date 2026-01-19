import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, updateDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from "react";
import { DeviceEventEmitter, Platform } from 'react-native';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { auth, db } from "../src/lib/firebase";

// --- Notification Configuration ---
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
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7DFFA6',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }
    
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    })).data;
  }

  return token;
}
// --- End Notification Configuration ---

const AuthContext = createContext({ refreshAuth: () => {} });
export const useAuthRefresh = () => useContext(AuthContext);

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const refreshAuth = () => {
    setUser(auth.currentUser ? { ...auth.currentUser } as User : null);
  };

  // 1. Handle Notification Taps (Broadcasting to your Tab Screen)
  useEffect(() => {
    // Listener for when the user taps a notification while the app is running/backgrounded
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.chatId) {
        // Navigate to the main screen first
        router.push("/(tabs)");
        // Emit event to open the specific chat modal
        setTimeout(() => {
          DeviceEventEmitter.emit('openChat', { chatId: data.chatId });
        }, 500);
      }
    });

    // Check if the app was opened FROM a killed state via a notification
    Notifications.getLastNotificationResponseAsync().then(response => {
      const data = response?.notification.request.content.data;
      if (data?.chatId) {
        router.push("/(tabs)");
        setTimeout(() => {
          DeviceEventEmitter.emit('openChat', { chatId: data.chatId });
        }, 1000);
      }
    });

    return () => subscription.remove();
  }, []);

  // 2. Handle Auth State and Push Token Registration
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);

      if (u) {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          try {
            await updateDoc(doc(db, 'users', u.uid), {
              pushToken: token,
            });
            console.log("Push token saved:", token);
          } catch (e) {
            console.error("Error saving push token:", e);
          }
        }
      }
    });
    return unsub;
  }, []);

  // 3. Handle Navigation Logic (Protected Routes)
  useEffect(() => {
    if (authLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const onLocationPage = segments[0] === "location";
    const onDetailsPage = segments[1] === "details";
    const hasName = !!user?.displayName;

    if (!user) {
      if (!inAuthGroup) router.replace("/(auth)/welcome");
    } else if (!hasName) {
      if (!onDetailsPage) router.replace("/(auth)/details");
    } else if (onLocationPage) {
      return;
    } else {
      if (inAuthGroup) router.replace("/(tabs)");
    }
  }, [user, segments, authLoading]);

  if (authLoading) return null;

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