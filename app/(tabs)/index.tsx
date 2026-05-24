import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from "expo-image";
import * as Notifications from "expo-notifications";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import Reanimated, { FadeOut } from 'react-native-reanimated';
import {
  Animated,
  DeviceEventEmitter,
  FlatList,
  Keyboard,
  Modal,
  PixelRatio,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ACCENT,
  aiPrompts,
  BG,
  BORDER,
  BUTTON_RADIUS,
  DESTRUCTIVE,
  EXPIRATION_HOURS,
  fonts,
  MODAL_RADIUS,
  MUTED,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  SPACE_4,
  SPACE_5,
  TEXT,
  tabScreenMainHeaderTitle,
  TYPE_BODY
} from '../../constants/Variables';
import { ignoreSnapshotPermissionDenied } from '@/src/lib/firestoreListeners';
import { auth, db } from '../../src/lib/firebase';
import { useAuthRefresh } from '../_layout';
import { useSynqBoot } from "../../src/lib/synqBootContext";
import {
  computeSynqActiveFromUserData,
  synqStatusStorageKey,
} from "../../src/lib/synqSession";
import ConfirmModal from '../confirm-modal';
import AlertModal from '../alert-modal';
import { filterOrReject } from '@/src/lib/contentFilter';
import { useBlockedUsers } from '@/src/lib/blockedUsers';
import ReportModal from '../report-modal';
import ExploreModal from '../explore-modal';
import {
  resolveAvatar,
  SynqStatus,
  wrapChatTitle,
} from '../helpers';
import { openInMaps } from '../map-utils';
import ActiveSynqSection from '../../src/components/synq/ActiveSynqSection';
import ProfileTabHeaderOverlay from '@/src/components/ProfileTabHeaderOverlay';
import MessagesChatPane from '../../src/components/synq/MessagesChatPane';
import MessagesInboxPane from '../../src/components/synq/MessagesInboxPane';
import EditSynqModal from '../synq-screens/EditSynqModal';
import InactiveSynqView from '../synq-screens/InactiveSynqView';
import SynqActivatingView from '../synq-screens/SynqActivatingView';

function prefetchParticipantAvatars(chat: { participantImages?: Record<string, unknown> } | null | undefined) {
  const images = chat?.participantImages || {};
  Object.values(images).forEach((url) => {
    const uri = resolveAvatar(url as string | undefined);
    if (uri) ExpoImage.prefetch(uri).catch(() => {});
  });
}

type SynqUi = { status: SynqStatus; hydrated: boolean };

function setSynqStatus(setSynq: Dispatch<SetStateAction<SynqUi>>, status: SynqStatus) {
  setSynq((s) => ({ ...s, status }));
}

const IMESSAGE_REF_SCREEN_WIDTH = 375;
const IMESSAGE_BUBBLE_MAX_WIDTH_PT = 252;
const IMESSAGE_BUBBLE_FONT_SIZE = 17;
const IMESSAGE_BUBBLE_LINE_HEIGHT = 22;
const IMESSAGE_BUBBLE_PADDING_H = 9;
const IMESSAGE_BUBBLE_PADDING_V = 8;
const IMESSAGE_BUBBLE_CORNER_RADIUS = 18;
const MESSAGE_BUBBLE_MIN_HEIGHT = 36;
const IMESSAGE_CHAT_HORIZONTAL_INSET = 8;
const IMESSAGE_BUBBLE_OUTER_MARGIN = 6;
const IMESSAGE_INCOMING_AVATAR_BLOCK = 34 + 7;

function iMessageBubbleColumnMaxWidth(windowWidth: number, isOutgoing: boolean) {
  const contentWidth = windowWidth - 2 * IMESSAGE_CHAT_HORIZONTAL_INSET;
  const scaled252 = (windowWidth / IMESSAGE_REF_SCREEN_WIDTH) * IMESSAGE_BUBBLE_MAX_WIDTH_PT;
  const capFromLayout = isOutgoing
    ? contentWidth - IMESSAGE_BUBBLE_OUTER_MARGIN
    : contentWidth - IMESSAGE_BUBBLE_OUTER_MARGIN - IMESSAGE_INCOMING_AVATAR_BLOCK;
  return Math.max(32, Math.min(scaled252, capFromLayout));
}

