import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  fonts,
  Friend,
  MUTED,
  MUTED2,
  MUTED3,
  profileScreenSectionTitle,
  RADIUS_LG,
  RADIUS_MD,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE,
  tabScreenMainHeaderTitle,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_SECTION,
} from "@/constants/Variables";
import { useBlockedUsers } from "@/src/lib/blockedUsers";
import {
  buildFriendDistanceMap,
  resolveOriginCoords,
  sortFriendsByDistanceKm,
  sortFriendsByNameWithNoLocationLast,
} from "@/src/lib/friendDistance";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  SectionList,
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
import { LOCATION_PROMPT_CHECK_REQUEST } from "../../src/lib/locationPromptEvents";
import {
  type Connection,
  connectionsCacheByUser,
  friendProfileCacheByUser,
  friendsListCacheByUser,
  suggestedCacheByUser,
  warmFriendsAndConnectionsCache,
  warmSuggestedCache,
} from "../../src/lib/socialCache";
import AlertModal from "../alert-modal";
import { friendLocationLine, resolveAvatar } from "../helpers";

const { width } = Dimensions.get("window");

type FriendsSortMode = "alphabetical" | "distance";

const sortFriendsByName = (list: Friend[]) =>
  [...list].sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

function formatMyCityLabel(city: string, state: string): string {
  if (!city.trim()) return "";
  const c = city.trim();
  const s = state.trim();
  return s ? `${c}, ${s}` : c;
}

function splitDisplayName(displayName?: string | null) {
  const raw = (displayName || "").trim();
  if (!raw) return { first: "User", last: "" };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

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
    <TouchableOpacity
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityLabel="Add friends"
      activeOpacity={0.75}
    >
      <Animated.View style={[animatedStyle, styles.headerAddBtn]}>
        <Ionicons name="person-add-outline" size={20} color={ACCENT} />
      </Animated.View>
    </TouchableOpacity>
  );
}

