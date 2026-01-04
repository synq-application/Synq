import { Stack, useRouter, useSegments } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { auth } from "../src/lib/firebase";

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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

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