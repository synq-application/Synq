import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  fonts,
  Friend,
  MUTED,
  MUTED2,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import {
  useLocalSearchParams,
  usePathname,
  useRouter,
  useSegments,
} from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Icon from "react-native-vector-icons/Ionicons";
import { auth, db } from "../../src/lib/firebase";
import {
  friendProfileCacheByUser,
  friendsListCacheByUser,
  suggestedCacheByUser,
  warmFriendsAndConnectionsCache,
  warmSuggestedCache,
} from "../../src/lib/socialCache";
import AlertModal from "../alert-modal";
import { resolveAvatar } from "../helpers";

const { width } = Dimensions.get("window");

const sortFriendsByName = (list: Friend[]) =>
  [...list].sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

const STAGGER_DELAYS = [0, 120] as const;

function emptyEntering(reduced: boolean, delayMs: number) {
  if (reduced) {
    return FadeIn.duration(1);
  }
  return FadeInDown.duration(380).delay(delayMs);
}

function FriendsHeaderAddButton({
  pulse,
  onPress,
}: {
  pulse: boolean;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduced || !pulse) {
      cancelAnimation(scale);
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(
      withSequence(
        withTiming(1.07, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(scale);
    };
  }, [pulse, reduced, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity onPress={onPress} accessibilityLabel="Add friends">
      <Animated.View style={animatedStyle}>
        <Icon name="add-circle-outline" size={30} color="white" />
      </Animated.View>
    </TouchableOpacity>
  );
}

function FriendsEmptyMainContent({
  onAddFriends,
}: {
  onAddFriends: () => void;
}) {
  const reduced = useReducedMotion();

  const onPressAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onAddFriends();
  };

  return (
    <View style={styles.emptyStateMain}>
      <Animated.View
        entering={emptyEntering(reduced, STAGGER_DELAYS[0])}
        style={styles.emptyHeroBlock}
      >
        <Text style={styles.emptyHeroTitle}>
          Your friends. Your plans.
        </Text>
        <Text style={styles.emptyHeroSubtitle}>
          {`Build your circle — then see who's free.`}
        </Text>
        <Text style={styles.emptyHeroHint}>
          Your friends will show up here once you connect.
        </Text>
      </Animated.View>

      <Animated.View
        entering={emptyEntering(reduced, STAGGER_DELAYS[1])}
        style={styles.emptyPrimaryCtaWrap}
      >
        <TouchableOpacity
          style={styles.emptyPrimaryCta}
          onPress={onPressAdd}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Add friends"
        >
          <Ionicons name="person-add-outline" size={22} color="#061006" />
          <Text style={styles.emptyPrimaryCtaText}>Add friends</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function FriendsListEmpty({
  hasFriends,
  searchText,
  onAddFriends,
  onClearSearch,
}: {
  hasFriends: boolean;
  searchText: string;
  onAddFriends: () => void;
  onClearSearch: () => void;
}) {
  const reduced = useReducedMotion();
  if (hasFriends && searchText.trim().length > 0) {
    return (
      <Animated.View
        entering={reduced ? FadeIn.duration(1) : FadeInDown.duration(400)}
        style={styles.emptyStateCenter}
      >
        <Ionicons name="search-outline" size={40} color={MUTED2} />
        <Text style={styles.emptyTitle}>No matches</Text>
        <Text style={styles.emptyText}>
          {`No friend named "${searchText.trim()}". Try another spelling or clear search.`}
        </Text>
        <TouchableOpacity onPress={onClearSearch} style={styles.emptySecondaryBtn} activeOpacity={0.8}>
          <Text style={styles.emptySecondaryBtnText}>Clear search</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return <FriendsEmptyMainContent onAddFriends={onAddFriends} />;
}

export default function FriendsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const isFriendsTabFocused = useIsFocused();
  const { openAddFriends } = useLocalSearchParams<{ openAddFriends?: string }>();
  const myId = auth.currentUser?.uid ?? "";
  const cachedFriends = myId ? friendsListCacheByUser[myId] ?? [] : [];
  const [friends, setFriends] = useState<Friend[]>(cachedFriends);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [isFriendsInitialLoading, setIsFriendsInitialLoading] = useState(cachedFriends.length === 0);
  const [isFriendsRefreshing, setIsFriendsRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");

  /** Keep modal "open" in state while viewing friend profile so back() restores it without a second sheet animation. */
  const routeShowsFriendProfile =
    (pathname ?? "").includes("friend-profile") ||
    segments.some((s) => typeof s === "string" && s.includes("friend-profile"));
  const showAddFriendsModal =
    searchModalVisible && isFriendsTabFocused && !routeShowsFriendProfile;

  useEffect(() => {
    if (openAddFriends !== "1") return;
    setSearchModalVisible(true);
  }, [openAddFriends]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const myId = auth.currentUser.uid;
    if (!friendProfileCacheByUser[myId]) {
      friendProfileCacheByUser[myId] = {};
    }
    const friendsRef = collection(db, "users", myId, "friends");

    const unsubFriends = onSnapshot(friendsRef, async (snapshot) => {
      const friendIds = snapshot.docs.map((d) => d.id);
      const profileCache = friendProfileCacheByUser[myId];

      try {
        const cachedVisible = sortFriendsByName(
          friendIds
            .map((id) => profileCache[id])
            .filter(Boolean) as Friend[]
        );

        if (cachedVisible.length > 0) {
          setFriends(cachedVisible);
          setIsFriendsInitialLoading(false);
        } else {
          setIsFriendsInitialLoading(true);
        }
        setIsFriendsRefreshing(cachedVisible.length > 0);

        await warmFriendsAndConnectionsCache(myId);
        const fetchedFriends: Friend[] = friendIds.map(
          (friendId) =>
            profileCache[friendId] ??
            ({
              id: friendId,
              displayName: "Unknown",
              mutualCount: 0,
            } as Friend)
        );

        const sortedFriends = sortFriendsByName(fetchedFriends);
        sortedFriends.forEach((friend) => {
          profileCache[friend.id] = friend;
          ExpoImage.prefetch(resolveAvatar((friend as any)?.imageurl)).catch(() => {});
        });

        friendsListCacheByUser[myId] = sortedFriends;
        setFriends(sortedFriends);
      } catch (err) {
        console.error("[FriendsScreen] Error fetching friend data:", err);
      } finally {
        setIsFriendsInitialLoading(false);
        setIsFriendsRefreshing(false);
      }
    });

    return () => {
      unsubFriends();
    };
  }, []);

  const filteredFriends = friends.filter((f) =>
    (f.displayName || "")
      .toLowerCase()
      .includes(searchText.toLowerCase())
  );

  const showFriendSearch = friends.length > 0 && !isFriendsInitialLoading;
  const listIsEmpty = filteredFriends.length === 0;

  const renderSkeletonRow = (key: string) => (
    <View key={key} style={styles.friendRow}>
      <View style={[styles.avatar, { backgroundColor: "#151515" }]} />
      <View style={{ flex: 1 }}>
        <View style={{ height: 14, width: "55%", backgroundColor: "#1f1f1f", borderRadius: 8, marginBottom: 8 }} />
        <View style={{ height: 12, width: "38%", backgroundColor: "#1a1a1a", borderRadius: 8 }} />
      </View>
      <View style={{ height: 12, width: 12 }} />
    </View>
  );

  const renderFriendRow = ({ item }: { item: Friend }) => (
    <TouchableOpacity
      style={styles.friendRow}
      onPress={() =>
        router.push({
          pathname: "/friend-profile",
          params: { friendId: item.id },
        })
      }
    >
      <View style={styles.avatar}>
        <ExpoImage
          source={{ uri: resolveAvatar((item as any)?.imageurl) }}
          style={styles.img}
          cachePolicy="memory-disk"
          transition={0}
        />
      </View>

      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text
          style={{
            color: TEXT,
            fontSize: 17,
            marginBottom: 2,
            fontFamily: fonts.heavy
          }}
        >
          {item.displayName || "User"}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Ionicons
            name="location-outline"
            size={12}
            color="rgba(255,255,255,0.45)"
            style={{ marginRight: 4 }}
          />
          <Text
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 13,
            }}
          >
            {(item as any)?.location || "No location"}
          </Text>
        </View>
      </View>

      <Icon name="chevron-forward" size={18} color="rgba(255,255,255,0.25)" />
    </TouchableOpacity>
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Friends</Text>
        </View>
        <FriendsHeaderAddButton
          pulse={!isFriendsInitialLoading && friends.length === 0}
          onPress={() => setSearchModalVisible(true)}
        />
      </View>
      <View style={styles.headerDivider} />
      {showFriendSearch && (
        <View style={styles.searchBarWrap}>
          <Ionicons name="search-outline" size={18} color={MUTED2} />
          <TextInput
            placeholder="Search friends..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={styles.searchBarInput}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={18} color={MUTED2} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {isFriendsInitialLoading ? (
        <View style={{ paddingBottom: 20 }}>
          {["1", "2", "3"].map((k) => renderSkeletonRow(k))}
        </View>
      ) : (
        <>
          <FlatList
            style={styles.friendsList}
            data={filteredFriends}
            keyExtractor={(item) => item.id}
            renderItem={renderFriendRow}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={Keyboard.dismiss}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListFooterComponent={<View style={{ height: 40 }} />}
            contentContainerStyle={listIsEmpty ? styles.friendsListContentEmpty : styles.friendsListContent}
            ListEmptyComponent={
              <FriendsListEmpty
                hasFriends={friends.length > 0}
                searchText={searchText}
                onAddFriends={() => setSearchModalVisible(true)}
                onClearSearch={() => setSearchText("")}
              />
            }
          />
        </>
      )}
      {isFriendsRefreshing && !isFriendsInitialLoading && (
        <View style={styles.refreshingDot} />
      )}

        <SearchModal
          visible={showAddFriendsModal}
          onClose={() => setSearchModalVisible(false)}
          currentFriends={friends.map((f) => f.id)}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

function SearchModal({
  visible,
  onClose,
  currentFriends,
}: {
  visible: boolean;
  onClose: () => void;
  currentFriends: string[];
}) {
  const router = useRouter();
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [pendingRequestIds, setPendingRequestIds] = useState<Record<string, boolean>>({});
  const [incomingRequestIds, setIncomingRequestIds] = useState<Record<string, boolean>>({});
  const [acceptedIds, setAcceptedIds] = useState<Record<string, boolean>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [isSuggestedRefreshing, setIsSuggestedRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title?: string;
    message: string;
  } | null>(null);

  const getResultSubtitle = (user: any) => {
    const mutualCount =
      typeof user?.mutualCount === "number" && Number.isFinite(user.mutualCount)
        ? user.mutualCount
        : 0;
    return `${mutualCount} mutual ${mutualCount === 1 ? "friend" : "friends"}`;
  };

  useEffect(() => {
    if (!visible) return;
    setQueryText("");
    setResults([]);
    setIsSearching(false);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !auth.currentUser) return;

    const fetchSuggested = async () => {
      try {
        const myId = auth.currentUser!.uid;
        const cachedSuggested = suggestedCacheByUser[myId] ?? [];
        if (cachedSuggested.length > 0) {
          setSuggested(cachedSuggested);
        }
        setIsSuggestedRefreshing(cachedSuggested.length > 0);

        await warmSuggestedCache(myId);
        const nextSuggested = (suggestedCacheByUser[myId] ?? []).filter(
          (u) => !currentFriends.includes(u.id) && u.id !== myId
        );
        suggestedCacheByUser[myId] = nextSuggested;
        nextSuggested.forEach((user) => {
          ExpoImage.prefetch(resolveAvatar(user?.imageurl)).catch(() => {});
        });
        setSuggested(nextSuggested);
        hydratePendingForUsers(nextSuggested.map((u) => u.id));
        hydrateIncomingForUsers(nextSuggested.map((u) => u.id));
      } catch (e) {
        console.error("[Suggested] error:", e);
      } finally {
        setIsSuggestedRefreshing(false);
      }
    };

    fetchSuggested();
  }, [visible]);

  const debounceRef = React.useRef<any>(null);
  const pendingCheckCacheRef = React.useRef<Record<string, boolean>>({});
  const pendingCheckInFlightRef = React.useRef<Record<string, Promise<boolean>>>({});
  const incomingCheckCacheRef = React.useRef<Record<string, boolean>>({});
  const incomingCheckInFlightRef = React.useRef<Record<string, Promise<boolean>>>({});

  const hydratePendingForUsers = async (userIds: string[]) => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    const checks = uniqueIds.map(async (targetId) => {
      if (currentFriends.includes(targetId)) {
        pendingCheckCacheRef.current[targetId] = false;
        return [targetId, false] as const;
      }
      if (pendingCheckCacheRef.current[targetId] !== undefined) {
        return [targetId, pendingCheckCacheRef.current[targetId]] as const;
      }
      if (!pendingCheckInFlightRef.current[targetId]) {
        pendingCheckInFlightRef.current[targetId] = getDoc(
          doc(db, "users", targetId, "friendRequests", myId)
        )
          .then((snap) => snap.exists())
          .catch(() => false);
      }
      const exists = await pendingCheckInFlightRef.current[targetId];
      pendingCheckCacheRef.current[targetId] = exists;
      delete pendingCheckInFlightRef.current[targetId];
      return [targetId, exists] as const;
    });

    const resolved = await Promise.all(checks);
    setPendingRequestIds((prev) => {
      const next = { ...prev };
      resolved.forEach(([id, isPending]) => {
        next[id] = isPending;
      });
      return next;
    });
  };

  const hydrateIncomingForUsers = async (userIds: string[]) => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    const checks = uniqueIds.map(async (targetId) => {
      if (currentFriends.includes(targetId) || acceptedIds[targetId]) {
        incomingCheckCacheRef.current[targetId] = false;
        return [targetId, false] as const;
      }
      if (incomingCheckCacheRef.current[targetId] !== undefined) {
        return [targetId, incomingCheckCacheRef.current[targetId]] as const;
      }
      if (!incomingCheckInFlightRef.current[targetId]) {
        incomingCheckInFlightRef.current[targetId] = getDoc(
          doc(db, "users", myId, "friendRequests", targetId)
        )
          .then(async (snap) => {
            if (snap.exists()) return true;
            // Legacy compatibility: some friend request docs may not use sender uid as doc id.
            const legacyQ = query(
              collection(db, "users", myId, "friendRequests"),
              where("from", "==", targetId),
              limit(1)
            );
            const legacySnap = await getDocs(legacyQ);
            return !legacySnap.empty;
          })
          .catch(() => false);
      }
      const exists = await incomingCheckInFlightRef.current[targetId];
      incomingCheckCacheRef.current[targetId] = exists;
      delete incomingCheckInFlightRef.current[targetId];
      return [targetId, exists] as const;
    });

    const resolved = await Promise.all(checks);
    setIncomingRequestIds((prev) => {
      const next = { ...prev };
      resolved.forEach(([id, isIncoming]) => {
        next[id] = isIncoming;
      });
      return next;
    });
  };

  const searchUsers = (val: string) => {
    setQueryText(val);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      if (val.length < 1) {
        setResults([]);
        return;
      }

      setIsSearching(true);

      try {
        const usersRef = collection(db, "users");
        const snap = await getDocs(usersRef);

        const mapped = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as any)
        );

        const normalize = (str: string) =>
          str.toLowerCase().trim().replace(/\s+/g, " ");

        const search = normalize(val);

        const filtered = mapped.filter((u) => {
          const displayName = normalize(u.displayName || "");
          const fullName = normalize(`${u.firstName || ""} ${u.lastName || ""}`);
          const email = normalize(u.email || "");

          const matches =
            displayName.includes(search) ||
            fullName.includes(search) ||
            email.includes(search);

          return (
            u.id !== auth.currentUser?.uid &&
            matches
          );
        });

        setResults(filtered);
        hydratePendingForUsers(filtered.map((u) => u.id));
        hydrateIncomingForUsers(filtered.map((u) => u.id));
      } catch (e) {
        console.error("[SearchModal] Search failed", e);
      } finally {
        setIsSearching(false);
      }
    }, 300); // debounce delay (can tweak 250–400)
  };

  const sendInvite = async (targetUser: any) => {
    if (!auth.currentUser) {
      return;
    }

    const myId = auth.currentUser.uid;
    const targetId = targetUser.id;
    const requestDocRef = doc(
      db,
      "users",
      targetId,
      "friendRequests",
      myId
    );

    try {
      Keyboard.dismiss();
      const meSnap = await getDoc(doc(db, "users", myId));
      const meData = meSnap.exists() ? (meSnap.data() as any) : {};
      const senderName =
        meData?.displayName || auth.currentUser.displayName || "Someone";
      const senderImageUrl = meData?.imageurl || null;

      const payload = {
        from: myId,
        to: targetId,
        senderName,
        senderImageUrl,
        status: "pending",
        sentAt: serverTimestamp(),
      };
      pendingCheckCacheRef.current[targetId] = true;
      setPendingRequestIds((prev) => ({ ...prev, [targetId]: true }));

      setAlertConfig({
        title: "Sent!",
        message: `Invite sent to ${targetUser.displayName}`,
      });
      setAlertVisible(true);

      setDoc(requestDocRef, payload).catch((e: any) => {
        pendingCheckCacheRef.current[targetId] = false;
        setPendingRequestIds((prev) => ({ ...prev, [targetId]: false }));
        setAlertConfig({
          title: "Error",
          message: e?.message || "Could not send invite.",
        });
        setAlertVisible(true);
      });

    } catch (e: any) {
      if (e?.code === "permission-denied") {
        setAlertConfig({
          title: "Already sent",
          message: "You’ve already sent this user a friend request.",
        });
        setAlertVisible(true);
        return;
      }

      setAlertConfig({
        title: "Error",
        message: e?.message || "Could not send invite.",
      });
      setAlertVisible(true);
    }
  };

  const acceptIncomingRequest = async (targetUser: any) => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const senderId = targetUser.id;

    try {
      const meSnap = await getDoc(doc(db, "users", myId));
      const meData = meSnap.exists() ? (meSnap.data() as any) : {};
      const myName = meData?.displayName || auth.currentUser.displayName || "User";
      const myImageUrl = meData?.imageurl || null;
      const senderName = targetUser.displayName || "User";
      const senderImageUrl = targetUser.imageurl || null;

      const batch = writeBatch(db);
      batch.set(doc(db, "users", myId, "friends", senderId), {
        synqCount: 0,
        since: serverTimestamp(),
        displayName: senderName,
        imageurl: senderImageUrl,
        notifyOnCreate: true,
      });
      batch.set(doc(db, "users", senderId, "friends", myId), {
        synqCount: 0,
        since: serverTimestamp(),
        displayName: myName,
        imageurl: myImageUrl,
      });
      batch.delete(doc(db, "users", myId, "friendRequests", senderId));
      await batch.commit();

      incomingCheckCacheRef.current[senderId] = false;
      setIncomingRequestIds((prev) => ({ ...prev, [senderId]: false }));
      setAcceptedIds((prev) => ({ ...prev, [senderId]: true }));
      await deleteDoc(doc(db, "users", senderId, "friendRequests", myId)).catch(() => {});

      setAlertConfig({
        title: "Success",
        message: `You are now connected with ${senderName}!`,
      });
      setAlertVisible(true);
    } catch (e: any) {
      setAlertConfig({
        title: "Error",
        message: e?.message || "Could not accept request.",
      });
      setAlertVisible(true);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalBody}>
        <StatusBar barStyle="light-content" />

        <View style={styles.searchHeader}>
          <Text style={styles.searchTitle}>Add friends</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={28} color="#444" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchInputWrap}>
          <TextInput
            placeholder="Search by name..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={styles.searchInput}
            value={queryText}
            onChangeText={searchUsers}
            autoCapitalize="none"
          />
        </View>

        {!queryText && suggested.length > 0 && (
          <View style={{ marginTop: 10, paddingBottom: 160 }}>
            <View style={styles.suggestedHeaderRow}>
              <Text style={styles.sectionLabel}>Suggested</Text>
              {isSuggestedRefreshing && <View style={styles.suggestedRefreshingDot} />}
            </View>
            <FlatList
              data={suggested}
              keyExtractor={(item) => item.id}
              scrollEnabled={true}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={Keyboard.dismiss}
              ListFooterComponent={<View style={{ height: 40 }} />}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <View style={styles.searchResult}>
                  <TouchableOpacity
                    onPress={() => {
                      router.push({
                        pathname: "/friend-profile",
                        params: { friendId: item.id },
                      });
                    }}
                    style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.avatar}>
                      <ExpoImage
                        source={{ uri: resolveAvatar(item.imageurl) }}
                        style={styles.img}
                        cachePolicy="memory-disk"
                        transition={0}
                      />
                    </View>

                    <View style={{ paddingRight: 12 }}>
                      <Text style={styles.friendName}>
                        {item.displayName || "User"}
                      </Text>
                      <Text style={styles.mutualText}>
                        {item.mutualCount} mutual{" "}
                        {item.mutualCount === 1 ? "friend" : "friends"}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      if (incomingRequestIds[item.id]) {
                        acceptIncomingRequest(item);
                      } else {
                        sendInvite(item);
                      }
                    }}
                    style={[
                      styles.addBtn,
                      incomingRequestIds[item.id] && styles.acceptOutlineBtn,
                      (pendingRequestIds[item.id] || acceptedIds[item.id]) && styles.addBtnDisabled,
                    ]}
                    activeOpacity={0.8}
                    disabled={!!pendingRequestIds[item.id] || !!acceptedIds[item.id]}
                  >
                    <Text
                      style={[
                        styles.addBtnText,
                        incomingRequestIds[item.id] && styles.acceptOutlineText,
                        (pendingRequestIds[item.id] || acceptedIds[item.id]) && styles.addBtnDisabledText,
                      ]}
                    >
                      {acceptedIds[item.id]
                        ? "Friends"
                        : incomingRequestIds[item.id]
                          ? "Accept"
                          : pendingRequestIds[item.id]
                            ? "Pending"
                            : "Add"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListFooterComponent={<View style={{ height: 40 }} />}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <View style={styles.searchResult}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <View style={styles.avatar}>
                    <ExpoImage
                      source={{ uri: resolveAvatar(item.imageurl) }}
                      style={styles.img}
                      cachePolicy="memory-disk"
                      transition={0}
                    />
                  </View>
                  <View style={{ paddingRight: 12 }}>
                    <Text style={styles.friendName}>
                      {item.displayName || "User"}
                    </Text>
                    <Text style={styles.secondaryDetail}>{getResultSubtitle(item)}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    if (incomingRequestIds[item.id]) {
                      acceptIncomingRequest(item);
                      return;
                    }
                    if (!currentFriends.includes(item.id) && !pendingRequestIds[item.id] && !acceptedIds[item.id]) {
                      sendInvite(item);
                    }
                  }}
                  style={[
                    styles.addBtn,
                    incomingRequestIds[item.id] && styles.acceptOutlineBtn,
                    (currentFriends.includes(item.id) || pendingRequestIds[item.id] || acceptedIds[item.id]) && styles.addBtnDisabled
                  ]}
                  disabled={currentFriends.includes(item.id) || !!pendingRequestIds[item.id] || !!acceptedIds[item.id]}
                >
                  <Text
                    style={[
                      styles.addBtnText,
                      incomingRequestIds[item.id] && styles.acceptOutlineText,
                      (currentFriends.includes(item.id) || pendingRequestIds[item.id] || acceptedIds[item.id]) && styles.addBtnDisabledText,
                    ]}
                  >
                    {currentFriends.includes(item.id) || acceptedIds[item.id]
                      ? "Friends"
                      : incomingRequestIds[item.id]
                        ? "Accept"
                      : pendingRequestIds[item.id]
                        ? "Pending"
                        : "Add"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      </View>
      <AlertModal
        visible={alertVisible}
        title={alertConfig?.title}
        message={alertConfig?.message || ""}
        onClose={() => setAlertVisible(false)}
      />
    </Modal>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 88,
    alignItems: "flex-start",
  },
  headerTitleBlock: { flex: 1, paddingRight: 12 },
  headerTitle: { color: TEXT, fontSize: 28, fontFamily: fonts.heavy, letterSpacing: 0.2 },
  headerAction: { paddingLeft: 12, paddingVertical: 6 },
  headerDivider: { marginTop: 16, height: 1, backgroundColor: BORDER },
  friendRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  separator: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginLeft: 66,
  },
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 50,
    backgroundColor: SURFACE,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    borderWidth: 1,
    borderColor: BORDER
  },
  img: {
    width: 55,
    height: 55,
    borderRadius: 50,
  },
  friendName: { color: TEXT, fontSize: 18, fontFamily: fonts.heavy },
  mutualText: { color: MUTED2, fontSize: 13, fontFamily: fonts.book, marginTop: 3 },
  friendsList: { flex: 1 },
  friendsListContent: { paddingBottom: 40 },
  friendsListContentEmpty: { flexGrow: 1, paddingBottom: 40 },
  emptyStateCenter: {
    flex: 1,
    paddingTop: SPACE_5,
    paddingHorizontal: SPACE_3,
    paddingBottom: SPACE_5,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 360,
  },
  /** Friends list empty (no icon) — vertically centered in the list area. */
  emptyStateMain: {
    flex: 1,
    paddingHorizontal: SPACE_5,
    paddingVertical: SPACE_6,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  emptyHeroBlock: {
    alignItems: "center",
    width: "100%",
  },
  /** Matches `headerTitle` on this screen (28 / Heavy) for visual consistency. */
  emptyHeroTitle: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0.2,
    textAlign: "center",
    width: "100%",
  },
  emptyHeroSubtitle: {
    color: MUTED,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    lineHeight: 24,
    textAlign: "center",
    marginTop: SPACE_5,
    maxWidth: 340,
  },
  emptyHeroHint: {
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION + 1,
    lineHeight: 20,
    textAlign: "center",
    marginTop: SPACE_4,
    maxWidth: 320,
  },
  emptyPrimaryCtaWrap: {
    alignSelf: "stretch",
    width: "100%",
    marginTop: SPACE_6 + SPACE_3,
  },
  emptyPrimaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE_3,
    width: "100%",
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 18,
    paddingHorizontal: SPACE_5,
    minHeight: 56,
  },
  emptyPrimaryCtaText: {
    color: "#061006",
    fontFamily: fonts.heavy,
    fontSize: 17,
    letterSpacing: 0.2,
  },
  emptySecondaryBtn: { marginTop: SPACE_4, paddingVertical: 8, paddingHorizontal: 12 },
  emptySecondaryBtnText: { color: ACCENT, fontFamily: fonts.heavy, fontSize: 15 },
  emptyContainer: { flex: 1, justifyContent: "center", marginTop: 30, paddingHorizontal: 10 },
  emptyCard: {
    backgroundColor: SURFACE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
  },
  emptyTitle: { color: TEXT, textAlign: "center", fontFamily: fonts.heavy, fontSize: 18 },
  emptyText: { color: MUTED, textAlign: "center", fontFamily: fonts.book, fontSize: 14, marginTop: 12, lineHeight: 20, paddingHorizontal: 8 },
  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  popupContent: {
    width: width * 0.9,
    maxHeight: "86%",
    backgroundColor: "rgba(18,18,18,0.96)",
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  closeBtn: { position: "absolute", top: 16, right: 16, padding: 8, zIndex: 2 },
  largeAvatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
    marginTop: 10,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  popupName: { color: TEXT, fontSize: 24, fontFamily: fonts.heavy, letterSpacing: 0.2 },
  popupLocation: { marginTop: 6, color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: fonts.book },
  popupLocationText: { color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: fonts.book },
  interestsContainer: { width: "100%", marginTop: 10, marginBottom: 10 },
  sectionLabel: {
    color: MUTED2,
    fontSize: 16,
    fontFamily: fonts.heavy,
    marginBottom: 10,
    letterSpacing: 0.9,
  },
  interestsScroll: { maxHeight: 150, width: "100%" },
  interestsWrapper: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", paddingBottom: 4 },
  interestPill: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: { color: TEXT, fontFamily: fonts.book, fontSize: 13 },
  noInterestsText: {
    color: MUTED2,
    fontSize: 13,
    fontFamily: fonts.book,
    fontStyle: "italic",
    textAlign: "left",
    alignSelf: "flex-start",
    width: "100%",
  },
  removeBtn: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 12 },
  removeBtnText: { color: "#ff453a", fontFamily: fonts.heavy, fontSize: 14 },
  modalBody: { flex: 1, backgroundColor: BG, padding: 20 },
  searchHeader: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  searchTitle: { color: TEXT, fontSize: 28, fontFamily: fonts.heavy, letterSpacing: 0.2 },
  cancelText: { color: ACCENT, fontFamily: fonts.book, fontSize: 16 },
  searchInputWrap: { marginTop: 14, marginBottom: 12 },
  searchInput: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    color: TEXT,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    fontFamily: fonts.medium,
    fontSize: 16,
  },
  searchResult: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  secondaryDetail: { color: MUTED2, fontSize: 13, fontFamily: fonts.book, marginTop: 2 },
  addBtn: { backgroundColor: ACCENT, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14 },
  acceptOutlineBtn: { backgroundColor: "transparent", borderWidth: 1, borderColor: ACCENT },
  addBtnDisabled: { opacity: 0.45, backgroundColor: "#3f3f3f" },
  addBtnText: { color: "#061006", fontFamily: fonts.heavy, fontSize: 14, letterSpacing: 0.2 },
  acceptOutlineText: { color: ACCENT },
  addBtnDisabledText: { color: "rgba(255,255,255,0.85)" },
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 14,
    marginBottom: 6,
  },
  searchBarInput: {
    flex: 1,
    color: TEXT,
    marginLeft: 8,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  suggestedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  suggestedRefreshingDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: ACCENT,
    opacity: 0.85,
    marginRight: 2,
  },
  refreshingDot: {
    position: "absolute",
    top: 78,
    right: 24,
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: ACCENT,
    opacity: 0.85,
  },
});