function FriendsSortMenu({
  visible,
  sortMode,
  onSelect,
  onClose,
}: {
  visible: boolean;
  sortMode: FriendsSortMode;
  onSelect: (mode: FriendsSortMode) => void;
  onClose: () => void;
}) {
  const options: { mode: FriendsSortMode; label: string; hint: string }[] = [
    { mode: "alphabetical", label: "Alphabetical", hint: "A → Z by name" },
    { mode: "distance", label: "Distance", hint: "Nearest first (uses city when needed)" },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sortMenuOverlay} onPress={onClose}>
        <Pressable style={styles.sortMenuCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sortMenuTitle}>Sort friends</Text>
          {options.map((option) => {
            const selected = sortMode === option.mode;
            return (
              <TouchableOpacity
                key={option.mode}
                style={[styles.sortMenuOption, selected && styles.sortMenuOptionSelected]}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelect(option.mode);
                  onClose();
                }}
                activeOpacity={0.75}
              >
                <View style={styles.sortMenuOptionText}>
                  <Text style={styles.sortMenuOptionLabel}>{option.label}</Text>
                  <Text style={styles.sortMenuOptionHint}>{option.hint}</Text>
                </View>
                {selected ? (
                  <Ionicons name="checkmark" size={18} color={ACCENT} />
                ) : (
                  <View style={styles.sortMenuOptionSpacer} />
                )}
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
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
          <Text style={styles.emptyHeroAccent}>Your friends.</Text>
          {"\n"}Your plans.
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
  const cachedTopSynqs = myId ? connectionsCacheByUser[myId] ?? [] : [];
  const [friends, setFriends] = useState<Friend[]>(cachedFriends);
  const [topSynqs, setTopSynqs] = useState<Connection[]>(cachedTopSynqs);
  const [hasLoadedTopSynqs, setHasLoadedTopSynqs] = useState(cachedTopSynqs.length > 0);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [isFriendsInitialLoading, setIsFriendsInitialLoading] = useState(cachedFriends.length === 0);
  const [searchText, setSearchText] = useState("");
  const [sortMode, setSortMode] = useState<FriendsSortMode>("alphabetical");
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [myCityLabel, setMyCityLabel] = useState("");
  const [friendDistancesKm, setFriendDistancesKm] = useState<Record<string, number>>({});
  const [distanceSortReady, setDistanceSortReady] = useState(sortMode !== "distance");

  const routeShowsFriendProfile =
    (pathname ?? "").includes("friend-profile") ||
    segments.some((s) => typeof s === "string" && s.includes("friend-profile"));
  const showAddFriendsModal =
    searchModalVisible && isFriendsTabFocused && !routeShowsFriendProfile;

  useEffect(() => {
    if (openAddFriends !== "1") return;
    setSearchModalVisible(true);
  }, [openAddFriends]);

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => {
        DeviceEventEmitter.emit(LOCATION_PROMPT_CHECK_REQUEST);
      }, 1000);
      return () => clearTimeout(t);
    }, [])
  );

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    getDoc(doc(db, "users", myId))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const data = snap.data() as {
          lat?: unknown;
          lng?: unknown;
          city?: unknown;
          state?: unknown;
          locationDisplay?: unknown;
        };
        const lat = typeof data.lat === "number" ? data.lat : null;
        const lng = typeof data.lng === "number" ? data.lng : null;
        if (lat != null && lng != null) {
          setMyCoords({ lat, lng });
        }
        const city = typeof data.city === "string" ? data.city : "";
        const state = typeof data.state === "string" ? data.state : "";
        const label =
          typeof data.locationDisplay === "string" && data.locationDisplay.trim()
            ? data.locationDisplay.trim()
            : formatMyCityLabel(city, state);
        if (label) setMyCityLabel(label);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [myId]);

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
        setTopSynqs(connectionsCacheByUser[myId] ?? []);
        setHasLoadedTopSynqs(true);
      }
    });

    return () => {
      unsubFriends();
    };
  }, []);

  const { isBlocked } = useBlockedUsers();

  useEffect(() => {
    if (sortMode !== "distance") {
      setDistanceSortReady(true);
      return;
    }

    let cancelled = false;
    setDistanceSortReady(false);

    (async () => {
      const origin = await resolveOriginCoords(myCoords, myCityLabel);
      if (cancelled) return;

      if (!origin || friends.length === 0) {
        setFriendDistancesKm({});
        setDistanceSortReady(true);
        return;
      }

      const map = await buildFriendDistanceMap(friends, origin);
      if (!cancelled) {
        setFriendDistancesKm(map);
        setDistanceSortReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sortMode, friends, myCoords, myCityLabel]);

  const displayFriends = useMemo(() => {
    const filtered = friends.filter((f) => {
      if (isBlocked(f.id)) return false;
      return (f.displayName || "")
        .toLowerCase()
        .includes(searchText.toLowerCase());
    });
    if (sortMode === "distance" && distanceSortReady) {
      return sortFriendsByDistanceKm(filtered, friendDistancesKm);
    }
    return sortFriendsByNameWithNoLocationLast(filtered);
  }, [friends, searchText, sortMode, distanceSortReady, friendDistancesKm, isBlocked]);

  const showFriendSearch = friends.length > 0 && !isFriendsInitialLoading;
  const listIsEmpty = displayFriends.length === 0;

  const hasTopSynqActivity = topSynqs.some((t) => (t.synqCount ?? 0) > 0);

  const renderSkeletonRow = (key: string) => (
    <View key={key} style={styles.friendCard}>
      <View style={[styles.avatarRing, styles.skeletonBlock]} />
      <View style={{ flex: 1 }}>
        <View style={[styles.skeletonBlock, { height: 14, width: "55%", marginBottom: 8 }]} />
        <View style={[styles.skeletonBlock, { height: 12, width: "38%" }]} />
      </View>
    </View>
  );

  const renderPodiumSlot = (
    item: Connection | undefined,
    rank: number,
    avatarSize: number,
    key: string
  ) => {
    if (!item) return <View key={key} style={styles.podiumSlotEmpty} />;

    const isFirst = rank === 1;
    return (
      <View key={key} style={[styles.podiumSlot, isFirst && styles.podiumSlotFirst]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({
              pathname: "/friend-profile",
              params: { friendId: item.id },
            });
          }}
          style={styles.podiumAvatarPress}
        >
          <View
            style={[
              styles.podiumAvatarRing,
              isFirst && styles.podiumAvatarRingFirst,
              { width: avatarSize + 6, height: avatarSize + 6, borderRadius: (avatarSize + 6) / 2 },
            ]}
          >
            <ExpoImage
              source={{ uri: resolveAvatar(item.imageUrl) }}
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
              }}
              cachePolicy="memory-disk"
              transition={120}
            />
          </View>
        </TouchableOpacity>
        <Text style={[styles.connName, isFirst && styles.connNameFirst]} numberOfLines={1}>
          {item.name.split(" ")[0]}
        </Text>
      </View>
    );
  };

  const renderTopSynqsPodium = () => (
    <View style={styles.topSynqsCard}>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,255,133,0.1)", "rgba(0,255,133,0.03)", "rgba(255,255,255,0.02)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.topSynqsCardInner}>
        <Text style={[styles.listSectionLabel, styles.listSectionLabelCard]}>Top Synqs</Text>
        <View style={styles.podiumRow}>
          {(() => {
            const topThree = topSynqs.slice(0, 3);
            const slots: { item: Connection | undefined; rank: number; size: number }[] = [
              { item: topThree[1], rank: 2, size: 52 },
              { item: topThree[0], rank: 1, size: 68 },
              { item: topThree[2], rank: 3, size: 52 },
            ];
            return slots.map((slot) =>
              renderPodiumSlot(slot.item, slot.rank, slot.size, `podium-${slot.rank}`)
            );
          })()}
        </View>
      </View>
    </View>
  );

  const renderTopSynqsSection = () => {
    if (!hasLoadedTopSynqs || !hasTopSynqActivity) {
      return null;
    }

    return (
      <View style={styles.topSynqsSection}>
        {renderTopSynqsPodium()}
      </View>
    );
  };

  const renderFriendsListHeader = () => {
    const topSynqsBlock = renderTopSynqsSection();
    const showAllFriendsHeader = friends.length > 0;

    return (
      <>
        {topSynqsBlock}
        {showAllFriendsHeader ? (
          <View
            style={[
              styles.allFriendsSection,
              topSynqsBlock != null && styles.allFriendsSectionInset,
            ]}
          >
            <View style={styles.allFriendsSectionHeader}>
              <Text style={[styles.listSectionLabel, styles.listSectionLabelRow]}>
                All friends
              </Text>
              <View style={styles.allFriendsTrailing}>
                <View style={styles.friendCountPill}>
                  <Text style={styles.friendCountPillText}>{friends.length}</Text>
                </View>
                <TouchableOpacity
                  style={styles.sortBtn}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSortMenuVisible(true);
                  }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Sort friends"
                >
                  <Ionicons
                    name="swap-vertical-outline"
                    size={18}
                    color={sortMode === "distance" ? ACCENT : MUTED2}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.friendsListHeaderSpacerNoTopSynqs} />
        )}
      </>
    );
  };

  const renderFriendRow = ({ item }: { item: Friend }) => {
    const locationLine = friendLocationLine(item);
    const fallbackLoc =
      typeof (item as any)?.location === "string" && (item as any).location.trim()
        ? (item as any).location
        : "";
    const locationText = locationLine || fallbackLoc || "";
    const nameParts = splitDisplayName(item.displayName);

    return (
    <TouchableOpacity
      style={styles.friendCard}
      activeOpacity={0.72}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
          pathname: "/friend-profile",
          params: { friendId: item.id },
        });
      }}
    >
      <View style={styles.avatarRing}>
        <ExpoImage
          source={{ uri: resolveAvatar((item as any)?.imageurl) }}
          style={styles.img}
          cachePolicy="memory-disk"
          transition={120}
        />
      </View>

      <View style={styles.friendRowContent}>
        <Text style={styles.friendRowName} numberOfLines={1}>
          <Text style={styles.friendNameAccent}>{nameParts.first}</Text>
          {nameParts.last.length > 0 ? (
            <Text style={styles.friendNameAccent}> {nameParts.last}</Text>
          ) : null}
        </Text>
        {locationText.length > 0 && (
          <View style={styles.friendRowMeta}>
            <Ionicons
              name="location-outline"
              size={12}
              color={MUTED2}
              style={styles.friendRowMetaIcon}
            />
            <Text style={styles.friendRowLocation} numberOfLines={1}>
              {locationText}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.friendChevronWrap}>
        <Icon name="chevron-forward" size={16} color={MUTED3} />
      </View>
    </TouchableOpacity>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,255,133,0.09)", "rgba(0,255,133,0.02)", "transparent"]}
          locations={[0, 0.45, 1]}
          style={styles.ambientGlow}
        />
        <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
        <FriendsHeaderAddButton
          pulse={!isFriendsInitialLoading && friends.length === 0}
          onPress={() => setSearchModalVisible(true)}
        />
      </View>
      {showFriendSearch && (
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={MUTED3} />
          <TextInput
            placeholder="Search"
            placeholderTextColor={MUTED3}
            style={styles.searchBarInput}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={14} color={MUTED2} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {isFriendsInitialLoading ? (
        <View style={{ paddingBottom: 20 }}>
          {renderFriendsListHeader()}
          {["1", "2", "3"].map((k) => renderSkeletonRow(k))}
        </View>
      ) : (
        <FlatList
          style={styles.friendsList}
          data={displayFriends}
          keyExtractor={(item) => item.id}
          renderItem={renderFriendRow}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          ListFooterComponent={<View style={{ height: 40 }} />}
          contentContainerStyle={listIsEmpty ? styles.friendsListContentEmpty : styles.friendsListContent}
          ListHeaderComponent={renderFriendsListHeader()}
          ListEmptyComponent={
            <FriendsListEmpty
              hasFriends={friends.length > 0}
              searchText={searchText}
              onAddFriends={() => setSearchModalVisible(true)}
              onClearSearch={() => setSearchText("")}
            />
          }
        />
      )}
        <SearchModal
          visible={showAddFriendsModal}
          onClose={() => setSearchModalVisible(false)}
          currentFriends={friends.map((f) => f.id)}
        />
        <FriendsSortMenu
          visible={sortMenuVisible}
          sortMode={sortMode}
          onSelect={setSortMode}
          onClose={() => setSortMenuVisible(false)}
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
  const [incomingRequestsRows, setIncomingRequestsRows] = useState<any[]>([]);
  const [outgoingRequestsRows, setOutgoingRequestsRows] = useState<any[]>([]);
  const [pendingRequestIds, setPendingRequestIds] = useState<Record<string, boolean>>({});
  const [incomingRequestIds, setIncomingRequestIds] = useState<Record<string, boolean>>({});
  const [acceptedIds, setAcceptedIds] = useState<Record<string, boolean>>({});
  const [isSearching, setIsSearching] = useState(false);
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

    const fetchSuggested = () => {
      const myId = auth.currentUser!.uid;
      const applySuggested = (list: any[]) => {
        const visible = list.filter(
          (u) => !currentFriends.includes(u.id) && u.id !== myId
        );
        setSuggested(visible);
        hydratePendingForUsers(visible.map((u) => u.id));
        hydrateIncomingForUsers(visible.map((u) => u.id));
        visible.forEach((user) => {
          ExpoImage.prefetch(resolveAvatar(user?.imageurl)).catch(() => {});
        });
      };

      const cached = suggestedCacheByUser[myId] ?? [];
      if (cached.length > 0) {
        applySuggested(cached);
      }

      void warmSuggestedCache(myId)
        .then(() => {
          if (!auth.currentUser || auth.currentUser.uid !== myId) return;
          const next = suggestedCacheByUser[myId] ?? [];
          suggestedCacheByUser[myId] = next;
          applySuggested(next);
        })
        .catch((e) => console.error("[Suggested] refresh failed:", e));
    };

    fetchSuggested();
  }, [visible]);

  useEffect(() => {
    if (!visible || !auth.currentUser) {
      setIncomingRequestsRows([]);
      return;
    }
    const myId = auth.currentUser.uid;
    const reqRef = collection(db, "users", myId, "friendRequests");
    const unsubscribe = onSnapshot(
      reqRef,
      (snapshot) => {
        const rows = snapshot.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const friendRequestDocId = d.id;
          const senderId =
            (typeof data.from === "string" && data.from) ||
            (typeof data.fromId === "string" && data.fromId) ||
            friendRequestDocId;
          return {
            id: senderId,
            friendRequestDocId,
            displayName:
              (typeof data.senderName === "string" && data.senderName) ||
              (typeof data.fromName === "string" && data.fromName) ||
              "Someone",
            imageurl:
              (typeof data.senderImageUrl === "string" && data.senderImageUrl) ||
              (typeof data.fromImageUrl === "string" && data.fromImageUrl) ||
              (typeof data.fromImageurl === "string" && data.fromImageurl) ||
              null,
          };
        });
        rows.forEach((user) => {
          ExpoImage.prefetch(resolveAvatar(user?.imageurl)).catch(() => {});
          incomingCheckCacheRef.current[user.id] = true;
        });
        setIncomingRequestsRows(rows);
        setIncomingRequestIds((prev) => {
          const next = { ...prev };
          rows.forEach((r) => {
            next[r.id] = true;
          });
          return next;
        });
        rows.forEach((row) => {
          void getDoc(doc(db, "users", row.id))
            .then((senderSnap) => {
              if (!senderSnap.exists()) return;
              const u = senderSnap.data() as Record<string, unknown>;
              setIncomingRequestsRows((prev) =>
                prev.map((r) =>
                  r.id === row.id
                    ? {
                        ...r,
                        displayName: (u.displayName as string) || r.displayName,
                        imageurl: (u.imageurl as string | null | undefined) ?? r.imageurl,
                      }
                    : r
                )
              );
            })
            .catch(() => {});
        });
      },
      (e) => console.error("[SearchModal] friendRequests snapshot:", e)
    );
    return () => unsubscribe();
  }, [visible]);

  useEffect(() => {
    if (!visible || !auth.currentUser) {
      setOutgoingRequestsRows([]);
      return;
    }
    const myId = auth.currentUser.uid;
    const outgoingRef = collection(db, "users", myId, "outgoingFriendRequests");
    const unsubscribe = onSnapshot(
      outgoingRef,
      (snapshot) => {
        const rows = snapshot.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            displayName:
              (typeof data.displayName === "string" && data.displayName) ||
              (typeof data.toName === "string" && data.toName) ||
              "User",
            imageurl:
              (typeof data.imageurl === "string" && data.imageurl) || null,
          };
        });

        rows.forEach((user) => {
          pendingCheckCacheRef.current[user.id] = true;
          ExpoImage.prefetch(resolveAvatar(user.imageurl)).catch(() => {});
        });
        setOutgoingRequestsRows(rows);
        setPendingRequestIds((prev) => {
          const next = { ...prev };
          rows.forEach((r) => {
            next[r.id] = true;
          });
          return next;
        });
        rows.forEach((row) => {
          if (row.displayName !== "User" && row.imageurl) return;
          void getDoc(doc(db, "users", row.id))
            .then((recipientSnap) => {
              if (!recipientSnap.exists()) return;
              const u = recipientSnap.data() as Record<string, unknown>;
              setOutgoingRequestsRows((prev) =>
                prev.map((r) =>
                  r.id === row.id
                    ? {
                        ...r,
                        displayName: (u.displayName as string) || r.displayName,
                        imageurl: (u.imageurl as string | null | undefined) ?? r.imageurl,
                      }
                    : r
                )
              );
              ExpoImage.prefetch(resolveAvatar(u.imageurl as string)).catch(() => {});
            })
            .catch(() => {});
        });
      },
      (e) => console.error("[SearchModal] outgoingFriendRequests snapshot:", e)
    );
    return () => unsubscribe();
  }, [visible]);

  const debounceRef = React.useRef<any>(null);
  const pendingCheckCacheRef = React.useRef<Record<string, boolean>>({});
  const pendingCheckInFlightRef = React.useRef<Record<string, Promise<boolean>>>({});
  const incomingCheckCacheRef = React.useRef<Record<string, boolean>>({});
  const incomingCheckInFlightRef = React.useRef<Record<string, Promise<boolean>>>({});

  const hydratePendingForUsers = (userIds: string[]) => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

    uniqueIds.forEach((targetId) => {
      if (currentFriends.includes(targetId)) {
        pendingCheckCacheRef.current[targetId] = false;
        setPendingRequestIds((prev) => ({ ...prev, [targetId]: false }));
        return;
      }
      if (pendingCheckCacheRef.current[targetId] !== undefined) {
        setPendingRequestIds((prev) => ({
          ...prev,
          [targetId]: pendingCheckCacheRef.current[targetId],
        }));
        return;
      }
      const apply = (isPending: boolean) => {
        pendingCheckCacheRef.current[targetId] = isPending;
        setPendingRequestIds((prev) => ({ ...prev, [targetId]: isPending }));
        if (isPending && auth.currentUser) {
          void setDoc(
            doc(db, "users", myId, "outgoingFriendRequests", targetId),
            { to: targetId, sentAt: serverTimestamp() },
            { merge: true }
          ).catch(() => {});
        }
      };
      const inFlight = pendingCheckInFlightRef.current[targetId];
      if (inFlight) {
        void inFlight.then(apply);
        return;
      }
      pendingCheckInFlightRef.current[targetId] = getDoc(
        doc(db, "users", targetId, "friendRequests", myId)
      )
        .then((snap) => snap.exists())
        .catch(() => false)
        .finally(() => {
          delete pendingCheckInFlightRef.current[targetId];
        });
      void pendingCheckInFlightRef.current[targetId].then(apply);
    });
  };

  const hydrateIncomingForUsers = (userIds: string[]) => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

    uniqueIds.forEach((targetId) => {
      if (currentFriends.includes(targetId) || acceptedIds[targetId]) {
        incomingCheckCacheRef.current[targetId] = false;
        setIncomingRequestIds((prev) => ({ ...prev, [targetId]: false }));
        return;
      }
      if (incomingCheckCacheRef.current[targetId] !== undefined) {
        setIncomingRequestIds((prev) => ({
          ...prev,
          [targetId]: incomingCheckCacheRef.current[targetId],
        }));
        return;
      }
      const apply = (isIncoming: boolean) => {
        incomingCheckCacheRef.current[targetId] = isIncoming;
        setIncomingRequestIds((prev) => ({ ...prev, [targetId]: isIncoming }));
      };
      const inFlight = incomingCheckInFlightRef.current[targetId];
      if (inFlight) {
        void inFlight.then(apply);
        return;
      }
      incomingCheckInFlightRef.current[targetId] = getDoc(
        doc(db, "users", myId, "friendRequests", targetId)
      )
        .then(async (snap) => {
          if (snap.exists()) return true;
          const legacyQ = query(
            collection(db, "users", myId, "friendRequests"),
            where("from", "==", targetId),
            limit(1)
          );
          const legacySnap = await getDocs(legacyQ);
          return !legacySnap.empty;
        })
        .catch(() => false)
        .finally(() => {
          delete incomingCheckInFlightRef.current[targetId];
        });
      void incomingCheckInFlightRef.current[targetId].then(apply);
    });
  };

  const incomingRequestsVisible = useMemo(
    () => incomingRequestsRows.filter((r) => !currentFriends.includes(r.id)),
    [incomingRequestsRows, currentFriends]
  );

  const incomingIds = useMemo(
    () => new Set(incomingRequestsVisible.map((r) => r.id)),
    [incomingRequestsVisible]
  );

  const outgoingRequestsVisible = useMemo(
    () =>
      outgoingRequestsRows.filter(
        (r) => !currentFriends.includes(r.id) && !incomingIds.has(r.id)
      ),
    [outgoingRequestsRows, currentFriends, incomingIds]
  );

  const outgoingIds = useMemo(
    () => new Set(outgoingRequestsVisible.map((r) => r.id)),
    [outgoingRequestsVisible]
  );

  const pymkSuggested = useMemo(
    () =>
      suggested.filter((u) => !incomingIds.has(u.id) && !outgoingIds.has(u.id)),
    [suggested, incomingIds, outgoingIds]
  );

  const addFriendsSections = useMemo(() => {
    const sections: {
      title: string;
      data: any[];
      isFirstSection?: boolean;
    }[] = [];
    if (incomingRequestsVisible.length > 0) {
      sections.push({
        title: "Friend requests",
        data: incomingRequestsVisible,
        isFirstSection: sections.length === 0,
      });
    }
    if (outgoingRequestsVisible.length > 0) {
      sections.push({
        title: "Sent requests",
        data: outgoingRequestsVisible,
        isFirstSection: sections.length === 0,
      });
    }
    if (pymkSuggested.length > 0) {
      sections.push({
        title: "People you may know",
        data: pymkSuggested,
        isFirstSection: sections.length === 0,
      });
    }
    return sections;
  }, [incomingRequestsVisible, outgoingRequestsVisible, pymkSuggested]);

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

        const mapped = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

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

          return u.id !== auth.currentUser?.uid && matches;
        });

        setResults(filtered);
        hydratePendingForUsers(filtered.map((u) => u.id));
        hydrateIncomingForUsers(filtered.map((u) => u.id));
      } catch (e) {
        console.error("[SearchModal] Search failed", e);
        setResults([]);
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

      const outgoingRef = doc(db, "users", myId, "outgoingFriendRequests", targetId);
      const batch = writeBatch(db);
      batch.set(requestDocRef, payload);
      batch.set(outgoingRef, {
        to: targetId,
        displayName: targetUser.displayName || null,
        imageurl: targetUser.imageurl || null,
        sentAt: serverTimestamp(),
      });
      batch.commit().catch((e: any) => {
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

  const cancelOutgoingRequest = async (targetUser: any) => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const targetId = targetUser.id;

    pendingCheckCacheRef.current[targetId] = false;
    setPendingRequestIds((prev) => ({ ...prev, [targetId]: false }));

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", targetId, "friendRequests", myId));
      batch.delete(doc(db, "users", myId, "outgoingFriendRequests", targetId));
      await batch.commit();
    } catch (e: any) {
      pendingCheckCacheRef.current[targetId] = true;
      setPendingRequestIds((prev) => ({ ...prev, [targetId]: true }));
      setAlertConfig({
        title: "Error",
        message: e?.message || "Could not cancel request.",
      });
      setAlertVisible(true);
    }
  };

  const handlePendingLongPress = (targetUser: any) => {
    const isPending =
      pendingRequestIds[targetUser.id] || outgoingIds.has(targetUser.id);
    if (!isPending) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Cancel friend request?",
      `Withdraw your request to ${targetUser.displayName || "this user"}?`,
      [
        { text: "Keep pending", style: "cancel" },
        {
          text: "Cancel request",
          style: "destructive",
          onPress: () => void cancelOutgoingRequest(targetUser),
        },
      ]
    );
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
      const requestDocId = targetUser.friendRequestDocId ?? senderId;
      batch.delete(doc(db, "users", myId, "friendRequests", requestDocId));
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

  const declineIncomingRequest = async (targetUser: any) => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const senderId = targetUser.id;
    const requestDocId = targetUser.friendRequestDocId ?? senderId;

    try {
      Keyboard.dismiss();
      await deleteDoc(doc(db, "users", myId, "friendRequests", requestDocId));
      await deleteDoc(doc(db, "users", senderId, "friendRequests", myId)).catch(() => {});

      incomingCheckCacheRef.current[senderId] = false;
      setIncomingRequestIds((prev) => ({ ...prev, [senderId]: false }));
    } catch (e: any) {
      setAlertConfig({
        title: "Error",
        message: e?.message || "Could not decline request.",
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

        {!queryText ? (
          <View style={{ flex: 1, marginTop: 10 }}>
            {addFriendsSections.length > 0 ? (
            <SectionList
              sections={addFriendsSections}
              keyExtractor={(item) => item.id}
              scrollEnabled={true}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={Keyboard.dismiss}
              stickySectionHeadersEnabled={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListFooterComponent={<View style={{ height: 40 }} />}
              SectionSeparatorComponent={() => null}
              renderSectionHeader={({ section }) => (
                <View
                  style={[
                    styles.suggestedHeaderRow,
                    { marginTop: section.isFirstSection ? 0 : 18 },
                  ]}
                >
                  <Text style={styles.sectionLabel}>{section.title}</Text>
                </View>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item, section }) => {
                const isFriendRequests = section.title === "Friend requests";
                const isSentRequests = section.title === "Sent requests";
                if (isFriendRequests) {
                  return (
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
                          <Text style={styles.mutualText}>Sent you a request</Text>
                        </View>
                      </TouchableOpacity>
                      <View style={styles.requestActionBtns}>
                        <TouchableOpacity
                          onPress={() => declineIncomingRequest(item)}
                          style={styles.declineBtn}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.declineBtnText}>Decline</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => acceptIncomingRequest(item)}
                          style={[styles.addBtn, styles.acceptOutlineBtn]}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.addBtnText, styles.acceptOutlineText]}>Accept</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }
                if (isSentRequests) {
                  return (
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
                          <Text style={styles.mutualText}>Request sent</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onLongPress={() => handlePendingLongPress(item)}
                        delayLongPress={400}
                        style={[styles.addBtn, styles.addBtnDisabled]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.addBtnText, styles.addBtnDisabledText]}>
                          Pending
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
                return (
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
                        } else if (!pendingRequestIds[item.id] && !acceptedIds[item.id]) {
                          sendInvite(item);
                        }
                      }}
                      onLongPress={() => handlePendingLongPress(item)}
                      delayLongPress={400}
                      style={[
                        styles.addBtn,
                        incomingRequestIds[item.id] && styles.acceptOutlineBtn,
                        (pendingRequestIds[item.id] || acceptedIds[item.id]) && styles.addBtnDisabled,
                      ]}
                      activeOpacity={0.8}
                      disabled={!!acceptedIds[item.id]}
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
                );
              }}
            />
            ) : null}
          </View>
        ) : (
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
                  onLongPress={() => handlePendingLongPress(item)}
                  delayLongPress={400}
                  style={[
                    styles.addBtn,
                    incomingRequestIds[item.id] && styles.acceptOutlineBtn,
                    (currentFriends.includes(item.id) || pendingRequestIds[item.id] || acceptedIds[item.id]) && styles.addBtnDisabled
                  ]}
                  disabled={currentFriends.includes(item.id) || !!acceptedIds[item.id]}
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
        )}
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
  ambientGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 88,
    marginBottom: 10,
    minHeight: 44,
  },
  headerTitle: {
    ...tabScreenMainHeaderTitle,
    flex: 1,
    lineHeight: 34,
    includeFontPadding: false,
  },
  headerAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAction: { paddingLeft: 12, paddingVertical: 6 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: RADIUS_MD,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 8,
  },
  searchBarInput: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: 15,
    paddingVertical: 0,
    minHeight: 20,
  },
  topSynqsSection: { marginTop: 6, marginBottom: 4 },
  topSynqsCard: {
    borderRadius: RADIUS_LG,
    borderWidth: 1,
    borderColor: "rgba(0,255,133,0.14)",
    overflow: "hidden",
    backgroundColor: SURFACE,
  },
  topSynqsCardInner: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
  },
  listSectionLabel: {
    color: TEXT,
    fontSize: TYPE_SECTION,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  listSectionLabelCard: {
    marginBottom: 14,
  },
  listSectionLabelRow: {
    flex: 1,
    paddingRight: 8,
    lineHeight: 26,
    includeFontPadding: false,
  },
  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 12,
    paddingTop: 4,
  },
  podiumSlot: {
    flex: 1,
    alignItems: "center",
    maxWidth: 96,
  },
  podiumSlotFirst: {
    marginBottom: 6,
  },
  podiumSlotEmpty: {
    flex: 1,
    maxWidth: 96,
  },
  podiumAvatarPress: {
    alignItems: "center",
    position: "relative",
  },
  podiumAvatarRing: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  podiumAvatarRingFirst: {
    borderColor: ACCENT,
    shadowColor: ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  connName: {
    color: TEXT,
    fontSize: 13,
    marginTop: 10,
    textAlign: "center",
    fontFamily: fonts.medium,
  },
  connNameFirst: {
    fontSize: 14,
    fontFamily: fonts.heavy,
  },
  skeletonBlock: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
  },
  skeletonConnLabel: {
    height: 9,
    width: 48,
    marginTop: 10,
    borderRadius: 6,
  },
  allFriendsSection: {
    marginTop: 12,
    marginBottom: 10,
  },
  allFriendsSectionInset: {
    paddingLeft: 16,
  },
  allFriendsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 32,
  },
  allFriendsTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  sortBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  sortMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  sortMenuCard: {
    backgroundColor: "#141414",
    borderRadius: RADIUS_LG,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 8,
    overflow: "hidden",
  },
  sortMenuTitle: {
    color: MUTED2,
    fontSize: 12,
    fontFamily: fonts.heavy,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
  },
  sortMenuOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  sortMenuOptionSelected: {
    backgroundColor: "rgba(0,255,133,0.06)",
  },
  sortMenuOptionText: {
    flex: 1,
    paddingRight: 12,
  },
  sortMenuOptionLabel: {
    color: TEXT,
    fontSize: 16,
    fontFamily: fonts.heavy,
  },
  sortMenuOptionHint: {
    color: MUTED3,
    fontSize: 12,
    fontFamily: fonts.book,
    marginTop: 2,
  },
  sortMenuOptionSpacer: {
    width: 18,
  },
  friendCountPill: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  friendCountPillText: {
    color: MUTED2,
    fontSize: 13,
    fontFamily: fonts.heavy,
    lineHeight: 16,
    includeFontPadding: false,
  },
  friendsListHeaderSpacerNoTopSynqs: { height: 18 },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: RADIUS_MD,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  friendRowContent: { flex: 1, justifyContent: "center", paddingRight: 8 },
  friendRowName: {
    marginBottom: 3,
  },
  friendNameAccent: {
    color: TEXT,
    fontSize: 17,
    fontFamily: fonts.heavy,
    letterSpacing: 0.1,
  },
  friendRowMeta: { flexDirection: "row", alignItems: "center" },
  friendRowMetaIcon: { marginRight: 4 },
  friendRowLocation: {
    color: MUTED,
    fontSize: 13,
    flex: 1,
    fontFamily: fonts.book,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginLeft: 69,
  },
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    overflow: "hidden",
  },
  friendChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  img: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
  emptyHeroTitle: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 0.2,
    textAlign: "center",
    width: "100%",
  },
  emptyHeroAccent: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 0.2,
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
    alignSelf: "center",
    marginTop: SPACE_6 + SPACE_3,
  },
  emptyPrimaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE_3,
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 16,
    paddingHorizontal: SPACE_5,
    minHeight: 52,
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
  sectionLabel: profileScreenSectionTitle,
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
  requestActionBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  declineBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  declineBtnText: { color: MUTED2, fontFamily: fonts.heavy, fontSize: 14, letterSpacing: 0.2 },
  addBtn: { backgroundColor: ACCENT, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14 },
  acceptOutlineBtn: { backgroundColor: "transparent", borderWidth: 1, borderColor: ACCENT },
  addBtnDisabled: { opacity: 0.45, backgroundColor: "#3f3f3f" },
  addBtnText: { color: "#061006", fontFamily: fonts.heavy, fontSize: 14, letterSpacing: 0.2 },
  acceptOutlineText: { color: ACCENT },
  addBtnDisabledText: { color: "rgba(255,255,255,0.85)" },
  suggestedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
