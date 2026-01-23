import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../src/lib/firebase";

const ACCENT = "#7DFFA6";
const BACKGROUND = "black";
const SURFACE = "#161616";

const fonts = {
  black: Platform.OS === "ios" ? "Avenir-Black" : "sans-serif-condensed",
  heavy: Platform.OS === "ios" ? "Avenir-Heavy" : "sans-serif-medium",
  medium: Platform.OS === "ios" ? "Avenir-Medium" : "sans-serif",
};

export default function SettingsScreen() {
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;

    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) setUserData(snap.data());
    });

    return () => unsubscribe();
  }, []);

  const appVersion =
    Constants.expoConfig?.version ||
    Constants.manifest2?.extra?.expoClient?.version ||
    Constants.manifest?.version ||
    "1.0.0";

  const openSystemSettings = async () => {
    try {
      if (typeof (Linking as any).openSettings === "function") {
        await (Linking as any).openSettings();
        return;
      }
      await Linking.openURL("app-settings:");
    } catch {
      Alert.alert("Unable to open Settings", "Please open your device Settings app.");
    }
  };

  const signOut = async () => {
    try {
      await auth.signOut();
      router.reload; 
    } catch {
      Alert.alert("Sign out failed", "Please try again.");
    }
  };

  const confirmSignOut = () => {
    Alert.alert("Sign out?", "You can sign back in anytime.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  };

  const SettingItem = ({
    label,
    onPress,
    value,
    danger,
  }: {
    label: string;
    onPress?: () => void;
    value?: string;
    danger?: boolean;
  }) => (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.itemLeft}>
        <Text style={[styles.itemLabel, danger && styles.dangerText]}>{label}</Text>
      </View>

      {value ? (
        <Text style={styles.itemValue}>{value}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#666" />
      )}
    </TouchableOpacity>
  );

  const StaticItem = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.item}>
      <View style={styles.itemLeft}>
        <Text style={styles.itemLabel}>{label}</Text>
      </View>
      <Text style={styles.itemValue}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

<View style={styles.header}>
  <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
    <Ionicons name="chevron-back" size={28} color="black" />
  </TouchableOpacity>

  <Text style={styles.headerTitle}>Settings</Text>
</View>



      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.userSection}>
          <Image
            source={{
              uri: userData?.imageurl || "https://www.gravatar.com/avatar/?d=mp",
            }}
            style={styles.avatar}
          />
          <Text style={styles.userName}>
            {userData?.displayName || auth.currentUser?.displayName || "User"}
          </Text>
        </View>

        <Text style={styles.groupTitle}>Account</Text>
        <View style={styles.group}>
          <SettingItem label="Edit profile" onPress={() => router.push("/edit-profile")} />
          <SettingItem label="Notifications" onPress={openSystemSettings} />
          <SettingItem label="Sign out" onPress={confirmSignOut} />
        </View>

        <Text style={styles.groupTitle}>More</Text>
        <View style={styles.group}>
          <SettingItem label="About us" onPress={() => router.push("/about-us")} />
          <SettingItem label="Privacy policy" onPress={() => router.push("/privacy-policy")} />
          <SettingItem label="Terms and conditions" onPress={() => router.push("/terms-conditions")} />
          <SettingItem label="Feedback" onPress={() => router.push("/feedback")} />
          <StaticItem label="Version" value={appVersion} />
        </View>

        <Text style={styles.groupTitle}>Danger zone</Text>
        <View style={styles.group}>
          <SettingItem label="Delete account" danger onPress={() => router.push("/delete-account")} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
header: {
  height: 80,
  backgroundColor: ACCENT,
  flexDirection: "row",
  alignItems: "flex-end",
  paddingHorizontal: 20,
  paddingBottom: 20,
},

backButton: {
  marginRight: 8,
  justifyContent: "center",
},

headerTitle: {
  fontSize: 24,
  fontFamily: fonts.heavy,
  color: "black",
  lineHeight: 28, 
},
  scrollContent: { paddingBottom: 40 },

  userSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE,
    margin: 20,
    padding: 15,
    borderRadius: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    backgroundColor: "#333",
  },
  userName: {
    color: "white",
    fontSize: 18,
    fontFamily: fonts.heavy,
  },

  groupTitle: {
    color: "#666",
    fontSize: 14,
    fontFamily: fonts.medium,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginLeft: 25,
    marginBottom: 10,
    marginTop: 10,
  },
  group: {
    backgroundColor: SURFACE,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 25,
  },

  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "#252525",
  },
  itemLeft: { flexDirection: "row", alignItems: "center" },
  itemLabel: {
    color: "white",
    fontSize: 16,
    fontFamily: fonts.medium,
  },
  itemValue: {
    color: "#A8A8A8",
    fontSize: 14,
    fontFamily: fonts.medium,
  },

  dangerText: {
    color: "#FF5A5F",
    fontFamily: fonts.heavy,
  },
});
