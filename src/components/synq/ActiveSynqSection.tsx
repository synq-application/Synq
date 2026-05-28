import HeaderIconButton from "@/src/components/HeaderIconButton";
import NotificationBadge from "@/src/components/NotificationBadge";
import TabHeaderIconRow from "@/src/components/TabHeaderIconRow";
import { useTabHeaderLayout } from "@/src/components/ProfileTabHeaderOverlay";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import SynqOptionsSheet from "../../../app/synq-screens/SynqOptionsSheet";
import React, { useMemo, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { friendLocationLine, resolveAvatar } from "../../../app/helpers";
import {
  ACCENT,
  BG,
  MUTED2,
  PRIMARY_CTA_HEIGHT,
  TAB_BAR_SCROLL_INSET,
} from "../../../constants/Variables";

/** Fade strip sitting just above the Select friends button. */
const ACTIVE_LIST_BOTTOM_FADE_HEIGHT = 52;
/** Extra lift for the Select friends CTA above the tab bar. */
const ACTIVE_CTA_BOTTOM_NUDGE = 48;

type Props = {
  styles: any;
  memo: string;
  hasUnread: boolean;
  activePulseOpacity: Animated.Value;
  activePulseScale: Animated.Value;
  availableFriends: any[];
  selectedFriends: string[];
  setSelectedFriends: React.Dispatch<React.SetStateAction<string[]>>;
  handleConnect: () => void;
  endSynq: () => void;
  insetsBottom: number;
  openMessagesInbox: () => void;
  openEditModal: () => void;
  openChangeAudience?: () => void;
  audienceLabel?: string | null;
};

export default function ActiveSynqSection({
  styles,
  memo,
  hasUnread,
  activePulseOpacity,
  activePulseScale,
  availableFriends,
  selectedFriends,
  setSelectedFriends,
  handleConnect,
  endSynq,
  insetsBottom,
  openMessagesInbox,
  openEditModal,
  openChangeAudience,
  audienceLabel,
}: Props) {
  const [optionsVisible, setOptionsVisible] = useState(false);
  const headerLayout = useTabHeaderLayout();

  const footerLayout = useMemo(() => {
    const ctaPadTop = 12;
    const ctaBottomPad = TAB_BAR_SCROLL_INSET + ACTIVE_CTA_BOTTOM_NUDGE;
    const ctaBlockHeight = ctaPadTop + PRIMARY_CTA_HEIGHT;
    const dockHeight = ctaBlockHeight + ctaBottomPad;
    const fadeBottom = ctaBottomPad + PRIMARY_CTA_HEIGHT;
    return {
      ctaPadTop,
      ctaBottomPad,
      ctaBlockHeight,
      dockHeight,
      fadeBottom,
      listBottomPad: fadeBottom + ACTIVE_LIST_BOTTOM_FADE_HEIGHT,
    };
  }, []);

  return (
    <View style={styles.activeSynqRoot}>
      <TabHeaderIconRow>
        <View style={styles.synqHeaderSide}>
          <HeaderIconButton
            name="chatbubbles-outline"
            onPress={openMessagesInbox}
            accessibilityLabel="Open messages"
            badge={hasUnread ? <NotificationBadge variant="dot" /> : undefined}
          />
        </View>
        <View style={styles.synqHeaderTitleCenter}>
          <View style={styles.headerTitleWithIndicator}>
            <Animated.View
              style={[
                styles.activeStatusDot,
                {
                  opacity: activePulseOpacity,
                  transform: [{ scale: activePulseScale }],
                },
              ]}
              accessibilityLabel="Synq session live"
            />
            <Text style={styles.headerTitle} numberOfLines={1}>
              Synq is active
            </Text>
          </View>
        </View>
        <View style={styles.synqHeaderSide}>
          <HeaderIconButton
            name="ellipsis-horizontal"
            onPress={() => setOptionsVisible(true)}
            accessibilityLabel="Synq options"
          />
        </View>
      </TabHeaderIconRow>
      <View
        style={[
          styles.activeBody,
          { paddingTop: headerLayout.iconRowBottom + 14 },
        ]}
      >
      <View style={styles.headerDivider} />

      {memo.trim() !== "" ? (
        <View style={styles.activeMemoRow}>
          <View style={styles.activeMemoCard}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={20}
              color={ACCENT}
              style={styles.activeMemoIcon}
            />
            <Text style={styles.activeMemoText} numberOfLines={6}>
              {memo.trim()}
            </Text>
          </View>
        </View>
      ) : null}

      {audienceLabel ? (
        <Pressable
          onPress={openChangeAudience}
          disabled={!openChangeAudience}
          style={({ pressed }) => [
            styles.audienceRow,
            openChangeAudience && pressed && styles.audienceRowPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Shared with ${audienceLabel}`}
          accessibilityHint={
            openChangeAudience ? "Opens change audience" : undefined
          }
        >
          <Ionicons name="people-outline" size={16} color={ACCENT} />
          <Text style={styles.audienceText} numberOfLines={1}>
            Shared with {audienceLabel}
          </Text>
          {openChangeAudience ? (
            <Ionicons name="chevron-forward" size={14} color={MUTED2} />
          ) : null}
        </Pressable>
      ) : null}

      <View style={styles.activeListFooterDock}>
        <FlatList
          style={styles.activeFriendsList}
          data={availableFriends}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={null}
          ListEmptyComponent={
            <View style={styles.activeEmptyWrap}>
              <Text style={styles.activeEmptyTitle}>No free friends right now.</Text>
              <Text style={styles.activeEmptySub}>
                Add more connections to increase the chances of having overlapping free time!
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const friendMemo = item.memo?.trim();
            const locationLine = friendLocationLine(item);
            const selected = selectedFriends.includes(item.id);
            return (
              <TouchableOpacity
                onPress={() =>
                  setSelectedFriends((prev) =>
                    prev.includes(item.id)
                      ? prev.filter((id) => id !== item.id)
                      : [...prev, item.id]
                  )
                }
                style={[
                  styles.friendCard,
                  selected ? styles.friendCardSelected : styles.friendCardUnselected,
                ]}
              >
                <ExpoImage
                  source={{ uri: resolveAvatar(item.imageurl) }}
                  style={styles.friendImg}
                  cachePolicy="memory-disk"
                  transition={0}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.whiteBold}>{item.displayName}</Text>

                  {locationLine ? (
                    <View style={styles.locationRow}>
                      <Ionicons
                        name="location-outline"
                        size={14}
                        color="#999"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.locationText}>{locationLine}</Text>
                    </View>
                  ) : null}

                  {friendMemo ? (
                    <Text style={styles.friendMemoInline} numberOfLines={2}>
                      {friendMemo}
                    </Text>
                  ) : null}
                </View>

                {selected ? (
                  <Ionicons name="checkmark-circle" size={24} color={ACCENT} />
                ) : null}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={[
            styles.activeListContent,
            {
              paddingBottom:
                availableFriends.length > 0
                  ? footerLayout.listBottomPad
                  : TAB_BAR_SCROLL_INSET,
            },
          ]}
        />

        {availableFriends.length > 0 ? (
          <>
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(9,10,11,0)", "rgba(9,10,11,0.55)", BG]}
          locations={[0, 0.7, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[
            styles.activeListBottomFade,
            {
              height: ACTIVE_LIST_BOTTOM_FADE_HEIGHT,
              bottom: footerLayout.fadeBottom,
            },
          ]}
        />
          <View
            style={[
              styles.activeFooterDock,
              {
                height: footerLayout.dockHeight,
                paddingTop: footerLayout.ctaPadTop,
                paddingBottom: footerLayout.ctaBottomPad,
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.btn, !selectedFriends.length && { opacity: 0.5 }]}
              onPress={handleConnect}
              disabled={!selectedFriends.length}
              accessibilityRole="button"
              accessibilityLabel={
                selectedFriends.length === 0
                  ? "Select friends who are free to start planning"
                  : `Start plan with ${selectedFriends.length} friend${
                      selectedFriends.length === 1 ? "" : "s"
                    }`
              }
            >
              <Text style={styles.btnText}>
                {selectedFriends.length === 0 ? "Select friends" : "Start plan"}
              </Text>
            </TouchableOpacity>
          </View>
          </>
        ) : null}
      </View>
      </View>

      <SynqOptionsSheet
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        onEditMemo={openEditModal}
        onChangeAudience={openChangeAudience}
        onEndSynq={endSynq}
      />
    </View>
  );
}
