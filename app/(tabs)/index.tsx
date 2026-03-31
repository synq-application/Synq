import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
import React, { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  DeviceEventEmitter,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  Vibration,
  View
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ACCENT,
  aiPrompts,
  BG,
  BORDER,
  BUTTON_RADIUS,
  EXPIRATION_HOURS,
  fonts,
  MODAL_RADIUS,
  MUTED,
  MUTED2,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  SPACE_4,
  SPACE_5,
  TEXT,
  TYPE_BODY,
} from '../../constants/Variables';
import { auth, db } from '../../src/lib/firebase';
import { useSynqBoot } from "../../src/lib/synqBootContext";
import {
  computeSynqActiveFromUserData,
  synqStatusStorageKey,
} from "../../src/lib/synqSession";
import ConfirmModal from '../confirm-modal';
import ExploreModal from '../explore-modal';
import { formatTime, parseIdeaText, resolveAvatar, SynqStatus, wrapChatTitle } from '../helpers';
import { openInMaps } from '../map-utils';
import EditSynqModal from '../synq-screens/EditSynqModal';
import InactiveSynqView from '../synq-screens/InactiveSynqView';

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

export default function SynqScreen() {
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
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isInboxVisible, setIsInboxVisible] = useState(false);
  const [isExploreVisible, setIsExploreVisible] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [pendingNewChat, setPendingNewChat] = useState<{
    participants: string[];
    participantNames: Record<string, string>;
    participantImages: Record<string, string>;
  } | null>(null);
  const [allChats, setAllChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
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

  /** Single tap opens maps (after double-tap window); double tap hearts — mirrors Instagram-style idea cards. */
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
    if (isChatVisible) return;
    Object.values(ideaMapOpenTimerRef.current).forEach((t) => {
      if (t) clearTimeout(t);
    });
    ideaMapOpenTimerRef.current = {};
  }, [isChatVisible]);

  useEffect(() => {
    let index = 0;

    const interval = setInterval(() => {
      index = (index + 1) % aiPrompts.length;
      setRotatingAIText(aiPrompts[index]);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

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
        setIsChatVisible(true);
        setIsInboxVisible(false);
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
      setIsChatVisible(true);
      setIsInboxVisible(false);
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
    if (!messages.length) return;
    const idx = messages.findIndex((m) => m.id === pendingScrollToMessageId);
    if (idx < 0) return;
    const t = setTimeout(() => {
      try {
        flatListRef.current?.scrollToIndex({
          index: idx,
          animated: true,
          viewPosition: 0.4,
        });
      } catch {
        try {
          flatListRef.current?.scrollToIndex({ index: idx, animated: true });
        } catch {}
      }
      setPendingScrollToMessageId(null);
    }, 400);
    return () => clearTimeout(t);
  }, [pendingScrollToMessageId, messages]);

  useEffect(() => {
    if (!pendingScrollToMessageId) return;
    const failSafe = setTimeout(() => setPendingScrollToMessageId(null), 10000);
    return () => clearTimeout(failSafe);
  }, [pendingScrollToMessageId]);
  useEffect(() => {
    if (isExploreVisible) {
      Keyboard.dismiss();
    }
  }, [isExploreVisible]);

  useEffect(() => {
    if (!auth.currentUser) return;
    let cancelled = false;
    const init = async () => {
      let nextStatus: SynqStatus = "idle";
      try {
        const uid = auth.currentUser!.uid;
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
      where("participants", "array-contains", auth.currentUser!.uid),
      orderBy("createdAt", "desc")
    );

    const unsubChats = onSnapshot(q, (snap) => {
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
      const myId = auth.currentUser!.uid;
      const anyUnread = chats.some((c: any) => {
        const updatedAtMs = c.updatedAt?.toMillis?.() ?? 0;
        const lastReadMs = c.lastReadBy?.[myId]?.toMillis?.() ?? 0;
        const lastSender = c.lastMessageSenderId;
        return !!lastSender && lastSender !== myId && updatedAtMs > lastReadMs;
      });

      setHasUnread(anyUnread);
    });

    return () => {
      cancelled = true;
      unsubChats();
    };
  }, []);

  useEffect(() => {
    if (!auth.currentUser || status !== 'active') {
      setAvailableFriends([]);
      return;
    }

    const myId = auth.currentUser.uid;
    const friendsRef = collection(db, 'users', myId, 'friends');
    const friendUnsubs = new Map<string, () => void>();
    const friendState = new Map<string, any>();

    const emit = () => {
      setAvailableFriends(Array.from(friendState.values()));
    };

    const friendsUnsub = onSnapshot(friendsRef, (friendsSnap) => {
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
        const uUnsub = onSnapshot(uRef, (uSnap) => {
          if (!uSnap.exists()) {
            friendState.delete(fid);
            emit();
            return;
          }

          const data = uSnap.data();

          if (data?.status === 'available') {
            friendState.set(fid, { id: fid, ...data });
            const uri = resolveAvatar(data?.imageurl);
            if (uri) {
              ExpoImage.prefetch(uri).catch(() => {});
            }
          } else {
            friendState.delete(fid);
          }

          emit();
        });

        friendUnsubs.set(fid, uUnsub);
      });
      emit();
    });

    return () => {
      friendsUnsub();
      friendUnsubs.forEach((unsub) => unsub());
      friendUnsubs.clear();
      friendState.clear();
    };
  }, [status]);

  useEffect(() => {
    if (!activeChatId || !isChatVisible) return;
    const q = query(collection(db, 'chats', activeChatId, 'messages'), orderBy('createdAt', 'asc'));

    return onSnapshot(q, (snap) => {
      const newMessages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(newMessages);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
  }, [activeChatId, isChatVisible]);

  useEffect(() => {
    if (!isChatVisible) return;
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
  }, [activeChatId, isChatVisible, pendingNewChat, allChats, messages]);

  useEffect(() => {
    let timer: any;
    if (status === 'activating') {
      timer = setTimeout(() => {
        Vibration.vibrate(100);
        setSynqStatus(setSynq, 'finding');
      }, 2000);
    } else if (status === 'finding') {
      timer = setTimeout(() => {
        Vibration.vibrate(100);
        setSynqStatus(setSynq, 'optimizing');
      }, 2000);
    } else if (status === 'optimizing') {
      timer = setTimeout(() => {
        Vibration.vibrate(500);
        setSynqStatus(setSynq, 'active');
      }, 2000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [status]);

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
        : allChats.find((c) => c.id === activeChatId);
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
    } catch {} finally {
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
    } catch {}
  };

  const startSynq = async () => {
    if (!auth.currentUser || isStartingSynq) return;
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
    } catch {} finally {
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
      setIsChatVisible(true);
      setSelectedFriends([]);
    } catch {}
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !auth.currentUser) return;
    if (!pendingNewChat && (!activeChatId || !allChats.find((c) => c.id === activeChatId))) return;

    const text = inputText.trim();
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
    } catch {}
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
    } catch {}
  };

  const firstName = (fullName: string) =>
    (fullName || "").trim().split(/\s+/)[0];


  const getChatTitle = (chat: any) => {
    if (!chat) return "Synq Chat";

    if (chat.customName?.trim()) {
      return wrapChatTitle(chat.customName.trim(), 25);
    }

    const myId = auth.currentUser?.uid;

    const otherUsers = Object.entries(chat.participantNames)
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
    : allChats.find((c) => c.id === activeChatId);

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

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, tabletContentStyle]}>
        <StatusBar barStyle="light-content" />
        {status === 'active' && (
          <View style={styles.activeSynqRoot}>
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => setIsInboxVisible(true)}
                style={styles.headerIconContainer}
                accessibilityRole="button"
                accessibilityLabel="Open messages"
              >
                <Ionicons name="chatbubbles-outline" size={28} color="white" />
                {hasUnread && <View style={styles.badge} />}
              </TouchableOpacity>
              <View style={styles.synqHeaderTitleWrap}>
                <Text style={styles.headerTitle}>Synq is active</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(true)}
                style={styles.headerIconContainer}
                accessibilityRole="button"
                accessibilityLabel="Edit Synq memo and settings"
              >
                <Ionicons name="create-outline" size={26} color="white" />
              </TouchableOpacity>
            </View>
            <View style={styles.headerDivider} />

            <View style={styles.activeListWrap}>
            <FlatList
              style={styles.activeFriendsList}
              data={availableFriends}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <View style={styles.activeEmptyWrap}>
                  <Text style={styles.activeEmptyTitle}>No free friends right now.</Text>
                  <Text style={styles.activeEmptySub}>
                    {`In the meantime, add more connections to increase the chances of having overlapping free time!`}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const friendMemo = item.memo?.trim();
                return (
                <TouchableOpacity
                  onPress={() =>
                    setSelectedFriends((prev) =>
                      prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                    )
                  }
                  style={[styles.friendCard, selectedFriends.includes(item.id) && { borderColor: ACCENT }]}
                >
                  <ExpoImage
                    source={{ uri: resolveAvatar(item.imageurl) }}
                    style={styles.friendImg}
                    cachePolicy="memory-disk"
                    transition={0}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.whiteBold}>{item.displayName}</Text>

                    {item.city && (
                      <View style={styles.locationRow}>
                        <Ionicons
                          name="location-outline"
                          size={14}
                          color="#999"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.locationText}>
                          {item.state ? `${item.city}, ${item.state}` : item.city}
                        </Text>
                      </View>
                    )}

                    {friendMemo ? (
                      <Text
                        style={[styles.grayText, styles.friendMemoLine]}
                        numberOfLines={2}
                      >
                        {friendMemo}
                      </Text>
                    ) : null}
                  </View>

                  {selectedFriends.includes(item.id) && <Ionicons name="checkmark-circle" size={24} color={ACCENT} />}
                </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.activeListContent}
            />
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(9,10,11,0)", "rgba(9,10,11,0.72)", BG]}
              locations={[0, 0.55, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.activeListFade}
            />
            </View>

            <View
              style={[
                styles.activeFooterBlock,
                { paddingBottom: Math.max(56, 36 + insets.bottom) },
              ]}
            >
              <TouchableOpacity
                style={[styles.btn, !selectedFriends.length && { opacity: 0.5 }]}
                onPress={handleConnect}
                disabled={!selectedFriends.length}
                accessibilityRole="button"
                accessibilityLabel={`Connect with ${selectedFriends.length} selected friends`}
              >
                <Text style={styles.btnText}>Connect ({selectedFriends.length})</Text>
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
        )}
        {(status === 'activating' || status === 'finding' || status === 'optimizing') && (
          <View style={styles.activatingContainer}>
            <Text style={styles.unifiedTitle}>
              {status === 'activating'
                ? 'Synq activated...'
                : status === 'finding'
                  ? 'Finding connections...'
                  : 'Optimizing your network...'}
            </Text>
            <ExpoImage
              source={require('../../assets/pulse.gif')}
              style={styles.gifLarge}
              contentFit="contain"
              transition={0}
              cachePolicy="memory-disk"
            />
          </View>
        )}
        {status === "idle" && hydrated && (
          <InactiveSynqView
            memo={memo}
            setMemo={setMemo}
            onStartSynq={startSynq}
            isStartingSynq={isStartingSynq}
            styles={styles}
          />
        )}
        <Modal visible={isInboxVisible} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalBg}>
            <View style={styles.modalHeader}>
              <Text style={styles.messagesInboxTitle}>Messages</Text>
              <TouchableOpacity
                onPress={() => setIsInboxVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close messages"
              >
                <Ionicons name="close-circle" size={28} color="#444" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={allChats}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const myId = auth.currentUser?.uid;
                const updatedAtMs = item.updatedAt?.toMillis?.() ?? 0;
                const lastReadMs = myId ? item.lastReadBy?.[myId]?.toMillis?.() ?? 0 : 0;
                const lastSender = item.lastMessageSenderId;
                const isUnreadThread =
                  !!myId && !!lastSender && lastSender !== myId && updatedAtMs > lastReadMs;
                return (
                <Swipeable
                  rightThreshold={24}
                  onSwipeableOpen={(direction) => {
                    if (direction === "right") {
                      handleDeleteChat(item.id);
                    }
                  }}
                  renderRightActions={() => (
                    <TouchableOpacity
                      style={styles.deleteAction}
                      onPress={() => handleDeleteChat(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Delete conversation"
                    >
                      <Ionicons name="trash" size={24} color="white" />
                    </TouchableOpacity>
                  )}
                >
                  <TouchableOpacity
                    style={[styles.inboxItem, isUnreadThread && styles.inboxItemUnread]}
                    onPress={async () => {
                      prefetchParticipantAvatars(item);
                      setPendingNewChat(null);
                      setActiveChatId(item.id);
                      setIsInboxVisible(false);
                      setIsChatVisible(true);
                      await markChatRead(item.id);
                    }}
                  >
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
                          typeof item.lastMessage === "string" ? item.lastMessage.trim() : "";
                        if (!lm || lm === "Synq established!") return null;
                        return (
                          <Text style={styles.grayText} numberOfLines={1}>
                            {lm}
                          </Text>
                        );
                      })()}
                    </View>
                  </TouchableOpacity>
                </Swipeable>
                );
              }}
            />
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
                  setIsChatVisible(false);
                  setActiveChatId(null);
                  setPendingNewChat(null);
                }
                setAllChats((prev) => prev.filter((c) => c.id !== chatId));
                try {
                  await deleteDoc(doc(db, "chats", chatId));
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch {}
              }}
            />
          </View>
        </Modal>

        <Modal visible={isChatVisible} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalBg}>
            <View
              style={[
                styles.modalHeader,
                { paddingTop: Math.max(4, insets.top - 26) },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View>
                  <Text style={styles.modalTitle}>
                    {activeChat ? getChatTitle(activeChat) : 'Synq Chat'}
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
                    <Ionicons name="sparkles" size={14} color={ACCENT} />
                    <Text style={styles.aiChipText}>{rotatingAIText}</Text>
                    <Ionicons name="chevron-forward" size={14} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsChatVisible(false);
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

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={60}>
              <View style={{ flex: 1 }}>
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  keyExtractor={(item) => item.id}
                  keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                  keyboardShouldPersistTaps="handled"
                  onScrollBeginDrag={() => Keyboard.dismiss()}
                  onMomentumScrollBegin={() => Keyboard.dismiss()}
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
                    const isMe = item.senderId === auth.currentUser?.uid;
                    const isSystemIdea = item.text.includes("✨ Synq AI Suggestion") || item.venueImage;
                    const senderAvatar =
                      resolveAvatar(
                        activeChat?.participantImages?.[item.senderId] || item.imageurl
                      );
                    if (isSystemIdea) {
                      const { name, address } = parseIdeaText(item.text);
                      const ideaHeartCount =
                        item.reactions &&
                        Object.values(item.reactions).filter((v) => v === "heart").length;

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

                          <View style={{ maxWidth: "75%" }}>
                            <Pressable
                              onPress={() =>
                                onMessageBubblePress({
                                  id: item.id,
                                  reactions: item.reactions,
                                })
                              }
                            >
                              <View
                                style={[
                                  styles.bubble,
                                  isMe ? styles.myBubble : styles.theirBubble,
                                  { position: "relative", overflow: "visible" },
                                ]}
                              >
                                <Text
                                  style={{
                                    color: isMe ? "black" : "white",
                                    fontSize: 16,
                                    textAlign: isMe ? "right" : "left",
                                  }}
                                >
                                  {item.text}
                                </Text>
                                {(() => {
                                  const heartCount =
                                    item.reactions &&
                                    Object.values(item.reactions).filter((v) => v === "heart").length;
                                  if (!heartCount) return null;
                                  return (
                                    <View
                                      style={[
                                        styles.heartReaction,
                                        isMe
                                          ? { left: -4, right: undefined }
                                          : { right: -6, left: undefined },
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
                                  );
                                })()}
                              </View>
                            </Pressable>
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
                  contentContainerStyle={{ padding: 20 }}
                />

                {showAICard && (
                  <View style={styles.inChatAICardContainer}>
                    <View style={styles.inChatAICard}>
                      <View style={styles.aiCardHeader}>
                        <Ionicons name="sparkles" size={16} color={ACCENT} style={{ marginRight: 8 }} />
                        <Text style={styles.aiCardTitleSmall}>Synq Suggestion</Text>
                        <TouchableOpacity style={{ marginLeft: 'auto' }} onPress={() => setShowAICard(false)}>
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
          </View>
        </Modal>

        <EditSynqModal
          visible={isEditModalVisible}
          onClose={() => setIsEditModalVisible(false)}
          memo={memo}
          setMemo={setMemo}
          styles={styles}
          onSaveMemo={async () => {
            await updateDoc(doc(db, "users", auth.currentUser!.uid), { memo });
            setIsEditModalVisible(false);
          }}
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
  activeListWrap: { flex: 1, position: "relative" },
  activeFriendsList: { flex: 1 },
  /** Extra bottom padding so last rows scroll above the fade overlay. */
  activeListContent: { paddingTop: 20, paddingBottom: 140, paddingHorizontal: 0 },
  activeListFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
    zIndex: 1,
    elevation: 2,
  },
  /** Friends-tab–style tokens, bumped for legibility on Synq active empty list. */
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 88,
    alignItems: "flex-start",
  },
  synqHeaderTitleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  headerDivider: {
    marginTop: 16,
    height: 1,
    backgroundColor: BORDER,
  },
  headerTitle: {
    color: TEXT,
    fontSize: 28,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 15,
    borderRadius: BUTTON_RADIUS,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222'
  },
  friendImg: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  whiteBold: { color: 'white', fontSize: 17, fontFamily: fonts.medium },
  grayText: { color: '#666', fontSize: 13, marginTop: 2 },
  locationText: { color: '#666', fontSize: 12, marginTop: 2 },
  activeFooterBlock: {
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  btn: {
    alignSelf: 'center',
    width: PRIMARY_CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 16, color: 'black', fontFamily: fonts.medium },
  deactivateLink: { marginTop: 20, alignSelf: 'center', padding: 10 },
  deactivateLinkText: { color: '#FF453A', fontSize: 15, fontFamily: fonts.medium, opacity: 0.9 },
  activatingContainer: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  unifiedTitle: { color: 'white', fontSize: 28, fontFamily: fonts.medium, marginBottom: 36, textAlign: 'center', paddingHorizontal: 24 },
  gifLarge: { width: 280, height: 280 },
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
    marginTop: 120,
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
  modalTitle: { color: 'white', fontSize: 22, fontFamily: fonts.medium },
  messagesInboxTitle: { color: TEXT, fontSize: 28, fontFamily: fonts.heavy, letterSpacing: 0.2 },
  deleteAction: { backgroundColor: '#FF453A', justifyContent: 'center', alignItems: 'center', width: 80, height: '100%' },
  inboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
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
  msgContainer: { marginBottom: 15 },
  chatAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderColor: BORDER,
    borderWidth: 1.5,
    marginRight: 7,
  },
  bubble: { padding: 15, borderRadius: MODAL_RADIUS },
  myBubble: { backgroundColor: ACCENT },
  theirBubble: { backgroundColor: '#1C1C1E' },
  inputRow: { flexDirection: 'row', alignItems: "flex-end", padding: 20, paddingBottom: 40, backgroundColor: BG },
  inputMultiline: {
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 45,
    maxHeight: 120,
  },
  input: { flex: 1, backgroundColor: '#1C1C1E', borderRadius: BUTTON_RADIUS + 10, paddingHorizontal: 20, paddingVertical: 12, color: 'white', fontSize: 16, marginRight: 10 },
  sendBtn: { width: 45, height: 45, borderRadius: BUTTON_RADIUS + 8, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
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
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
  },
  sendIdeaBtn: { backgroundColor: '#8E8E93', margin: 20, padding: 18, borderRadius: 12, alignItems: 'center' },
  sendIdeaBtnEnabled: { backgroundColor: ACCENT, margin: 20, padding: 18, borderRadius: 12, alignItems: 'center' },
  sendIdeaText: { color: 'black', fontFamily: 'Avenir-Black', fontSize: 16 },
  inChatAICardContainer: { paddingHorizontal: 20, marginVertical: 10 },
  inChatAICard: { backgroundColor: '#1C1C1E', borderRadius: 20, padding: 20, borderLeftWidth: 4, borderLeftColor: ACCENT },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  aiCardTitleSmall: { color: ACCENT, fontSize: 14, fontFamily: 'Avenir-Heavy', letterSpacing: 0.5 },
  aiCardBodySmall: { color: 'white', fontSize: 15, fontFamily: 'Avenir', lineHeight: 22, marginBottom: 15 },
  aiShareBtnSmall: { backgroundColor: ACCENT, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  aiShareBtnText: { color: 'black', fontSize: 14, fontFamily: 'Avenir-Heavy' },
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
    backgroundColor: ACCENT,
    width: '80%',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    alignSelf: 'center'
  },
  saveBtnText: { color: 'black', fontSize: 16, fontFamily: 'Avenir-Medium' },
  endSynqBtn: { width: '100%', padding: 18, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FF453A' },
  endSynqBtnText: { color: '#FF453A', fontSize: 16 },
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
  friendMemoLine: {
    marginTop: 4,
    fontStyle: "italic",
  },
  timestampCentered: {
    color: '#666',
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

  aiChipText: {
    color: "#aaa",
    fontSize: 12,
    marginHorizontal: 6,
    fontFamily: "Avenir-Medium",
  },
  panelSubtext: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    marginTop: 6,
    marginBottom: 12,
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

  lockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },

  lockText: {
    color: "rgba(255,255,255,0.30)",
    fontSize: 12,
    marginLeft: 6,
  },
});