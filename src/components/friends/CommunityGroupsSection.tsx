import {
  ACCENT,
  fonts,
  Friend,
  MUTED2,
  MUTED3,
  RADIUS_LG,
  SPACE_2,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
} from "@/constants/Variables";
import CreateGroupModal from "@/src/components/friends/CreateGroupModal";
import CommunityGroupSearchSheet from "@/src/components/friends/CommunityGroupSearchSheet";
import GroupListAvatar from "@/src/components/friends/GroupListAvatar";
import {
  CommunityGroup,
  createCommunityGroup,
  subscribeJoinedCommunityGroups,
} from "@/src/lib/communityGroups";
import { communityGroupsCacheByUser } from "@/src/lib/socialCache";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const COMMUNITY_SUBTITLE = "Public — anyone can search and join.";

const GROUP_SURFACE = "#0E1012";
const GROUP_BORDER = "rgba(255,255,255,0.06)";
const ROW_INSET = 72;

type Props = {
  userId: string;
  friends?: Friend[];
};

function formatMemberCount(count: number): string {
  return count === 1 ? "1 member" : `${count} members`;
}

function GroupRowSeparator() {
  return <View style={styles.rowSeparator} />;
}

function CommunityGroupRow({
  group,
  friends,
  onPress,
}: {
  group: CommunityGroup;
  friends: Friend[];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.groupRow}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}, ${group.memberIds.length} members`}
    >
      <GroupListAvatar memberIds={group.memberIds} friends={friends} />
      <View style={styles.groupRowMain}>
        <Text style={styles.groupName} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.groupMeta} numberOfLines={1}>
          {formatMemberCount(group.memberIds.length)} · Public
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function SearchGroupsRow({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.searchRow}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="Search community groups"
    >
      <View style={styles.searchIcon}>
        <Ionicons name="search" size={18} color={ACCENT} />
      </View>
      <Text style={styles.searchLabel}>Search groups</Text>
    </TouchableOpacity>
  );
}

function NewCommunityGroupRow({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.newGroupRow}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="Create community group"
    >
      <View style={styles.newGroupIcon}>
        <Ionicons name="add" size={20} color={ACCENT} />
      </View>
      <Text style={styles.newGroupLabel}>Create community group</Text>
    </TouchableOpacity>
  );
}

export default function CommunityGroupsSection({ userId, friends = [] }: Props) {
  const router = useRouter();
  const cached = userId ? communityGroupsCacheByUser[userId] ?? [] : [];
  const [groups, setGroups] = useState<CommunityGroup[]>(cached);
  const [loading, setLoading] = useState(cached.length === 0);
  const [searchVisible, setSearchVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(groups.length === 0);
    const unsub = subscribeJoinedCommunityGroups(
      userId,
      (next) => {
        communityGroupsCacheByUser[userId] = next;
        setGroups(next);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [userId]);

  const joinedGroupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);

  const openGroup = (id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/community-group/[id]", params: { id } });
  };

  const openSearch = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchVisible(true);
  };

  const openCreate = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCreateVisible(true);
  };

  const handleCreate = async (name: string) => {
    if (!userId) return;
    setCreateBusy(true);
    try {
      const id = await createCommunityGroup(userId, name);
      setCreateVisible(false);
      router.push({ pathname: "/community-group/[id]", params: { id } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Try again.";
      Alert.alert("Could not create group", message);
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <>
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Community groups</Text>
          <View style={styles.sectionCountPill}>
            <Text style={styles.sectionCountText}>{groups.length}</Text>
          </View>
        </View>
        <Text style={styles.sectionSubtitle}>{COMMUNITY_SUBTITLE}</Text>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={ACCENT} />
          </View>
        ) : (
          <View style={styles.groupSurface}>
            <SearchGroupsRow onPress={openSearch} />
            <GroupRowSeparator />
            {groups.map((group, index) => (
              <React.Fragment key={group.id}>
                {index > 0 ? <GroupRowSeparator /> : null}
                <CommunityGroupRow
                  group={group}
                  friends={friends}
                  onPress={() => openGroup(group.id)}
                />
              </React.Fragment>
            ))}
            <GroupRowSeparator />
            <NewCommunityGroupRow onPress={openCreate} />
          </View>
        )}
      </View>

      <CommunityGroupSearchSheet
        visible={searchVisible}
        userId={userId}
        friends={friends}
        joinedGroupIds={joinedGroupIds}
        onClose={() => setSearchVisible(false)}
        onJoined={() => {}}
        onOpenGroup={openGroup}
      />

      <CreateGroupModal
        visible={createVisible}
        busy={createBusy}
        title="New community group"
        hint="Anyone can find and join this group."
        submitLabel="Create group"
        onClose={() => setCreateVisible(false)}
        onCreate={handleCreate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: SPACE_2,
  },
  sectionSubtitle: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED3,
    lineHeight: 17,
    letterSpacing: 0.05,
    marginBottom: SPACE_2,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    fontFamily: fonts.heavy,
    fontSize: 18,
    color: TEXT,
    letterSpacing: 0.12,
  },
  sectionCountPill: {
    minWidth: 26,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
  },
  sectionCountText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  groupSurface: {
    marginTop: SPACE_3,
    backgroundColor: GROUP_SURFACE,
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: GROUP_SURFACE,
  },
  searchIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,255,133,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.2)",
  },
  searchLabel: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: TEXT,
    letterSpacing: 0.08,
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: GROUP_SURFACE,
  },
  groupRowMain: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  groupName: {
    fontFamily: fonts.heavy,
    fontSize: 17,
    color: TEXT,
    letterSpacing: 0.08,
    marginBottom: 4,
  },
  groupMeta: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION + 1,
    color: MUTED2,
    letterSpacing: 0.05,
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: GROUP_BORDER,
    marginLeft: ROW_INSET,
  },
  newGroupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: GROUP_SURFACE,
    borderBottomLeftRadius: RADIUS_LG,
    borderBottomRightRadius: RADIUS_LG,
  },
  newGroupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,255,133,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.2)",
  },
  newGroupLabel: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: ACCENT,
    letterSpacing: 0.12,
  },
  loading: {
    paddingVertical: SPACE_5,
    alignItems: "center",
  },
});
