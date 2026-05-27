import CloseButton from "@/src/components/CloseButton";
import CloseIcon from "@/src/components/CloseIcon";
import { ACCENT, BG, MUTED2, ON_ACCENT_TEXT } from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  FlatList,
  InteractionManager,
  Keyboard,
  type KeyboardEvent,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatTime, parseIdeaText, resolveAvatar } from "../../../app/helpers";

const MESSAGE_ENTER = FadeInUp.duration(200);
const COMPOSER_KEYBOARD_GAP = 14;

function getKeyboardInset(event: KeyboardEvent): number {
  const { screenY } = event.endCoordinates;
  return Math.max(0, Dimensions.get("window").height - screenY);
}

type Props = {
  styles: any;
  insetsTop: number;
  activeChat: any;
  getChatTitle: (chat: any) => string;
  renderAvatarStack: (images: Record<string, string> | undefined) => React.ReactNode;
  rotatingAIText: string;
  pendingScrollToMessageId: string | null;
  setPendingScrollToMessageId: (value: string | null) => void;
  flatListRef: React.RefObject<FlatList<any> | null>;
  messages: any[];
  messagesReady: boolean;
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

export default function MessagesChatPane({
  styles,
  insetsTop,
  activeChat,
  getChatTitle,
  renderAvatarStack,
  rotatingAIText,
  pendingScrollToMessageId,
  setPendingScrollToMessageId,
  flatListRef,
  messages,
  messagesReady,
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
  const listHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const isKeyboardOpenRef = useRef(false);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const chatSeededRef = useRef(false);
  const initialScrollDoneRef = useRef(false);
  const lastMessageCountRef = useRef(0);
  useEffect(() => {
    knownMessageIdsRef.current = new Set();
    chatSeededRef.current = false;
    initialScrollDoneRef.current = false;
    lastMessageCountRef.current = 0;
    isKeyboardOpenRef.current = false;
    setKeyboardOpen(false);
    setKeyboardInset(0);
  }, [activeChat?.id]);

  const composerBottomInset = Math.max(insets.bottom, 10) + 6;
  const composerPaddingBottom = keyboardOpen
    ? COMPOSER_KEYBOARD_GAP
    : composerBottomInset;
  useLayoutEffect(() => {
    if (!messagesReady || messages.length === 0) {
      if (messagesReady && messages.length === 0) {
        chatSeededRef.current = true;
      }
      return;
    }

    if (!chatSeededRef.current) {
      messages.forEach((message) => knownMessageIdsRef.current.add(message.id));
      chatSeededRef.current = true;
    }
  }, [messages, messagesReady]);

  useEffect(() => {
    if (!messagesReady || messages.length === 0) return;

    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      lastMessageCountRef.current = messages.length;
      const task = InteractionManager.runAfterInteractions(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      });
      return () => task.cancel();
    }

    if (
      messages.length > lastMessageCountRef.current &&
      !pendingScrollToMessageId
    ) {
      lastMessageCountRef.current = messages.length;
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [
    messagesReady,
    messages.length,
    pendingScrollToMessageId,
    flatListRef,
  ]);

  useEffect(() => {
    if (!pendingScrollToMessageId || !messagesReady || !messages.length) return;

    const targetIndex = messages.findIndex(
      (message) => message.id === pendingScrollToMessageId
    );
    if (targetIndex < 0) return;

    const timer = setTimeout(() => {
      try {
        flatListRef.current?.scrollToIndex({
          index: targetIndex,
          animated: true,
          viewPosition: 0.4,
        });
      } catch {
        try {
          flatListRef.current?.scrollToIndex({
            index: targetIndex,
            animated: true,
          });
        } catch {}
      }
      setPendingScrollToMessageId(null);
    }, 400);

    return () => clearTimeout(timer);
  }, [
    pendingScrollToMessageId,
    messagesReady,
    messages,
    flatListRef,
    setPendingScrollToMessageId,
  ]);

  const shouldAnimateMessage = useCallback((messageId: string) => {
    if (!chatSeededRef.current || knownMessageIdsRef.current.has(messageId)) {
      return false;
    }
    knownMessageIdsRef.current.add(messageId);
    return true;
  }, []);

  const handleSend = () => {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage();
  };

  const scrollToLatest = useCallback(
    (animated = false) => {
      if (!messagesReady || messages.length === 0) return;

      const listHeight = listHeightRef.current;
      const contentHeight = contentHeightRef.current;
      if (listHeight > 0 && contentHeight > 0) {
        flatListRef.current?.scrollToOffset({
          offset: Math.max(0, contentHeight - listHeight),
          animated,
        });
        return;
      }

      const lastIndex = messages.length - 1;
      try {
        flatListRef.current?.scrollToIndex({
          index: lastIndex,
          animated,
          viewPosition: 1,
        });
      } catch {
        flatListRef.current?.scrollToEnd({ animated });
      }
    },
    [messagesReady, messages.length, flatListRef]
  );

  const forceScrollToBottom = useCallback(() => {
    if (!messagesReady || messages.length === 0) return;

    const run = () => scrollToLatest(false);
    run();
    requestAnimationFrame(run);
    setTimeout(run, 50);
    setTimeout(run, 150);
    setTimeout(run, 300);
  }, [messagesReady, messages.length, scrollToLatest]);

  const setKeyboardVisible = useCallback((visible: boolean) => {
    isKeyboardOpenRef.current = visible;
    setKeyboardOpen(visible);
  }, []);

  useEffect(() => {
    const applyInset = (event: KeyboardEvent) => {
      setKeyboardInset(getKeyboardInset(event));
    };
    const onShow = (event: KeyboardEvent) => {
      applyInset(event);
      setKeyboardVisible(true);
      forceScrollToBottom();
    };
    const onHide = () => {
      setKeyboardInset(0);
      setKeyboardVisible(false);
    };

    if (Platform.OS === "ios") {
      const frameSub = Keyboard.addListener("keyboardWillChangeFrame", applyInset);
      const showSub = Keyboard.addListener("keyboardWillShow", (event) => {
        onShow(event);
        const delay = event.duration ?? 250;
        setTimeout(() => forceScrollToBottom(), delay);
      });
      const hideSub = Keyboard.addListener("keyboardWillHide", onHide);
      return () => {
        frameSub.remove();
        showSub.remove();
        hideSub.remove();
      };
    }

    const showSub = Keyboard.addListener("keyboardDidShow", onShow);
    const hideSub = Keyboard.addListener("keyboardDidHide", onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [forceScrollToBottom, setKeyboardVisible]);

  useLayoutEffect(() => {
    if (keyboardOpen) {
      forceScrollToBottom();
    }
  }, [keyboardOpen, forceScrollToBottom]);

  const handleComposerFocus = useCallback(() => {
    forceScrollToBottom();
  }, [forceScrollToBottom]);

  const listContentStyle = useMemo(
    () => [
      styles.chatListContent,
      messagesReady && messages.length === 0 && styles.chatListContentEmpty,
      messagesReady && messages.length > 0 && { flexGrow: 1 },
    ],
    [messages.length, messagesReady, styles.chatListContent, styles.chatListContentEmpty]
  );

  const renderMessage = useCallback(
    ({ item }: { item: any }) => {
      const animateEntry = shouldAnimateMessage(item.id);
      const isMe = item.senderId === currentUserId;
      const isSystemMessage = item.type === "system";
      const isSystemIdea =
        item.text.includes("✨ Synq AI Suggestion") || item.venueImage;
      const senderAvatar = resolveAvatar(
        activeChat?.participantImages?.[item.senderId] || item.imageurl
      );
      const RowWrapper = animateEntry ? Animated.View : View;
      const rowWrapperProps = animateEntry ? { entering: MESSAGE_ENTER } : {};

      if (isSystemMessage) {
        return (
          <RowWrapper {...rowWrapperProps}>
            <View style={styles.centeredIdeaContainer}>
              <Text style={styles.systemMessageText}>{item.text}</Text>
              <Text style={styles.timestampCentered}>{formatTime(item.createdAt)}</Text>
            </View>
          </RowWrapper>
        );
      }

      if (isSystemIdea) {
        const { name, address } = parseIdeaText(item.text);
        const ideaHeartCount =
          item.reactions &&
          Object.values(item.reactions).filter((v) => v === "heart").length;

        return (
          <RowWrapper {...rowWrapperProps}>
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
          </RowWrapper>
        );
      }

      const bubbleCap = iMessageBubbleColumnMaxWidth(windowWidth, isMe);
      const heartCount =
        item.reactions &&
        Object.values(item.reactions).filter((v) => v === "heart").length;

      return (
        <RowWrapper {...rowWrapperProps}>
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
        </RowWrapper>
      );
    },
    [
      activeChat?.participantImages,
      ChatMessageBubble,
      currentUserId,
      iMessageBubbleColumnMaxWidth,
      onIdeaBubblePress,
      onMessageBubblePress,
      onMessageLongPress,
      shouldAnimateMessage,
      styles,
      windowWidth,
    ]
  );

  return (
    <View style={styles.modalBg}>
      <View
        style={[
          styles.chatHeader,
          { paddingTop: Math.max(8, insetsTop - 22) },
        ]}
      >
        <View style={styles.chatHeaderMain}>
          <View style={styles.chatHeaderAvatarSlot}>
            {renderAvatarStack(activeChat?.participantImages)}
          </View>
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
              <Ionicons name="sparkles" size={11} color={ACCENT} />
              <Text style={styles.aiChipTextPremium} numberOfLines={1}>
                {rotatingAIText}
              </Text>
              <Ionicons name="chevron-forward" size={11} color={MUTED2} />
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

      <View style={{ flex: 1, paddingBottom: keyboardInset }}>
        <View style={styles.chatBody}>
          <FlatList
            key={activeChat?.id ?? "chat"}
            ref={flatListRef}
            style={styles.chatList}
            data={messagesReady ? messages : []}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            initialNumToRender={Math.min(messages.length || 20, 30)}
            maxToRenderPerBatch={20}
            windowSize={Math.min(messages.length || 10, 15)}
            onLayout={(event) => {
              listHeightRef.current = event.nativeEvent.layout.height;
              if (isKeyboardOpenRef.current) {
                scrollToLatest(false);
              }
            }}
            onContentSizeChange={(_width, height) => {
              contentHeightRef.current = height;
              if (isKeyboardOpenRef.current) {
                scrollToLatest(false);
              }
            }}
            ListEmptyComponent={
              messagesReady ? (
                <View style={styles.chatEmptyWrap}>
                  <View style={styles.chatEmptyIconWrap}>
                    <Ionicons name="chatbubble-ellipses-outline" size={26} color={ACCENT} />
                  </View>
                  <Text style={styles.chatEmptyTitle}>Start the conversation</Text>
                  <Text style={styles.chatEmptyText}>
                    Say hi to kick this Synq off.
                  </Text>
                </View>
              ) : null
            }
            alwaysBounceVertical={Platform.OS === "ios"}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            renderItem={renderMessage}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                try {
                  flatListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: isKeyboardOpenRef.current ? 1 : 0.4,
                  });
                } catch {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }
              }, 100);
            }}
            contentContainerStyle={listContentStyle}
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
            {
              backgroundColor: BG,
              paddingBottom: composerPaddingBottom,
            },
          ]}
        >
          <View style={styles.composerShell}>
            <TextInput
              style={styles.composerInput}
              value={inputText}
              onChangeText={setInputText}
              onFocus={handleComposerFocus}
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
      </View>
    </View>
  );
}