import CloseButton from "@/src/components/CloseButton";
import CloseIcon from "@/src/components/CloseIcon";
import { ACCENT, MUTED, MUTED2, ON_ACCENT_TEXT } from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import React, { useMemo } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatTime, parseIdeaText, resolveAvatar } from "../../../app/helpers";

type Props = {
  styles: any;
  insetsTop: number;
  activeChat: any;
  getChatTitle: (chat: any) => string;
  rotatingAIText: string;
  pendingScrollToMessageId: string | null;
  flatListRef: React.RefObject<FlatList<any> | null>;
  messages: any[];
  showAICard: boolean;
  aiResponse: string;
  inputText: string;
  setInputText: (value: string) => void;
  setMessagesPane: (value: "inbox" | "chat") => void;
  setShowAICard: (value: boolean) => void;
  setShowOptionsList: (value: boolean) => void;
  setPendingNewChat: (value: any) => void;
  setIsExploreVisible: (value: boolean) => void;
  sendMessage: () => void;
  sendAISuggestionToChat: () => void;
  onMessageBubblePress: (item: { id: string; reactions?: Record<string, string> }) => void;
  onMessageLongPress?: (item: {
    id: string;
    senderId: string;
    text: string;
  }) => void;
  onIdeaBubblePress: (
    item: { id: string; reactions?: Record<string, string> },
    mapsPayload: { name: string; address: string }
  ) => void;
  ChatMessageBubble: React.ComponentType<{
    text: string;
    bubbleCap: number;
    isMe: boolean;
    onPress: () => void;
    heartCount: number;
  }>;
  iMessageBubbleColumnMaxWidth: (windowWidth: number, isOutgoing: boolean) => number;
  windowWidth: number;
  currentUserId?: string;
};

function getHeaderAvatarUri(
  chat: { participantImages?: Record<string, string> } | null | undefined,
  currentUserId?: string
) {
  if (!chat?.participantImages || !currentUserId) return null;
  const other = Object.entries(chat.participantImages).find(([uid]) => uid !== currentUserId);
  return other ? resolveAvatar(other[1]) : null;
}

