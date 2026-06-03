import BackButton from "@/src/components/BackButton";
import CloseButton from "@/src/components/CloseButton";
import ChatInboxActionSheet from "@/src/components/synq/ChatInboxActionSheet";
import { MUTED2 } from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

type Props = {
  styles: any;
  allChats: any[];
  pinnedChatIds?: string[];
  currentUserId?: string;
  getChatTitle: (chat: any) => string;
  renderAvatarStack: (images: any) => React.ReactNode;
  onCloseMessages: () => void;
  onOpenChat: (chat: any) => Promise<void>;
  onDeleteChat: (chatId: string) => void;
  onChatLongPress?: (chat: any) => void;
  renderDeleteConfirmModal: React.ReactNode;
  mergeSelectMode?: boolean;
  selectedMergeChatIds?: string[];
  mergePreviewTitle?: string;
  mergeAnchorTitle?: string;
  mergeBusy?: boolean;
  onCancelMergeMode?: () => void;
  onToggleMergeChatSelection?: (chatId: string) => void;
  onConfirmMerge?: () => void;
  renderMergeConfirmModal?: React.ReactNode;
  inboxActionChat?: any | null;
  onCloseInboxAction?: () => void;
  onPinChat?: (chatId: string) => void;
  onCombineChat?: (chatId: string) => void;
  onDeleteFromAction?: (chatId: string) => void;
};

