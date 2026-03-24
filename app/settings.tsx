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
          <Ionicons name="chevron-back" size={26} color="#888" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
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
          <SettingItem label="About us" onPress={() => router.push("/profile-settings/about-us")} />
          <SettingItem label="Privacy policy" onPress={() => router.push("/profile-settings/privacy-policy")} />
          <SettingItem label="Terms and conditions" onPress={() => router.push("/profile-settings/terms-conditions")} />
          <SettingItem label="Feedback" onPress={() => router.push("/profile-settings/feedback")} />
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backButton: {
    marginRight: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1F1F1F",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: fonts.heavy,
    color: "white",
  },
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 10,
  },
  userSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#2A2A2A",
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