import {
  ACCENT,
  Friend,
  MUTED2,
  MUTED3,
} from "@/constants/Variables";
import CommunityGroupListAvatar from "@/src/components/friends/CommunityGroupListAvatar";
import CommunityGroupSearchSheet from "@/src/components/friends/CommunityGroupSearchSheet";
import GroupsFeatureInfoModal from "@/src/components/friends/GroupsFeatureInfoModal";
import { groupsPageStyles } from "@/src/components/friends/groupsListStyles";
import {
  CommunityGroup,
  subscribeJoinedCommunityGroups,
} from "@/src/lib/communityGroups";
import { communityGroupsCacheByUser } from "@/src/lib/socialCache";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  userId: string;
  friends?: Friend[];
};

function formatMemberCount(count: number): string {
  return count === 1 ? "1 member" : `${count} members`;
}

export default function CommunitySection({ userId, friends = [] }: Props) {
  const router = useRouter();
  const cached = userId ? communityGroupsCacheByUser[userId] ?? [] : [];
  const [joined, setJoined] = useState<CommunityGroup[]>(cached);
  const [searchVisible, setSearchVisible] = useState(false);
  const [communityInfoVisible, setCommunityInfoVisible] = useState(false);

  const joinedIds = useMemo(() => new Set(joined.map((g) => g.id)), [joined]);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeJoinedCommunityGroups(
      userId,
      (next) => {
        communityGroupsCacheByUser[userId] = next;
        setJoined(next);
      },
      () => {}
    );
    return unsub;
  }, [userId]);

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
    router.push("/community-group/create");
  };

  return (
    <>
      <View style={groupsPageStyles.section}>
        <View style={groupsPageStyles.sectionHeader}>
          <View style={groupsPageStyles.sectionTitleRow}>
            <Text style={groupsPageStyles.sectionTitle}>Community</Text>
            <TouchableOpacity
              style={groupsPageStyles.infoBtn}
              onPress={() => setCommunityInfoVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="What is community"
            >
              <Ionicons name="information-circle-outline" size={16} color={MUTED2} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={groupsPageStyles.searchBar}
          onPress={openSearch}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Find communities"
        >
          <Ionicons name="search" size={18} color={MUTED3} />
          <Text style={groupsPageStyles.searchBarPlaceholder}>Find communities</Text>
        </TouchableOpacity>

        {joined.map((group) => (
          <TouchableOpacity
            key={group.id}
            style={groupsPageStyles.circleCard}
            onPress={() => openGroup(group.id)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${group.name}, ${group.memberIds.length} members`}
          >
            <CommunityGroupListAvatar
              coverPhotoUrl={group.coverPhotoUrl}
              coverPhotoThumbUrl={group.coverPhotoThumbUrl}
            />
            <View style={groupsPageStyles.circleCardMain}>
              <Text style={groupsPageStyles.circleCardTitle} numberOfLines={1}>
                {group.name}
              </Text>
              <Text style={groupsPageStyles.circleCardMeta} numberOfLines={1}>
                {formatMemberCount(group.memberIds.length)}
                {group.category ? ` · ${group.category}` : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={MUTED3} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={groupsPageStyles.circleCard}
          onPress={openCreate}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="New community"
        >
          <View style={groupsPageStyles.newCircleIcon}>
            <Ionicons name="add" size={22} color={ACCENT} />
          </View>
          <View style={groupsPageStyles.circleCardMain}>
            <Text style={groupsPageStyles.circleCardTitle}>New community</Text>
          </View>
        </TouchableOpacity>
      </View>

      <CommunityGroupSearchSheet
        visible={searchVisible}
        userId={userId}
        friends={friends}
        joinedGroupIds={joinedIds}
        onClose={() => setSearchVisible(false)}
        onJoined={() => {}}
        onOpenGroup={openGroup}
      />

      <GroupsFeatureInfoModal
        visible={communityInfoVisible}
        variant="community"
        onClose={() => setCommunityInfoVisible(false)}
      />
    </>
  );
}

/** @deprecated Use CommunitySection */
export function CommunityGroupsRows(props: Props) {
  return <CommunitySection {...props} />;
}
