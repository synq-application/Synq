import {
  ONBOARDING_DIVIDER_WIDTH,
  ONBOARDING_H_PADDING,
} from "@/constants/onboardingLayout";
import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  destructiveActionBtn,
  destructiveActionBtnText,
  fonts,
  Friend,
  MODAL_RADIUS,
  MUTED,
  MUTED2,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  profileScreenSectionTitle,
  SURFACE,
  TEXT,
} from "@/constants/Variables";
import { useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { signOut as firebaseSignOut } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { filterOrReject } from "@/src/lib/contentFilter";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  AppState,
  AppStateStatus,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import { presetActivities, stateAbbreviations } from "../../assets/Mocks";
import { auth, db, storage } from "../../src/lib/firebase";
import { filterOutPastOpenPlans, matchesPlanEvent } from "../../src/lib/planEvents";
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

type ProfilePressableProps = {
  onPress: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: "button";
  disabled?: boolean;
  haptic?: boolean;
  animatePress?: boolean;
};

function ProfilePressable({
  onPress,
  onLongPress,
  children,
  style,
  contentStyle,
  accessibilityLabel,
  accessibilityRole,
  disabled,
  haptic = true,
  animatePress = true,
}: ProfilePressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animatePress ? scale.value : 1 }],
  }));
  return (
    <Pressable
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole ?? "button"}
      onPress={() => {
        if (animatePress) {
          scale.value = withSpring(1, { damping: 16, stiffness: 380 });
        }
        if (haptic && !disabled) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
      }}
      onLongPress={
        onLongPress
          ? () => {
              if (haptic && !disabled) {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onLongPress();
            }
          : undefined
      }
      onPressIn={() => {
        if (!disabled && animatePress) {
          scale.value = withSpring(0.96, { damping: 16, stiffness: 380 });
        }
      }}
      onPressOut={() => {
        if (animatePress) {
          scale.value = withSpring(1, { damping: 16, stiffness: 380 });
        }
      }}
      style={style}
    >
      <Animated.View style={[animatedStyle, contentStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

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
  const [avatarRenderVersion, setAvatarRenderVersion] = useState(0);
  const [isQRExpanded, setQRExpanded] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [inviteCode, setInviteCode] = useState<string>("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  type OpenPlanEvent = {
    id: string;
    date: string;
    title: string;
    time?: string;
    location?: string;
    planHostUid?: string;
    joinedFromId?: string;
    joinedFromIds?: string[];
    joinedFromName?: string;
    joinedFromNames?: string[];
    joinedFromFriendUid?: string;
  };

  const [events, setEvents] = useState<OpenPlanEvent[]>([]);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [pendingInterestDelete, setPendingInterestDelete] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const resolvedProfileImage = useMemo(() => resolveAvatar(profileImage), [profileImage]);

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

    for (const field of [eventToSave.title, eventToSave.location]) {
      if (!field) continue;
      const check = filterOrReject(String(field));
      if (!check.ok) {
        showAlert("Content not allowed", check.reason);
        return;
      }
    }

    const newItem = {
      id: Date.now().toString(),
      date: eventToSave.date,
      title: eventToSave.title,
      time: eventToSave.time || "",
      location: eventToSave.location || "",
      planHostUid: auth.currentUser.uid,
    };

    const ref = doc(db, "users", auth.currentUser.uid);
    try {
      const snap = await getDoc(ref);
      const raw = snap.exists()
        ? (snap.data() as { events?: unknown }).events
        : undefined;
      const existing = Array.isArray(raw) ? (raw as OpenPlanEvent[]) : [];
      const updatedEvents = [...existing, newItem];

      await updateDoc(ref, {
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
        const rawEvents = (userData.events || []) as OpenPlanEvent[];
        const prunedEvents = filterOutPastOpenPlans(rawEvents);
        if (prunedEvents.length < rawEvents.length) {
          updateDoc(userDocRef, { events: prunedEvents }).catch(() => {});
        }
        setEvents(prunedEvents);
        setInterests(userData.interests || []);
        setSelectedInterests(userData.interests || []);
        setProfileImage(userData?.imageurl || null);
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

  const prunePastEventsToFirestore = useCallback(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setEvents((prev) => {
      const pruned = filterOutPastOpenPlans(prev);
      if (pruned.length === prev.length) return prev;
      updateDoc(doc(db, "users", uid), { events: pruned }).catch(() => {});
      return pruned;
    });
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    prunePastEventsToFirestore();
    const id = setInterval(() => prunePastEventsToFirestore(), 60_000);
    return () => clearInterval(id);
  }, [isFocused, prunePastEventsToFirestore]);

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === "active") prunePastEventsToFirestore();
    };
    const sub = AppState.addEventListener("change", onAppState);
    return () => sub.remove();
  }, [prunePastEventsToFirestore]);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    const myUid = auth.currentUser.uid;
    const t = setTimeout(() => {
      reconcileHostOpenPlansFromFriends(myUid).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [events]);

  const handleDeleteInterest = (interestName: string) => {
    setPendingInterestDelete(interestName);
  };

  const pickImage = async () => {
    setIsPickingImage(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        await uploadImage(result.assets[0].uri);
      }
    } finally {
      setAvatarRenderVersion((prev) => prev + 1);
      setIsPickingImage(false);
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
    } catch (e) {
      showAlert("Error", "Could not save interests.");
    }
  };

  const profileQrUrl = useMemo(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return "";
    return Linking.createURL("/friend-profile", {
      queryParams: { friendId: uid },
    });
  }, [auth.currentUser?.uid]);
  const inviteShareUrl = useMemo(() => {
    if (!inviteCode) return "";
    return `synq://invite/${encodeURIComponent(inviteCode)}`;
  }, [inviteCode]);

  const fetchInviteCode = useCallback(async (): Promise<string> => {
    if (inviteCode) return inviteCode;
    const functions = getFunctions(undefined, "us-central1");
    const getOrCreateInviteCode = httpsCallable(functions, "getOrCreateInviteCode");
    const result = await getOrCreateInviteCode({});
    const code = String((result.data as any)?.inviteCode || "").trim();
    if (!code) {
      throw new Error("Could not create invite code.");
    }
    setInviteCode(code);
    return code;
  }, [inviteCode]);

  useEffect(() => {
    if (!auth.currentUser?.uid) {
      setInviteCode("");
      return;
    }
    let cancelled = false;
    const ensureInviteCode = async () => {
      try {
        const code = await fetchInviteCode();
        if (!cancelled && code) setInviteCode(code);
      } catch {}
    };
    void ensureInviteCode();
    return () => {
      cancelled = true;
    };
  }, [auth.currentUser?.uid, fetchInviteCode]);

  const shareProfile = async () => {
    const fallbackUid = auth.currentUser?.uid;
    const fallbackUrl = fallbackUid
      ? `synq://invite?inviteFrom=${encodeURIComponent(fallbackUid)}`
      : "";
    try {
      const code = await fetchInviteCode();
      const url = `synq://invite/${encodeURIComponent(code)}`;
      await Share.share({
        message: `Join me on Synq and let's connect: ${url}`,
        url,
      });
    } catch {
      if (!fallbackUrl) {
        showAlert(
          "We couldn't generate your invite link yet. Please try again in a moment.",
          "Share unavailable"
        );
        return;
      }
      await Share.share({
        message: `Join me on Synq and let's connect: ${fallbackUrl}`,
        url: fallbackUrl,
      });
    }
  };

  const locationLower =
    city && state ? `${city}, ${state}` : null;

  const profileNameParts = useMemo(() => {
    const raw = auth.currentUser?.displayName?.trim() || "";
    if (!raw) return { first: "Your", last: "profile" };
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { first: parts[0], last: "" };
    return { first: parts[0], last: parts.slice(1).join(" ") };
  }, [auth.currentUser?.displayName]);

  useEffect(() => {
    if (isFocused) return;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [isFocused]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <ProfilePressable
          style={styles.headerIconContainer}
          contentStyle={styles.headerIconInner}
          onPress={() => router.push("/notifications")}
          accessibilityLabel="Notifications"
        >
          <Icon name="notifications-outline" size={26} color="white" />
          {requestCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{requestCount}</Text>
            </View>
          )}
        </ProfilePressable>

        <ProfilePressable
          style={styles.headerIconContainer}
          contentStyle={styles.headerIconInner}
          onPress={() => router.push("/settings")}
          accessibilityLabel="Settings"
        >
          <Icon name="settings-outline" size={26} color="white" />
        </ProfilePressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        <View style={styles.heroOuter}>
          <View style={styles.heroGradient}>
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
                <ProfilePressable
                  onPress={pickImage}
                  onLongPress={() => setAvatarPreviewOpen(true)}
                  disabled={isUploading || isPickingImage}
                  contentStyle={styles.imageWrapper}
                  accessibilityLabel="Profile photo. Tap to change, hold to expand."
                  animatePress={false}
                >
                  <ExpoImage
                    key={`${resolvedProfileImage}-${avatarRenderVersion}`}
                    source={{ uri: resolvedProfileImage }}
                    style={styles.profileImg}
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    recyclingKey={`${resolvedProfileImage}-${avatarRenderVersion}`}
                    transition={0}
                  />
                </ProfilePressable>
              </View>

              <ProfilePressable
                style={styles.qrToggle}
                contentStyle={styles.qrToggleInner}
                onPress={() => setQRExpanded(true)}
                accessibilityLabel="Expand QR code"
              >
                <Icon name="qr-code-outline" size={13} color="black" />
              </ProfilePressable>
            </View>

            <Text style={styles.nameAccent} numberOfLines={2}>
              {profileNameParts.first}
              {profileNameParts.last.length > 0 ? ` ${profileNameParts.last}` : ""}
            </Text>

            {locationLower ? (
              <View style={styles.locationRow}>
                <Icon
                  name="location-outline"
                  size={14}
                  color={MUTED2}
                  style={styles.locationIcon}
                />
                <Text style={styles.locationText} numberOfLines={1}>
                  {locationLower}
                </Text>
              </View>
            ) : null}

            <View style={styles.profileActionsRow}>
              <ProfilePressable
                contentStyle={styles.editProfileBtn}
                onPress={() => router.push("/edit-profile")}
                accessibilityLabel="Edit profile"
              >
                <Icon name="create-outline" size={14} color={MUTED2} />
                <Text style={styles.editProfileBtnText}>Edit profile</Text>
              </ProfilePressable>
              <ProfilePressable
                contentStyle={styles.editProfileBtn}
                onPress={shareProfile}
                accessibilityLabel="Share profile"
              >
                <Icon name="share-social-outline" size={14} color={MUTED2} />
                <Text style={styles.editProfileBtnText}>Share profile</Text>
              </ProfilePressable>
            </View>
          </View>
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
                  <ProfilePressable
                    style={styles.connAvatarPress}
                    contentStyle={styles.connAvatarPressInner}
                    onPress={() =>
                      router.push({
                        pathname: "/friend-profile",
                        params: { friendId: friend.id },
                      })
                    }
                    accessibilityLabel={`${firstName}, last Synq ${formatLastSynq(at)}`}
                  >
                    <View style={styles.imageCircle}>
                      <ExpoImage
                        source={{ uri: resolveAvatar(friend.imageurl) }}
                        style={styles.connImg}
                        cachePolicy="memory-disk"
                        transition={220}
                      />
                      {i === 0 && (
                        <View style={styles.crown}>
                          <Icon name="star" size={8} color="black" />
                        </View>
                      )}
                    </View>
                  </ProfilePressable>
                  <Text style={styles.connName} numberOfLines={1}>
                    {firstName}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.profileHelperText}>
            {friendsForHostNames.length === 0
              ? "Add friends to see recent Synqs here."
              : "No Synqs yet. Start a Synq with a friend to see it here."}
          </Text>
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
          <>
            <Text style={styles.profileHelperText}>
              Add a few interests so friends know what you are into.
            </Text>
            <TouchableOpacity
              style={styles.interestsAddPlanBtn}
              onPress={() => setShowInputModal(true)}
              accessibilityLabel="Add interests"
              activeOpacity={0.85}
            >
              <Text style={styles.interestsAddPlanBtnText}>+ Add</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.interestsWrapper}>
            {interests.map((interest, i) => (
              <ProfilePressable
                key={i}
                style={styles.interestRectOuter}
                contentStyle={styles.interestRect}
                onPress={() => handleDeleteInterest(interest)}
                accessibilityLabel={`Interest ${interest}, tap to remove`}
              >
                <Text style={styles.interestText}>{interest}</Text>
              </ProfilePressable>
            ))}

            <ProfilePressable
              style={styles.addRectOuter}
              contentStyle={styles.addRect}
              onPress={() => setShowInputModal(true)}
              accessibilityLabel="Add more interests"
            >
              <Text style={styles.addRectText}>+ Add</Text>
            </ProfilePressable>
          </View>
        )}
      </View>

      <ProfilePressable
        style={{ alignSelf: "center" }}
        contentStyle={styles.signOutBtn}
        onPress={handleSignOut}
        accessibilityLabel="Sign out"
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </ProfilePressable>
      </ScrollView>

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

      <Modal
        visible={avatarPreviewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarPreviewOpen(false)}
      >
        <Pressable
          style={styles.avatarPreviewOverlay}
          onPress={() => setAvatarPreviewOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close profile photo preview"
        >
          <View style={styles.avatarPreviewDim} pointerEvents="none" />
          <ExpoImage
            source={{ uri: resolvedProfileImage }}
            style={styles.avatarPreviewImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            recyclingKey={`${resolvedProfileImage}-${avatarRenderVersion}`}
          />
        </Pressable>
      </Modal>

      <Modal
        visible={showInputModal}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <SafeAreaProvider>
          <SafeAreaView style={styles.interestModalFullscreen} edges={["top", "left", "right", "bottom"]}>
            <StatusBar barStyle="light-content" />
            <View style={styles.interestSheet}>
            <View style={styles.interestSheetTop}>
              <View style={styles.interestSheetHeaderRow}>
                <View style={styles.interestSheetTitleWrap}>
                  <Text style={styles.interestSheetTitle}>What are you into?</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowInputModal(false)}
                  activeOpacity={0.7}
                  accessibilityLabel="Close interests"
                  accessibilityRole="button"
                >
                  <Icon name="close-circle" size={28} color="#444" />
                </TouchableOpacity>
              </View>
              <View style={styles.interestSheetDivider} />
            </View>

            <View style={styles.interestPillsSection}>
              <ScrollView
                style={styles.interestPillsScroll}
                contentContainerStyle={styles.interestPillsWrap}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onScrollBeginDrag={Keyboard.dismiss}
                showsVerticalScrollIndicator={false}
              >
                {allActivities.map((item) => {
                  const active = selectedInterests.includes(item.name);
                  return (
                    <TouchableOpacity
                      key={item.name}
                      onPress={() =>
                        setSelectedInterests((prev) =>
                          active ? prev.filter((i) => i !== item.name) : [...prev, item.name]
                        )
                      }
                      activeOpacity={0.85}
                      style={[styles.interestPill, active && styles.interestPillOn]}
                    >
                      <Text style={styles.interestText}>{item.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <TouchableOpacity onPress={saveInterests} style={styles.interestSaveBtn}>
              <Text style={styles.interestSaveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
          </SafeAreaView>
        </SafeAreaProvider>
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
    </View>
  );
}

const styles = StyleSheet.create({
  /** Matches `friends` tab: padded screen, header outside scroll so icon row aligns with other tabs. */
  screen: { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 70 },
  heroOuter: { marginHorizontal: -20, marginTop: 0 },
  heroGradient: {
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingBottom: 8,
    position: "relative",
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
  headerIconInner: {
    position: "relative",
    width: 40,
    height: 40,
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
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  imageWrapper: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(0,255,133,0.55)",
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  profileImg: { width: "100%", height: "100%" },
  avatarPreviewOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingHorizontal: 24,
  },
  avatarPreviewDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.88)",
  },
  avatarPreviewImage: {
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.22)",
  },
  qrToggle: { position: "absolute", bottom: 10, right: 10, backgroundColor: ACCENT, padding: 10, borderRadius: 25, zIndex: 2 },
  qrToggleInner: { alignItems: "center", justifyContent: "center" },
  nameAccent: {
    color: ACCENT,
    fontSize: 24,
    lineHeight: 32,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
    marginTop: 14,
    textAlign: "center",
    maxWidth: "92%",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    maxWidth: "88%",
  },
  locationIcon: {
    marginRight: 4,
  },
  locationText: {
    color: MUTED,
    fontSize: 14,
    fontFamily: fonts.book,
    flexShrink: 1,
  },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  profileActionsRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  editProfileBtnText: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: 13,
    letterSpacing: 0.1,
  },
  synqsContainer: { flexDirection: "row", justifyContent: "flex-start", gap: 14 },
  connItem: { alignItems: "center", width: 72 },
  connAvatarPress: { alignItems: "center" },
  connAvatarPressInner: { borderRadius: 50, overflow: "hidden" },
  imageCircle: {
    width: 55,
    height: 55,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  connImg: { width: 55, height: 55, borderRadius: 50 },
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
    fontFamily: fonts.medium,
  },
  profileHelperText: {
    color: MUTED2,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.book,
    textAlign: "left",
  },
  sectionAfterHero: {
    marginTop: 4,
    paddingTop: 6,
  },
  section: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  sectionTitle: profileScreenSectionTitle,
  interestsAddPlanBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 16,
    alignSelf: "flex-start",
  },
  interestsAddPlanBtnText: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: 13,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  interestsWrapper: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  interestRectOuter: { marginRight: 8, marginBottom: 8 },
  interestRect: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  interestText: { color: TEXT, fontFamily: fonts.book, fontSize: 13 },
  addRectOuter: { marginBottom: 8 },
  addRect: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: ACCENT,
    borderStyle: "solid",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addRectText: { color: ACCENT, fontFamily: fonts.heavy, fontSize: 13 },
  signOutBtn: { ...destructiveActionBtn, marginTop: 40 },
  signOutText: destructiveActionBtnText,
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  qrModalBox: { backgroundColor: "white", padding: 25, borderRadius: MODAL_RADIUS + 18 },
  interestModalFullscreen: {
    flex: 1,
    backgroundColor: BG,
  },
  interestSheet: {
    flex: 1,
    backgroundColor: BG,
    width: "100%",
    paddingHorizontal: ONBOARDING_H_PADDING,
    paddingTop: 36,
  },
  interestSheetTop: {
    marginBottom: 0,
  },
  interestSheetHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  interestSheetTitleWrap: {
    flex: 1,
    marginRight: 12,
  },
  interestSheetTitle: {
    color: TEXT,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fonts.heavy,
    letterSpacing: 0.1,
  },
  interestSheetDivider: {
    marginTop: 8,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    width: ONBOARDING_DIVIDER_WIDTH,
  },
  interestPillsSection: {
    flex: 1,
    marginTop: 16,
    marginBottom: 8,
    minHeight: 0,
  },
  interestPillsScroll: {
    flex: 1,
  },
  interestPillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingBottom: 6,
  },
  interestPill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  interestPillOn: {
    backgroundColor: "rgba(125,255,166,0.18)",
    borderColor: "rgba(125,255,166,0.6)",
  },
  interestSaveBtn: {
    marginTop: 20,
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    backgroundColor: ACCENT,
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  interestSaveBtnText: {
    color: "black",
    fontSize: 18,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
});
