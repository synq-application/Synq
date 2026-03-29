import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
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
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import {
  ACCENT,
  BG,
  BORDER,
  DEFAULT_AVATAR,
  RADIUS_MD,
  SPACE_3,
  SPACE_4,
  SPACE_6,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_SECTION,
  TYPE_TITLE
} from "../constants/Variables";
import { auth, db } from "../src/lib/firebase";

import AlertModal from "./alert-modal";
import { prefetchResolvedAvatar, resolveAvatar } from "./helpers";

function prefetchRequestRows(items: any[]) {
  items.forEach((item) => {
    prefetchResolvedAvatar(
      item.senderImageUrl || item.fromImageUrl || item.fromImageurl || item.imageurl
    );
  });
}

const SURFACE = "rgba(255,255,255,0.06)";
const BACKGROUND = BG;

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
        prefetchRequestRows(resolved);
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

  useEffect(() => {
    prefetchResolvedAvatar(DEFAULT_AVATAR);
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

        const myImageUrl = resolveAvatar(meData?.imageurl);

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
              resolveAvatar(senderData?.imageurl);
          }
        }

        const batch = writeBatch(db);

        batch.set(doc(db, "users", myId, "friends", senderId), {
          synqCount: 0,
          since: serverTimestamp(),
          displayName: senderName,
          imageurl: resolveAvatar(senderImageUrl),
          notifyOnCreate: true,
        });

        batch.set(doc(db, "users", senderId, "friends", myId), {
          synqCount: 0,
          since: serverTimestamp(),
          displayName: myName,
          imageurl: myImageUrl,
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

    const avatarUri = resolveAvatar(fromImageUrl);

    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <View style={styles.avatar}>
            <ExpoImage
              source={{ uri: avatarUri }}
              style={styles.avatarImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
              recyclingKey={avatarUri}
              priority="high"
            />
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
    paddingHorizontal: SPACE_4 + 4,
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
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1F1F1F",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: TYPE_TITLE,
    fontFamily: fonts.heavy,
    color: "white",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: {
    paddingBottom: SPACE_6 + 8,
    paddingTop: SPACE_3,
  },
  group: {
    backgroundColor: SURFACE,
    marginHorizontal: SPACE_4 + 4,
    borderRadius: RADIUS_MD,
    overflow: "hidden",
    marginBottom: SPACE_3,
    borderWidth: 1,
    borderColor: BORDER,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACE_4 + 2,
    paddingHorizontal: SPACE_4 + 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#252525",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: SPACE_3,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACE_4,
    overflow: "hidden",
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  rowKicker: {
    color: ACCENT,
    fontSize: TYPE_CAPTION - 2,
    fontFamily: fonts.black,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
  },
  rowText: {
    fontSize: TYPE_BODY - 1,
    color: "white",
    fontFamily: fonts.medium,
    lineHeight: 18,
  },
  boldWhite: { fontFamily: fonts.heavy, color: "white" },
  grayText: { color: "#aaa", fontFamily: fonts.medium, fontSize: TYPE_BODY - 1 },
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
    marginRight: SPACE_3,
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
    marginTop: SPACE_6 + 8,
    marginHorizontal: SPACE_4 + 4,
    padding: SPACE_4 + 2,
    borderRadius: RADIUS_MD,
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
    fontSize: TYPE_SECTION,
    fontFamily: fonts.heavy,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: "#777",
    fontSize: TYPE_BODY - 1,
    fontFamily: fonts.medium,
    textAlign: "center",
    marginTop: 8
  },
});