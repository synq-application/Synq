import {
  ACCENT,
  BG,
  Friend,
  fonts,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  RADIUS_LG,
  RADIUS_MD,
  stackScreenHeaderTitle,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import CommunityGroupListAvatar from "@/src/components/friends/CommunityGroupListAvatar";
import {
  GROUP_BORDER,
  GROUP_SURFACE,
  groupsPageStyles,
} from "@/src/components/friends/groupsListStyles";
import { COMMUNITY_GROUP_CATEGORIES } from "@/src/lib/communityGroupCategories";
import {
  COMMUNITY_CATEGORY_ICON_RING,
  getCommunityCategoryIcon,
} from "@/src/lib/communityCategoryIcons";
import {
  CommunityGroup,
  fetchCommunityGroupsByCategory,
  fetchSuggestedCommunityGroups,
  joinCommunityGroup,
  searchCommunityGroups,
} from "@/src/lib/communityGroups";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  userId: string;
  friends: Friend[];
  joinedGroupIds: Set<string>;
  suggestedGroups?: CommunityGroup[];
  onClose: () => void;
  onJoined: (groupId: string) => void;
  onOpenGroup: (groupId: string) => void;
};

const LIST_GAP = 10;
const SECTION_GAP = 28;

function formatMemberCount(count: number): string {
  return count === 1 ? "1 member" : `${count} members`;
}

function ListGap() {
  return <View style={styles.listGap} />;
}

