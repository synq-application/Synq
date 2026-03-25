import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  addDoc,
  collection,
  deleteDoc,
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
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Vibration,
  View
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { ACCENT, aiPrompts, DEFAULT_AVATAR, EXPIRATION_HOURS, fonts, MUTED, OFFSETS } from '../../constants/Variables';
import { auth, db } from '../../src/lib/firebase';
import ConfirmModal from '../confirm-modal';
import ExploreModal from '../explore-modal';
import { formatTime, SynqStatus } from '../helpers';
import { openInMaps } from '../map-utils';
import EditSynqModal from '../synq-screens/EditSynqModal';
import InactiveSynqView from '../synq-screens/InactiveSynqView';

export default function SynqScreen() {
  const [memo, setMemo] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [status, setStatus] = useState<SynqStatus>('idle');
  const [availableFriends, setAvailableFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isInboxVisible, setIsInboxVisible] = useState(false);
  const [isExploreVisible, setIsExploreVisible] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
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
  const lastTapRef = useRef<{ [key: string]: number }>({});
  const heartScales = useRef<{ [key: string]: Animated.Value }>({});
  const [hasUnread, setHasUnread] = useState(false);
  const [mutualInterests, setMutualInterests] = useState<string[]>([]);
  const [showEndSynqModal, setShowEndSynqModal] = useState(false);
  const [rotatingAIText, setRotatingAIText] = useState(aiPrompts[0]);
  const markChatRead = async (chatId: string) => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;

    try {
      await updateDoc(doc(db, 'chats', chatId), {
        [`lastReadBy.${myId}`]: serverTimestamp(),
      });
    } catch (e) {
      console.error('Failed to mark chat read', e);
    }
  };

  const parseIdeaText = (text: string) => {
    const lines = (text || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const name = lines[0] || "";
    const address = lines.slice(1).join(" ") || "";
    return { name, address };
  };
  const normalizeInterest = (s: string) => (s || '').trim();

  const animateHeart = (messageId: string) => {
    if (!heartScales.current[messageId]) {
      heartScales.current[messageId] = new Animated.Value(0);
    }

    const scale = heartScales.current[messageId];

    scale.setValue(0);

    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  };

  const intersectMany = (lists: string[][]) => {
    if (!lists.length) return [];
    const base = new Set(lists[0].map(normalizeInterest).filter(Boolean));
    for (let i = 1; i < lists.length; i++) {
      const next = new Set(lists[i].map(normalizeInterest).filter(Boolean));
      for (const val of Array.from(base)) {
        if (!next.has(val)) base.delete(val);
      }
    }
    return Array.from(base);
  };

  const computeMutualInterestsForChat = async (chatId: string) => {
    if (!auth.currentUser) return [];
    const me = auth.currentUser.uid;

    const chat = allChats.find((c) => c.id === chatId);
    if (!chat) return [];

    const myInterests: string[] = (userProfile?.interests || [])
      .map(normalizeInterest)
      .filter(Boolean);

    if (!myInterests.length) return [];

    const otherIds: string[] = (chat.participants || []).filter((id: string) => id !== me);
    if (!otherIds.length) return [];

    const snaps = await Promise.all(
      otherIds.map((uid: string) => getDoc(doc(db, 'users', uid)))
    );

    const othersLists: string[][] = snaps
      .filter((s) => s.exists())
      .map((s) =>
        ((s.data()?.interests || []) as string[])
          .map(normalizeInterest)
          .filter(Boolean)
      );

    const mutual = intersectMany([myInterests, ...othersLists]);
    return mutual.slice(0, 10);
  };

  useEffect(() => {
    let index = 0;

    const interval = setInterval(() => {
      index = (index + 1) % aiPrompts.length;
      setRotatingAIText(aiPrompts[index]);
    }, 10000);

    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!isExploreVisible || !activeChatId) return;

    (async () => {
      try {
        const mutual = await computeMutualInterestsForChat(activeChatId);
        setMutualInterests(mutual);
      } catch (e) {
        console.error('Failed to compute mutual interests', e);
        setMutualInterests([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExploreVisible, activeChatId]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('openChat', async (data) => {
      if (data.chatId) {
        setActiveChatId(data.chatId);
        setIsChatVisible(true);
        setIsInboxVisible(false);
        await markChatRead(data.chatId);
      }
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (isExploreVisible) {
      Keyboard.dismiss();
    }
  }, [isExploreVisible]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const init = async () => {
      try {
        const userRef = doc(db, 'users', auth.currentUser!.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserProfile(data);
          setMemo(data.memo || '');
          if (data.status === 'available' && data.synqStartedAt) {
            const startTime = data.synqStartedAt.toDate().getTime();
            const hoursElapsed = (new Date().getTime() - startTime) / (1000 * 60 * 60);
            if (hoursElapsed > EXPIRATION_HOURS) {
              await updateDoc(userRef, { status: 'inactive', memo: '' });
              setStatus('idle');
              setMemo('');
            } else {
              setStatus('active');
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    init();

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", auth.currentUser!.uid),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snap) => {
      const chats = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      chats.sort((a, b) => {
        const aMs = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const bMs = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return bMs - aMs;
      });

      setAllChats(chats);
      const myId = auth.currentUser!.uid;
      const anyUnread = chats.some((c: any) => {
        const updatedAtMs = c.updatedAt?.toMillis?.() ?? 0;
        const lastReadMs = c.lastReadBy?.[myId]?.toMillis?.() ?? 0;
        const lastSender = c.lastMessageSenderId;
        return !!lastSender && lastSender !== myId && updatedAtMs > lastReadMs;
      });

      setHasUnread(anyUnread);
    });
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
    let timer: any;
    if (status === 'activating') {
      timer = setTimeout(() => {
        Vibration.vibrate(100);
        setStatus('finding');
      }, 2000);
    } else if (status === 'finding') {
      timer = setTimeout(async () => {
        Vibration.vibrate(500);
        setStatus('active');
      }, 2000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [status]);

  const triggerAISuggestion = async (category: string) => {
    if (!activeChatId || isAILoading) return;
    setIsAILoading(true);
    setCurrentCategory(category);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const functions = getFunctions();
      const getSuggestions = httpsCallable(functions, 'getSynqSuggestions');
      const currentChat = allChats.find((c) => c.id === activeChatId);
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
    } catch (error) {
      console.error('AI Error:', error);
    } finally {
      setIsAILoading(false);
      setIsThinking(false)
    }
  };

  const sendAISuggestionToChat = async () => {
    if (!activeChatId || !auth.currentUser) return;

    const textToSend = selectedOption
      ? `${selectedOption.name}\n${selectedOption.location}`
      : `✨ Synq AI Suggestion:\n\n${aiResponse}`;

    try {
      await addDoc(collection(db, 'chats', activeChatId, 'messages'), {
        text: textToSend,
        senderId: auth.currentUser.uid,
        imageurl: userProfile?.imageurl || DEFAULT_AVATAR,
        venueImage: selectedOption?.imageUrl || selectedOption?.imageurl || null,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', activeChatId), {
        lastMessage: selectedOption ? `Shared: ${selectedOption.name}` : 'AI Suggestion shared',
        lastMessageSenderId: auth.currentUser.uid,
        updatedAt: serverTimestamp()
      });

      setIsExploreVisible(false);
      setShowOptionsList(false);
      setSelectedOption(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('Failed to share AI suggestion', e);
    }
  };

  const startSynq = async () => {
    if (!auth.currentUser) return;
    Vibration.vibrate(200);
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      memo,
      status: 'available',
      synqStartedAt: serverTimestamp()
    });
    setStatus('activating');
  };

  const endSynq = () => {
    setShowEndSynqModal(true);
  };

  const handleConnectWithId = async (friendId: string) => {
    if (!auth.currentUser) return;
    const participants = [auth.currentUser.uid, friendId].sort();
    await executeConnection(participants);
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
        setActiveChatId(existing.id);
      } else {
        const nameMap: any = {};
        const imgMap: any = {};
        for (const uid of participants) {
          const uSnap = await getDoc(doc(db, 'users', uid));
          if (uSnap.exists()) {
            nameMap[uid] = uSnap.data().displayName;
            imgMap[uid] = uSnap.data().imageurl || DEFAULT_AVATAR;
          }
        }
        const chatRef = await addDoc(collection(db, 'chats'), {
          participants,
          participantNames: nameMap,
          participantImages: imgMap,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: 'Synq established!'
        });
        setActiveChatId(chatRef.id);
      }
      setIsChatVisible(true);
      setSelectedFriends([]);
    } catch (e) {
      console.error(e);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !activeChatId || !auth.currentUser) return;
    const currentChat = allChats.find((c) => c.id === activeChatId);
    if (!currentChat) return;

    const text = inputText;
    const myId = auth.currentUser.uid;
    setInputText('');

    try {
      await addDoc(collection(db, 'chats', activeChatId, 'messages'), {
        text,
        senderId: myId,
        imageurl: userProfile?.imageurl || DEFAULT_AVATAR,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', activeChatId), {
        lastMessage: text,
        lastMessageSenderId: myId,
        updatedAt: serverTimestamp()
      });

      const otherParticipants = currentChat.participants.filter((pId: string) => pId !== myId);
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
    } catch (e) {
      console.error('Failed to send message', e);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    Alert.alert('Delete Chat', 'Are you sure you want to delete this conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (activeChatId === chatId) {
            setIsChatVisible(false);
            setActiveChatId(null);
          }
          await deleteDoc(doc(db, 'chats', chatId));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }
    ]);
  };

  const toggleHeartReaction = async (messageId: string, currentReactions: any) => {
    if (!auth.currentUser || !activeChatId) return;

    const userId = auth.currentUser.uid;
    const messageRef = doc(db, "chats", activeChatId, "messages", messageId);

    try {
      const hasReacted = currentReactions?.[userId] === "heart";

      await updateDoc(messageRef, {
        [`reactions.${userId}`]: hasReacted ? null : "heart",
      });
    } catch (e) {
      console.error("Failed to toggle reaction", e);
    }
  };

  const firstName = (fullName: string) =>
    (fullName || "").trim().split(/\s+/)[0];

  const wrapChatTitle = (text: string, maxChars = 30) => {
    const tokens = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const token of tokens) {
      const testLine = currentLine
        ? `${currentLine} ${token}`
        : token;

      if (testLine.length <= maxChars) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = token;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  };

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

  const activeChat = allChats.find((c) => c.id === activeChatId);

  const resolveAvatar = (url?: any) => {
    if (typeof url === "string" && url.trim().startsWith("http")) {
      return url;
    }
    return DEFAULT_AVATAR;
  };

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
      .map(([_, url]) => resolveAvatar(url));

    if (others.length === 1) {
      return (
        <View style={styles.singleAvatarWrap}>
          <Image
            source={{ uri: others[0] }}
            style={styles.singleAvatar}
          />
        </View>
      );
    }

    const displayImages = others.slice(0, 4);

    if (displayImages.length === 0) {
      return (
        <View style={styles.inboxCircle}>
          <Ionicons name="people" size={20} color={ACCENT} />
        </View>
      );
    }

    return (
      <View style={styles.avatarCluster}>
        {displayImages.map((uri, index) => {
          const o = OFFSETS[index] ?? { x: index * 14, y: 0, z: 1 };
          return (
            <Image
              key={`${uri}-${index}`}
              source={{ uri }}
              style={[
                styles.clusterPhoto,
                { left: o.x, top: o.y, zIndex: o.z },
              ]}
            />
          );
        })}
      </View>
    );
  };

  if (loading) return <View style={styles.darkFill}><ActivityIndicator color={ACCENT} /></View>;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        {status === 'active' && (
          <View style={{ flex: 1 }}>
            <View style={styles.activeHeader}>
              <TouchableOpacity onPress={() => setIsInboxVisible(true)} style={styles.headerIconContainer}>
                <Ionicons name="chatbubbles-outline" size={28} color="white" />
                {hasUnread && <View style={styles.badge} />}
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Synq is active</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(true)} style={styles.headerIconContainer}>
                <Ionicons name="create-outline" size={26} color="white" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableFriends}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <>
                  <Text style={{ color: 'white', textAlign: 'center', marginTop: 50, fontSize: 22 }}>
                    No free friends right now.
                  </Text>
                  <Text style={{ color: 'white', textAlign: 'center', marginTop: 50, fontSize: 18 }}>
                    In the meantime, add more connections to increase the chances of having overlapping free time!
                  </Text>
                </>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() =>
                    setSelectedFriends((prev) =>
                      prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                    )
                  }
                  style={[styles.friendCard, selectedFriends.includes(item.id) && { borderColor: ACCENT }]}
                >
                  <Image source={{ uri: item.imageurl || DEFAULT_AVATAR }} style={styles.friendImg} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.whiteBold}>{item.displayName}</Text>

                    {item.city && (
                      <View style={styles.locationRow}>
                        <Ionicons
                          name="location-sharp"
                          size={14}
                          color="#999"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.locationText}>
                          {item.state ? `${item.city}, ${item.state}` : item.city}
                        </Text>
                      </View>
                    )}

                    <Text style={styles.grayText} numberOfLines={1}>
                      {item.memo}
                    </Text>
                  </View>

                  {selectedFriends.includes(item.id) && <Ionicons name="checkmark-circle" size={24} color={ACCENT} />}
                </TouchableOpacity>
              )}
              contentContainerStyle={{ padding: 20 }}
            />

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.btn, !selectedFriends.length && { opacity: 0.5 }]}
                onPress={handleConnect}
                disabled={!selectedFriends.length}
              >
                <Text style={styles.btnText}>Connect ({selectedFriends.length})</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={endSynq} style={styles.deactivateLink}>
                <Text style={styles.deactivateLinkText}>End Synq</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {(status === 'activating' || status === 'finding') && (
          <View style={styles.activatingContainer}>
            <Text style={styles.unifiedTitle}>{status === 'activating' ? 'Synq activated...' : 'Finding connections...'}</Text>
            <Image source={require('../../assets/pulse.gif')} style={styles.gifLarge} resizeMode="contain" />
          </View>
        )}
        {status === "idle" && (
          <InactiveSynqView
            memo={memo}
            setMemo={setMemo}
            onStartSynq={startSynq}
            styles={styles}
          />
        )}
        <Modal visible={isInboxVisible} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalBg}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Messages</Text>
              <TouchableOpacity onPress={() => setIsInboxVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#444" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={allChats}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Swipeable
                  renderRightActions={() => (
                    <TouchableOpacity style={styles.deleteAction} onPress={() => handleDeleteChat(item.id)}>
                      <Ionicons name="trash" size={24} color="white" />
                    </TouchableOpacity>
                  )}
                >
                  <TouchableOpacity
                    style={styles.inboxItem}
                    onPress={async () => {
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
                        style={styles.whiteBold}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {getChatTitle(item)}
                      </Text>
                      <Text style={styles.grayText} numberOfLines={1}>
                        {item.lastMessage}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              )}
            />
          </View>
        </Modal>

        <Modal visible={isChatVisible} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalBg}>
            <View style={styles.modalHeader}>
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
                }}
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
                  onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                  onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                  renderItem={({ item }) => {
                    const isMe = item.senderId === auth.currentUser?.uid;
                    const isSystemIdea = item.text.includes("✨ Synq AI Suggestion") || item.venueImage;
                    const currentChat = allChats.find((c) => c.id === activeChatId);
                    const senderAvatar =
                      currentChat?.participantImages?.[item.senderId] || item.imageurl || DEFAULT_AVATAR;
                    if (isSystemIdea) {
                      const { name, address } = parseIdeaText(item.text);

                      return (
                        <View style={styles.centeredIdeaContainer}>
                          <View style={{ width: "85%", alignSelf: "center" }}>
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => {
                                openInMaps({ name, address });
                              }}
                            >
                              <View style={[styles.ideaBubble, { width: "100%" }]}>
                                {item.venueImage ? (
                                  <Image
                                    source={{ uri: item.venueImage }}
                                    style={styles.ideaImage}
                                    resizeMode="cover"
                                  />
                                ) : null}
                                <Text style={styles.ideaText}>{item.text}</Text>
                              </View>
                            </TouchableOpacity>
                          </View>

                          <Text style={styles.timestampCentered}>{formatTime(item.createdAt)}</Text>
                        </View>
                      );
                    }
                    return (
                      <View
                        style={[
                          styles.msgContainer,
                          isMe ? { alignItems: "flex-end" } : { alignItems: "flex-start" },
                        ]}
                      >
                        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                          {!isMe && (
                            <Image source={{ uri: senderAvatar }} style={styles.chatAvatar} />
                          )}

                          <View style={{ position: "relative", maxWidth: "75%" }}>
                            <View
                              onStartShouldSetResponder={() => true}
                              onResponderRelease={() => {
                                const now = Date.now();
                                const lastTap = lastTapRef.current[item.id];

                                if (lastTap && now - lastTap < 300) {
                                  toggleHeartReaction(item.id, item.reactions);

                                  // 💥 animate
                                  animateHeart(item.id);

                                  // 📳 haptic
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }

                                lastTapRef.current[item.id] = now;
                              }}
                              style={[
                                styles.bubble,
                                isMe ? styles.myBubble : styles.theirBubble,
                              ]}
                            >
                              <Text
                                style={{
                                  color: isMe ? "black" : "white",
                                  fontSize: 16,
                                }}
                              >
                                {item.text}
                              </Text>
                            </View>
                            {item.reactions &&
                              Object.values(item.reactions).includes("heart") && (
                                <Animated.View
                                  style={[
                                    styles.heartReaction,
                                    {
                                      transform: [
                                        {
                                          scale:
                                            heartScales.current[item.id] ||
                                            new Animated.Value(1),
                                        },
                                      ],
                                    },
                                  ]}
                                >
                                  <Ionicons name="heart" size={12} color="#FF3B30" />
                                </Animated.View>
                              )}
                          </View>
                        </View>

                        <Text
                          style={[
                            styles.timestampOutside,
                            isMe ? { marginRight: 4 } : { marginLeft: 44 },
                          ]}
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
                <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
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

            setMemo("");
            setStatus("idle");
            setIsEditModalVisible(false);
          }}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070707" },
  darkFill: { flex: 1, backgroundColor: 'black', justifyContent: 'center' },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    paddingTop: 70,
    paddingBottom: 20,
    alignItems: 'center',
    backgroundColor: "#070707",
    height: 140
  },
  headerTitle: { color: 'white', fontSize: 24, fontFamily: 'Avenir-Heavy', textAlign: 'center' },
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
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222'
  },
  friendImg: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  whiteBold: { color: 'white', fontSize: 17, fontFamily: 'Avenir-Medium' },
  grayText: { color: '#666', fontSize: 13, marginTop: 2 },
  locationText: { color: '#666', fontSize: 12, marginTop: 2 },
  footer: { padding: 25, paddingBottom: 80 },
  btn: { backgroundColor: ACCENT, padding: 18, borderRadius: 20, alignItems: 'center' },
  btnText: { fontSize: 16, color: 'black', fontFamily: 'Avenir-Medium' },
  deactivateLink: { marginTop: 20, alignSelf: 'center', padding: 10 },
  deactivateLinkText: { color: '#FF453A', fontSize: 15, fontFamily: 'Avenir-Medium', opacity: 0.9 },
  activatingContainer: { flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center' },
  unifiedTitle: { color: 'white', fontSize: 28, fontFamily: 'Avenir', marginBottom: 50, textAlign: 'center' },
  gifLarge: { width: 350, height: 350, marginTop: 50 },
  inactiveCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  mainTitle: { color: 'white', fontSize: 32, fontFamily: fonts.medium, letterSpacing: 0.2 },
  memoInput: {
    color: 'white',
    fontSize: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    width: '100%',
    textAlign: 'center',
    marginVertical: 40,
    paddingBottom: 10
  },
  pulseBox: { width: 250, height: 300, justifyContent: 'center', alignItems: 'center' },
  tapToActivate: {
    color: 'gray',
    fontSize: 19,
    fontFamily: 'Avenir-Medium',
    marginTop: -10,
    opacity: 0.8,
    letterSpacing: 0.5,
    textAlign: 'center'
  },
centeredModalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.9)',
  justifyContent: 'center', 
  alignItems: 'center',
  padding: 25,
},
  modalBg: { flex: 1, backgroundColor: 'black' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#111' },
  modalTitle: { color: 'white', fontSize: 22, fontFamily: 'Avenir-Medium' },
  deleteAction: { backgroundColor: '#FF453A', justifyContent: 'center', alignItems: 'center', width: 80, height: '100%' },
  inboxItem: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#111' },
  inboxCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  stackedPhoto: { width: 40, height: 40, borderRadius: 20, position: 'absolute', borderWidth: 2, borderColor: 'black' },
  msgContainer: { marginBottom: 15 },
  chatAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  bubble: { padding: 15, borderRadius: 22 },
  myBubble: { backgroundColor: ACCENT },
  theirBubble: { backgroundColor: '#1C1C1E' },
  timestampOutside: { color: '#444', fontSize: 11, marginTop: 4, fontFamily: 'Avenir' },
  inputRow: { flexDirection: 'row', alignItems: "flex-end", padding: 20, paddingBottom: 40, backgroundColor: 'black' },
  inputMultiline: {
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 45,
    maxHeight: 120,
  },
  input: { flex: 1, backgroundColor: '#1C1C1E', borderRadius: 25, paddingHorizontal: 20, paddingVertical: 12, color: 'white', fontSize: 16, marginRight: 10 },
  sendBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  explorePanel: { height: '85%', backgroundColor: '#0A0A0A', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
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
    backgroundColor: "#000",
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: "#222",
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
  timestampCentered: {
    color: '#666',
    fontSize: 10,
    marginTop: 4,
  },
  singleAvatarWrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  singleAvatar: {
    width: 52,
    height: 52,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "black",
    backgroundColor: "#1C1C1E",
  },
  avatarColumn: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCluster: {
    width: 64,
    height: 56,
    position: "relative",
  },
  clusterPhoto: {
    width: 34,
    height: 34,
    borderRadius: 17,
    position: "absolute",
    borderWidth: 2,
    borderColor: "black",
    backgroundColor: "#1C1C1E",
  },
  avatarStack: {
    width: 50,
    height: 50,
    position: 'relative',
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

suggestionWrap: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 8, // 👈 cleaner spacing (RN 0.71+)
},
suggestionChip: {
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
  backgroundColor: "rgba(255,255,255,0.04)",
  paddingHorizontal: 14,
  paddingVertical: 10,
  borderRadius: 999,

  // 👇 KEY FIX
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