export default function MessagesInboxPane({
  styles,
  allChats,
  pinnedChatIds = [],
  currentUserId,
  getChatTitle,
  renderAvatarStack,
  onCloseMessages,
  onOpenChat,
  onDeleteChat,
  onChatLongPress,
  renderDeleteConfirmModal,
  mergeSelectMode = false,
  selectedMergeChatIds = [],
  mergePreviewTitle = "",
  mergeAnchorTitle = "",
  mergeBusy = false,
  onCancelMergeMode,
  onToggleMergeChatSelection,
  onConfirmMerge,
  renderMergeConfirmModal,
  inboxActionChat = null,
  onCloseInboxAction,
  onPinChat,
  onCombineChat,
  onDeleteFromAction,
}: Props) {
  const canCombine = allChats.length >= 2;
  const mergeReady = selectedMergeChatIds.length === 2;
  const pinnedSet = new Set(pinnedChatIds);

  const mergeSubtitle = mergeReady
    ? "Ready to create your group chat"
    : selectedMergeChatIds.length === 1 && mergeAnchorTitle
      ? `Pick one more to combine with ${mergeAnchorTitle}`
      : `Pick two conversations · ${selectedMergeChatIds.length}/2 selected`;

  const renderChatRow = (item: any, index: number) => {
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
    const isSelected = selectedMergeChatIds.includes(item.id);
    const isPinned = pinnedSet.has(item.id);
    const selectionOrder = isSelected
      ? selectedMergeChatIds.indexOf(item.id) + 1
      : 0;

    const rowContent = (
      <TouchableOpacity
        style={[
          styles.inboxItem,
          index === 0 && styles.inboxItemFirst,
          isUnreadThread && !mergeSelectMode && styles.inboxItemUnread,
          mergeSelectMode && isSelected && styles.inboxItemSelected,
        ]}
        onPress={() => {
          if (mergeSelectMode) {
            onToggleMergeChatSelection?.(item.id);
            return;
          }
          void onOpenChat(item);
        }}
        onLongPress={() => {
          if (mergeSelectMode) return;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onChatLongPress?.(item);
        }}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityState={{ selected: mergeSelectMode ? isSelected : undefined }}
        accessibilityLabel={
          mergeSelectMode
            ? `${getChatTitle(item)}${isSelected ? ", selected" : ""}`
            : `${getChatTitle(item)}${isPinned ? ", pinned" : ""}`
        }
      >
        <View style={styles.inboxItemRow}>
          {mergeSelectMode ? (
            <View
              style={[
                styles.inboxSelectBadge,
                isSelected && styles.inboxSelectBadgeActive,
              ]}
            >
              {isSelected ? (
                <Text style={styles.inboxSelectBadgeText}>{selectionOrder}</Text>
              ) : null}
            </View>
          ) : null}
          <View style={styles.avatarColumn}>
            {renderAvatarStack(item.participantImages)}
          </View>
          <View style={styles.inboxTextCol}>
            <View style={styles.inboxTitleRow}>
              <Text
                style={[
                  styles.whiteBold,
                  styles.inboxTitleText,
                  isUnreadThread && styles.unreadChatTitle,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {getChatTitle(item)}
              </Text>
              {isPinned && !mergeSelectMode ? (
                <Ionicons
                  name="pin"
                  size={14}
                  color={MUTED2}
                  style={styles.inboxPinIcon}
                />
              ) : null}
            </View>
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
    );

    if (mergeSelectMode) {
      return rowContent;
    }

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
        {rowContent}
      </Swipeable>
    );
  };

  return (
    <View style={styles.modalBg}>
      {mergeSelectMode ? (
        <>
          <View style={styles.inboxMergeHeader}>
            <BackButton
              onPress={onCancelMergeMode}
              style={styles.inboxMergeBackBtn}
              accessibilityLabel="Cancel combining chats"
            />
            <Text style={styles.inboxMergeHeaderTitle} numberOfLines={1}>
              Combine chats
            </Text>
            <View style={styles.inboxMergeHeaderSide} />
          </View>
          <Text style={styles.inboxMergeSubtitle}>{mergeSubtitle}</Text>
        </>
      ) : (
        <View style={styles.inboxHeaderRow}>
          <Text style={styles.messagesInboxTitle}>Messages</Text>
          <CloseButton
            onPress={onCloseMessages}
            accessibilityLabel="Close messages"
          />
        </View>
      )}

      <View style={styles.messagesHeaderDivider} />

      <FlatList
        data={allChats}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.inboxEmptyWrap}>
            <View style={styles.inboxEmptyIconWrap}>
              <Ionicons name="chatbubbles-outline" size={28} color={MUTED2} />
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
        contentContainerStyle={[
          styles.inboxListContent,
          mergeSelectMode && styles.inboxListContentMerge,
        ]}
        renderItem={({ item, index }) => renderChatRow(item, index)}
      />

      {mergeSelectMode ? (
        <View style={styles.inboxMergeFooterCard}>
          <Text style={styles.inboxMergeFooterLabel}>New group chat</Text>
          {mergeReady ? (
            <Text style={styles.inboxMergeFooterTitle} numberOfLines={2}>
              {mergePreviewTitle}
            </Text>
          ) : (
            <Text style={styles.inboxMergeFooterHint}>
              {selectedMergeChatIds.length === 1 && mergeAnchorTitle
                ? `Choose another conversation to combine with ${mergeAnchorTitle}.`
                : "Everyone from both conversations will be in one thread."}
            </Text>
          )}
          <TouchableOpacity
            style={[
              styles.inboxMergePrimaryBtn,
              (!mergeReady || mergeBusy) && styles.inboxMergePrimaryBtnDisabled,
            ]}
            onPress={onConfirmMerge}
            disabled={!mergeReady || mergeBusy}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Create group chat"
          >
            <Text
              style={[
                styles.inboxMergePrimaryBtnText,
                (!mergeReady || mergeBusy) && styles.inboxMergePrimaryBtnTextDisabled,
              ]}
            >
              {mergeBusy ? "Creating…" : "Create group chat"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ChatInboxActionSheet
        visible={!!inboxActionChat}
        chatTitle={inboxActionChat ? getChatTitle(inboxActionChat) : ""}
        isPinned={
          inboxActionChat ? pinnedSet.has(inboxActionChat.id) : false
        }
        canCombine={canCombine}
        onClose={() => onCloseInboxAction?.()}
        onPin={() => {
          if (inboxActionChat) onPinChat?.(inboxActionChat.id);
        }}
        onCombine={() => {
          if (inboxActionChat) onCombineChat?.(inboxActionChat.id);
        }}
        onDelete={() => {
          if (inboxActionChat) onDeleteFromAction?.(inboxActionChat.id);
        }}
      />

      {renderDeleteConfirmModal}
      {renderMergeConfirmModal}
    </View>
  );
}
