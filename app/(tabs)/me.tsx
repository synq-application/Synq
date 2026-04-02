import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  fonts,
  MODAL_RADIUS,
  MUTED,
  MUTED2,
  SURFACE,
  TEXT,
} from "@/constants/Variables";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { signOut as firebaseSignOut } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import Icon from "react-native-vector-icons/Ionicons";
import { presetActivities, stateAbbreviations } from "../../assets/Mocks";
import { auth, db, storage } from "../../src/lib/firebase";
import { matchesPlanEvent } from "../../src/lib/planEvents";
import { reconcileHostOpenPlansFromFriends } from "../../src/lib/reconcileHostOpenPlans";
import {
  connectionProfileCacheByUser,
  connectionsCacheByUser,
  pruneSocialCachesToFriendIds,
  warmFriendsAndConnectionsCache,
} from "../../src/lib/socialCache";
import AlertModal from "../alert-modal";
import ConfirmModal from "../confirm-modal";
import { prefetchResolvedAvatar, resolveAvatar } from "../helpers";
import MonthlyMemo from "../monthly-memo";

const allActivities = Object.values(presetActivities).flat();

type Connection = {
  id: string;
  name: string;
  imageUrl: string | null;
  synqCount: number;
};
export default function ProfileScreen() {
  const isFocused = useIsFocused();
  const scrollRef = useRef<ScrollView>(null);
  const params = useLocalSearchParams<{ focusEventId?: string | string[] }>();
  const focusEventIdRaw = params.focusEventId;
  const focusEventId =
    typeof focusEventIdRaw === "string"
      ? focusEventIdRaw
      : Array.isArray(focusEventIdRaw)
        ? focusEventIdRaw[0]
        : undefined;

  const [planHighlightId, setPlanHighlightId] = useState<string | null>(null);

  const myId = auth.currentUser?.uid ?? "";
  const cachedConnections = myId ? connectionsCacheByUser[myId] ?? [] : [];
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isQRExpanded, setQRExpanded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [connections, setConnections] = useState<Connection[]>(cachedConnections);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [hasLoadedConnections, setHasLoadedConnections] = useState(cachedConnections.length > 0);
  const [requestCount, setRequestCount] = useState(0);
  const [events, setEvents] = useState<
    { id: string; date: string; title: string; time?: string; location?: string }[]
  >([]);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [pendingInterestDelete, setPendingInterestDelete] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const [showEventModal, setShowEventModal] = useState(false);

  useEffect(() => {
    const id = typeof focusEventId === "string" ? focusEventId.trim() : "";
    if (!id) return;
    setPlanHighlightId(id);
    const t = setTimeout(() => setPlanHighlightId(null), 12000);
    return () => clearTimeout(t);
  }, [focusEventId]);

  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
  });

  const hostDisplayNameByUid = useMemo(() => {
    const m: Record<string, string> = {};
    if (myId) {
      const selfName = auth.currentUser?.displayName?.trim();
      if (selfName) m[myId] = selfName;
    }
    connections.forEach((c) => {
      if (c.id && c.name) m[c.id] = c.name;
    });
    return m;
  }, [myId, connections]);

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const saveEvent = async (eventOverride?: any) => {
    if (!auth.currentUser) return;

    const eventToSave = eventOverride || newEvent;

    if (!eventToSave.title) {
      showAlert("Missing info", "Add a title");
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      date: eventToSave.date,
      title: eventToSave.title,
      time: eventToSave.time || "",
      location: eventToSave.location || "",
      planHostUid: auth.currentUser.uid,
    };

    const updatedEvents = [...events, newItem];

    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        events: updatedEvents,
      });

      setShowEventModal(false);
      setNewEvent({ title: "", date: "", time: "", location: "" });
    } catch (e) {
      showAlert("Error", "Could not save event.");
    }
  };

  const deleteEvent = async (id: string) => {
    if (!auth.currentUser) return;

    const toRemove = events.find((e) => e.id === id);
    if (!toRemove) return;

    const myUid = auth.currentUser.uid;
    const attendeeIds = new Set<string>();
    attendeeIds.add(myUid);
    const host = String((toRemove as any).planHostUid || "").trim();
    if (host) attendeeIds.add(host);
    for (const raw of [
      ...((Array.isArray((toRemove as any).joinedFromIds) ? (toRemove as any).joinedFromIds : []) as string[]),
      (toRemove as any).joinedFromId,
    ].filter(Boolean)) {
      attendeeIds.add(String(raw).trim());
    }

    const removeFromUserCalendar = async (uid: string) => {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return false;
      const evs = (snap.data() as any).events || [];
      const next = evs.filter((e: any) => !matchesPlanEvent(e, toRemove, evs));
      if (next.length === evs.length) return true;
      await updateDoc(ref, { events: next });
      return true;
    };

    try {
      // Always prioritize removing from my own calendar so UX reflects the action I took.
      await removeFromUserCalendar(myUid);
    } catch (e) {
      showAlert("Error", "Could not delete event.");
      return;
    }

    const otherAttendeeIds = [...attendeeIds].filter((uid) => uid !== myUid);
    await Promise.allSettled(
      otherAttendeeIds.map((uid) => removeFromUserCalendar(uid))
    );
  };

  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    const myId = auth.currentUser.uid;
    if (!connectionProfileCacheByUser[myId]) {
      connectionProfileCacheByUser[myId] = {};
    }

    const userDocRef = doc(db, "users", myId);

    const unsubscribeProfile = onSnapshot(userDocRef, (userDocSnap) => {
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        setCity(userData.city || null);
        const stateAbbr = stateAbbreviations[userData.state] || userData.state || null;
        setState(stateAbbr);
        setEvents(userData.events || []);
        setInterests(userData.interests || []);
        setSelectedInterests(userData.interests || []);
        setProfileImage(userData?.imageurl || null);
        setMemo(typeof userData.memo === "string" ? userData.memo : "");
        prefetchResolvedAvatar(userData?.imageurl);
      }
    });

    const reqRef = collection(db, "users", myId, "friendRequests");
    const unsubscribeRequests = onSnapshot(reqRef, (snap) => {
      setRequestCount(snap.docs.length);
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        const senderId = data.from || data.fromId || d.id;
        const inline =
          data.senderImageUrl || data.fromImageUrl || data.fromImageurl || data.imageurl;
        prefetchResolvedAvatar(inline);
        const hasHttp =
          typeof inline === "string" && inline.trim().startsWith("http");
        if (!hasHttp && senderId) {
          getDoc(doc(db, "users", senderId))
            .then((u) => {
              if (u.exists()) prefetchResolvedAvatar((u.data() as any)?.imageurl);
            })
            .catch(() => {});
        }
      });
    });

    const friendsCol = collection(db, "users", myId, "friends");
    const unsubscribeFriends = onSnapshot(friendsCol, async (snapshot) => {
      const friendIds = new Set(snapshot.docs.map((d) => d.id));
      pruneSocialCachesToFriendIds(myId, friendIds);

      const profileCache = connectionProfileCacheByUser[myId];
      const friendDocs = snapshot.docs.map((friendDoc) => ({
        id: friendDoc.id,
        synqCount: friendDoc.data().synqCount || 0,
      }));

      const cachedVisible = friendDocs
        .map(({ id, synqCount }) => {
          const cached = profileCache[id];
          if (!cached) return null;
          return { ...cached, synqCount } as Connection;
        })
        .filter(Boolean) as Connection[];

      if (cachedVisible.length > 0) {
        setConnections(cachedVisible.sort((a, b) => b.synqCount - a.synqCount));
        setHasLoadedConnections(true);
      }
      await warmFriendsAndConnectionsCache(myId);
      const validFriends = friendDocs
        .map(({ id, synqCount }) => {
          const profile = profileCache[id];
          if (!profile) return null;
          return {
            ...profile,
            synqCount,
          } as Connection;
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.synqCount - a.synqCount) as Connection[];
      connectionsCacheByUser[myId] = validFriends;
      setConnections(validFriends);
      setHasLoadedConnections(true);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeRequests();
      unsubscribeFriends();
    };
  }, []);

  /** Merge attendee names from friends' copies of your plans (works even if rules block joiner from updating your doc). */
  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    const myUid = auth.currentUser.uid;
    const t = setTimeout(() => {
      reconcileHostOpenPlansFromFriends(myUid).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [events]);

  const filteredActivities = useMemo(
    () =>
      allActivities.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [searchQuery]
  );

  const handleDeleteInterest = (interestName: string) => {
    setPendingInterestDelete(interestName);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0].uri) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    if (!auth.currentUser) return;

    setIsUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `profiles/${auth.currentUser.uid}`);
      const uploadTask = await uploadBytesResumable(storageRef, blob);
      const url = await getDownloadURL(uploadTask.ref);

      await updateDoc(doc(db, "users", auth.currentUser.uid), { imageurl: url });
      setProfileImage(url);
    } catch (e) {
      showAlert("Error", "Could not upload image.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSignOut = () => {
    setShowSignOutConfirm(true);
  };

  const saveInterests = async () => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        interests: selectedInterests,
      });
      setShowInputModal(false);
      setSearchQuery("");
    } catch (e) {
      showAlert("Error", "Could not save interests.");
    }
  };

  /** Deep link so any phone camera / QR app can open Synq to this profile (requires Synq installed). */
  const profileQrUrl = useMemo(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return "";
    return Linking.createURL("/friend-profile", {
      queryParams: { friendId: uid },
    });
  }, [auth.currentUser?.uid]);

  const locationLower =
    city && state ? `${city}, ${state}` : null;

  useEffect(() => {
    if (isFocused) return;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [isFocused]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScrollBeginDrag={Keyboard.dismiss}
    >
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconContainer}
          onPress={() => router.push("/notifications")}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Icon name="notifications-outline" size={26} color="white" />
          {requestCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{requestCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerIconContainer}
          onPress={() => router.push("/settings")}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Icon name="settings-outline" size={26} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        <View style={styles.qrContainer}>
          <View style={styles.qrBg}>
            {profileQrUrl ? (
              <QRCode
                value={profileQrUrl}
                size={160}
                color="black"
                backgroundColor="white"
              />
            ) : (
              <View style={{ width: 160, height: 160, backgroundColor: "#eee" }} />
            )}
          </View>

          <View style={styles.avatarGlowWrap}>
            <TouchableOpacity onPress={pickImage} style={styles.imageWrapper} disabled={isUploading}>
              <ExpoImage
                source={{ uri: resolveAvatar(profileImage) }}
                style={styles.profileImg}
                cachePolicy="memory-disk"
                transition={0}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => setQRExpanded(true)} style={styles.qrToggle}>
            <Icon name="qr-code-outline" size={13} color="black" />
          </TouchableOpacity>
        </View>

        <Text style={styles.nameText}>{auth.currentUser?.displayName}</Text>

        {locationLower && (
          <View style={styles.locationRow}>
            <Icon
              name="location-outline"
              size={18}
              color="rgba(255,255,255,0.35)"
              style={styles.locationIcon}
            />
            <Text style={styles.locationText}>{locationLower}</Text>
          </View>
        )}

        {memo.trim() !== "" && (
          <Text style={styles.profileMemoText}>{memo.trim()}</Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Top Synqs</Text>
          <TouchableOpacity
            style={styles.sectionInfoBtn}
            onPress={() => {
              showAlert(
                "Top Synqs",
                "Your top Synqs are the people you connect with the most!"
              );
            }}
            accessibilityRole="button"
            accessibilityLabel="About top synqs"
          >
            <Icon name="information-circle-outline" size={18} color="#444" />
          </TouchableOpacity>
        </View>

        <View style={styles.synqsContainer}>
          {!hasLoadedConnections ? (
            [0, 1, 2].map((i) => (
              <View key={i} style={styles.connItem}>
                <View
                  style={[
                    styles.imageCircle,
                    {
                      borderColor: "#222",
                      borderWidth: 2,
                      backgroundColor: "#151515",
                    },
                  ]}
                />
                <View
                  style={{
                    height: 10,
                    width: 46,
                    backgroundColor: "#1f1f1f",
                    borderRadius: 6,
                    marginTop: 6,
                  }}
                />
              </View>
            ))
          ) : connections.length > 0 ? (
            connections.slice(0, 3).map((item, i) => (
              <View key={item.id || i} style={styles.connItem}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: "/friend-profile",
                      params: { friendId: item.id },
                    })
                  }
                >
                  <View
                    style={[
                      styles.imageCircle,
                      { borderColor: ACCENT, borderWidth: 1 },
                    ]}
                  >
                    <ExpoImage
                      source={{ uri: resolveAvatar(item.imageUrl) }}
                      style={styles.connImg}
                      cachePolicy="memory-disk"
                      transition={0}
                    />
                    {i === 0 && (
                      <View style={styles.crown}>
                        <Icon name="star" size={10} color="black" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                <Text style={styles.connName} numberOfLines={1}>
                  {item.name.split(" ")[0]}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              Start messaging to see your top synqs.
            </Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Interests</Text>
        <View style={styles.interestsWrapper}>
          {interests.map((interest, i) => (
            <TouchableOpacity
              key={i}
              style={styles.interestRect}
              onPress={() => handleDeleteInterest(interest)}
            >
              <Text style={styles.interestText}>{interest}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity onPress={() => setShowInputModal(true)} style={styles.addRect}>
            <Text style={styles.addRectText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.section}>
        <MonthlyMemo
          ACCENT={ACCENT}
          setShowEventModal={setShowEventModal}
          showEventModal={showEventModal}
          newEvent={newEvent}
          setNewEvent={setNewEvent}
          saveEvent={saveEvent}
          events={events}
          deleteEvent={deleteEvent}
          viewerUid={myId}
          hostDisplayNameByUid={hostDisplayNameByUid}
          highlightEventId={planHighlightId}
        />
      </View>

      <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Modal visible={isQRExpanded} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setQRExpanded(false)}
            accessibilityRole="button"
            accessibilityLabel="Close QR code"
          />
          <View style={styles.qrModalBox} pointerEvents="box-none">
            {profileQrUrl ? (
              <QRCode value={profileQrUrl} size={260} color="black" backgroundColor="white" />
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={showInputModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1, width: "100%" }}
            onPress={() => setShowInputModal(false)}
          />
          <View style={styles.interestContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>What are you into?</Text>
              <TouchableOpacity onPress={() => setShowInputModal(false)}>
                <Icon name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBarContainer}>
              <Icon name="search-outline" size={18} color="#666" style={{ marginLeft: 12 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search interests..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
            </View>

            <ScrollView
              contentContainerStyle={styles.interestGrid}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={Keyboard.dismiss}
            >
              {filteredActivities.map((item) => {
                const active = selectedInterests.includes(item.name);
                return (
                  <TouchableOpacity
                    key={item.name}
                    onPress={() =>
                      setSelectedInterests((prev) =>
                        active ? prev.filter((i) => i !== item.name) : [...prev, item.name]
                      )
                    }
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity onPress={saveInterests} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <AlertModal
  visible={alertVisible}
  title={alertTitle}
  message={alertMessage}
  onClose={() => setAlertVisible(false)}
/>
      <ConfirmModal
        visible={!!pendingInterestDelete}
        title="Remove Interest"
        message={
          pendingInterestDelete
            ? `Remove "${pendingInterestDelete}"?`
            : "Remove this interest?"
        }
        confirmText="Delete"
        destructive
        onCancel={() => setPendingInterestDelete(null)}
        onConfirm={async () => {
          if (!pendingInterestDelete || !auth.currentUser) return;
          const updatedInterests = interests.filter((i) => i !== pendingInterestDelete);
          await updateDoc(doc(db, "users", auth.currentUser.uid), {
            interests: updatedInterests,
          });
          setPendingInterestDelete(null);
        }}
      />
      <ConfirmModal
        visible={showSignOutConfirm}
        title="Sign Out"
        message="Are you sure?"
        confirmText="Sign Out"
        onCancel={() => setShowSignOutConfirm(false)}
        onConfirm={async () => {
          setShowSignOutConfirm(false);
          await firebaseSignOut(auth);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: { paddingBottom: 70, paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 88,
    alignItems: "flex-start",
  },
  headerIconContainer: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: -4,
    top: -4,
    backgroundColor: "red",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "black",
  },
  badgeText: { color: "white", fontSize: 10, fontFamily: fonts.black },
  profileSection: { alignItems: "center", marginTop: 4 },
  qrContainer: { width: 200, height: 200, justifyContent: "center", alignItems: "center" },
  qrBg: { position: "absolute", opacity: 0.4, backgroundColor: "white", borderRadius: 25, padding: 10 },
  avatarGlowWrap: {
    borderRadius: 84,
    shadowColor: ACCENT,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },
  imageWrapper: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: ACCENT,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  profileImg: { width: "100%", height: "100%" },
  qrToggle: { position: "absolute", bottom: 10, right: 10, backgroundColor: ACCENT, padding: 10, borderRadius: 25, zIndex: 2 },
  nameText: { color: ACCENT, fontSize: 26, fontFamily: fonts.heavy, letterSpacing: 0.2, marginTop: 10 },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  locationIcon: {
    marginRight: 5,
  },
  locationText: {
    color: MUTED2,
    fontSize: 16,
    marginTop: 2,
    letterSpacing: 1,
    fontFamily: fonts.medium,
  },
  profileMemoText: {
    color: MUTED,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
    paddingHorizontal: 16,
    textAlign: "center",
    fontFamily: fonts.medium,
    alignSelf: "stretch",
  },
  section: { marginTop: 20 },
  sectionTitle: { color: TEXT, fontSize: 21, fontFamily: fonts.heavy, marginBottom: 12, letterSpacing: 0.2 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sectionTitleInline: { marginBottom: 0 },
  sectionInfoBtn: { marginLeft: 6, paddingVertical: 0 },
  synqsContainer: { flexDirection: "row", justifyContent: "flex-start", gap: 20 },
  connItem: { alignItems: "center", width: 80 },
  imageCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", position: "relative" },
  connImg: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#222" },
  crown: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: ACCENT,
    padding: 3,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "black",
    zIndex: 10,
  },
  connName: { color: TEXT, fontSize: 14, marginTop: 10, textAlign: "center", fontFamily: fonts.heavy },
  emptyText: { color: MUTED2, fontFamily: fonts.medium, fontSize: 15 },
  interestsWrapper: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  interestRect: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: { color: TEXT, fontFamily: fonts.book, fontSize: 13 },
  addRect: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: ACCENT,
    borderStyle: "solid",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 8,
  },
  addRectText: { color: ACCENT, fontFamily: fonts.heavy, fontSize: 13 },
  signOutBtn: { alignSelf: "center", marginTop: 22, paddingVertical: 14, paddingHorizontal: 60, borderRadius: BUTTON_RADIUS + 8, borderWidth: 1.5, borderColor: "#222", backgroundColor: "#0a0a0a" },
  signOutText: { color: "#666", fontFamily: fonts.heavy, fontSize: 13, letterSpacing: 2, textTransform: "uppercase" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  qrModalBox: { backgroundColor: "white", padding: 25, borderRadius: MODAL_RADIUS + 18 },
  interestContent: { backgroundColor: "#0a0a0a", width: "100%", height: "85%", marginTop: "auto", borderTopLeftRadius: MODAL_RADIUS + 18, borderTopRightRadius: MODAL_RADIUS + 18, padding: 30, alignItems: "center" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", width: "100%", alignItems: "center", marginBottom: 25 },
  modalTitle: { color: TEXT, fontSize: 26, fontFamily: fonts.black },
  searchBarContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#1a1a1a", borderRadius: 18, width: "100%", marginBottom: 20, borderWidth: 1, borderColor: BORDER },
  searchInput: { flex: 1, color: TEXT, padding: 14, fontFamily: fonts.medium, fontSize: 16 },
  interestGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", paddingBottom: 30 },
  chip: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 30, backgroundColor: "#111", borderWidth: 1, borderColor: "#222", margin: 6 },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipText: { color: "#555", fontFamily: fonts.heavy },
  chipTextActive: { color: "black" },
  saveBtn: { backgroundColor: ACCENT, width: "100%", padding: 20, borderRadius: 22, marginBottom: 20, alignItems: "center" },
  saveBtnText: { color: "black", fontFamily: fonts.black, fontSize: 17 },
});
