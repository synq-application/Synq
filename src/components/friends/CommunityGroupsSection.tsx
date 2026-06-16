import {
  Friend,
  MUTED2,
  MUTED3,
} from "@/constants/Variables";
import CommunityGroupListAvatar from "@/src/components/friends/CommunityGroupListAvatar";
import CommunityGroupSearchSheet from "@/src/components/friends/CommunityGroupSearchSheet";
import GroupsFeatureInfoModal from "@/src/components/friends/GroupsFeatureInfoModal";
import GroupsSectionHeader from "@/src/components/friends/GroupsSectionHeader";
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
          <GroupsSectionHeader
            title="Communities"
            onAdd={openCreate}
            addAccessibilityLabel="New community"
            onInfo={() => setCommunityInfoVisible(true)}
            infoAccessibilityLabel="What is community"
          />
        </View>

        <TouchableOpacity
          style={groupsPageStyles.browseRow}
          onPress={openSearch}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Find communities"
        >
          <View style={groupsPageStyles.browseRowIcon}>
            <Ionicons name="compass-outline" size={20} color={MUTED2} />
          </View>
          <Text style={groupsPageStyles.browseRowTitle}>Find communities</Text>
          <Ionicons name="chevron-forward" size={16} color={MUTED3} />
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
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={MUTED3} />
          </TouchableOpacity>
        ))}
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