function ChatMessageBubble({
  text,
  bubbleCap,
  isMe,
  onPress,
  heartCount,
}: {
  text: string;
  bubbleCap: number;
  isMe: boolean;
  onPress: () => void;
  heartCount: number;
}) {
  const fontScale = PixelRatio.getFontScale();
  const padH = Math.round(IMESSAGE_BUBBLE_PADDING_H * fontScale);
  const padV = Math.round(IMESSAGE_BUBBLE_PADDING_V * fontScale);
  const innerMax = bubbleCap - 2 * padH;

  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          styles.bubble,
          isMe ? styles.myBubble : styles.theirBubble,
          { paddingHorizontal: padH, paddingVertical: padV },
          { maxWidth: bubbleCap, alignSelf: "flex-start" },
          { position: "relative", overflow: "visible" },
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            {
              color: isMe ? "black" : "white",
              maxWidth: innerMax,
              textAlign: "left",
            },
          ]}
        >
          {text}
        </Text>
        {heartCount > 0 ? (
          <View
            style={[
              styles.heartReaction,
              isMe ? { left: -4, right: undefined } : { right: -6, left: undefined },
            ]}
          >
            {Array.from({ length: heartCount }, (_, i) => (
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
  );
}

export default function SynqScreen() {
  const { user } = useAuthRefresh();
  const synqBoot = useSynqBoot();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabletContentStyle =
    windowWidth >= 768
      ? { maxWidth: 840, width: '100%' as const, alignSelf: 'center' as const }
      : undefined;

  const [memo, setMemo] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [synq, setSynq] = useState<SynqUi>(() => ({
    status: synqBoot?.cachedSynqActive ? "active" : "idle",
    hydrated: false,
  }));
  const { status, hydrated } = synq;
  const [availableFriends, setAvailableFriends] = useState<any[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);
  const [messagesPane, setMessagesPane] = useState<"inbox" | "chat">("inbox");
  const isChatPaneOpen = messagesModalVisible && messagesPane === "chat";
  const [isExploreVisible, setIsExploreVisible] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [pendingNewChat, setPendingNewChat] = useState<{
    participants: string[];
    participantNames: Record<string, string>;
    participantImages: Record<string, string>;
  } | null>(null);
  const [allChats, setAllChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesReady, setMessagesReady] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [showAICard, setShowAICard] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [aiOptions, setAiOptions] = useState<any[]>([]);
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [showOptionsList, setShowOptionsList] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const [pendingScrollToMessageId, setPendingScrollToMessageId] = useState<string | null>(null);
  const lastTapRef = useRef<{ [key: string]: number }>({});
  const ideaMapOpenTimerRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});
  const [hasUnread, setHasUnread] = useState(false);
  const [showEndSynqModal, setShowEndSynqModal] = useState(false);
  const [showDeleteChatModal, setShowDeleteChatModal] = useState(false);
  const [pendingDeleteChatId, setPendingDeleteChatId] = useState<string | null>(null);
  const [rotatingAIText, setRotatingAIText] = useState(aiPrompts[0]);
  const [isStartingSynq, setIsStartingSynq] = useState(false);
  const [contentAlertVisible, setContentAlertVisible] = useState(false);
  const [contentAlertMessage, setContentAlertMessage] = useState("");
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    reportedUserId: string;
    messageId: string;
    chatId: string;
  } | null>(null);
  const { isBlocked } = useBlockedUsers();
  const activePulseOpacity = useRef(new Animated.Value(1)).current;

  const visibleChats = useMemo(() => {
    const myId = auth.currentUser?.uid;
    if (!myId) return allChats;
    return allChats.filter(
      (c) =>
        !(c.participants || []).some(
          (p: string) => p && p !== myId && isBlocked(p)
        )
    );
  }, [allChats, isBlocked]);

  const visibleAvailableFriends = useMemo(
    () => availableFriends.filter((f) => !isBlocked(f.id)),
    [availableFriends, isBlocked]
  );

  useEffect(() => {
    if (!activeChatId || !auth.currentUser?.uid) return;
    const chat = allChats.find((c) => c.id === activeChatId);
    const myId = auth.currentUser.uid;
    if (
      chat &&
      (chat.participants || []).some(
        (p: string) => p && p !== myId && isBlocked(p)
      )
    ) {
      setActiveChatId(null);
      setMessages([]);
      setMessagesPane("inbox");
      setPendingNewChat(null);
    }
  }, [activeChatId, allChats, isBlocked]);

  const rejectIfObjectionable = (text: string): boolean => {
    const result = filterOrReject(text);
    if (!result.ok) {
      setContentAlertMessage(result.reason);
      setContentAlertVisible(true);
      return true;
    }
    return false;
  };

  const showActionError = (message: string) => {
    setContentAlertMessage(message);
    setContentAlertVisible(true);
  };
  const markChatRead = async (chatId: string) => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;

    try {
      await updateDoc(doc(db, 'chats', chatId), {
        [`lastReadBy.${myId}`]: serverTimestamp(),
      });
    } catch {}
  };

  const DOUBLE_TAP_MS = 320;
  const onMessageBubblePress = (item: { id: string; reactions?: Record<string, string> }) => {
    const now = Date.now();
    const last = lastTapRef.current[item.id] ?? 0;
    if (now - last < DOUBLE_TAP_MS) {
      lastTapRef.current[item.id] = 0;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      void toggleHeartReaction(item.id, item.reactions);
    } else {
      lastTapRef.current[item.id] = now;
    }
  };

  const onIdeaBubblePress = (
    item: { id: string; reactions?: Record<string, string> },
    mapsPayload: { name: string; address: string }
  ) => {
    const now = Date.now();
    const last = lastTapRef.current[item.id] ?? 0;
    if (now - last < DOUBLE_TAP_MS) {
      const pending = ideaMapOpenTimerRef.current[item.id];
      if (pending) clearTimeout(pending);
      delete ideaMapOpenTimerRef.current[item.id];
      lastTapRef.current[item.id] = 0;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      void toggleHeartReaction(item.id, item.reactions);
      return;
    }
    lastTapRef.current[item.id] = now;
    const prev = ideaMapOpenTimerRef.current[item.id];
    if (prev) clearTimeout(prev);
    ideaMapOpenTimerRef.current[item.id] = setTimeout(() => {
      delete ideaMapOpenTimerRef.current[item.id];
      lastTapRef.current[item.id] = 0;
      openInMaps(mapsPayload);
    }, DOUBLE_TAP_MS);
  };

  useEffect(() => {
    if (isChatPaneOpen) return;
    Object.values(ideaMapOpenTimerRef.current).forEach((t) => {
      if (t) clearTimeout(t);
    });
    ideaMapOpenTimerRef.current = {};
  }, [isChatPaneOpen]);

  useEffect(() => {
    let index = 0;

    const interval = setInterval(() => {
      index = (index + 1) % aiPrompts.length;
      setRotatingAIText(aiPrompts[index]);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status !== 'active') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(activePulseOpacity, {
          toValue: 0.45,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(activePulseOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      activePulseOpacity.setValue(1);
    };
  }, [status, activePulseOpacity]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('openChat', async (data: { chatId?: string; messageId?: string }) => {
      if (data.chatId) {
        try {
          const snap = await getDoc(doc(db, "chats", data.chatId));
          if (snap.exists()) {
            prefetchParticipantAvatars(snap.data() as any);
          }
        } catch {}
        setPendingNewChat(null);
        setActiveChatId(data.chatId);
        setMessagesModalVisible(true);
        setMessagesPane("chat");
        const mid = typeof data.messageId === "string" && data.messageId.trim() ? data.messageId.trim() : null;
        setPendingScrollToMessageId(mid);
        await markChatRead(data.chatId);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const openFromNotificationData = async (data: Record<string, unknown> | undefined) => {
      if (!data) return;
      const rawChatId = data.chatId;
      const chatId =
        typeof rawChatId === "string"
          ? rawChatId.trim()
          : rawChatId != null
            ? String(rawChatId).trim()
            : "";
      if (!chatId) return;
      try {
        const snap = await getDoc(doc(db, "chats", chatId));
        if (snap.exists()) {
          prefetchParticipantAvatars(snap.data() as any);
        }
      } catch {}
      setPendingNewChat(null);
      setActiveChatId(chatId);
      setMessagesModalVisible(true);
      setMessagesPane("chat");
      const rawMid = data.messageId;
      const mid =
        typeof rawMid === "string" && rawMid.trim()
          ? rawMid.trim()
          : rawMid != null
            ? String(rawMid).trim() || null
            : null;
      setPendingScrollToMessageId(mid);
      await markChatRead(chatId);
    };

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromNotificationData(
        response.notification.request.content.data as Record<string, unknown> | undefined
      );
    });

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      openFromNotificationData(
        response.notification.request.content.data as Record<string, unknown> | undefined
      );
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!pendingScrollToMessageId) return;
    if (!messagesReady || !messages.length) return;
    const failSafe = setTimeout(() => setPendingScrollToMessageId(null), 10000);
    return () => clearTimeout(failSafe);
  }, [pendingScrollToMessageId, messagesReady, messages.length]);
  useEffect(() => {
    if (isExploreVisible) {
      Keyboard.dismiss();
    }
  }, [isExploreVisible]);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    let cancelled = false;
    const init = async () => {
      let nextStatus: SynqStatus = "idle";
      try {
        const userRef = doc(db, 'users', uid);

        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (!cancelled) {
            setUserProfile(data);
            setMemo(data.memo || '');
          }
          if (computeSynqActiveFromUserData(data)) {
            nextStatus = "active";
            AsyncStorage.setItem(synqStatusStorageKey(uid), "active").catch(() => {});
          } else {
            if (data.status === 'available' && data.synqStartedAt) {
              const startTime = data.synqStartedAt.toDate().getTime();
              const hoursElapsed = (new Date().getTime() - startTime) / (1000 * 60 * 60);
              if (hoursElapsed > EXPIRATION_HOURS) {
                await updateDoc(userRef, { status: 'inactive', memo: '' });
                if (!cancelled) setMemo('');
              }
            }
            nextStatus = "idle";
            AsyncStorage.setItem(synqStatusStorageKey(uid), "idle").catch(() => {});
          }
        }
      } catch {
        nextStatus = "idle";
      }
      if (!cancelled) {
        setSynq({ status: nextStatus, hydrated: true });
      }
    };

    init();

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", uid),
      orderBy("createdAt", "desc")
    );

    const unsubChats = onSnapshot(
      q,
      (snap) => {
      const chats = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      chats.sort((a, b) => {
        const aMs = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const bMs = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return bMs - aMs;
      });

      setAllChats(chats);
      chats.forEach((chat: any) => {
        const images = chat?.participantImages || {};
        Object.values(images).forEach((url: any) => {
          const uri = resolveAvatar(url);
          if (uri) {
            ExpoImage.prefetch(uri).catch(() => {});
          }
        });
      });
      const anyUnread = chats.some((c: any) => {
        const updatedAtMs = c.updatedAt?.toMillis?.() ?? 0;
        const lastReadMs = c.lastReadBy?.[uid]?.toMillis?.() ?? 0;
        const lastSender = c.lastMessageSenderId;
        return !!lastSender && lastSender !== uid && updatedAtMs > lastReadMs;
      });

      setHasUnread(anyUnread);
    },
      ignoreSnapshotPermissionDenied
    );

    return () => {
      cancelled = true;
      unsubChats();
    };
  }, [user?.uid]);

  useEffect(() => {
    const myId = user?.uid;
    if (!myId || status !== 'active') {
      setAvailableFriends([]);
      return;
    }
    const friendsRef = collection(db, 'users', myId, 'friends');
    const friendUnsubs = new Map<string, () => void>();
    const friendState = new Map<string, any>();

    const emit = () => {
      setAvailableFriends(Array.from(friendState.values()));
    };

    const friendsUnsub = onSnapshot(
      friendsRef,
      (friendsSnap) => {
      const friendIds = new Set(friendsSnap.docs.map((d) => d.id));

      for (const [fid, unsub] of friendUnsubs.entries()) {
        if (!friendIds.has(fid)) {
          unsub();
          friendUnsubs.delete(fid);
          friendState.delete(fid);
        }
      }

      friendsSnap.docs.forEach((fDoc) => {
        const fid = fDoc.id;
        if (friendUnsubs.has(fid)) return;

        const uRef = doc(db, 'users', fid);
        const uUnsub = onSnapshot(
          uRef,
          (uSnap) => {
            if (!uSnap.exists()) {
              friendState.delete(fid);
              emit();
              return;
            }

            const data = uSnap.data();

            if (computeSynqActiveFromUserData(data)) {
              friendState.set(fid, { id: fid, ...data });
              const uri = resolveAvatar(data?.imageurl);
              if (uri) {
                ExpoImage.prefetch(uri).catch(() => {});
              }
            } else {
              friendState.delete(fid);
            }

            emit();
          },
          ignoreSnapshotPermissionDenied
        );

        friendUnsubs.set(fid, uUnsub);
      });
      emit();
    },
      ignoreSnapshotPermissionDenied
    );

    return () => {
      friendsUnsub();
      friendUnsubs.forEach((unsub) => unsub());
      friendUnsubs.clear();
      friendState.clear();
    };
  }, [status, user?.uid]);

  useEffect(() => {
    if (!activeChatId || !isChatPaneOpen) {
      setMessagesReady(false);
      return;
    }

    setMessages([]);
    setMessagesReady(false);
    const q = query(collection(db, 'chats', activeChatId, 'messages'), orderBy('createdAt', 'asc'));

    return onSnapshot(
      q,
      (snap) => {
        const newMessages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(newMessages);
        setMessagesReady(true);
      },
      (error) => {
        ignoreSnapshotPermissionDenied(error);
        setMessages([]);
        setMessagesReady(false);
        setActiveChatId(null);
        setMessagesPane("inbox");
      }
    );
  }, [activeChatId, isChatPaneOpen]);

  useEffect(() => {
    if (!messagesModalVisible || pendingNewChat) return;
    const activeChatMissing =
      !!activeChatId && !allChats.some((c) => c.id === activeChatId);
    if (activeChatMissing || (allChats.length === 0 && messagesPane === "chat")) {
      setActiveChatId(null);
      setMessages([]);
      setMessagesPane("inbox");
    }
  }, [messagesModalVisible, activeChatId, allChats, messagesPane, pendingNewChat]);

  useEffect(() => {
    if (!isChatPaneOpen) return;
    const prefetchUri = (url: unknown) => {
      const uri = resolveAvatar(url as string | undefined);
      if (uri) ExpoImage.prefetch(uri).catch(() => {});
    };
    if (pendingNewChat) {
      Object.values(pendingNewChat.participantImages).forEach((u) => prefetchUri(u));
      return;
    }
    if (!activeChatId) return;
    const chat = allChats.find((c: any) => c.id === activeChatId);
    Object.values(chat?.participantImages || {}).forEach((u) => prefetchUri(u));
    const seen = new Set<string>();
    messages.forEach((m: any) => {
      const url =
        chat?.participantImages?.[m.senderId] || m.imageurl;
      const uri = resolveAvatar(url);
      if (uri && !seen.has(uri)) {
        seen.add(uri);
        ExpoImage.prefetch(uri).catch(() => {});
      }
      if (typeof m.venueImage === "string" && m.venueImage.startsWith("http")) {
        ExpoImage.prefetch(m.venueImage).catch(() => {});
      }
    });
  }, [activeChatId, isChatPaneOpen, pendingNewChat, allChats, messages]);

  const completeSynqLaunch = useCallback(() => {
    Vibration.vibrate(400);
    setSynqStatus(setSynq, "active");
  }, [setSynq]);

  const triggerAISuggestion = async (category: string) => {
    if ((!activeChatId && !pendingNewChat) || isAILoading) return;
    setIsAILoading(true);
    setCurrentCategory(category);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const functions = getFunctions();
      const getSuggestions = httpsCallable(functions, 'getSynqSuggestions');
      const currentChat = pendingNewChat
        ? { participants: pendingNewChat.participants }
        : visibleChats.find((c) => c.id === activeChatId);
      if (!currentChat) return;
      const city = userProfile?.city + ' ' + userProfile?.state;
      const friendId = currentChat.participants.find((id: string) => id !== auth.currentUser?.uid);
      const friendSnap = await getDoc(doc(db, 'users', friendId));
      const friendInterests = friendSnap.exists() ? friendSnap.data()?.interests || [] : [];
      const shared = (userProfile?.interests || []).filter((i: any) => friendInterests.includes(i));

      const payload = {
        category: category,
        shared: shared.length > 0 ? shared : ['exploring new spots'],
        location: city
      };

      const result = await getSuggestions(payload);
      const data = result.data as any;

      if (data.suggestions) {
        setAiOptions(data.suggestions);
        setShowOptionsList(true);
      } else {
        setAiResponse(data.suggestion);
        setIsExploreVisible(false);
        setShowAICard(true);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      showActionError("Could not load suggestions. Please try again.");
    } finally {
      setIsAILoading(false);
      setIsThinking(false)
    }
  };

  const sendAISuggestionToChat = async () => {
    if (!auth.currentUser) return;
    if (!pendingNewChat && !activeChatId) return;

    const textToSend = selectedOption
      ? `${selectedOption.name}\n${selectedOption.location}`
      : `✨ Synq AI Suggestion:\n\n${aiResponse}`;

    if (rejectIfObjectionable(textToSend)) return;

    try {
      let chatId = activeChatId;
      if (pendingNewChat) {
        const chatRef = await addDoc(collection(db, 'chats'), {
          participants: pendingNewChat.participants,
          participantNames: pendingNewChat.participantNames,
          participantImages: pendingNewChat.participantImages,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: '',
        });
        chatId = chatRef.id;
        setActiveChatId(chatId);
        setPendingNewChat(null);
      }
      if (!chatId) return;

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: textToSend,
        senderId: auth.currentUser.uid,
        imageurl: resolveAvatar(userProfile?.imageurl),
        venueImage: selectedOption?.imageUrl || selectedOption?.imageurl || null,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: selectedOption ? `Shared: ${selectedOption.name}` : 'AI Suggestion shared',
        lastMessageSenderId: auth.currentUser.uid,
        updatedAt: serverTimestamp()
      });

      setIsExploreVisible(false);
      setShowOptionsList(false);
      setSelectedOption(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      showActionError("Could not share suggestion. Please try again.");
    }
  };

  const startSynq = async () => {
    if (!auth.currentUser || isStartingSynq) return;
    if (memo.trim() && rejectIfObjectionable(memo)) return;
    Vibration.vibrate(200);
    setIsStartingSynq(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        memo,
        status: 'available',
        synqStartedAt: serverTimestamp()
      });
      AsyncStorage.setItem(synqStatusStorageKey(auth.currentUser.uid), "active").catch(() => {});
      setSynqStatus(setSynq, 'activating');
    } catch {
      showActionError("Could not start Synq. Check your connection and try again.");
    } finally {
      setIsStartingSynq(false);
    }
  };

  const endSynq = () => {
    setShowEndSynqModal(true);
  };

  const handleConnect = async () => {
    if (selectedFriends.length === 0 || !auth.currentUser) return;
    const participants = [auth.currentUser.uid, ...selectedFriends].sort();
    await executeConnection(participants);
  };

  const executeConnection = async (participants: string[]) => {
    try {
      const existing = allChats.find((c) => JSON.stringify(c.participants.sort()) === JSON.stringify(participants));
      if (existing) {
        prefetchParticipantAvatars(existing);
        setPendingNewChat(null);
        setActiveChatId(existing.id);
      } else {
        const nameMap: Record<string, string> = {};
        const imgMap: Record<string, string> = {};
        for (const uid of participants) {
          const uSnap = await getDoc(doc(db, 'users', uid));
          if (uSnap.exists()) {
            nameMap[uid] = uSnap.data().displayName;
            imgMap[uid] = resolveAvatar(uSnap.data().imageurl);
          }
        }
        prefetchParticipantAvatars({ participantImages: imgMap });
        setPendingNewChat({
          participants,
          participantNames: nameMap,
          participantImages: imgMap,
        });
        setActiveChatId(null);
        setMessages([]);
      }
      setMessagesModalVisible(true);
      setMessagesPane("chat");
      setSelectedFriends([]);
    } catch {
      showActionError("Could not open chat. Please try again.");
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !auth.currentUser) return;
    if (!pendingNewChat && (!activeChatId || !allChats.find((c) => c.id === activeChatId))) return;

    const text = inputText.trim();
    if (rejectIfObjectionable(text)) return;

    const myId = auth.currentUser.uid;
    setInputText('');

    try {
      let chatId = activeChatId;
      let otherParticipants: string[];

      if (pendingNewChat) {
        const chatRef = await addDoc(collection(db, 'chats'), {
          participants: pendingNewChat.participants,
          participantNames: pendingNewChat.participantNames,
          participantImages: pendingNewChat.participantImages,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: '',
        });
        chatId = chatRef.id;
        otherParticipants = pendingNewChat.participants.filter((pId: string) => pId !== myId);
        setActiveChatId(chatId);
        setPendingNewChat(null);
      } else {
        const currentChat = allChats.find((c) => c.id === activeChatId)!;
        otherParticipants = currentChat.participants.filter((pId: string) => pId !== myId);
      }

      await addDoc(collection(db, 'chats', chatId!, 'messages'), {
        text,
        senderId: myId,
        imageurl: resolveAvatar(userProfile?.imageurl),
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', chatId!), {
        lastMessage: text,
        lastMessageSenderId: myId,
        updatedAt: serverTimestamp()
      });
      otherParticipants.forEach(async (pId: string) => {
        const mySideFriendDoc = doc(db, 'users', myId, 'friends', pId);
        const theirSideFriendDoc = doc(db, 'users', pId, 'friends', myId);

        await updateDoc(mySideFriendDoc, {
          synqCount: increment(1),
          lastSynqAt: serverTimestamp(),
        }).catch(() => { });

        await updateDoc(theirSideFriendDoc, {
          synqCount: increment(1),
          lastSynqAt: serverTimestamp(),
        }).catch(() => { });
      });
    } catch {
      setInputText(text);
      showActionError("Message could not be sent. Please try again.");
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    setPendingDeleteChatId(chatId);
    setShowDeleteChatModal(true);
  };

  const toggleHeartReaction = async (messageId: string, currentReactions: any) => {
    if (!auth.currentUser || !activeChatId) return;

    const userId = auth.currentUser.uid;
    const messageRef = doc(db, "chats", activeChatId, "messages", messageId);

    try {
      const hasReacted = currentReactions?.[userId] === "heart";

      await updateDoc(messageRef, {
        [`reactions.${userId}`]: hasReacted ? deleteField() : "heart",
      });
    } catch {
      showActionError("Could not update reaction. Please try again.");
    }
  };

  const firstName = (fullName: string) =>
    (fullName || "").trim().split(/\s+/)[0];


  const getChatTitle = (chat: any) => {
    if (!chat) return "Synq Chat";

    if (chat.customName?.trim()) {
      return wrapChatTitle(chat.customName.trim(), 25);
    }

    const myId = auth.currentUser?.uid;

    const otherUsers = Object.entries(chat.participantNames || {})
      .filter(([uid]) => uid !== myId)
      .map(([_, name]) => name as string);

    if (otherUsers.length === 0) return "Just You";

    let title = "";

    if (otherUsers.length === 1) {
      title = otherUsers[0];
    }
    else {
      const firstNames = otherUsers.map((name) => firstName(name));
      const names = [...firstNames];
      const lastFriend = names.pop();

      title = `${names.join(", ")} & ${lastFriend}`;
    }

    return title;
  };

  const activeChat = pendingNewChat
    ? {
        id: "__pending__",
        participants: pendingNewChat.participants,
        participantNames: pendingNewChat.participantNames,
        participantImages: pendingNewChat.participantImages,
      }
    : visibleChats.find((c) => c.id === activeChatId);

  const renderAvatarStack = (images: any) => {
    if (!images) {
      return (
        <View style={styles.inboxCircle}>
          <Ionicons name="people" size={20} color={ACCENT} />
        </View>
      );
    }

    const others = Object.entries(images)
      .filter(([uid]) => uid !== auth.currentUser?.uid)
      .map(([_, url]) => resolveAvatar(url))
      .filter((uri): uri is string => Boolean(uri));

    if (others.length === 0) {
      return (
        <View style={styles.inboxCircle}>
          <Ionicons name="people" size={20} color={ACCENT} />
        </View>
      );
    }

    if (others.length === 1) {
      return (
        <View style={styles.inboxSingleWrap}>
          <ExpoImage
            source={{ uri: others[0] }}
            style={styles.inboxSinglePhoto}
            cachePolicy="memory-disk"
            transition={0}
          />
        </View>
      );
    }

    const stack = others.slice(0, 2);

    return (
      <View style={styles.inboxStackWrap}>
        <ExpoImage
          source={{ uri: stack[0] }}
          style={[styles.inboxStackPhoto, styles.inboxStackPhotoBack]}
          cachePolicy="memory-disk"
          transition={0}
        />
        <ExpoImage
          source={{ uri: stack[1] }}
          style={[styles.inboxStackPhoto, styles.inboxStackPhotoFront]}
          cachePolicy="memory-disk"
          transition={0}
        />
      </View>
    );
  };

  const bootActive = synqBoot?.cachedSynqActive === true;
  if (!hydrated && !bootActive) return <View style={styles.darkFill} />;

  const isActivating = status === "activating";

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, tabletContentStyle]}>
        <StatusBar barStyle="light-content" />
        {status === 'active' && (
          <>
          <ProfileTabHeaderOverlay variant="title" />
          <ActiveSynqSection
            styles={styles}
            memo={memo}
            hasUnread={hasUnread}
            activePulseOpacity={activePulseOpacity}
            availableFriends={visibleAvailableFriends}
            selectedFriends={selectedFriends}
            setSelectedFriends={setSelectedFriends}
            handleConnect={handleConnect}
            endSynq={endSynq}
            insetsBottom={insets.bottom}
            openMessagesInbox={() => {
              setMessagesModalVisible(true);
              setMessagesPane("inbox");
            }}
            openEditModal={() => setIsEditModalVisible(true)}
          />
          </>
        )}
        {(isActivating || (status === "idle" && hydrated)) && (
          <View style={styles.synqHomeLayer}>
            {isActivating && (
              <View style={StyleSheet.absoluteFill}>
                <SynqActivatingView onComplete={completeSynqLaunch} />
              </View>
            )}
            {status === "idle" && hydrated && (
              <Reanimated.View
                exiting={FadeOut.duration(520)}
                style={StyleSheet.absoluteFill}
              >
                <InactiveSynqView
                  memo={memo}
                  setMemo={setMemo}
                  onStartSynq={startSynq}
                  isStartingSynq={isStartingSynq}
                />
              </Reanimated.View>
            )}
          </View>
        )}
        <Modal visible={messagesModalVisible} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalBg}>
          {messagesPane === "inbox" ? (
            <MessagesInboxPane
              styles={styles}
              allChats={visibleChats}
              currentUserId={auth.currentUser?.uid}
              getChatTitle={getChatTitle}
              renderAvatarStack={renderAvatarStack}
              onCloseMessages={() => {
                setMessagesModalVisible(false);
                setMessagesPane("inbox");
                setActiveChatId(null);
                setPendingNewChat(null);
                setMessages([]);
              }}
              onOpenChat={async (item) => {
                prefetchParticipantAvatars(item);
                setPendingNewChat(null);
                setActiveChatId(item.id);
                setMessagesPane("chat");
                await markChatRead(item.id);
              }}
              onDeleteChat={handleDeleteChat}
              renderDeleteConfirmModal={
                <ConfirmModal
                  visible={showDeleteChatModal}
                  title="Delete Chat"
                  message="Are you sure you want to delete this conversation?"
                  confirmText="Delete"
                  destructive
                  onCancel={() => {
                    setShowDeleteChatModal(false);
                    setPendingDeleteChatId(null);
                  }}
                  onConfirm={async () => {
                    const chatId = pendingDeleteChatId;
                    setShowDeleteChatModal(false);
                    setPendingDeleteChatId(null);
                    if (!chatId) return;
                    if (activeChatId === chatId) {
                      setActiveChatId(null);
                      setPendingNewChat(null);
                      setMessages([]);
                      setMessagesPane("inbox");
                    }
                    setAllChats((prev) => prev.filter((c) => c.id !== chatId));
                    try {
                      await deleteDoc(doc(db, "chats", chatId));
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    } catch {
                      showActionError("Could not delete chat. Please try again.");
                    }
                  }}
                />
              }
            />
          ) : (
            <>
              <MessagesChatPane
              styles={styles}
              insetsTop={insets.top}
              activeChat={activeChat}
              getChatTitle={getChatTitle}
              rotatingAIText={rotatingAIText}
              pendingScrollToMessageId={pendingScrollToMessageId}
              flatListRef={flatListRef}
              messages={messages}
              messagesReady={messagesReady}
              showAICard={showAICard}
              aiResponse={aiResponse}
              inputText={inputText}
              setInputText={setInputText}
              setMessagesPane={setMessagesPane}
              setShowAICard={setShowAICard}
              setShowOptionsList={setShowOptionsList}
              setPendingNewChat={setPendingNewChat}
              setIsExploreVisible={setIsExploreVisible}
              sendMessage={sendMessage}
              sendAISuggestionToChat={sendAISuggestionToChat}
              setPendingScrollToMessageId={setPendingScrollToMessageId}
              onMessageBubblePress={onMessageBubblePress}
              onMessageLongPress={(item) => {
                if (item.senderId === auth.currentUser?.uid) return;
                setReportTarget({
                  reportedUserId: item.senderId,
                  messageId: item.id,
                  chatId: activeChatId || "",
                });
                setReportModalVisible(true);
              }}
              onIdeaBubblePress={onIdeaBubblePress}
              ChatMessageBubble={ChatMessageBubble}
              iMessageBubbleColumnMaxWidth={iMessageBubbleColumnMaxWidth}
              windowWidth={windowWidth}
              currentUserId={auth.currentUser?.uid}
            />
              <ExploreModal
              visible={isExploreVisible}
              onClose={() => {
                setIsExploreVisible(false);
                setShowOptionsList(false);
              }}
              onBack={() => setShowOptionsList(false)}
              onSelectVibe={(label: string) => {
                setIsThinking(true);
                setTimeout(() => {
                  triggerAISuggestion(label);
                }, 600);
              }}
              isThinking={isThinking}
              isAILoading={isAILoading}
              showOptionsList={showOptionsList}
              aiOptions={aiOptions}
              selectedOption={selectedOption}
              setSelectedOption={setSelectedOption}
              sendAISuggestionToChat={() => {
                sendAISuggestionToChat();
                setIsExploreVisible(false);
                setShowOptionsList(false);
              }}
              currentCategory={currentCategory}
              />
            </>
          )}
          </View>
        </Modal>

        <EditSynqModal
          visible={isEditModalVisible}
          onClose={() => setIsEditModalVisible(false)}
          memo={memo}
          setMemo={setMemo}
          styles={styles}
          onSaveMemo={async () => {
            if (memo.trim() && rejectIfObjectionable(memo)) return;
            await updateDoc(doc(db, "users", auth.currentUser!.uid), { memo });
            setIsEditModalVisible(false);
          }}
        />
        <ReportModal
          visible={reportModalVisible && !!reportTarget}
          reportedUserId={reportTarget?.reportedUserId || ""}
          contentType="message"
          chatId={reportTarget?.chatId}
          messageId={reportTarget?.messageId}
          onClose={() => {
            setReportModalVisible(false);
            setReportTarget(null);
          }}
        />
        <AlertModal
          visible={contentAlertVisible}
          title="Content not allowed"
          message={contentAlertMessage}
          onClose={() => setContentAlertVisible(false)}
        />
        <ConfirmModal
          visible={showEndSynqModal}
          title="End Synq?"
          message="You will no longer be visible as available."
          confirmText="End Synq"
          destructive
          onCancel={() => setShowEndSynqModal(false)}
          onConfirm={async () => {
            setShowEndSynqModal(false);

            if (!auth.currentUser) return;

            await updateDoc(doc(db, "users", auth.currentUser.uid), {
              status: "inactive",
              memo: "",
            });
            AsyncStorage.setItem(synqStatusStorageKey(auth.currentUser.uid), "idle").catch(() => {});

            setMemo("");
            setSynqStatus(setSynq, "idle");
            setIsEditModalVisible(false);
          }}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  darkFill: { flex: 1, backgroundColor: BG, justifyContent: 'center' },
  activeSynqRoot: { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  activeListFooterDock: {
    flex: 1,
    minHeight: 0,
    position: "relative",
  },
  activeFriendsList: { flex: 1 },
  activeListContent: { paddingTop: 12, paddingHorizontal: 0 },
  activeListBottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 2,
  },
  activeFooterDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    backgroundColor: BG,
    justifyContent: "flex-start",
  },
  activeEmptyWrap: {
    alignItems: "center",
    paddingHorizontal: SPACE_5,
    marginTop: SPACE_5,
    maxWidth: 380,
    alignSelf: "center",
  },
  activeEmptyTitle: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: 22,
    lineHeight: 34,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  activeEmptySub: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY + 1,
    lineHeight: 26,
    textAlign: "center",
    marginTop: SPACE_4,
  },
  activeBody: { flex: 1, minHeight: 0 },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  synqHeaderTitleCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerTitleWithIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
  },
  activeStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 10,
    backgroundColor: "#34D399",
    shadowColor: "#34D399",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 5,
    elevation: 3,
  },
  headerDivider: {
    marginTop: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  activeMemoRow: {
    marginTop: 14,
    width: "100%",
  },
  activeMemoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#0A0B0D",
    borderRadius: BUTTON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.05)",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  activeMemoIcon: {
    marginTop: 2,
    marginRight: 12,
  },
  activeMemoText: {
    flex: 1,
    color: TEXT,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.book,
    textAlign: "left",
  },
  headerTitle: {
    ...tabScreenMainHeaderTitle,
    textAlign: "center",
  },
  headerIconContainer: { width: 40, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
    borderWidth: 2,
    borderColor: 'black'
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: BUTTON_RADIUS,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  friendCardSelected: {
    borderColor: ACCENT,
  },
  friendCardUnselected: {
    borderColor: "rgba(255,255,255,0.22)",
  },
  activeFriendRowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  friendImg: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  whiteBold: { color: 'white', fontSize: 17, fontFamily: fonts.medium },
  grayText: { color: MUTED2, fontSize: 13, marginTop: 2 },
  locationText: { color: MUTED2, fontSize: 12, marginTop: 2 },
  btn: {
    alignSelf: 'center',
    width: PRIMARY_CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 16, color: ON_ACCENT_TEXT, fontFamily: fonts.heavy },
  synqHomeLayer: {
    flex: 1,
  },
  inactiveCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  mainEyebrow: {
    position: "absolute",
    top: 96,
    color: MUTED,
    fontSize: 14,
    fontFamily: fonts.heavy,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 0,
  },
  mainSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 26,
    fontFamily: fonts.medium,
    textAlign: "center",
    lineHeight: 34,
    marginTop: 96,
    maxWidth: 352,
  },
  inlineMetaRow: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  inlineMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlineMetaDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  inlineMetaText: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 16,
    fontFamily: fonts.medium,
  },
  memoCard: {
    width: "100%",
    marginTop: 32,
    backgroundColor: "#0E0F11",
    borderWidth: 1,
    borderColor: "#1B1D20",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  memoLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontFamily: fonts.medium,
    marginBottom: 6,
  },
  memoInput: {
    color: 'white',
    fontSize: 17,
    width: '100%',
    fontFamily: fonts.medium,
    paddingVertical: 6,
  },
  pulseBox: {
    width: 340,
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  centeredModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
  },
  modalBg: { flex: 1, backgroundColor: BG },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#111' },
  messagesHeaderDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.16)",
    marginHorizontal: 20,
  },
  modalTitle: { color: 'white', fontSize: 22, fontFamily: fonts.medium },
  messagesInboxTitle: tabScreenMainHeaderTitle,
  deleteAction: { backgroundColor: DESTRUCTIVE, justifyContent: 'center', alignItems: 'center', width: 80, height: '100%' },
  inboxItem: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  inboxItemFirst: {
    paddingTop: 16,
  },
  inboxListContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  inboxItemRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
  },
  inboxSeparatorBetween: {
    paddingLeft: 20 + 60 + 14,
    paddingRight: 40,
    justifyContent: "center",
  },
  inboxSeparatorLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.12)",
    width: "100%",
  },
  inboxItemUnread: {
    backgroundColor: 'rgba(43,255,136,0.10)',
    borderLeftWidth: 2,
    borderLeftColor: ACCENT,
  },
  unreadChatTitle: {
    color: ACCENT,
  },
  inboxCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  stackedPhoto: { width: 40, height: 40, borderRadius: 20, position: 'absolute', borderWidth: 2, borderColor: 'black' },
  msgContainer: { marginBottom: 18 },
  chatAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderColor: BORDER,
    borderWidth: 1.5,
    marginRight: 7,
  },
  messageBubbleColumn: {
    flexGrow: 0,
    flexShrink: 0,
  },
  bubble: {
    minHeight: MESSAGE_BUBBLE_MIN_HEIGHT,
    paddingVertical: IMESSAGE_BUBBLE_PADDING_V,
    paddingHorizontal: IMESSAGE_BUBBLE_PADDING_H,
    borderRadius: IMESSAGE_BUBBLE_CORNER_RADIUS,
  },
  bubbleText: {
    fontSize: IMESSAGE_BUBBLE_FONT_SIZE,
    lineHeight: IMESSAGE_BUBBLE_LINE_HEIGHT,
    textAlign: "left",
  },
  myBubble: {
    backgroundColor: ACCENT,
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  theirBubble: {
    backgroundColor: '#1C1C1E',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  chatHeaderMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  chatHeaderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#1C1C1E',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderTextCol: {
    flex: 1,
    minWidth: 0,
  },
  chatTitle: {
    color: TEXT,
    fontSize: 20,
    fontFamily: fonts.heavy,
    letterSpacing: 0.15,
  },
  chatHeaderDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginHorizontal: 18,
  },
  chatBody: {
    flex: 1,
    backgroundColor: '#0A0B0C',
  },
  chatList: {
    flex: 1,
  },
  chatListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  chatListContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  composerDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    backgroundColor: '#0C0D0F',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  composerShell: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#16181C',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingLeft: 16,
    paddingRight: 5,
    paddingVertical: 5,
    minHeight: 50,
  },
  composerInput: {
    flex: 1,
    color: TEXT,
    fontSize: 16,
    fontFamily: fonts.medium,
    lineHeight: 21,
    paddingTop: 10,
    paddingBottom: 10,
    paddingRight: 8,
    maxHeight: 120,
  },
  sendBtnInset: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
    flexShrink: 0,
  },
  sendBtnInsetDisabled: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  sendIconWrap: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    transform: [{ translateX: 2 }, { translateY: 1 }],
  },
  sendIconDisabled: {
    transform: [{ translateX: 2 }, { translateY: 1 }],
    opacity: 0.45,
  },
  chatTimestamp: {
    color: MUTED3,
    fontSize: 11,
    marginTop: 5,
    fontFamily: fonts.book,
    letterSpacing: 0.2,
  },
  explorePanel: { height: '85%', backgroundColor: '#0A0A0A', borderTopLeftRadius: MODAL_RADIUS + 8, borderTopRightRadius: MODAL_RADIUS + 8, overflow: 'hidden' },
  sectionHeader: { color: 'white', fontSize: 18, fontFamily: 'Avenir-Black', marginBottom: 20, paddingHorizontal: 20 },
  scrollRow: { marginBottom: 30, paddingLeft: 20 },
  ideaCircle: { alignItems: 'center', marginRight: 25 },
  circlePlaceholder: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  circleText: { color: 'white', fontSize: 13, fontFamily: 'Avenir-Medium' },
  venueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  selectedCard: {
    borderColor: ACCENT,
    backgroundColor: '#1a1a1a',
  },
  venueImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  venueName: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Avenir-Heavy',
  },
  venueRating: {
    color: ACCENT,
    fontSize: 12,
    marginVertical: 2,
  },
  venueDesc: {
    color: MUTED2,
    fontSize: 13,
    lineHeight: 18,
  },
  sendIdeaBtn: { backgroundColor: '#8E8E93', margin: 20, padding: 18, borderRadius: 12, alignItems: 'center' },
  sendIdeaBtnEnabled: { backgroundColor: ACCENT, margin: 20, padding: 18, borderRadius: 12, alignItems: 'center' },
  sendIdeaText: { color: ON_ACCENT_TEXT, fontFamily: fonts.black, fontSize: 16 },
  inChatAICardContainer: { paddingHorizontal: 20, marginVertical: 10 },
  inChatAICard: {
    backgroundColor: '#141516',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(43,255,136,0.18)',
  },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  aiCardTitleSmall: { color: ACCENT, fontSize: 14, fontFamily: 'Avenir-Heavy', letterSpacing: 0.5 },
  aiCardBodySmall: { color: 'white', fontSize: 15, fontFamily: 'Avenir', lineHeight: 22, marginBottom: 15 },
  aiShareBtnSmall: { backgroundColor: ACCENT, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  aiShareBtnText: { color: ON_ACCENT_TEXT, fontSize: 14, fontFamily: fonts.heavy },
  editPanel: {
    width: '100%',
    backgroundColor: '#161616',
    borderRadius: 28,
    padding: 24,
    alignItems: 'stretch',
  },
  panelTitle: {
    color: 'white',
    fontSize: 22,
    fontFamily: 'Avenir-Medium',
  },
  panelInput: {
    width: '100%',
    backgroundColor: "#0E0E0E",
    color: 'white',
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 12,
    fontSize: 15,
    minHeight: 80,
  },
  saveBtn: {
    alignSelf: 'center',
    width: PRIMARY_CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveBtnText: { color: ON_ACCENT_TEXT, fontSize: 16, fontFamily: fonts.heavy },
  centeredIdeaContainer: {
    alignItems: 'center',
    marginVertical: 15,
    width: '100%',
  },
  ideaBubble: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ACCENT,
    padding: 12,
    alignItems: 'stretch',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: "hidden",
  },
  heartReaction: {
    position: "absolute",
    bottom: -6,
    right: -6,
    flexDirection: "row",
    alignItems: "center",
  },
  ideaImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: 10,
  },
  ideaText: {
    color: 'white',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  friendMemoInline: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    color: MUTED2,
    fontFamily: fonts.medium,
  },
  timestampCentered: {
    color: MUTED2,
    fontSize: 10,
    marginTop: 4,
  },
  inboxSingleWrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  inboxSinglePhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#1C1C1E",
  },
  inboxStackWrap: {
    width: 56,
    height: 54,
    position: "relative",
  },
  inboxStackPhoto: {
    width: 42,
    height: 42,
    borderRadius: 21,
    position: "absolute",
    borderWidth: 2,
    borderColor: BG,
    backgroundColor: "#1C1C1E",
  },
  inboxStackPhotoBack: {
    left: 0,
    top: 2,
    zIndex: 1,
  },
  inboxStackPhotoFront: {
    left: 11,
    top: 10,
    zIndex: 2,
  },
  avatarColumn: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  inboxTextCol: {
    flex: 1,
    marginLeft: 14,
  },
  imageCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: MUTED,
    backgroundColor: "#111",
  },
  circleImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#1C1C1E",
  },
  aiChipPremium: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(43,255,136,0.07)",
    borderWidth: 1,
    borderColor: "rgba(43,255,136,0.22)",
    gap: 6,
  },
  aiChipText: {
    color: "#aaa",
    fontSize: 12,
    marginHorizontal: 6,
    fontFamily: "Avenir-Medium",
  },
  aiChipTextPremium: {
    flex: 1,
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: fonts.medium,
    letterSpacing: 0.15,
  },
  suggestionSectionTitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 15,
    fontFamily: fonts.medium,
  },

  suggestionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    alignSelf: "flex-start",
  },

  suggestionText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
  },

  inboxEmptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 64,
    marginTop: 30,
  },
  inboxEmptyIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(43,255,136,0.08)",
    borderWidth: 1,
    borderColor: "rgba(43,255,136,0.24)",
    marginBottom: 14,
  },
  inboxEmptyTitle: {
    color: TEXT,
    fontSize: 24,
    fontFamily: fonts.heavy,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  inboxEmptySub: {
    marginTop: 10,
    color: MUTED2,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.medium,
    textAlign: "center",
    maxWidth: 320,
  },
  chatEmptyWrap: {
    flex: 1,
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  chatEmptyIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(43,255,136,0.08)",
    borderWidth: 1,
    borderColor: "rgba(43,255,136,0.22)",
    marginBottom: 14,
  },
  chatEmptyTitle: {
    color: TEXT,
    fontSize: 17,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  chatEmptyText: {
    marginTop: 6,
    color: MUTED2,
    fontSize: 14,
    fontFamily: fonts.medium,
    textAlign: "center",
    lineHeight: 20,
  },
});