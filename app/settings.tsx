import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
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
import {
  BG,
  BORDER,
  BUTTON_RADIUS,
  MODAL_RADIUS,
  MUTED,
  RADIUS_MD,
  SPACE_1,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_TITLE,
} from "../constants/Variables";
import { auth, db } from "../src/lib/firebase";
import { resolveAvatar } from "./helpers";

import AlertModal from "./alert-modal";
import ConfirmModal from "./confirm-modal";

const BACKGROUND = BG;
const SURFACE = "rgba(255,255,255,0.06)";

const fonts = {
  black: "Avenir-Black",
  heavy: "Avenir-Heavy",
  medium: "Avenir-Medium",
};

export default function SettingsScreen() {
  const [userData, setUserData] = useState<any>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title?: string;
    message: string;
  } | null>(null);

  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const showAlert = (title: string, message: string) => {
    setAlertConfig({ title, message });
    setAlertVisible(true);
  };

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
      showAlert("Unable to open Settings", "Please open your device Settings app.");
    }
  };

  const signOut = async () => {
    try {
      await auth.signOut();
      router.replace("/"); 
    } catch {
      showAlert("Sign out failed", "Please try again.");
    }
  };

  const confirmSignOut = () => {
    setShowSignOutModal(true);
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
        <Text style={[styles.itemLabel, danger && styles.dangerText]}>
          {label}
        </Text>
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
            source={{ uri: resolveAvatar(userData?.imageurl) }}
            style={styles.avatar}
          />
          <Text style={styles.userName}>
            {userData?.displayName ||
              auth.currentUser?.displayName ||
              "User"}
          </Text>
        </View>

        <Text style={styles.groupTitle}>Account</Text>
        <View style={styles.group}>
          <SettingItem
            label="Edit profile"
            onPress={() => router.push("/edit-profile")}
          />
          <SettingItem
            label="Notifications"
            onPress={openSystemSettings}
          />
          <SettingItem label="Sign out" onPress={confirmSignOut} />
        </View>

        <Text style={styles.groupTitle}>More</Text>
        <View style={styles.group}>
          <SettingItem
            label="About us"
            onPress={() => router.push("/profile-settings/about-us")}
          />
          <SettingItem
            label="Privacy policy"
            onPress={() =>
              router.push("/profile-settings/privacy-policy")
            }
          />
          <SettingItem
            label="Terms and conditions"
            onPress={() =>
              router.push("/profile-settings/terms-conditions")
            }
          />
          <SettingItem
            label="Feedback"
            onPress={() => router.push("/profile-settings/feedback")}
          />
          <StaticItem label="Version" value={appVersion} />
        </View>

        <Text style={styles.groupTitle}>Danger zone</Text>
        <View style={styles.group}>
          <SettingItem
            label="Delete account"
            danger
            onPress={() => router.push("/delete-account")}
          />
        </View>
      </ScrollView>

      <ConfirmModal
        visible={showSignOutModal}
        title="Sign out?"
        message="You can sign back in anytime."
        confirmText="Sign out"
        destructive
        onCancel={() => setShowSignOutModal(false)}
        onConfirm={async () => {
          setShowSignOutModal(false);
          await signOut();
        }}
      />

      <AlertModal
        visible={alertVisible}
        title={alertConfig?.title}
        message={alertConfig?.message || ""}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE_4 + SPACE_1,
    paddingTop: SPACE_3,
    paddingBottom: SPACE_3,
  },
  backButton: {
    marginRight: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1F1F1F",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: TYPE_TITLE,
    fontFamily: fonts.heavy,
    color: "white",
  },
  scrollContent: {
    paddingBottom: SPACE_6 + SPACE_1,
    paddingTop: SPACE_3,
  },
  userSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    margin: SPACE_4 + SPACE_1,
    padding: SPACE_4,
    borderRadius: RADIUS_MD,
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
    fontSize: TYPE_BODY + 2,
    fontFamily: fonts.heavy,
  },

  groupTitle: {
    color: MUTED,
    fontSize: TYPE_CAPTION + 1,
    fontFamily: fonts.medium,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginLeft: SPACE_5 + 1,
    marginBottom: SPACE_3 - 2,
    marginTop: SPACE_3 - 2,
  },
  group: {
    backgroundColor: SURFACE,
    marginHorizontal: SPACE_4 + SPACE_1,
    borderRadius: RADIUS_MD,
    overflow: "hidden",
    marginBottom: SPACE_5 + 1,
    borderWidth: 1,
    borderColor: BORDER,
  },

  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACE_4 + 2,
    paddingHorizontal: SPACE_4 + 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#252525",
  },
  itemLeft: { flexDirection: "row", alignItems: "center" },
  itemLabel: {
    color: "white",
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
  },
  itemValue: {
    color: "#A8A8A8",
    fontSize: TYPE_CAPTION + 1,
    fontFamily: fonts.medium,
  },

  dangerText: {
    color: "#FF5A5F",
    fontFamily: fonts.heavy,
  },
});