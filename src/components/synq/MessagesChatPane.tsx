import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import React from "react";
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
import { MUTED } from "../../../constants/Variables";
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
  onIdeaBubblePress,
  ChatMessageBubble,
  iMessageBubbleColumnMaxWidth,
  windowWidth,
  currentUserId,
}: Props) {
  return (
    <View style={styles.modalBg}>
      <View
        style={[
          styles.modalHeader,
          { paddingTop: Math.max(4, insetsTop - 26) },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View>
            <Text style={styles.modalTitle}>
              {activeChat ? getChatTitle(activeChat) : "Synq Chat"}
            </Text>

            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsExploreVisible(true);
              }}
              style={styles.aiChip}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open Synq AI place suggestions"
            >
              <Ionicons name="sparkles" size={14} color="#2BFF88" />
              <Text style={styles.aiChipText}>{rotatingAIText}</Text>
              <Ionicons name="chevron-forward" size={14} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => {
            Keyboard.dismiss();
            setMessagesPane("inbox");
            setShowAICard(false);
            setShowOptionsList(false);
            setPendingNewChat(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="Close chat"
        >
          <Ionicons name="close-circle" size={28} color="#444" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={60}
      >
        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={styles.chatEmptyWrap}>
                <Ionicons name="sparkles-outline" size={24} color={MUTED} />
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
                    </View>
                  </View>
                  <Text
                    style={{
                      color: "#444",
                      fontSize: 11,
                      marginTop: 4,
                      marginLeft: isMe ? 0 : 44,
                      alignSelf: isMe ? "flex-end" : "flex-start",
                    }}
                  >
                    {formatTime(item.createdAt)}
                  </Text>
                </View>
              );
            }}
            contentContainerStyle={{
              flexGrow: 1,
              padding: 20,
            }}
          />

          {showAICard && (
            <View style={styles.inChatAICardContainer}>
              <View style={styles.inChatAICard}>
                <View style={styles.aiCardHeader}>
                  <Ionicons
                    name="sparkles"
                    size={16}
                    color="#2BFF88"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.aiCardTitleSmall}>Synq Suggestion</Text>
                  <TouchableOpacity
                    style={{ marginLeft: "auto" }}
                    onPress={() => setShowAICard(false)}
                  >
                    <Ionicons name="close-circle" size={28} color="#444" />
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

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message..."
            placeholderTextColor="#666"
            multiline
            textAlignVertical="top"
            scrollEnabled
            returnKeyType="default"
          />
          <TouchableOpacity
            onPress={sendMessage}
            style={styles.sendBtn}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Ionicons name="send" size={18} color="black" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
