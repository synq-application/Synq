import CloseButton from "@/src/components/CloseButton";
import CloseIcon from "@/src/components/CloseIcon";
import {
  ACCENT,
  BG,
  HEADER_BLACK,
  MUTED2,
  ON_ACCENT_TEXT,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import React, {
  type ComponentType,
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
  Keyboard,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet as RNStyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  formatTime,
  parseIdeaText,
  resolveAvatar,
  resolveChatSenderAvatar,
} from "../../../app/helpers";

const MESSAGE_ENTER = FadeInUp.duration(200);
const COMPOSER_KEYBOARD_GAP = 14;
const LIST_SCROLL_OVERFLOW_SLACK = 4;
/** Matches index.tsx SlideInRight on the chat pane. */
const CHAT_PANE_ENTER_MS = 300;
/** Clamp overscroll at the latest-message edge (normal list, offset at bottom). */
const CHAT_BOTTOM_SCROLL_TOLERANCE = 2;
/** Fade from black into the message list, starting just under the AI chip row. */
const CHAT_HEADER_FADE_BELOW_AI = 28;
/** Modest bump past the header fade overlap (shell uses negative margin). */
const CHAT_LIST_HEADER_FADE_CLEARANCE = 10;
const CHAT_HEADER_FADE_GRADIENT = [
  HEADER_BLACK,
  "rgba(0,0,0,0.78)",
  "rgba(0,0,0,0.38)",
  "rgba(9,10,11,0)",
] as const;
const CHAT_HEADER_FADE_LOCATIONS = [0, 0.32, 0.68, 1] as const;

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
  onBackFromChat: () => void;
  setShowAICard: (value: boolean) => void;
  setShowOptionsList: (value: boolean) => void;
  setPendingNewChat: (value: any) => void;
  showAISuggestions: boolean;
  showAIUnavailableMessage?: boolean;
  onOpenAISuggestions: () => void;
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
  ChatMessageBubble: ComponentType<{
    text: string;
    bubbleCap: number;
    isMe: boolean;
    onPress: () => void;
    heartCount: number;
  }>;
  iMessageBubbleColumnMaxWidth: (windowWidth: number, isOutgoing: boolean) => number;
  windowWidth: number;
  currentUserId?: string;
  /** Live profile photos from Firestore; keeps bubbles in sync when avatars change mid-chat. */
  liveParticipantImages?: Record<string, string>;
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
  onBackFromChat,
  setShowAICard,
  setShowOptionsList,
  setPendingNewChat,
  showAISuggestions,
  showAIUnavailableMessage = false,
  onOpenAISuggestions,
  sendMessage,
  sendAISuggestionToChat,
  onMessageBubblePress,
  onMessageLongPress,
  onIdeaBubblePress,
  ChatMessageBubble,
  iMessageBubbleColumnMaxWidth,
  windowWidth,
  currentUserId,
  liveParticipantImages,
}: Props) {
  const insets = useSafeAreaInsets();
  const canSend = inputText.trim().length > 0;
  const listHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const [listHeight, setListHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const isKeyboardOpenRef = useRef(false);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const chatSeededRef = useRef(false);
  const lastMessageCountRef = useRef(0);
  const prevChatIdRef = useRef<string | undefined>(undefined);
  const anchorBottomRef = useRef(true);
  const pendingNormalScrollRef = useRef(false);
  const listData = messages;

  useEffect(() => {
    const prevId = prevChatIdRef.current;
    const nextId = activeChat?.id;
    prevChatIdRef.current = nextId;

    knownMessageIdsRef.current = new Set();
    chatSeededRef.current = false;
    if (messages.length > 0) {
      messages.forEach((message) => knownMessageIdsRef.current.add(message.id));
      chatSeededRef.current = true;
    }
    lastMessageCountRef.current = 0;
    anchorBottomRef.current = true;
    pendingNormalScrollRef.current = messages.length > 0;

    const pendingToReal =
      prevId === "__pending__" && !!nextId && nextId !== "__pending__";
    if (!pendingToReal) {
      isKeyboardOpenRef.current = false;
      setKeyboardOpen(false);
      setKeyboardInset(0);
    }
  }, [activeChat?.id, messages.length]);

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

  const listScrollable =
    listHeight > 0 && contentHeight > listHeight + LIST_SCROLL_OVERFLOW_SLACK;

  const maxScrollOffset = useCallback(() => {
    const listH = listHeightRef.current;
    const contentH = contentHeightRef.current;
    return Math.max(0, contentH - listH);
  }, []);

  const syncAnchoredToLatest = useCallback(
    (offsetY: number) => {
      const maxOffset = maxScrollOffset();
      const atLatest =
        maxOffset <= CHAT_BOTTOM_SCROLL_TOLERANCE ||
        offsetY >= maxOffset - CHAT_BOTTOM_SCROLL_TOLERANCE;
      anchorBottomRef.current = atLatest;
      return atLatest;
    },
    [maxScrollOffset]
  );

  const handleChatScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!listScrollable) return;
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const maxOffset = Math.max(
        0,
        contentSize.height - layoutMeasurement.height
      );
      let y = contentOffset.y;
      if (y > maxOffset + CHAT_BOTTOM_SCROLL_TOLERANCE) {
        flatListRef.current?.scrollToOffset({ offset: maxOffset, animated: false });
        y = maxOffset;
      }
      syncAnchoredToLatest(y);
    },
    [listScrollable, flatListRef, syncAnchoredToLatest]
  );

  const handleChatScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!listScrollable) return;
      syncAnchoredToLatest(event.nativeEvent.contentOffset.y);
    },
    [listScrollable, syncAnchoredToLatest]
  );

  const scrollToLatest = useCallback(
    (animated = false) => {
      if (messages.length === 0) return false;

      const listH = listHeightRef.current;
      const contentH = contentHeightRef.current;
      if (listH <= 0 || contentH <= listH + LIST_SCROLL_OVERFLOW_SLACK) {
        syncAnchoredToLatest(0);
        return false;
      }

      const offset = contentH - listH;
      flatListRef.current?.scrollToEnd({ animated });
      flatListRef.current?.scrollToOffset({ offset, animated });
      syncAnchoredToLatest(offset);
      return true;
    },
    [messages.length, flatListRef, syncAnchoredToLatest]
  );

  useLayoutEffect(() => {
    if (pendingScrollToMessageId) return;
    if (!messagesReady || messages.length === 0 || !listScrollable) return;
    if (!pendingNormalScrollRef.current) return;

    scrollToLatest(false);
    pendingNormalScrollRef.current = false;
  }, [
    messagesReady,
    messages.length,
    listScrollable,
    pendingScrollToMessageId,
    scrollToLatest,
  ]);

  useEffect(() => {
    if (!pendingScrollToMessageId || !messages.length) return;

    pendingNormalScrollRef.current = false;
    anchorBottomRef.current = false;
    const targetIndex = listData.findIndex(
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
        scrollToLatest(false);
      }
      setPendingScrollToMessageId(null);
    }, CHAT_PANE_ENTER_MS + 80);

    return () => clearTimeout(timer);
  }, [
    pendingScrollToMessageId,
    messages,
    flatListRef,
    setPendingScrollToMessageId,
    scrollToLatest,
  ]);

  useEffect(() => {
    if (!messagesReady || messages.length === 0) return;
    if (pendingScrollToMessageId) return;

    const prevCount = lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;
    if (
      listScrollable &&
      messages.length > prevCount &&
      prevCount > 0 &&
      anchorBottomRef.current
    ) {
      requestAnimationFrame(() => scrollToLatest(true));
    }
  }, [
    messages.length,
    messagesReady,
    pendingScrollToMessageId,
    listScrollable,
    scrollToLatest,
  ]);

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
      scrollToLatest(false);
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
        setTimeout(() => scrollToLatest(false), delay);
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
  }, [scrollToLatest, setKeyboardVisible]);

  useLayoutEffect(() => {
    if (keyboardOpen) {
      scrollToLatest(false);
    }
  }, [keyboardOpen, scrollToLatest]);

  const handleComposerFocus = useCallback(() => {
    scrollToLatest(false);
  }, [scrollToLatest]);

  const listContentStyle = useMemo(
    () => [
      styles.chatListContent,
      messages.length > 0 && {
        paddingTop: 12 + CHAT_LIST_HEADER_FADE_CLEARANCE,
        paddingBottom: 2,
      },
      messagesReady && messages.length === 0 && styles.chatListContentEmpty,
    ],
    [messages.length, messagesReady, styles.chatListContent, styles.chatListContentEmpty]
  );

  const listAvatarExtraData = useMemo(() => {
    const resolved = activeChat?.participantImages ?? {};
    const live = liveParticipantImages ?? {};
    const ids = new Set([...Object.keys(resolved), ...Object.keys(live)]);
    return [...ids]
      .sort()
      .map((uid) => `${uid}:${live[uid] ?? resolved[uid] ?? ""}`)
      .join("|");
  }, [activeChat?.participantImages, liveParticipantImages]);

  const renderMessage = useCallback(
    ({ item }: { item: any }) => {
      const animateEntry = shouldAnimateMessage(item.id);
      const isMe = item.senderId === currentUserId;
      const isSystemMessage = item.type === "system";
      const isSystemIdea =
        item.text.includes("✨ Synq AI Suggestion") || item.venueImage;
      const senderAvatar = resolveChatSenderAvatar(item.senderId, {
        participantImages: activeChat?.participantImages,
        liveImages: liveParticipantImages,
        messageImageUrl: item.imageurl,
      });
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
                          <View
                            key={i}
                            style={[
                              styles.heartReactionBadge,
                              i > 0 && styles.heartReactionBadgeOverlap,
                            ]}
                          >
                            <Ionicons name="heart" size={12} color="#FF2D55" />
                          </View>
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
                  recyclingKey={`${item.senderId}-${senderAvatar}`}
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
      liveParticipantImages,
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

  const chatHeaderContentPaddingTop = 10;

  return (
    <View style={styles.modalBg}>
      <View style={chatHeaderOverlayStyles.shell}>
        <View
          style={[
            styles.chatHeader,
            chatHeaderOverlayStyles.headerContent,
            { paddingTop: chatHeaderContentPaddingTop },
          ]}
        >
          <View style={styles.chatHeaderMain}>
            <View style={styles.chatHeaderAvatarSlot}>
              {renderAvatarStack(activeChat?.participantImages)}
            </View>
            <View
              style={[
                styles.chatHeaderTextCol,
                !showAISuggestions &&
                  !showAIUnavailableMessage &&
                  styles.chatHeaderTextColCompact,
              ]}
            >
              <Text style={styles.chatTitle} numberOfLines={1}>
                {activeChat ? getChatTitle(activeChat) : "Synq Chat"}
              </Text>
              {showAISuggestions ? (
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onOpenAISuggestions();
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
              ) : showAIUnavailableMessage ? (
                <Text style={styles.aiUnavailableHint} numberOfLines={2}>
                  AI isn't available for this chat until everyone enters their
                  locations.
                </Text>
              ) : null}
            </View>
          </View>
          <CloseButton
            onPress={onBackFromChat}
            accessibilityLabel="Close chat"
          />
        </View>
        <LinearGradient
          pointerEvents="none"
          colors={[...CHAT_HEADER_FADE_GRADIENT]}
          locations={[...CHAT_HEADER_FADE_LOCATIONS]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={chatHeaderOverlayStyles.fadeBelowAi}
        />
      </View>

      <View style={{ flex: 1, paddingBottom: keyboardInset }}>
        <View style={styles.chatBody}>
          <View style={styles.chatList}>
          <FlatList
            key={`${activeChat?.id ?? "chat"}-std`}
            ref={flatListRef}
            style={styles.chatListFill}
            data={listData}
            extraData={listAvatarExtraData}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            scrollEnabled={listScrollable}
            directionalLockEnabled={listScrollable}
            bounces={false}
            alwaysBounceVertical={false}
            overScrollMode="never"
            maintainVisibleContentPosition={
              messages.length > 0
                ? { minIndexForVisible: 0, autoscrollToTopThreshold: 24 }
                : undefined
            }
            onLayout={(event) => {
              const height = event.nativeEvent.layout.height;
              listHeightRef.current = height;
              setListHeight(height);
            }}
            onContentSizeChange={(_width, height) => {
              contentHeightRef.current = height;
              setContentHeight(height);

              if (isKeyboardOpenRef.current) {
                requestAnimationFrame(() => scrollToLatest(false));
                return;
              }
              if (anchorBottomRef.current && listScrollable) {
                requestAnimationFrame(() => scrollToLatest(false));
              }
            }}
            scrollEventThrottle={16}
            onScroll={listScrollable ? handleChatScroll : undefined}
            onScrollBeginDrag={
              listScrollable
                ? () => {
                    anchorBottomRef.current = false;
                  }
                : undefined
            }
            onScrollEndDrag={listScrollable ? handleChatScrollEnd : undefined}
            onMomentumScrollEnd={listScrollable ? handleChatScrollEnd : undefined}
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
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            renderItem={renderMessage}
            onScrollToIndexFailed={(info) => {
              const delay = Math.min(
                Math.max(info.averageItemLength || 72, 48) *
                  Math.max(info.index, 1),
                400
              );
              setTimeout(() => {
                try {
                  flatListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: isKeyboardOpenRef.current ? 1 : 0.4,
                  });
                } catch {
                  scrollToLatest(false);
                }
              }, delay);
            }}
            contentContainerStyle={listContentStyle}
          />
          </View>

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

const chatHeaderOverlayStyles = RNStyleSheet.create({
  shell: {
    position: "relative",
    zIndex: 2,
    marginBottom: -CHAT_HEADER_FADE_BELOW_AI,
  },
  headerContent: {
    backgroundColor: HEADER_BLACK,
  },
  fadeBelowAi: {
    height: CHAT_HEADER_FADE_BELOW_AI,
  },
});