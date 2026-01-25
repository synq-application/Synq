import { ACCENT } from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../src/lib/firebase";

const BACKGROUND = "black";
const SURFACE = "#161616";

const fonts = {
  heavy: Platform.OS === "ios" ? "Avenir-Heavy" : "sans-serif-medium",
  medium: Platform.OS === "ios" ? "Avenir-Medium" : "sans-serif",
  black: Platform.OS === "ios" ? "Avenir-Black" : "sans-serif-condensed",
};

export default function DeleteAccountScreen() {
  const [busy, setBusy] = useState(false);

const runDelete = async () => {
  if (!auth.currentUser?.uid) {
    Alert.alert("Not signed in", "Please sign in again and try deleting your account.");
    return;
  }

  setBusy(true);
  try {
    const functions = getFunctions(undefined, "us-central1");
    const deleteMyAccount = httpsCallable(functions, "deleteMyAccount");
    await deleteMyAccount({});
    await signOut(auth);

    Alert.alert("Account deleted", "Your account has been deleted.");
    router.replace("/");

  } catch (e: any) {
    const code = String(e?.code || "");
    const msg = String(e?.message || e);

    if (code.includes("unauthenticated")) {
      Alert.alert("Please sign in again", "Your session expired. Sign in and try again.");
    } else if (code.includes("not-found")) {
      Alert.alert(
        "Delete not available yet",
        "The deleteMyAccount function isn’t deployed. Deploy it and try again."
      );
    } else {
      Alert.alert("Couldn’t delete account", msg);
    }
  } finally {
    setBusy(false);
  }
};
  const confirmDelete = () => {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your Synq account, friends, and chats. This can’t be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: runDelete },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete account</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>This is permanent</Text>
          <Text style={styles.heroSubtitle}>
            Deleting your account removes your profile, friends, chats, and messages from Synq.
            This can’t be undone.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What will be deleted</Text>

          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>Your profile</Text>
          </View>

          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>Friends (removed on both sides)</Text>
          </View>

          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>Chats and messages you’re part of</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={confirmDelete}
          activeOpacity={0.9}
          style={[styles.deleteBtn, busy && { opacity: 0.7 }]}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator />
          ) : (
            <>
              <Ionicons name="trash" size={18} color="white" />
              <Text style={styles.deleteText}>Delete my account</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.footerSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },

  header: {
    height: 72,
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: fonts.heavy,
    color: "black",
    marginLeft: 6,
  },

  scrollContent: { paddingBottom: 40 },

  hero: {
    margin: 20,
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#202020",
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: fonts.heavy,
    color: "white",
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#BDBDBD",
    lineHeight: 20,
  },
  card: {
    backgroundColor: SURFACE,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#202020",
  },
  cardTitle: {
    color: "white",
    fontFamily: fonts.heavy,
    fontSize: 16,
    marginBottom: 12,
  },
  bulletRow: { flexDirection: "row", marginBottom: 10 },
  bulletDot: { color: ACCENT, marginRight: 10, fontSize: 18, lineHeight: 22 },
  bulletText: {
    color: "#EAEAEA",
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  deleteBtn: {
    marginTop: 18,
    marginHorizontal: 20,
    backgroundColor: "#FF4D4F",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  deleteText: {
    color: "white",
    fontFamily: fonts.black,
    fontSize: 16,
  },
  footerSpace: { height: 24 },
});
