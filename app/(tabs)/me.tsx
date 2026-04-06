import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  fonts,
  Friend,
  MODAL_RADIUS,
  MUTED,
  MUTED2,
  RADIUS_LG,
  SURFACE,
  TEXT,
} from "@/constants/Variables";
import { useIsFocused } from "@react-navigation/native";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
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
  friendRelationCacheByUser,
  friendsListCacheByUser,
  pruneSocialCachesToFriendIds,
  warmFriendsAndConnectionsCache,
} from "../../src/lib/socialCache";
import AlertModal from "../alert-modal";
import ConfirmModal from "../confirm-modal";
import { formatLastSynq, prefetchResolvedAvatar, resolveAvatar } from "../helpers";
import MonthlyMemo from "../monthly-memo";

const allActivities = Object.values(presetActivities).flat();

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
  const cachedFriendsForNames = myId ? friendsListCacheByUser[myId] ?? [] : [];
  const [friendsForHostNames, setFriendsForHostNames] = useState<Friend[]>(cachedFriendsForNames);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isQRExpanded, setQRExpanded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
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
    friendsForHostNames.forEach((f) => {
      const name = (f.displayName || "").trim();
      if (f.id && name) m[f.id] = name;
    });
    return m;
  }, [myId, friendsForHostNames]);

  const recentSynqRows = useMemo(() => {
    if (!myId) return [];
    const rel = friendRelationCacheByUser[myId];
    if (!rel) return [];
    const toDate = (raw: unknown): Date | null => {
      if (raw == null) return null;
      try {
        const d =
          typeof (raw as { toDate?: () => Date }).toDate === "function"
            ? (raw as { toDate: () => Date }).toDate()
            : new Date(raw as string | number);
        return Number.isNaN(d.getTime()) ? null : d;
      } catch {
        return null;
      }
    };
    const rows: { friend: Friend; at: Date }[] = [];
    for (const f of friendsForHostNames) {
      const d = toDate(rel[f.id]?.lastSynqAt);
      if (!d) continue;
      rows.push({ friend: f, at: d });
    }
    rows.sort((a, b) => b.at.getTime() - a.at.getTime());
    return rows.slice(0, 3);
  }, [myId, friendsForHostNames]);

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

      try {
        await warmFriendsAndConnectionsCache(myId);
        setFriendsForHostNames(friendsListCacheByUser[myId] ?? []);
      } catch (e) {
        console.error("[ProfileScreen] warmFriendsAndConnectionsCache:", e);
      }
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

      <View style={styles.heroOuter}>
        {/** Flat screen BG — green comes only from flare layers below (no top band). */}
        <View style={styles.heroGradient}>
          {/**
           * Cool teal “studio” light — deep base + hint of brand green (not candy mint).
           * Kept to upper-right so it never reads as a top banner.
           */}
          <LinearGradient
            pointerEvents="none"
            colors={[
              "rgba(14, 42, 32, 0.65)",
              "rgba(0, 255, 133, 0.07)",
              "rgba(0, 255, 133, 0.02)",
              "transparent",
            ]}
            locations={[0, 0.1, 0.24, 1]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.1, y: 0.72 }}
            style={[styles.heroFlareLayer, { opacity: 0.5 }]}
          />
          {/* Single bloom — high in the hero only (no blobs straddling the fold) */}
          <View pointerEvents="none" style={[styles.heroFlareBlob, styles.heroFlareBlobA]} />
          <LinearGradient
            pointerEvents="none"
            colors={["transparent", "rgba(0, 0, 0, 0.06)"]}
            locations={[0.55, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.heroSheen}
          />
          {/** Feather to screen BG — removes hard clip where hero meets Recent Synqs */}
          <LinearGradient
            pointerEvents="none"
            colors={["transparent", BG]}
            locations={[0, 1]}
            style={styles.heroBottomFeather}
          />

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

            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={() => router.push("/edit-profile")}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
            >
              <Icon name="create-outline" size={15} color={ACCENT} />
              <Text style={styles.editProfileBtnText}>Edit profile</Text>
            </TouchableOpacity>
          </View>

          {memo.trim() !== "" && (
            <View style={styles.memoRow}>
              <View style={styles.memoContainer}>
                <Text style={styles.profileMemoText}>{memo.trim()}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View style={styles.sectionAfterHero}>
        <Text style={styles.sectionTitle}>Recent Synqs</Text>
        {recentSynqRows.length > 0 ? (
          <View style={styles.synqsContainer}>
            {recentSynqRows.map(({ friend, at }, i) => {
              const firstName =
                String(friend.displayName || "Friend")
                  .trim()
                  .split(/\s+/)[0] || "Friend";
              return (
                <View key={friend.id} style={styles.connItem}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() =>
                      router.push({
                        pathname: "/friend-profile",
                        params: { friendId: friend.id },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${firstName}, last Synq ${formatLastSynq(at)}`}
                  >
                    <View style={styles.imageCircle}>
                      <ExpoImage
                        source={{ uri: resolveAvatar(friend.imageurl) }}
                        style={styles.connImg}
                        cachePolicy="memory-disk"
                        transition={0}
                      />
                      {i === 0 && (
                        <View style={styles.crown}>
                          <Icon name="star" size={8} color="black" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.connName} numberOfLines={1}>
                    {firstName}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.recentSynqEmpty}>
            <Text style={styles.recentSynqEmptyText}>
              {friendsForHostNames.length === 0
                ? "Add friends to see recent Synqs here."
                : "No Synqs yet — connect from the home tab and your history will show up."}
            </Text>
            <TouchableOpacity
              style={styles.recentSynqEmptyCta}
              onPress={() => router.push("/(tabs)/friends")}
              accessibilityRole="button"
              accessibilityLabel="Open friends"
            >
              <Text style={styles.recentSynqEmptyCtaText}>Friends</Text>
              <Icon name="chevron-forward" size={14} color={ACCENT} />
            </TouchableOpacity>
          </View>
        )}
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
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Interests</Text>
        {interests.length === 0 ? (
          <View style={styles.interestsEmpty}>
            <Text style={styles.interestsEmptyText}>
              Add a few interests so friends know what you are into.
            </Text>
            <TouchableOpacity onPress={() => setShowInputModal(true)} style={styles.interestsEmptyCta}>
              <Text style={styles.interestsEmptyCtaText}>Add interests</Text>
              <Icon name="chevron-forward" size={16} color={ACCENT} />
            </TouchableOpacity>
          </View>
        ) : (
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
        )}
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
  heroOuter: { marginHorizontal: -20, marginTop: 0 },
  heroGradient: {
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingBottom: 8,
    overflow: "hidden",
    position: "relative",
  },
  heroFlareLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 1,
  },
  heroFlareBlob: {
    position: "absolute",
    borderRadius: 9999,
    zIndex: 1,
  },
  /** Upper-right only — kept away from bottom edge to avoid fold clipping */
  heroFlareBlobA: {
    width: 280,
    height: 280,
    top: -88,
    right: -108,
    backgroundColor: "rgba(0, 200, 130, 0.055)",
  },
  heroSheen: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 1,
  },
  heroBottomFeather: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 52,
    zIndex: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 88,
    alignItems: "flex-start",
    zIndex: 2,
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
  profileSection: { alignItems: "center", marginTop: 4, zIndex: 3 },
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
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  editProfileBtnText: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  /** Matches friends tab Top Synqs horizontal row */
  synqsContainer: { flexDirection: "row", justifyContent: "flex-start", gap: 14 },
  connItem: { alignItems: "center", width: 72 },
  imageCircle: {
    width: 55,
    height: 55,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  connImg: { width: 55, height: 55, borderRadius: 50, backgroundColor: "#222" },
  crown: {
    position: "absolute",
    bottom: -1,
    right: -1,
    backgroundColor: ACCENT,
    padding: 2,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "black",
    zIndex: 10,
  },
  connName: {
    color: TEXT,
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
    fontFamily: fonts.heavy,
  },
  recentSynqEmpty: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  recentSynqEmptyText: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.medium,
    textAlign: "center",
  },
  recentSynqEmptyCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 10,
  },
  recentSynqEmptyCtaText: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  memoRow: {
    marginTop: 6,
    alignSelf: "stretch",
    alignItems: "center",
    zIndex: 3,
  },
  memoContainer: {
    maxWidth: 240,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  profileMemoText: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    fontFamily: fonts.medium,
  },
  /** First block after hero — tight to Edit profile; no top rule. */
  sectionAfterHero: {
    marginTop: 4,
    paddingTop: 6,
  },
  /** Hairline + padding between Recent Synqs → Open plans → Interests. */
  section: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 20,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  interestsEmpty: {
    backgroundColor: SURFACE,
    borderRadius: RADIUS_LG,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  interestsEmptyText: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.medium,
    textAlign: "center",
  },
  interestsEmptyCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 14,
  },
  interestsEmptyCtaText: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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
  signOutBtn: { alignSelf: "center", marginTop: 20, paddingVertical: 14, paddingHorizontal: 60, borderRadius: BUTTON_RADIUS + 8, borderWidth: 1.5, borderColor: "#222", backgroundColor: "#0a0a0a" },
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
