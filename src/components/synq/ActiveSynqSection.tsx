import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Animated,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ACCENT, BG } from "../../../constants/Variables";
import { friendLocationLine, resolveAvatar } from "../../../app/helpers";

type Props = {
  styles: any;
  memo: string;
  hasUnread: boolean;
  activePulseOpacity: Animated.Value;
  availableFriends: any[];
  selectedFriends: string[];
  setSelectedFriends: React.Dispatch<React.SetStateAction<string[]>>;
  handleConnect: () => void;
  endSynq: () => void;
  insetsBottom: number;
  openMessagesInbox: () => void;
  openEditModal: () => void;
};

export default function ActiveSynqSection({
  styles,
  memo,
  hasUnread,
  activePulseOpacity,
  availableFriends,
  selectedFriends,
  setSelectedFriends,
  handleConnect,
  endSynq,
  insetsBottom,
  openMessagesInbox,
  openEditModal,
}: Props) {
  return (
    <View style={styles.activeSynqRoot}>
      <View style={styles.activeHeaderBlock}>
        <View style={styles.headerTitleRow}>
          <TouchableOpacity
            onPress={openMessagesInbox}
            style={styles.headerIconContainer}
            accessibilityRole="button"
            accessibilityLabel="Open messages"
          >
            <Ionicons name="chatbubbles-outline" size={28} color="white" />
            {hasUnread && <View style={styles.badge} />}
          </TouchableOpacity>
          <View style={styles.synqHeaderTitleCenter}>
            <View style={styles.headerTitleWithIndicator}>
              <Animated.View
                style={[styles.activeStatusDot, { opacity: activePulseOpacity }]}
                accessibilityLabel="Synq session live"
              />
              <Text style={styles.headerTitle}>Synq is active</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={openEditModal}
            style={styles.headerIconContainer}
            accessibilityRole="button"
            accessibilityLabel="Edit Synq memo and settings"
          >
            <Ionicons name="create-outline" size={26} color="white" />
          </TouchableOpacity>
        </View>
      </View>
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

      <View style={styles.activeListWrap}>
        <FlatList
          style={styles.activeFriendsList}
          data={availableFriends}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.activeEmptyWrap}>
              <Text style={styles.activeEmptyTitle}>No free friends right now.</Text>
              <Text style={styles.activeEmptySub}>
                {`Add more connections to increase the chances of having overlapping free time!`}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const friendMemo = item.memo?.trim();
            const locationLine = friendLocationLine(item);
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
                  selectedFriends.includes(item.id) && { borderColor: ACCENT },
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

                {selectedFriends.includes(item.id) && (
                  <Ionicons name="checkmark-circle" size={24} color={ACCENT} />
                )}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.activeListContent}
        />
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(9,10,11,0)", "rgba(9,10,11,0.38)", BG]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.activeListFade}
        />
      </View>

      <View
        style={[
          styles.activeFooterBlock,
          { paddingBottom: Math.max(44, 24 + insetsBottom) },
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

        <TouchableOpacity
          onPress={endSynq}
          style={styles.deactivateLink}
          accessibilityRole="button"
          accessibilityLabel="End Synq"
        >
          <Text style={styles.deactivateLinkText}>End Synq</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
