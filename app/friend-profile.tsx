import {
  ACCENT,
  BG,
  BORDER,
  fonts,
  MUTED2,
  SURFACE,
  TEXT,
} from "@/constants/Variables";
import { auth, db } from "@/src/lib/firebase";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import ConfirmModal from "./confirm-modal";
import { formatLastSynq } from "./helpers";
import MonthlyMemoReadOnly from "./readonly-monthly-memo";

export default function FriendProfile() {
  const { friendId } = useLocalSearchParams();
  const router = useRouter();

  const [friend, setFriend] = useState<any>(null);
  const [mutualFriends, setMutualFriends] = useState<any[]>([]);
  const [lastSynq, setLastSynq] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  useEffect(() => {
    const fetchFriend = async () => {
      try {
        const snap = await getDoc(doc(db, "users", friendId as string));
        if (snap.exists()) setFriend(snap.data());
      } finally {
        setLoading(false);
      }
    };

    fetchFriend();
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!friendId || !user) return;

    const fetchMutuals = async () => {
      const myId = user.uid;

      const myFriendsSnap = await getDocs(
        collection(db, "users", myId, "friends")
      );
      const myFriendIds = myFriendsSnap.docs.map((d) => d.id);

      const theirFriendsSnap = await getDocs(
        collection(db, "users", friendId as string, "friends")
      );
      const theirFriendIds = theirFriendsSnap.docs.map((d) => d.id);

      const mutualIds = theirFriendIds.filter((id) =>
        myFriendIds.includes(id)
      );

      const mutualData = await Promise.all(
        mutualIds.map(async (id) => {
          const snap = await getDoc(doc(db, "users", id));
          return snap.exists() ? { id, ...snap.data() } : null;
        })
      );

      setMutualFriends(mutualData.filter(Boolean));
    };

    fetchMutuals();
  }, [friendId]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !friendId) return;

    const fetchLastSynq = async () => {
      const ref = doc(
        db,
        "users",
        user.uid,
        "friends",
        friendId as string
      );

      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        if (data.lastSynqAt?.toDate) {
          setLastSynq(data.lastSynqAt.toDate());
        }
      }
    };

    fetchLastSynq();
  }, [friendId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  if (!friend) return null;

  const city = friend.city?.trim();
  const state = friend.state?.trim();
  const locationText =
    friend.location || [city, state].filter(Boolean).join(", ");

  const removeFriend = async () => {
    const user = auth.currentUser;
    if (!user || !friendId) return;

    try {
      await deleteDoc(
        doc(db, "users", user.uid, "friends", friendId as string)
      );

      router.back();
    } catch (e) {
      console.error("Failed to remove friend", e);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Icon name="chevron-back" size={22} color={TEXT} />
          </TouchableOpacity>
        </View>
        <View style={styles.header}>
          <Image
            source={{
              uri:
                friend.imageurl ||
                "https://www.gravatar.com/avatar/?d=mp",
            }}
            style={styles.avatar}
          />

          <Text style={styles.name}>
            {friend.displayName || "User"}
          </Text>

          {locationText && (
            <View style={styles.locationRow}>
              <Icon name="location-outline" size={14} color={MUTED2} />
              <Text style={styles.locationText}>{locationText}</Text>
            </View>
          )}

          {lastSynq && (
            <Text style={styles.lastSynqText}>
              Last synq: {formatLastSynq(lastSynq)}
            </Text>
          )}
        </View>

        {mutualFriends.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mutual Friends</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.synqsContainer}
            >
              {mutualFriends.map((item) => {
                const scale = new Animated.Value(1);

                return (
                  <View key={item.id} style={styles.connItem}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPressIn={() =>
                        Animated.spring(scale, {
                          toValue: 0.92,
                          useNativeDriver: true,
                        }).start()
                      }
                      onPressOut={() =>
                        Animated.spring(scale, {
                          toValue: 1,
                          useNativeDriver: true,
                        }).start()
                      }
                      onPress={() =>
                        router.push({
                          pathname: "/friend-profile",
                          params: { friendId: item.id },
                        })
                      }
                    >
                      <Animated.View
                        style={[
                          styles.imageCircle,
                          { transform: [{ scale }] },
                        ]}
                      >
                        {item.imageurl ? (
                          <Image
                            source={{ uri: item.imageurl }}
                            style={styles.connImg}
                          />
                        ) : (
                          <View style={styles.connDefaultAvatar}>
                            <Icon
                              name="person"
                              size={22}
                              color="rgba(255,255,255,0.2)"
                            />
                          </View>
                        )}
                      </Animated.View>
                    </TouchableOpacity>

                    <Text style={styles.connName} numberOfLines={1}>
                      {item.displayName?.split(" ")[0] || "User"}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.interestsWrapper}>
            {friend.interests?.length ? (
              friend.interests.map((interest: string, i: number) => (
                <View key={i} style={styles.pill}>
                  <Text style={styles.pillText}>{interest}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>
                No interests listed
              </Text>
            )}
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Memo</Text>

          <MonthlyMemoReadOnly
            events={friend.events || []}
            ACCENT={ACCENT}
            fonts={fonts}
          />
        </View>

        <View style={{ marginTop: 30, marginBottom: 40, alignItems: "center" }}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.removeFriendBtn}
            onPress={() => setShowRemoveModal(true)}
          >
            <Text style={styles.removeFriendText}>Remove Friend</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <ConfirmModal
        visible={showRemoveModal}
        title="Remove Friend"
        message={`Are you sure you want to remove ${friend.displayName} as a friend?`}
        confirmText="Remove"
        destructive
        onCancel={() => setShowRemoveModal(false)}
        onConfirm={async () => {
          setShowRemoveModal(false);
          await removeFriend();
        }}
      />
    </SafeAreaView>
  );

}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  container: { flex: 1, paddingHorizontal: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  topBar: { marginTop: 6, marginBottom: 10 },

  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: "center",
    alignItems: "center",
  },

  header: { alignItems: "center", marginTop: 10 },

  avatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: ACCENT,
    marginBottom: 16,
  },

  name: {
    color: TEXT,
    fontSize: 26,
    fontFamily: fonts.heavy,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

  locationText: {
    color: MUTED2,
    marginLeft: 4,
    fontFamily: fonts.book,
    fontSize: 16,
  },

  lastSynqText: {
    color: "rgba(255,255,255,0.4)",
    marginTop: 6,
    fontFamily: fonts.medium,
    fontSize: 13,
  },

  section: { marginTop: 30 },

  sectionTitle: {
    color: TEXT,
    fontSize: 20,
    fontFamily: fonts.heavy,
    marginBottom: 15,
  },

  synqsContainer: {
    flexDirection: "row",
    gap: 20,
  },

  connItem: {
    alignItems: "center",
    width: 80,
  },

  imageCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
  },

  connImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },

  connDefaultAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },

  connName: {
    color: TEXT,
    fontSize: 12,
    marginTop: 10,
    textAlign: "center",
    fontFamily: fonts.heavy,
  },

  interestsWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  pill: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  pillText: {
    color: TEXT,
    fontSize: 13,
    fontFamily: fonts.book,
  },
  emptyText: {
    color: MUTED2,
    fontStyle: "italic",
  },
  removeFriendBtn: {
    borderWidth: 1,
    borderColor: "#ff453a",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,69,58,0.08)",
  },

  removeFriendText: {
    color: "#ff453a",
    fontFamily: fonts.heavy,
    fontSize: 15,
  },
  memoCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    padding: 16,
  },

  memoText: {
    color: TEXT,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.medium,
  },
});