import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

type Props = {
  styles: any;
  allChats: any[];
  currentUserId?: string;
  getChatTitle: (chat: any) => string;
  renderAvatarStack: (images: any) => React.ReactNode;
  onCloseMessages: () => void;
  onOpenChat: (chat: any) => Promise<void>;
  onDeleteChat: (chatId: string) => void;
  renderDeleteConfirmModal: React.ReactNode;
};

export default function MessagesInboxPane({
  styles,
  allChats,
  currentUserId,
  getChatTitle,
  renderAvatarStack,
  onCloseMessages,
  onOpenChat,
  onDeleteChat,
  renderDeleteConfirmModal,
}: Props) {
  return (
    <View style={styles.modalBg}>
      <View style={styles.modalHeader}>
        <Text style={styles.messagesInboxTitle}>Messages</Text>
        <TouchableOpacity
          onPress={onCloseMessages}
          accessibilityRole="button"
          accessibilityLabel="Close messages"
        >
          <Ionicons name="close-circle" size={28} color="#444" />
        </TouchableOpacity>
      </View>
      <View style={styles.messagesHeaderDivider} />

      <FlatList
        data={allChats}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.inboxEmptyWrap}>
            <View style={styles.inboxEmptyIconWrap}>
              <Ionicons name="chatbubbles-outline" size={28} color="#2BFF88" />
            </View>
            <Text style={styles.inboxEmptyTitle}>No messages yet</Text>
            <Text style={styles.inboxEmptySub}>
              Start a plan with a friend and your conversations will show up here.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={styles.inboxSeparatorBetween}>
            <View style={styles.inboxSeparatorLine} />
          </View>
        )}
        contentContainerStyle={styles.inboxListContent}
        renderItem={({ item, index }) => {
          const updatedAtMs = item.updatedAt?.toMillis?.() ?? 0;
          const lastReadMs = currentUserId
            ? item.lastReadBy?.[currentUserId]?.toMillis?.() ?? 0
            : 0;
          const lastSender = item.lastMessageSenderId;
          const isUnreadThread =
            !!currentUserId &&
            !!lastSender &&
            lastSender !== currentUserId &&
            updatedAtMs > lastReadMs;
          return (
            <Swipeable
              rightThreshold={24}
              onSwipeableOpen={(direction) => {
                if (direction === "right") {
                  onDeleteChat(item.id);
                }
              }}
              renderRightActions={() => (
                <TouchableOpacity
                  style={styles.deleteAction}
                  onPress={() => onDeleteChat(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Delete conversation"
                >
                  <Ionicons name="trash" size={24} color="white" />
                </TouchableOpacity>
              )}
            >
              <TouchableOpacity
                style={[
                  styles.inboxItem,
                  index === 0 && styles.inboxItemFirst,
                  isUnreadThread && styles.inboxItemUnread,
                ]}
                onPress={() => void onOpenChat(item)}
              >
                <View style={styles.inboxItemRow}>
                  <View style={styles.avatarColumn}>
                    {renderAvatarStack(item.participantImages)}
                  </View>
                  <View style={styles.inboxTextCol}>
                    <Text
                      style={[styles.whiteBold, isUnreadThread && styles.unreadChatTitle]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {getChatTitle(item)}
                    </Text>
                    {(() => {
                      const lm =
                        typeof item.lastMessage === "string"
                          ? item.lastMessage.trim()
                          : "";
                      if (!lm || lm === "Synq established!") return null;
                      return (
                        <Text style={styles.grayText} numberOfLines={1}>
                          {lm}
                        </Text>
                      );
                    })()}
                  </View>
                </View>
              </TouchableOpacity>
            </Swipeable>
          );
        }}
      />
      {renderDeleteConfirmModal}
    </View>
  );
}