export default function MessagesChatPane({
  styles,
  insetsTop,
  activeChat,
  getChatTitle,
  rotatingAIText,
  pendingScrollToMessageId,
  flatListRef,
  messages,
  showAICard,
  aiResponse,
  inputText,
  setInputText,
  setMessagesPane,
  setShowAICard,
  setShowOptionsList,
  setPendingNewChat,
  setIsExploreVisible,
  sendMessage,
  sendAISuggestionToChat,
  onMessageBubblePress,
  onMessageLongPress,
  onIdeaBubblePress,
  ChatMessageBubble,
  iMessageBubbleColumnMaxWidth,
  windowWidth,
  currentUserId,
}: Props) {
  const insets = useSafeAreaInsets();
  const canSend = inputText.trim().length > 0;
  const headerAvatarUri = useMemo(
    () => getHeaderAvatarUri(activeChat, currentUserId),
    [activeChat, currentUserId]
  );

  const handleSend = () => {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage();
  };

  return (
    <View style={styles.modalBg}>
      <View
        style={[
          styles.chatHeader,
          { paddingTop: Math.max(8, insetsTop - 22) },
        ]}
      >
        <View style={styles.chatHeaderMain}>
          {headerAvatarUri ? (
            <ExpoImage
              source={{ uri: headerAvatarUri }}
              style={styles.chatHeaderAvatar}
              cachePolicy="memory-disk"
              transition={120}
              recyclingKey={headerAvatarUri}
            />
          ) : (
            <View style={styles.chatHeaderAvatar}>
              <Ionicons name="people" size={20} color={MUTED2} />
            </View>
          )}
          <View style={styles.chatHeaderTextCol}>
            <Text style={styles.chatTitle} numberOfLines={1}>
              {activeChat ? getChatTitle(activeChat) : "Synq Chat"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsExploreVisible(true);
              }}
              style={styles.aiChipPremium}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Open Synq AI place suggestions"
            >
              <Ionicons name="sparkles" size={13} color={ACCENT} />
              <Text style={styles.aiChipTextPremium} numberOfLines={1}>
                {rotatingAIText}
              </Text>
              <Ionicons name="chevron-forward" size={13} color={MUTED2} />
            </TouchableOpacity>
          </View>
        </View>
        <CloseButton
          onPress={() => {
            Keyboard.dismiss();
            setMessagesPane("inbox");
            setShowAICard(false);
            setShowOptionsList(false);
            setPendingNewChat(null);
          }}
          style={{ marginTop: 2 }}
          accessibilityLabel="Close chat"
        />
      </View>
      <View style={styles.chatHeaderDivider} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={60}
      >
        <View style={styles.chatBody}>
          <FlatList
            ref={flatListRef}
            style={styles.chatList}
            data={messages}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.chatEmptyWrap}>
                <View style={styles.chatEmptyIconWrap}>
                  <Ionicons name="chatbubble-ellipses-outline" size={26} color={ACCENT} />
                </View>
                <Text style={styles.chatEmptyTitle}>Start the conversation</Text>
                <Text style={styles.chatEmptyText}>
                  Say hi to kick this Synq off.
                </Text>
              </View>
            }
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              if (pendingScrollToMessageId) return;
              flatListRef.current?.scrollToEnd({ animated: true });
            }}
            onLayout={() => {
              if (pendingScrollToMessageId) return;
              flatListRef.current?.scrollToEnd({ animated: true });
            }}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                try {
                  flatListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: 0.4,
                  });
                } catch {}
              }, 350);
            }}
            renderItem={({ item }) => {
              const isMe = item.senderId === currentUserId;
              const isSystemIdea =
                item.text.includes("✨ Synq AI Suggestion") || item.venueImage;
              const senderAvatar = resolveAvatar(
                activeChat?.participantImages?.[item.senderId] || item.imageurl
              );
              if (isSystemIdea) {
                const { name, address } = parseIdeaText(item.text);
                const ideaHeartCount =
                  item.reactions &&
                  Object.values(item.reactions).filter((v) => v === "heart")
                    .length;

                return (
                  <View style={styles.centeredIdeaContainer}>
                    <View style={{ width: "85%", alignSelf: "center" }}>
                      <Pressable
                        onPress={() =>
                          onIdeaBubblePress(
                            { id: item.id, reactions: item.reactions },
                            { name, address }
                          )
                        }
                      >
                        <View
                          style={[
                            styles.ideaBubble,
                            { width: "100%", position: "relative", overflow: "visible" },
                          ]}
                        >
                          {item.venueImage ? (
                            <ExpoImage
                              source={{ uri: item.venueImage }}
                              style={styles.ideaImage}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                              transition={0}
                              recyclingKey={item.venueImage}
                            />
                          ) : null}
                          <Text style={styles.ideaText}>{item.text}</Text>
                          {ideaHeartCount ? (
                            <View style={styles.heartReaction}>
                              {Array.from({ length: ideaHeartCount }, (_, i) => (
                                <Ionicons
                                  key={i}
                                  name="heart"
                                  size={14}
                                  color="#FF2D55"
                                  style={{ marginLeft: i > 0 ? 3 : 0 }}
                                />
                              ))}
                            </View>
                          ) : null}
                        </View>
                      </Pressable>
                    </View>

                    <Text style={styles.timestampCentered}>{formatTime(item.createdAt)}</Text>
                  </View>
                );
              }
              const bubbleCap = iMessageBubbleColumnMaxWidth(windowWidth, isMe);
              const heartCount =
                item.reactions &&
                Object.values(item.reactions).filter((v) => v === "heart").length;
              return (
                <View
                  style={[
                    styles.msgContainer,
                    {
                      alignItems: isMe ? "flex-end" : "flex-start",
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-end",
                    }}
                  >
                    {!isMe && (
                      <ExpoImage
                        source={{ uri: senderAvatar }}
                        style={styles.chatAvatar}
                        cachePolicy="memory-disk"
                        transition={0}
                        recyclingKey={senderAvatar}
                      />
                    )}

                    <View
                      style={[
                        styles.messageBubbleColumn,
                        {
                          maxWidth: bubbleCap,
                          alignSelf: isMe ? "flex-end" : "flex-start",
                          alignItems: isMe ? "flex-end" : "flex-start",
                        },
                      ]}
                    >
                      <Pressable
                        onLongPress={() =>
                          onMessageLongPress?.({
                            id: item.id,
                            senderId: item.senderId,
                            text: item.text,
                          })
                        }
                        delayLongPress={400}
                      >
                        <ChatMessageBubble
                          text={item.text}
                          bubbleCap={bubbleCap}
                          isMe={isMe}
                          heartCount={heartCount || 0}
                          onPress={() =>
                            onMessageBubblePress({
                              id: item.id,
                              reactions: item.reactions,
                            })
                          }
                        />
                      </Pressable>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.chatTimestamp,
                      {
                        marginLeft: isMe ? 0 : 44,
                        alignSelf: isMe ? "flex-end" : "flex-start",
                      },
                    ]}
                  >
                    {formatTime(item.createdAt)}
                  </Text>
                </View>
              );
            }}
            contentContainerStyle={styles.chatListContent}
          />

          {showAICard && (
            <View style={styles.inChatAICardContainer}>
              <View style={styles.inChatAICard}>
                <View style={styles.aiCardHeader}>
                  <Ionicons
                    name="sparkles"
                    size={16}
                    color={ACCENT}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.aiCardTitleSmall}>Synq Suggestion</Text>
                  <TouchableOpacity
                    style={{ marginLeft: "auto" }}
                    onPress={() => setShowAICard(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <CloseIcon variant="inline" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.aiCardBodySmall}>{aiResponse}</Text>
                <TouchableOpacity style={styles.aiShareBtnSmall} onPress={sendAISuggestionToChat}>
                  <Text style={styles.aiShareBtnText}>Send to Chat</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View
          style={[
            styles.composerDock,
            { paddingBottom: Math.max(insets.bottom, 10) + 6 },
          ]}
        >
          <View style={styles.composerShell}>
            <TextInput
              style={styles.composerInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message"
              placeholderTextColor="rgba(255,255,255,0.32)"
              multiline
              textAlignVertical="center"
              scrollEnabled
              returnKeyType="default"
            />
            <TouchableOpacity
              onPress={handleSend}
              style={[
                styles.sendBtnInset,
                !canSend && styles.sendBtnInsetDisabled,
              ]}
              activeOpacity={canSend ? 0.85 : 1}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !canSend }}
            >
              <View style={styles.sendIconWrap}>
                <Ionicons
                  name="send"
                  size={18}
                  color={canSend ? ON_ACCENT_TEXT : MUTED2}
                  style={canSend ? styles.sendIcon : styles.sendIconDisabled}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
