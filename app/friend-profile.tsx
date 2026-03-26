import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  fonts,
  MODAL_RADIUS,
  MUTED2,
  SPACE_5,
  SURFACE,
  TEXT,
} from "@/constants/Variables";
import { Image as ExpoImage } from "expo-image";
import { auth, db } from "@/src/lib/firebase";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import {
  friendProfileCacheByUser,
  friendRelationCacheByUser,
  warmFriendsAndConnectionsCache,
} from "../src/lib/socialCache";
import AlertModal from "./alert-modal";
import ConfirmModal from "./confirm-modal";
import { formatLastSynq } from "./helpers";
import MonthlyMemoReadOnly from "./readonly-monthly-memo";

const isRemoteImageUri = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value);

export default function FriendProfile() {
  const { friendId, returnToAddFriends } = useLocalSearchParams<{
    friendId?: string;
    returnToAddFriends?: string;
  }>();
  const router = useRouter();
  const handleBack = () => {
    if (returnToAddFriends === "1") {
      router.replace({
        pathname: "/(tabs)/friends",
        params: { openAddFriends: "1" },
      });
      return;
    }
    router.back();
  };

  const viewerId = auth.currentUser?.uid ?? "";
  const friendKey = String(friendId || "");
  const cachedFriend =
    viewerId && friendKey
      ? friendProfileCacheByUser[viewerId]?.[friendKey] ?? null
      : null;
  const cachedLastSynq =
    viewerId && friendKey
      ? friendRelationCacheByUser[viewerId]?.[friendKey]?.lastSynqAt?.toDate?.() ?? null
      : null;

  const [friend, setFriend] = useState<any>(cachedFriend);
  const [mutualFriends, setMutualFriends] = useState<any[]>([]);
  const [lastSynq, setLastSynq] = useState<Date | null>(cachedLastSynq);
  const [loading, setLoading] = useState(!cachedFriend);
  const [isFriend, setIsFriend] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [joinedPlanKeys, setJoinedPlanKeys] = useState<Record<string, boolean>>({});
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const eventKey = (event: any) =>
    `${String(event?.title || "").trim().toLowerCase()}|${String(event?.date || "").trim()}|${String(
      event?.time || ""
    ).trim().toLowerCase()}|${String(event?.location || "").trim().toLowerCase()}`;

  const eventSortValue = (event: any) => {
    const date = String(event?.date || "");
    const [y, m, d] = date.split("-").map(Number);
    const base = new Date(
      Number.isFinite(y) ? y : 1970,
      Number.isFinite(m) ? m - 1 : 0,
      Number.isFinite(d) ? d : 1
    );
    const timeText = String(event?.time || "").trim();
    const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!timeMatch) return base.getTime();
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const period = timeMatch[3].toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    base.setHours(hours, minutes, 0, 0);
    return base.getTime();
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const hydrateJoinedPlans = async () => {
      try {
        const meSnap = await getDoc(doc(db, "users", user.uid));
        const meData = meSnap.exists() ? (meSnap.data() as any) : {};
        const mine = Array.isArray(meData?.events) ? meData.events : [];
        const next: Record<string, boolean> = {};
        mine.forEach((e: any) => {
          next[eventKey(e)] = true;
        });
        setJoinedPlanKeys(next);
      } catch {}
    };
    hydrateJoinedPlans();
  }, []);

  useEffect(() => {
    const fetchFriend = async () => {
      try {
        if (viewerId) {
          await warmFriendsAndConnectionsCache(viewerId);
          const warmed = friendProfileCacheByUser[viewerId]?.[friendKey];
          if (warmed) {
            setFriend(warmed);
            setLoading(false);
          }
        }
        const snap = await getDoc(doc(db, "users", friendKey));
        if (snap.exists()) {
          const data = snap.data();
          setFriend(data);
          if (viewerId) {
            if (!friendProfileCacheByUser[viewerId]) {
              friendProfileCacheByUser[viewerId] = {};
            }
            friendProfileCacheByUser[viewerId][friendKey] = {
              id: friendKey,
              ...(data as any),
            } as any;
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchFriend();
  }, [viewerId, friendKey]);

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
        friendKey
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
  }, [friendKey]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !friendKey) return;
    const checkRelationship = async () => {
      const myId = user.uid;
      try {
        const friendSnap = await getDoc(doc(db, "users", myId, "friends", friendKey));
        setIsFriend(friendSnap.exists());
        if (!friendSnap.exists()) {
          const pendingSnap = await getDoc(
            doc(db, "users", friendKey, "friendRequests", myId)
          );
          setRequestSent(pendingSnap.exists());
        } else {
          setRequestSent(false);
        }
      } catch {
        setIsFriend(false);
      }
    };
    checkRelationship();
  }, [friendKey]);

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

  const addFriend = async () => {
    const user = auth.currentUser;
    if (!user || !friendKey) return;
    setActionLoading(true);
    try {
      const meSnap = await getDoc(doc(db, "users", user.uid));
      const meData = meSnap.exists() ? (meSnap.data() as any) : {};
      const senderName = meData?.displayName || user.displayName || "Someone";
      const senderImageUrl = meData?.imageurl || null;
      await setDoc(doc(db, "users", friendKey, "friendRequests", user.uid), {
        from: user.uid,
        to: friendKey,
        senderName,
        senderImageUrl,
        status: "pending",
        sentAt: serverTimestamp(),
      });
      setRequestSent(true);
    } catch (e) {
      console.error("Failed to send friend request", e);
    } finally {
      setActionLoading(false);
    }
  };

  const joinPlan = async (event: {
    id: string;
    date: string;
    title: string;
    time?: string;
    location?: string;
    joinedFromId?: string;
    joinedFromIds?: string[];
    joinedFromName?: string;
    joinedFromNames?: string[];
  }) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const meRef = doc(db, "users", user.uid);
      const meSnap = await getDoc(meRef);
      const meData = meSnap.exists() ? (meSnap.data() as any) : {};
      const existingEvents = Array.isArray(meData?.events) ? meData.events : [];
      const joinerName =
        String(meData?.displayName || auth.currentUser?.displayName || "Friend").trim();
      const profileName = String(friend?.displayName || "Friend").trim();
      const initialSourceIds = Array.from(
        new Set(
          [
            ...((Array.isArray(event?.joinedFromIds) ? event.joinedFromIds : []).filter(Boolean) as string[]),
            String(event?.joinedFromId || "").trim(),
            friendKey,
            user.uid,
          ]
            .map((id) => String(id).trim())
            .filter(Boolean)
        )
      );
      const sourceNames = Array.from(
        new Set(
          [
            ...((Array.isArray(event?.joinedFromNames) ? event.joinedFromNames : []).filter(Boolean) as string[]),
            String(event?.joinedFromName || "").trim(),
            profileName,
            joinerName,
          ]
            .map((n) => n.trim())
            .filter(Boolean)
        )
      );
      // Backfill attendee IDs from names (older plans may only have names),
      // so propagation includes everyone consistently.
      const sourceIdsSet = new Set(initialSourceIds);
      const sourceNameSet = new Set(sourceNames.map((n) => n.toLowerCase()));
      try {
        const myFriendsSnap = await getDocs(collection(db, "users", user.uid, "friends"));
        myFriendsSnap.docs.forEach((d) => {
          const data = d.data() as any;
          const display = String(data?.displayName || "").trim().toLowerCase();
          if (display && sourceNameSet.has(display)) {
            sourceIdsSet.add(d.id);
          }
        });
      } catch {}
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        usersSnap.docs.forEach((u) => {
          const display = String((u.data() as any)?.displayName || "")
            .trim()
            .toLowerCase();
          if (display && sourceNameSet.has(display)) {
            sourceIdsSet.add(u.id);
          }
        });
      } catch {}
      const sourceIds = Array.from(sourceIdsSet);

      const displayNameById: Record<string, string> = {};
      await Promise.all(
        sourceIds.map(async (uid) => {
          try {
            const s = await getDoc(doc(db, "users", uid));
            if (s.exists()) {
              displayNameById[uid] = String((s.data() as any)?.displayName || "").trim();
            }
          } catch {}
        })
      );

      const syncAttendeesAcrossUsers = async (allAttendeeIds: string[]) => {
        await Promise.all(
          allAttendeeIds.map(async (attendeeId) => {
            try {
              const attendeeRef = doc(db, "users", attendeeId);
              const attendeeSnap = await getDoc(attendeeRef);
              if (!attendeeSnap.exists()) return;
              const attendeeData = attendeeSnap.data() as any;
              const attendeeEvents = Array.isArray(attendeeData?.events) ? attendeeData.events : [];
              let changed = false;
              const nextAttendeeEvents = attendeeEvents.map((e: any) => {
                if (eventKey(e) !== eventKey(event)) return e;
                const existingIds = Array.isArray(e?.joinedFromIds)
                  ? e.joinedFromIds
                  : [e?.joinedFromId].filter(Boolean);
                const mergedIds = Array.from(
                  new Set(
                    [...existingIds, ...allAttendeeIds]
                      .map((id: string) => String(id).trim())
                      .filter(Boolean)
                  )
                );
                const otherNames = mergedIds
                  .filter((id) => id !== attendeeId)
                  .map((id) => displayNameById[id])
                  .filter(Boolean);
                const prevNames = Array.isArray(e?.joinedFromNames)
                  ? e.joinedFromNames
                  : [e?.joinedFromName].filter(Boolean);
                const idsChanged = mergedIds.join("|") !== existingIds.join("|");
                const namesChanged = otherNames.join("|") !== prevNames.join("|");
                if (!idsChanged && !namesChanged) return e;
                changed = true;
                return {
                  ...e,
                  joinedFromIds: mergedIds,
                  joinedFromId: mergedIds[0] || "",
                  joinedFromNames: otherNames,
                  joinedFromName: otherNames.join(", "),
                };
              });
              if (changed) {
                await updateDoc(attendeeRef, { events: nextAttendeeEvents });
              }
            } catch {}
          })
        );
      };

      const exists = existingEvents.some((e: any) => eventKey(e) === eventKey(event));
      if (exists) {
        const updatedExistingEvents = existingEvents.map((e: any) => {
          if (eventKey(e) !== eventKey(event)) return e;
          const existingNames = Array.isArray(e?.joinedFromNames)
            ? e.joinedFromNames
            : [e?.joinedFromName].filter(Boolean);
          const mergedNames = Array.from(
            new Set([...existingNames, ...sourceNames].map((n: string) => String(n).trim()).filter(Boolean))
          );
          if (mergedNames.length === existingNames.length) return e;
          return {
            ...e,
            joinedFromIds: sourceIds,
            joinedFromId: sourceIds[0] || "",
            joinedFromNames: mergedNames,
            joinedFromName: mergedNames.join(", "),
          };
        });
        await updateDoc(meRef, { events: updatedExistingEvents });
        await syncAttendeesAcrossUsers(sourceIds);
        setJoinedPlanKeys((prev) => ({ ...prev, [eventKey(event)]: true }));
        showAlert("Updated", "Added this friend to the same joined plan.");
        return;
      }

      const newEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: String(event.title || "").trim(),
        date: String(event.date || "").trim(),
        time: String(event.time || "").trim(),
        location: String(event.location || "").trim(),
        joinedFromId: friendKey,
        joinedFromIds: sourceIds,
        joinedFromName: sourceNames.join(", "),
        joinedFromNames: sourceNames,
      };

      const nextEvents = [...existingEvents, newEvent].sort(
        (a: any, b: any) => eventSortValue(a) - eventSortValue(b)
      );

      await updateDoc(meRef, {
        events: nextEvents,
      });
      await syncAttendeesAcrossUsers(sourceIds);

      setJoinedPlanKeys((prev) => ({ ...prev, [eventKey(event)]: true }));
      showAlert("Added", "Plan added to your open plans.");
    } catch (e: any) {
      showAlert("Error", e?.message || "Could not join this plan right now.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Icon name="chevron-back" size={22} color={TEXT} />
          </TouchableOpacity>
        </View>
        <View style={styles.header}>
          {isRemoteImageUri(friend.imageurl) ? (
            <ExpoImage
              source={{ uri: friend.imageurl }}
              style={styles.avatar}
              cachePolicy="memory-disk"
              transition={0}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Icon name="person" size={56} color="rgba(255,255,255,0.28)" />
            </View>
          )}

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
                        {isRemoteImageUri(item.imageurl) ? (
                          <ExpoImage
                            source={{ uri: item.imageurl }}
                            style={styles.connImg}
                            cachePolicy="memory-disk"
                            transition={0}
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
          <Text style={styles.sectionTitle}>Open plans</Text>

          <MonthlyMemoReadOnly
            events={friend.events || []}
            ACCENT={ACCENT}
            fonts={fonts}
            onPressPlan={joinPlan}
            isPlanJoined={(event) => !!joinedPlanKeys[eventKey(event)]}
          />
        </View>

        <View style={{ marginTop: SPACE_5, marginBottom: 40, alignItems: "center" }}>
          {isFriend ? (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.removeFriendBtn}
              onPress={() => setShowRemoveModal(true)}
            >
              <Text style={styles.removeFriendText}>Remove Friend</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.addFriendBtn, requestSent && styles.addFriendBtnDisabled]}
              onPress={addFriend}
              disabled={requestSent || actionLoading}
            >
              <Text style={styles.addFriendText}>
                {requestSent ? "Pending" : actionLoading ? "Sending..." : "Add Friend"}
              </Text>
            </TouchableOpacity>
          )}
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
      <AlertModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
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
  avatarFallback: {
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
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

  section: { marginTop: SPACE_5 },

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
    width: 78,
    height: 78,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: BORDER,
    justifyContent: "center",
    alignItems: "center",
  },

  connImg: {
    width: 70,
    height: 70,
    borderRadius: 34,
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
    fontSize: 14,
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
    borderRadius: BUTTON_RADIUS,
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
  addFriendBtn: {
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 14,
    paddingHorizontal: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(125,255,166,0.08)",
  },
  addFriendBtnDisabled: {
    opacity: 0.55,
  },
  addFriendText: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: 15,
  },
  memoCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: MODAL_RADIUS - 4,
    padding: 16,
  },

  memoText: {
    color: TEXT,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.medium,
  },
});