export default function CommunityGroupSearchSheet({
  visible,
  userId,
  friends,
  joinedGroupIds,
  suggestedGroups = [],
  onClose,
  onJoined,
  onOpenGroup,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommunityGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryGroups, setCategoryGroups] = useState<CommunityGroup[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [exploreGroups, setExploreGroups] = useState<CommunityGroup[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const dismissKeyboard = () => Keyboard.dismiss();
  const listContentPadding = { paddingBottom: Math.max(insets.bottom, 16) + 12 };

  useEffect(() => {
    if (!visible) {
      setKeyboardOpen(false);
      return;
    }

    const onShow = () => setKeyboardOpen(true);
    const onHide = () => setKeyboardOpen(false);
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setResults([]);
      setSearching(false);
      setJoiningId(null);
      setSelectedCategory(null);
      setCategoryGroups([]);
      setCategoryLoading(false);
      setExploreGroups([]);
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSelectedCategory(null);
    setSearching(true);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void searchCommunityGroups(trimmed)
        .then((groups) => setResults(groups))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 280);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [query, visible]);

  useEffect(() => {
    if (!visible || !selectedCategory) {
      setCategoryGroups([]);
      setCategoryLoading(false);
      return;
    }

    let cancelled = false;
    setCategoryLoading(true);
    void fetchCommunityGroupsByCategory(selectedCategory)
      .then((groups) => {
        if (!cancelled) setCategoryGroups(groups);
      })
      .catch(() => {
        if (!cancelled) setCategoryGroups([]);
      })
      .finally(() => {
        if (!cancelled) setCategoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, selectedCategory]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    void fetchSuggestedCommunityGroups(joinedGroupIds, 5)
      .then((groups) => {
        if (!cancelled) setExploreGroups(groups);
      })
      .catch(() => {
        if (!cancelled) setExploreGroups([]);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, joinedGroupIds]);

  const handleJoin = async (group: CommunityGroup) => {
    if (!userId || joiningId) return;
    setJoiningId(group.id);
    try {
      await joinCommunityGroup(userId, group.id, group.memberIds);
      onJoined(group.id);
      onOpenGroup(group.id);
      onClose();
    } catch (err: unknown) {
      Alert.alert(
        "Could not join",
        err instanceof Error ? err.message : "Try again."
      );
    } finally {
      setJoiningId(null);
    }
  };

  const handleBackdropPress = () => {
    if (keyboardOpen) {
      dismissKeyboard();
      return;
    }
    onClose();
  };

  const selectCategory = (category: string) => {
    dismissKeyboard();
    setQuery("");
    setSelectedCategory(category);
  };

  const clearCategory = () => {
    setSelectedCategory(null);
    setCategoryGroups([]);
  };

  const trimmed = query.trim();

  const listTouchProps = {
    onStartShouldSetResponder: () => {
      dismissKeyboard();
      return false;
    },
  } as const;

  const renderGroupRow = (item: CommunityGroup) => {
    const isJoined = joinedGroupIds.has(item.id);
    const busy = joiningId === item.id;

    return (
      <TouchableOpacity
        style={styles.resultCard}
        activeOpacity={0.78}
        onPress={() => {
          dismissKeyboard();
          onOpenGroup(item.id);
          onClose();
        }}
      >
        <CommunityGroupListAvatar coverPhotoUrl={item.coverPhotoUrl} />
        <View style={styles.resultMain}>
          <Text style={styles.resultName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.resultMeta} numberOfLines={1}>
            {formatMemberCount(item.memberIds.length)}
            {item.category ? ` · ${item.category}` : ""}
            {item.location ? ` · ${item.location}` : ""}
          </Text>
        </View>
        {isJoined ? (
          <View style={styles.joinedPill}>
            <Text style={styles.joinedPillText}>Joined</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[groupsPageStyles.joinBtn, busy && groupsPageStyles.joinBtnDisabled]}
            disabled={busy}
            onPress={() => void handleJoin(item)}
            accessibilityRole="button"
            accessibilityLabel={`Join ${item.name}`}
          >
            {busy ? (
              <ActivityIndicator color={ON_ACCENT_TEXT} size="small" />
            ) : (
              <Text style={groupsPageStyles.joinBtnText}>Join</Text>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderCategoryBrowse = () => (
    <View style={styles.categorySection}>
      <Text style={styles.exploreTitle}>Explore</Text>
      <View style={styles.categoryPillSurface}>
        <View style={styles.categoryPillGrid}>
          {COMMUNITY_GROUP_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={styles.categoryPill}
              onPress={() => selectCategory(category)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={`Browse ${category} communities`}
            >
              <View style={styles.categoryPillIcon}>
                <Ionicons
                  name={getCommunityCategoryIcon(category)}
                  size={17}
                  color={COMMUNITY_CATEGORY_ICON_RING.iconColor}
                />
              </View>
              <Text style={styles.categoryPillLabel} numberOfLines={2}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderBrowseHome = () => {
    const browseSuggestions = (() => {
      const seen = new Set<string>();
      const merged: CommunityGroup[] = [];
      for (const group of [...suggestedGroups, ...exploreGroups]) {
        if (seen.has(group.id)) continue;
        seen.add(group.id);
        merged.push(group);
        if (merged.length >= 5) break;
      }
      return merged;
    })();

    return (
      <FlatList
        data={browseSuggestions}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={dismissKeyboard}
        style={styles.list}
        contentContainerStyle={listContentPadding}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {renderCategoryBrowse()}
            {browseSuggestions.length > 0 ? (
              <Text style={[groupsPageStyles.subsectionTitle, styles.suggestedTitle]}>
                Suggested
              </Text>
            ) : null}
          </>
        }
        renderItem={({ item }) => renderGroupRow(item)}
        ItemSeparatorComponent={ListGap}
      />
    );
  };

  const renderCategoryResults = () => (
    <FlatList
      data={categoryGroups}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScrollBeginDrag={dismissKeyboard}
      style={styles.list}
      contentContainerStyle={listContentPadding}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.categoryResultsHeader}>
          <TouchableOpacity
            style={styles.backToBrowseBtn}
            onPress={clearCategory}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Back to all categories"
          >
            <Ionicons name="chevron-back" size={15} color={MUTED2} />
            <Text style={styles.backToBrowseText}>Explore</Text>
          </TouchableOpacity>
          <View style={styles.categoryResultsTitleRow}>
            <View style={styles.categoryPillIconLg}>
              <Ionicons
                name={getCommunityCategoryIcon(selectedCategory ?? "Other")}
                size={18}
                color={COMMUNITY_CATEGORY_ICON_RING.iconColor}
              />
            </View>
            <View style={styles.categoryResultsCopy}>
              <Text style={styles.categoryResultsTitle}>{selectedCategory}</Text>
              <Text style={styles.categoryResultsMeta}>
                {categoryGroups.length === 1
                  ? "1 community"
                  : `${categoryGroups.length} communities`}
              </Text>
            </View>
          </View>
        </View>
      }
      renderItem={({ item }) => renderGroupRow(item)}
      ItemSeparatorComponent={ListGap}
      ListEmptyComponent={
        categoryLoading ? null : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyHint}>
              No communities in {selectedCategory} yet.
            </Text>
          </View>
        )
      }
    />
  );

  let listContent: React.ReactNode;

  if (searching) {
    listContent = (
      <Pressable style={styles.centered} onPress={dismissKeyboard}>
        <ActivityIndicator color={ACCENT} />
      </Pressable>
    );
  } else if (trimmed) {
    listContent =
      results.length === 0 ? (
        <Pressable style={styles.emptyPressable} onPress={dismissKeyboard}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyHint}>No groups found for &ldquo;{trimmed}&rdquo;.</Text>
          </View>
        </Pressable>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={dismissKeyboard}
          style={styles.list}
          contentContainerStyle={listContentPadding}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.resultsLabel}>
              {results.length === 1 ? "1 result" : `${results.length} results`}
            </Text>
          }
          renderItem={({ item }) => renderGroupRow(item)}
          ItemSeparatorComponent={ListGap}
        />
      );
  } else if (selectedCategory) {
    listContent = categoryLoading ? (
      <Pressable style={styles.centered} onPress={dismissKeyboard}>
        <ActivityIndicator color={ACCENT} />
      </Pressable>
    ) : (
      renderCategoryResults()
    );
  } else {
    listContent = renderBrowseHome();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleBackdropPress}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
            <View style={styles.header}>
              <Text style={styles.title}>Search communities</Text>
              <CloseButton onPress={onClose} />
            </View>
          </TouchableWithoutFeedback>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={17} color={MUTED3} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name"
              placeholderTextColor={MUTED3}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={MUTED2} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.listArea} {...listTouchProps}>
            {listContent}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.62)",
    justifyContent: "flex-end",
  },
  sheet: {
    flex: 1,
    maxHeight: "94%",
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.08)",
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 18,
  },
  title: {
    ...stackScreenHeaderTitle,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0.1,
  },
  exploreTitle: {
    ...groupsPageStyles.sectionTitle,
    marginBottom: 12,
  },
  searchRow: {
    ...groupsPageStyles.searchBar,
    marginBottom: 22,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: TEXT,
    padding: 0,
  },
  listArea: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listGap: {
    height: LIST_GAP,
  },
  suggestedTitle: {
    marginTop: SECTION_GAP - 4,
    marginBottom: 10,
  },
  resultsLabel: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION + 1,
    color: MUTED2,
    letterSpacing: 0.03,
    marginBottom: 14,
  },
  categorySection: {
    marginBottom: 8,
  },
  categoryPillSurface: {
    backgroundColor: GROUP_SURFACE,
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
    padding: 12,
  },
  categoryPillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryPill: {
    flexGrow: 1,
    flexBasis: "47%",
    maxWidth: "48%",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 88,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: RADIUS_MD,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
  },
  categoryPillIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COMMUNITY_CATEGORY_ICON_RING.backgroundColor,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COMMUNITY_CATEGORY_ICON_RING.borderColor,
  },
  categoryPillIconLg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COMMUNITY_CATEGORY_ICON_RING.backgroundColor,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COMMUNITY_CATEGORY_ICON_RING.borderColor,
  },
  categoryPillLabel: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: TEXT,
    letterSpacing: 0.03,
    textAlign: "center",
    lineHeight: 19,
  },
  categoryResultsHeader: {
    gap: 10,
    marginBottom: 16,
  },
  categoryResultsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  categoryResultsCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  backToBrowseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
    paddingVertical: 2,
    marginBottom: 6,
  },
  backToBrowseText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION + 1,
    color: MUTED2,
    letterSpacing: 0.03,
  },
  categoryResultsTitle: {
    ...groupsPageStyles.sectionTitle,
    fontSize: 20,
    lineHeight: 26,
    marginTop: 0,
  },
  categoryResultsMeta: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION + 1,
    color: MUTED3,
    letterSpacing: 0.03,
    marginTop: 2,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: GROUP_SURFACE,
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
  },
  resultMain: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  resultName: {
    fontFamily: fonts.heavy,
    fontSize: 16,
    color: TEXT,
    letterSpacing: 0.05,
    marginBottom: 3,
  },
  resultMeta: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    letterSpacing: 0.03,
    lineHeight: 17,
  },
  joinedPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
  },
  joinedPillText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    letterSpacing: 0.03,
  },
  centered: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyCard: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: RADIUS_LG,
    backgroundColor: GROUP_SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
  },
  emptyHint: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    textAlign: "center",
    lineHeight: 22,
    letterSpacing: 0.02,
  },
  emptyPressable: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
});
