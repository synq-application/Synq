// app/_layout.tsx
import { Stack, useRouter, useSegments } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../src/lib/firebase";

// Create a small context so children can "poke" the layout to refresh
const AuthContext = createContext({ refreshAuth: () => {} });
export const useAuthRefresh = () => useContext(AuthContext);

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Function to manually force React to recognize the updated Firebase User
  const refreshAuth = () => {
    // We spread the current user into a new object to force a state update
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
    const onDetailsPage = segments[1] === "details";
    const hasCompletedProfile = !!user?.displayName;

    if (!user) {
      if (!inAuthGroup) router.replace("/(auth)/welcome");
    } else if (!hasCompletedProfile) {
      if (!onDetailsPage) router.replace("/(auth)/details");
    } else {
      if (inAuthGroup) router.replace("/(tabs)");
    }
  }, [user, segments, authLoading]); // user dependency is key here

  if (authLoading) return null;

  return (
    <AuthContext.Provider value={{ refreshAuth }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthContext.Provider>
  );
}