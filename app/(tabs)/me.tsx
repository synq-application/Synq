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
  ON_ACCENT_TEXT,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  profileScreenSectionTitle,
  tabScreenMainHeaderTitle,
  SURFACE,
  TAB_BAR_SCROLL_INSET,
  SPACE_6,
  TEXT,
} from "@/constants/Variables";
import HeaderIconButton from "@/src/components/HeaderIconButton";
import NotificationBadge from "@/src/components/NotificationBadge";
import ProfileTabHeaderOverlay, {
  useTabHeaderLayout,
} from "@/src/components/ProfileTabHeaderOverlay";
import SynqPlusAddButton from "@/src/components/SynqPlusAddButton";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { collection, doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { filterOrReject } from "@/src/lib/contentFilter";
import {
  getPhotoLibraryPermission,
  launchProfilePhotoPicker,
  photoLibraryAccessGranted,
  requestPhotoLibraryAccess,
} from "@/src/lib/profilePhotoPicker";
import { setPendingProfilePhotoSource } from "@/src/lib/pendingProfilePhoto";
import { removeProfilePhoto } from "@/src/lib/uploadProfilePhoto";
import { getFunctions, httpsCallable } from "firebase/functions";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  ActivityIndicator,
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
import CloseButton from "@/src/components/CloseButton";
import ProfilePhotoActionSheet from "@/src/components/ProfilePhotoActionSheet";
import { presetActivities, stateAbbreviations } from "../../assets/Mocks";
import { auth, db } from "../../src/lib/firebase";
import { filterOutPastOpenPlans, matchesPlanEvent } from "../../src/lib/planEvents";
import { reconcileHostOpenPlansFromFriends } from "../../src/lib/reconcileHostOpenPlans";
import {
  computeRecentSynqRows,
  getCachedOwnProfile,
  getMeTabInitialState,
  hydrateOwnProfileFromDisk,
  mergeCachedOwnProfile,
  recentSynqRowsEqual,
  recentSynqRowsToCache,
  setCachedOwnProfile,
  type RecentSynqRow,
} from "../../src/lib/ownProfileCache";
import {
  friendRelationCacheByUser,
  friendsListCacheByUser,
  pruneSocialCachesToFriendIds,
  warmFriendsAndConnectionsCache,
} from "../../src/lib/socialCache";
import { ignoreSnapshotPermissionDenied } from "@/src/lib/firestoreListeners";
import AlertModal from "../alert-modal";
import { useAuthRefresh } from "../_layout";
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
  const headerLayout = useTabHeaderLayout();
  const scrollRef = useRef<ScrollView>(null);
  const profileScrollPaddingBottom = TAB_BAR_SCROLL_INSET + SPACE_6;
  const params = useLocalSearchParams<{ focusEventId?: string | string[] }>();
  const focusEventIdRaw = params.focusEventId;
  const focusEventId =
    typeof focusEventIdRaw === "string"
      ? focusEventIdRaw
      : Array.isArray(focusEventIdRaw)
        ? focusEventIdRaw[0]
        : undefined;

  const [planHighlightId, setPlanHighlightId] = useState<string | null>(null);

  const { user } = useAuthRefresh();
  const myId = user?.uid ?? "";
  const meBootstrap = useMemo(
    () => (myId ? getMeTabInitialState(myId) : null),
    [myId]
  );
  const [friendsForHostNames, setFriendsForHostNames] = useState<Friend[]>(
    () => meBootstrap?.friendsForHostNames ?? []
  );
  const [friendsDataEpoch, setFriendsDataEpoch] = useState(0);
  const [recentSynqRows, setRecentSynqRows] = useState<RecentSynqRow[]>(
    () => meBootstrap?.recentSynqRows ?? []
  );
  const [recentSynqsReady, setRecentSynqsReady] = useState(
    () => meBootstrap?.recentSynqsReady ?? false
  );
  const [profileImage, setProfileImage] = useState<string | null>(
    () => meBootstrap?.profileImage ?? null
  );
  const [avatarRenderVersion, setAvatarRenderVersion] = useState(0);
  const [isQRExpanded, setQRExpanded] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [photoMenuVisible, setPhotoMenuVisible] = useState(false);
  const [photoPermissionPromptVisible, setPhotoPermissionPromptVisible] =
    useState(false);
  const photoPermissionRef = useRef<{
    granted: boolean;
    status: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [inviteCode, setInviteCode] = useState<string>("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    () => meBootstrap?.selectedInterests ?? []
  );
  const [interests, setInterests] = useState<string[]>(() => meBootstrap?.interests ?? []);
  const [city, setCity] = useState<string | null>(() => meBootstrap?.city ?? null);
  const [state, setState] = useState<string | null>(() => meBootstrap?.state ?? null);
  const [requestCount, setRequestCount] = useState(0);
  const [unreadActivityCount, setUnreadActivityCount] = useState(0);
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

  const [events, setEvents] = useState<OpenPlanEvent[]>(
    () => (meBootstrap?.events as OpenPlanEvent[] | undefined) ?? []
  );
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [pendingInterestDelete, setPendingInterestDelete] = useState<string | null>(null);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
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

  const computedRecentSynqRows = useMemo(
    () => computeRecentSynqRows(myId, friendsForHostNames),
    [myId, friendsForHostNames, friendsDataEpoch]
  );

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const signOut = async () => {
    try {
      router.replace("/(auth)/welcome");
      await auth.signOut();
    } catch {
      showAlert("Sign out failed", "Please try again.");
    }
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

  const updateEvent = async (
    id: string,
    fields: { title: string; date: string; time: string; location: string }
  ) => {
    if (!auth.currentUser) return;

    const existing = events.find((e) => e.id === id);
    if (!existing) return;

    const myUid = auth.currentUser.uid;
    const host = String(existing.planHostUid || myUid).trim();
    if (host !== myUid) {
      showAlert("Can't edit", "You can only edit plans you created.");
      return;
    }

    if (!fields.title.trim()) {
      showAlert("Missing info", "Add a title");
      return;
    }

    for (const field of [fields.title, fields.location]) {
      if (!field) continue;
      const check = filterOrReject(String(field));
      if (!check.ok) {
        showAlert("Content not allowed", check.reason);
        return;
      }
    }

    const updatedPayload = {
      title: fields.title.trim(),
      date: fields.date,
      time: fields.time || "",
      location: fields.location || "",
    };

    const oldSnapshot = { ...existing };
    const attendeeIds = new Set<string>();
    attendeeIds.add(myUid);
    if (host) attendeeIds.add(host);
    for (const raw of [
      ...((Array.isArray(existing.joinedFromIds) ? existing.joinedFromIds : []) as string[]),
      existing.joinedFromId,
    ].filter(Boolean)) {
      attendeeIds.add(String(raw).trim());
    }

    const patchOnUserCalendar = async (uid: string) => {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const evs = (snap.data() as any).events || [];
      let changed = false;
      const next = evs.map((e: any) => {
        if (uid === myUid && String(e?.id || "") === String(id)) {
          changed = true;
          return { ...e, ...updatedPayload };
        }
        if (!matchesPlanEvent(e, oldSnapshot, evs)) return e;
        changed = true;
        return { ...e, ...updatedPayload };
      });
      if (changed) await updateDoc(ref, { events: next });
    };

    try {
      await patchOnUserCalendar(myUid);
    } catch {
      showAlert("Error", "Could not update event.");
      return;
    }

    const otherAttendeeIds = [...attendeeIds].filter((uid) => uid !== myUid);
    await Promise.allSettled(otherAttendeeIds.map((uid) => patchOnUserCalendar(uid)));

    setShowEventModal(false);
    setNewEvent({ title: "", date: "", time: "", location: "" });
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
    if (!myId) return;

    const userDocRef = doc(db, "users", myId);

    const unsubscribeProfile = onSnapshot(
      userDocRef,
      (userDocSnap) => {
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          const nextCity = userData.city || null;
          const stateAbbr =
            stateAbbreviations[userData.state] || userData.state || null;
          const rawEvents = (userData.events || []) as OpenPlanEvent[];
          const prunedEvents = filterOutPastOpenPlans(rawEvents);
          if (prunedEvents.length < rawEvents.length) {
            updateDoc(userDocRef, { events: prunedEvents }).catch(() => {});
          }
          const nextInterests = userData.interests || [];
          const nextImage = userData?.imageurl || null;

          const prevOwn = getCachedOwnProfile(myId);
          setCachedOwnProfile(myId, {
            imageurl: nextImage,
            interests: nextInterests,
            events: prunedEvents,
            city: nextCity,
            state: stateAbbr,
            recentSynqs: prevOwn?.recentSynqs ?? [],
          });

          setCity(nextCity);
          setState(stateAbbr);
          setEvents(prunedEvents);
          setInterests(nextInterests);
          setSelectedInterests(nextInterests);
          setProfileImage(nextImage);
          prefetchResolvedAvatar(nextImage);
        }
      },
      ignoreSnapshotPermissionDenied
    );

    const reqRef = collection(db, "users", myId, "friendRequests");
    const notifRef = collection(db, "users", myId, "notifications");
    const unsubscribeRequests = onSnapshot(
      reqRef,
      (snap) => {
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
      },
      ignoreSnapshotPermissionDenied
    );

    const unsubscribeNotifications = onSnapshot(
      notifRef,
      (snap) => {
        const unread = snap.docs.filter((d) => d.data()?.read !== true).length;
        setUnreadActivityCount(unread);
      },
      ignoreSnapshotPermissionDenied
    );

    const friendsCol = collection(db, "users", myId, "friends");
    const unsubscribeFriends = onSnapshot(
      friendsCol,
      async (snapshot) => {
        const friendIds = new Set(snapshot.docs.map((d) => d.id));
        pruneSocialCachesToFriendIds(myId, friendIds);

        if (!friendRelationCacheByUser[myId]) {
          friendRelationCacheByUser[myId] = {};
        }
        snapshot.docs.forEach((d) => {
          const data = d.data();
          friendRelationCacheByUser[myId][d.id] = {
            synqCount: data.synqCount || 0,
            lastSynqAt: data.lastSynqAt,
          };
        });

        const cachedList = friendsListCacheByUser[myId] ?? [];
        const friendsCacheMatches =
          cachedList.length > 0 &&
          cachedList.length === friendIds.size &&
          cachedList.every((f) => friendIds.has(f.id));

        if (friendsCacheMatches) {
          setFriendsForHostNames((prev) =>
            prev.length === cachedList.length &&
            prev.every((f, i) => f.id === cachedList[i]?.id)
              ? prev
              : cachedList
          );
          setFriendsDataEpoch((n) => n + 1);
          setRecentSynqsReady(true);
          return;
        }

        try {
          await warmFriendsAndConnectionsCache(myId);
          const nextFriends = friendsListCacheByUser[myId] ?? [];
          setFriendsForHostNames((prev) =>
            prev.length === nextFriends.length &&
            prev.every((f, i) => f.id === nextFriends[i]?.id)
              ? prev
              : nextFriends
          );
          setFriendsDataEpoch((n) => n + 1);
        } catch (e) {
          console.error("[ProfileScreen] warmFriendsAndConnectionsCache:", e);
        } finally {
          setRecentSynqsReady(true);
        }
      },
      ignoreSnapshotPermissionDenied
    );

    return () => {
      unsubscribeProfile();
      unsubscribeRequests();
      unsubscribeNotifications();
      unsubscribeFriends();
    };
  }, [myId]);

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

  const openPhotoMenu = useCallback(async () => {
    const permission = await getPhotoLibraryPermission();
    photoPermissionRef.current = {
      granted: photoLibraryAccessGranted(permission),
      status: permission.status,
    };
    setPhotoMenuVisible(true);
  }, []);

  const navigateToCropWithPhoto = (pickedUri: string) => {
    setPendingProfilePhotoSource(pickedUri);
    router.push("/profile-photo-crop");
  };

  const openPhotoPickerAfterAccess = async () => {
    const result = await launchProfilePhotoPicker();
    if (result.ok) {
      navigateToCropWithPhoto(result.uri);
      return;
    }
    if (result.reason === "denied") {
      showAlert(
        "Photo access needed",
        "Allow photo library access in Settings to update your profile picture."
      );
    }
  };

  const handleUploadPhoto = async () => {
    const cached = photoPermissionRef.current;
    if (!cached?.granted) {
      setPhotoMenuVisible(false);
      if (cached?.status === "undetermined") {
        setPhotoPermissionPromptVisible(true);
        return;
      }
      setIsPickingImage(true);
      try {
        const granted = await requestPhotoLibraryAccess();
        photoPermissionRef.current = {
          granted,
          status: granted ? "granted" : "denied",
        };
        if (!granted) {
          showAlert(
            "Photo access needed",
            "Allow photo library access in Settings to update your profile picture."
          );
          return;
        }
        const result = await launchProfilePhotoPicker();
        if (result.ok) {
          navigateToCropWithPhoto(result.uri);
        } else if (result.reason === "denied") {
          showAlert(
            "Photo access needed",
            "Allow photo library access in Settings to update your profile picture."
          );
        }
      } catch {
        showAlert("Error", "Could not open your photo library.");
      } finally {
        setAvatarRenderVersion((prev) => prev + 1);
        setIsPickingImage(false);
      }
      return;
    }

    setIsPickingImage(true);
    try {
      const result = await launchProfilePhotoPicker();
      setPhotoMenuVisible(false);

      if (result.ok) {
        navigateToCropWithPhoto(result.uri);
        return;
      }
      if (result.reason === "denied") {
        showAlert(
          "Photo access needed",
          "Allow photo library access in Settings to update your profile picture."
        );
      }
    } catch {
      setPhotoMenuVisible(false);
      showAlert("Error", "Could not open your photo library.");
    } finally {
      setAvatarRenderVersion((prev) => prev + 1);
      setIsPickingImage(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoMenuVisible(false);
    if (!auth.currentUser) return;

    setIsUploading(true);
    try {
      await removeProfilePhoto();
      setProfileImage(null);
      setAvatarRenderVersion((prev) => prev + 1);
    } catch {
      showAlert("Error", "Could not remove profile photo.");
    } finally {
      setIsUploading(false);
    }
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
    if (!myId) return;
    let cancelled = false;
    void hydrateOwnProfileFromDisk(myId).then(() => {
      if (cancelled) return;
      const next = getMeTabInitialState(myId);
      setProfileImage((prev) => prev ?? next.profileImage);
      setInterests((prev) => (prev.length > 0 ? prev : next.interests));
      setSelectedInterests((prev) => (prev.length > 0 ? prev : next.selectedInterests));
      setCity((prev) => prev ?? next.city);
      setState((prev) => prev ?? next.state);
      setEvents((prev) => (prev.length > 0 ? prev : (next.events as OpenPlanEvent[])));
      setFriendsForHostNames((prev) =>
        prev.length > 0 ? prev : next.friendsForHostNames
      );
      setRecentSynqRows((prev) =>
        prev.length > 0 ? prev : next.recentSynqRows
      );
      if (next.recentSynqsReady) {
        setRecentSynqsReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [myId]);

  useEffect(() => {
    if (computedRecentSynqRows.length > 0) {
      setRecentSynqRows((prev) => {
        if (recentSynqRowsEqual(computedRecentSynqRows, prev)) return prev;
        if (myId) {
          mergeCachedOwnProfile(myId, {
            recentSynqs: recentSynqRowsToCache(computedRecentSynqRows),
          });
        }
        return computedRecentSynqRows;
      });
      return;
    }
    if (!recentSynqsReady) return;
    setRecentSynqRows((prev) => {
      if (prev.length === 0) return prev;
      if (myId) {
        mergeCachedOwnProfile(myId, { recentSynqs: [] });
      }
      return [];
    });
  }, [computedRecentSynqRows, recentSynqsReady, myId]);

  useEffect(() => {
    if (isFocused) return;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [isFocused]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerLayout.contentPaddingTop,
            paddingBottom: profileScrollPaddingBottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ right: 0 }}
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
                  onPress={() => void openPhotoMenu()}
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
                <Ionicons name="qr-code-outline" size={13} color={ON_ACCENT_TEXT} />
              </ProfilePressable>
            </View>

            <Text style={styles.nameAccent} numberOfLines={2}>
              {profileNameParts.first}
              {profileNameParts.last.length > 0 ? ` ${profileNameParts.last}` : ""}
            </Text>

            {locationLower ? (
              <View style={styles.locationRow}>
                <Ionicons
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
                <Ionicons name="create-outline" size={14} color={MUTED2} />
                <Text style={styles.editProfileBtnText}>Edit profile</Text>
              </ProfilePressable>
              <ProfilePressable
                contentStyle={styles.editProfileBtn}
                onPress={shareProfile}
                accessibilityLabel="Share profile"
              >
                <Ionicons name="share-social-outline" size={14} color={MUTED2} />
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
                        transition={0}
                        recyclingKey={friend.id}
                      />
                      {i === 0 && (
                        <View style={styles.crown}>
                          <Ionicons name="star" size={8} color={ON_ACCENT_TEXT} />
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
        ) : recentSynqsReady ? (
          <Text style={styles.profileHelperText}>
            {friendsForHostNames.length === 0
              ? "Add friends to see recent Synqs here."
              : "No Synqs yet. Start a Synq with a friend to see it here."}
          </Text>
        ) : (
          <ActivityIndicator color={ACCENT} style={styles.recentSynqsLoading} />
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
          updateEvent={updateEvent}
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
            <SynqPlusAddButton
              onPress={() => setShowInputModal(true)}
              accessibilityLabel="Add interests"
              style={styles.interestsAddPlanBtnSpacing}
            />
          </>
        ) : (
          <>
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
            </View>
            <SynqPlusAddButton
              onPress={() => setShowInputModal(true)}
              accessibilityLabel="Add more interests"
              style={styles.interestsAddBelow}
            />
          </>
        )}
      </View>

      <View style={[styles.section, styles.signOutSection]}>
        <TouchableOpacity
          onPress={() => setShowSignOutModal(true)}
          style={styles.signOutBtn}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutBtnText}>Sign out</Text>
        </TouchableOpacity>
      </View>

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
              <View style={styles.interestHeader}>
                <Text style={styles.interestTitle}>What are you into?</Text>
                <CloseButton
                  onPress={() => setShowInputModal(false)}
                  accessibilityLabel="Close interests"
                />
              </View>
              <Text style={styles.interestSubtitle}>
                Pick a few things you enjoy doing with friends.
              </Text>

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
                      <Text style={[styles.interestPillText, active && styles.interestPillTextOn]}>
                        {item.name}
                      </Text>
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
      <ConfirmModal
        visible={photoPermissionPromptVisible}
        title="Photo library access"
        message="Synq needs access to your photo library so you can choose a profile photo."
        confirmText="Continue"
        cancelText="Not now"
        onCancel={() => setPhotoPermissionPromptVisible(false)}
        onConfirm={() => {
          setPhotoPermissionPromptVisible(false);
          void (async () => {
            setIsPickingImage(true);
            try {
              const granted = await requestPhotoLibraryAccess();
              photoPermissionRef.current = {
                granted,
                status: granted ? "granted" : "denied",
              };
              if (!granted) {
                showAlert(
                  "Photo access needed",
                  "Allow photo library access in Settings to update your profile picture."
                );
                return;
              }
              await openPhotoPickerAfterAccess();
            } catch {
              showAlert("Error", "Could not open your photo library.");
            } finally {
              setAvatarRenderVersion((prev) => prev + 1);
              setIsPickingImage(false);
            }
          })();
        }}
      />
      <AlertModal
  visible={alertVisible}
  title={alertTitle}
  message={alertMessage}
  onClose={() => setAlertVisible(false)}
/>
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
          try {
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
              interests: updatedInterests,
            });
            setPendingInterestDelete(null);
          } catch {
            showAlert("Error", "Could not remove interest. Please try again.");
            setPendingInterestDelete(null);
          }
        }}
      />

      <ProfileTabHeaderOverlay>
        <HeaderIconButton
          name="notifications-outline"
          onPress={() => router.push("/notifications")}
          accessibilityLabel="Notifications"
          badge={
            requestCount + unreadActivityCount > 0 ? (
              <NotificationBadge
                variant="count"
                count={requestCount + unreadActivityCount}
              />
            ) : undefined
          }
        />
        <HeaderIconButton
          name="settings-outline"
          onPress={() => router.push("/settings")}
          accessibilityLabel="Settings"
        />
      </ProfileTabHeaderOverlay>

      <ProfilePhotoActionSheet
        visible={photoMenuVisible}
        showRemove={Boolean(profileImage)}
        onClose={() => setPhotoMenuVisible(false)}
        onUpload={handleUploadPhoto}
        onRemove={handleRemovePhoto}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /** Full-width scroll (no gutter scrollbar); sections pad themselves. */
  screen: { flex: 1, backgroundColor: BG, position: "relative" },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
  },
  heroOuter: { marginTop: 0 },
  heroGradient: {
    backgroundColor: BG,
    paddingBottom: 8,
    position: "relative",
  },
  recentSynqsLoading: { alignSelf: "center", marginVertical: 16 },
  profileSection: { alignItems: "center", marginTop: 0, overflow: "visible" },
  qrContainer: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  qrBg: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 180,
    height: 180,
    opacity: 0.4,
    backgroundColor: "white",
    borderRadius: 25,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  avatarGlowWrap: {
    borderRadius: 84,
    zIndex: 2,
    elevation: 8,
  },
  imageWrapper: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: ACCENT,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
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
  interestsAddPlanBtnSpacing: { marginTop: 16 },
  interestsAddBelow: { marginTop: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  interestsWrapper: { flexDirection: "row", flexWrap: "wrap" },
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
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  interestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 34,
    paddingTop: 40,
    marginBottom: 10,
  },
  interestTitle: {
    ...tabScreenMainHeaderTitle,
    flex: 1,
    lineHeight: 32,
    includeFontPadding: false,
    marginRight: 12,
  },
  interestSubtitle: {
    color: MUTED2,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.book,
    marginBottom: 16,
  },
  interestPillsSection: {
    flex: 1,
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
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  interestPillOn: {
    backgroundColor: "rgba(0,255,133,0.12)",
    borderColor: "rgba(0,255,133,0.55)",
  },
  interestPillText: {
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: 13,
  },
  interestPillTextOn: {
    color: ACCENT,
    fontFamily: fonts.medium,
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
  signOutSection: {
    paddingBottom: 20,
  },
  signOutBtn: {
    marginTop: 4,
    alignSelf: "center",
    paddingVertical: 11,
    paddingHorizontal: 32,
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  signOutBtnText: {
    color: MUTED,
    fontSize: 15,
    fontFamily: fonts.medium,
    letterSpacing: 0.1,
  },
});
