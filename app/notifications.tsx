import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { ACCENT } from "../constants/Variables";
import { auth, db } from "../src/lib/firebase";

import AlertModal from "./alert-modal";

const BACKGROUND = "black";
const SURFACE = "#161616";
const DEFAULT_AVATAR =
  "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";
const isRemoteImageUri = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value);

const fonts = {
  black: "Avenir-Black",
  heavy: "Avenir-Heavy",
  medium: "Avenir-Medium",
};

export default function NotificationsScreen() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title?: string;
    message: string;
  } | null>(null);

  const showAlert = (title: string, message: string) => {
    setAlertConfig({ title, message });
    setAlertVisible(true);
  };

  const resolveRequestDisplay = async (request: any) => {
    const senderId = request.from || request.fromId || request.id;
    let senderName =
      request.senderName ||
      request.fromName ||
      "Someone";
    let senderImageUrl =
      request.senderImageUrl ||
      request.fromImageUrl ||
      request.fromImageurl ||
      request.imageurl ||
      null;

    try {
      const senderSnap = await getDoc(doc(db, "users", senderId));
      if (senderSnap.exists()) {
        const senderData = senderSnap.data() as any;
        senderName = senderData?.displayName || senderName;
        senderImageUrl = senderData?.imageurl || senderImageUrl;
      }
    } catch {}

    return {
      ...request,
      senderName,
      senderImageUrl,
    };
  };

  const fetchRequests = async () => {
    if (!auth.currentUser) return;

    const snap = await getDocs(
      collection(db, "users", auth.currentUser.uid, "friendRequests")
    );

    const reqList = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    const resolved = await Promise.all(reqList.map(resolveRequestDisplay));
    setRequests(resolved);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    const reqRef = collection(
      db,
      "users",
      auth.currentUser.uid,
      "friendRequests"
    );

    const unsubscribe = onSnapshot(
      reqRef,
      async (snapshot) => {
        const reqList = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        const resolved = await Promise.all(reqList.map(resolveRequestDisplay));
        setRequests(resolved);
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
      const myId = auth.currentUser.uid;
      const senderId = request.from || request.fromId;

      if (!senderId) throw new Error("Missing sender ID.");

      if (accept) {
        const meSnap = await getDoc(doc(db, "users", myId));
        const meData = meSnap.exists() ? meSnap.data() : {};

        const myName =
          meData?.displayName ||
          auth.currentUser.displayName ||
          "User";

        const myImageUrl = meData?.imageurl || DEFAULT_AVATAR;

        let senderName =
          request.senderName ||
          request.fromName ||
          "User";

        let senderImageUrl =
          request.senderImageUrl ||
          request.fromImageUrl ||
          request.fromImageurl ||
          request.imageurl ||
          null;

        if (!senderImageUrl || !senderName) {
          const senderSnap = await getDoc(doc(db, "users", senderId));
          if (senderSnap.exists()) {
            const senderData = senderSnap.data();
            senderName =
              senderName ||
              senderData?.displayName ||
              "User";
            senderImageUrl =
              senderImageUrl ||
              senderData?.imageurl ||
              DEFAULT_AVATAR;
          }
        }

        const batch = writeBatch(db);

        batch.set(doc(db, "users", myId, "friends", senderId), {
          synqCount: 0,
          since: serverTimestamp(),
          displayName: senderName,
          imageurl: senderImageUrl || DEFAULT_AVATAR,
        });

        batch.set(doc(db, "users", senderId, "friends", myId), {
          synqCount: 0,
          since: serverTimestamp(),
          displayName: myName,
          imageurl: myImageUrl || DEFAULT_AVATAR,
        });

        batch.delete(
          doc(db, "users", myId, "friendRequests", request.id)
        );

        await batch.commit();

        showAlert("Success", `You are now connected with ${senderName}!`);
      } else {
        await deleteDoc(
          doc(db, "users", myId, "friendRequests", request.id)
        );
      }
    } catch (e: any) {
      showAlert("Error", `Could not process request: ${e.message}`);
    }
  };

  const RequestRow = ({ item }: { item: any }) => {
    const fromImageUrl =
      item.senderImageUrl ||
      item.fromImageUrl ||
      item.fromImageurl ||
      item.imageurl ||
      null;

    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <View style={styles.avatar}>
            {isRemoteImageUri(fromImageUrl) ? (
              <Image source={{ uri: fromImageUrl }} style={styles.avatarImg} />
            ) : (
              <Image source={{ uri: DEFAULT_AVATAR }} style={styles.avatarImg} />
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.rowKicker}>Friend Request</Text>
            <Text style={styles.rowText}>
              <Text style={styles.boldWhite}>
                {item.senderName || item.fromName || "Someone"}
              </Text>
              <Text style={styles.grayText}> wants to be your friend.</Text>
            </Text>
          </View>
        </View>

        <View style={styles.rowRight}>
          <TouchableOpacity
            onPress={() => handleRequest(item, true)}
            style={styles.acceptBtn}
          >
            <Ionicons name="checkmark" size={22} color="black" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleRequest(item, false)}
            style={styles.denyBtn}
          >
            <Ionicons name="close" size={22} color="#888" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={26} color="#888" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
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
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="notifications-off-outline"
                  size={34}
                  color="#666"
                />
              </View>
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptySubtitle}>
                No new notifications right now.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.group}>
              <RequestRow item={item} />
            </View>
          )}
        />
      )}

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
  refreshBtn: {
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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: {
    paddingBottom: 40,
    paddingTop: 10,
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
    paddingVertical: 18,
    paddingHorizontal: 18,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    overflow: "hidden",
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
  grayText: { color: "#aaa", fontFamily: fonts.medium, fontSize: 14 },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  acceptBtn: {
    backgroundColor: ACCENT,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  denyBtn: {
    backgroundColor: "#222",
    width: 48,
    height: 48,
    borderRadius: 24,
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
    fontSize: 20,
    fontFamily: fonts.heavy,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: "#777",
    fontSize: 15,
    fontFamily: fonts.medium,
    textAlign: "center",
    marginTop: 8
  },
});