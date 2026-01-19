import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  SafeAreaView,
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
const DEFAULT_AVATAR =
  "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";

const fonts = {
  black: Platform.OS === "ios" ? "Avenir-Black" : "sans-serif-condensed",
  heavy: Platform.OS === "ios" ? "Avenir-Heavy" : "sans-serif-medium",
  medium: Platform.OS === "ios" ? "Avenir-Medium" : "sans-serif",
};

export default function NotificationsScreen() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const reqRef = collection(db, "users", auth.currentUser.uid, "friendRequests");

    const unsubscribe = onSnapshot(
      reqRef,
      (snapshot) => {
        const reqList = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setRequests(reqList);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore Snapshot failed:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleRequest = async (request: any, accept: boolean) => {
    if (!auth.currentUser) return;

    try {
      if (!request.fromId) throw new Error("Missing sender ID.");

      if (accept) {
        const meSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
        const meData = meSnap.exists() ? meSnap.data() : {};
        const myName = meData?.displayName || auth.currentUser.displayName || "User";
        const myImageUrl = meData?.imageurl || DEFAULT_AVATAR;

        let senderName = request.fromName || "User";
        let senderImageUrl = request.fromImageUrl || request.fromImageurl || request.imageurl || null;

        if (!senderImageUrl) {
          const senderSnap = await getDoc(doc(db, "users", request.fromId));
          if (senderSnap.exists()) {
            const senderData = senderSnap.data();
            senderName = senderName || senderData?.displayName || "User";
            senderImageUrl = senderData?.imageurl || DEFAULT_AVATAR;
          }
        }

        await setDoc(doc(db, "users", auth.currentUser.uid, "friends", request.fromId), {
          synqCount: 0,
          since: serverTimestamp(),
          displayName: senderName,
          imageurl: senderImageUrl || DEFAULT_AVATAR,
        });

        await setDoc(doc(db, "users", request.fromId, "friends", auth.currentUser.uid), {
          synqCount: 0,
          since: serverTimestamp(),
          displayName: myName,
          imageurl: myImageUrl,
        });

        Alert.alert("Success", `You are now connected with ${senderName}!`);
      }

      await deleteDoc(doc(db, "users", auth.currentUser.uid, "friendRequests", request.id));
    } catch (e: any) {
      Alert.alert("Error", `Could not process request: ${e.message}`);
    }
  };

  const RequestRow = ({ item }: { item: any }) => {
    const fromImageUrl =
      item.fromImageUrl || item.fromImageurl || item.imageurl || null;

    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <View style={styles.avatar}>
            {fromImageUrl ? (
              <Image source={{ uri: fromImageUrl }} style={styles.avatarImg} />
            ) : (
              <Ionicons name="person" size={18} color="#666" />
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.rowKicker}>Friend Request</Text>
            <Text style={styles.rowText} numberOfLines={2}>
              <Text style={styles.boldWhite}>{item.fromName || "Someone"}</Text>
              <Text style={styles.grayText}> wants to be your friend.</Text>
            </Text>
          </View>
        </View>

        <View style={styles.rowRight}>
          <TouchableOpacity onPress={() => handleRequest(item, true)} style={styles.acceptBtn}>
            <Ionicons name="checkmark" size={18} color="black" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleRequest(item, false)} style={styles.denyBtn}>
            <Ionicons name="close" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={28} color="#666" />
              </View>
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptySubtitle}>No new notifications right now.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.group}>
              <RequestRow item={item} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  header: {
    height: 80,
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: fonts.heavy,
    color: "black",
    marginBottom: 2,
  },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  listContent: {
    paddingBottom: 40,
  },

  sectionHeaderWrap: {
    paddingTop: 10,
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
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#252525",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },

  rowKicker: {
    color: ACCENT,
    fontSize: 10,
    fontFamily: fonts.black,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
  },
  rowText: {
    fontSize: 14,
    color: "white",
    fontFamily: fonts.medium,
    lineHeight: 18,
  },
  boldWhite: { fontFamily: fonts.heavy, color: "white" },
  grayText: { color: "#aaa", fontFamily: fonts.medium },

  rowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  acceptBtn: {
    backgroundColor: ACCENT,
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  denyBtn: {
    backgroundColor: "#222",
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },

  emptyWrap: {
    marginTop: 40,
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 16,
    backgroundColor: SURFACE,
    alignItems: "center",
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  emptyTitle: {
    color: "white",
    fontSize: 16,
    fontFamily: fonts.heavy,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: "#777",
    fontSize: 13,
    fontFamily: fonts.medium,
    textAlign: "center",
  },
});
