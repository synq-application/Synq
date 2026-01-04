import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  addDoc,
  collection,
  deleteDoc,

  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { auth, db } from '../../src/lib/firebase';

const ACCENT = "#7DFFA6";
const DEFAULT_AVATAR = 'https://www.gravatar.com/avatar/?d=mp';
const EXPIRATION_HOURS = 12;

type SynqStatus = 'idle' | 'activating' | 'finding' | 'active';

export default function SynqScreen() {
  const [memo, setMemo] = useState('');
  const [status, setStatus] = useState<SynqStatus>('idle');
  const [availableFriends, setAvailableFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isInboxVisible, setIsInboxVisible] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [allChats, setAllChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');

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
              fetchAvailableFriends();
            }
          }
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    init();

    const q = query(
      collection(db, "chats"), 
      where("participants", "array-contains", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setAllChats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const runSmartMatch = (friends: any[]) => {
    if (!userProfile?.interests || userProfile.interests.length === 0) return;
    for (const friend of friends) {
      const common = friend.interests?.filter((interest: string) => 
        userProfile.interests.includes(interest)
      );
      if (common && common.length > 0) {
        const sharedItem = common[0];
        Vibration.vibrate([0, 400, 100, 400]); 
        Alert.alert(
          "Smart Match Found! ⚡️",
          `Your friend ${friend.displayName} is looking to hang. You both love ${sharedItem}—want to Synq up?`,
          [
            { text: "Dismiss", style: "cancel" },
            { text: "Chat Now", onPress: () => {
                setSelectedFriends([friend.id]);
                handleConnectWithId(friend.id);
            }}
          ]
        );
        break; 
      }
    }
  };

  useEffect(() => {
    let timer: any; 
    if (status === 'activating') {
      timer = setTimeout(() => { Vibration.vibrate(100); setStatus('finding'); }, 3000);
    } else if (status === 'finding') {
      timer = setTimeout(async () => {
        const friends = await fetchAvailableFriends();
        if (friends) runSmartMatch(friends);
        Vibration.vibrate(500); 
        setStatus('active');
      }, 3000);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [status]);

  useEffect(() => {
    if (!activeChatId || !isChatVisible) return;
    const q = query(collection(db, "chats", activeChatId, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [activeChatId, isChatVisible]);

  const fetchAvailableFriends = async () => {
    if (!auth.currentUser) return [];
    const friendsSnap = await getDocs(collection(db, 'users', auth.currentUser.uid, 'friends'));
    const friendsList = await Promise.all(
      friendsSnap.docs.map(async (fDoc) => {
        const pSnap = await getDoc(doc(db, 'users', fDoc.id));
        if (pSnap.exists() && pSnap.data()?.status === 'available') {
          return { id: fDoc.id, ...pSnap.data() };
        }
        return null;
      })
    );
    const results = friendsList.filter(Boolean) as any[];
    setAvailableFriends(results);
    return results;
  };

  const startSynq = async () => {
    if (!auth.currentUser) return;
    Vibration.vibrate(200); 
    await updateDoc(doc(db, 'users', auth.currentUser.uid), { 
      memo, status: 'available', synqStartedAt: serverTimestamp() 
    });
    setStatus('activating');
  };

  const endSynq = async () => {
    Alert.alert("End Synq?", "You will no longer be visible as available.", [
      { text: "Cancel", style: "cancel" },
      { text: "End Session", style: "destructive", onPress: async () => {
            if (!auth.currentUser) return;
            await updateDoc(doc(db, 'users', auth.currentUser.uid), { status: 'inactive', memo: '' });
            setMemo(''); setStatus('idle'); setIsEditModalVisible(false);
          }
      }
    ]);
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
      const existing = allChats.find(c => JSON.stringify(c.participants.sort()) === JSON.stringify(participants));
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
        const chatRef = await addDoc(collection(db, "chats"), {
          participants, participantNames: nameMap, participantImages: imgMap,
          createdAt: serverTimestamp(), lastMessage: "Synq established!",
        });
        setActiveChatId(chatRef.id);
      }
      setIsChatVisible(true);
      setSelectedFriends([]);
    } catch (e) { console.error(e); }
  }

  const sendMessage = async () => {
    if (!inputText.trim() || !activeChatId || !auth.currentUser) return;
    const text = inputText;
    setInputText('');
    await addDoc(collection(db, "chats", activeChatId, "messages"), {
      text, senderId: auth.currentUser.uid,
      imageurl: userProfile?.imageurl || DEFAULT_AVATAR,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "chats", activeChatId), { lastMessage: text });
  };

  const handleDeleteChat = async (chatId: string) => {
    Alert.alert("Delete Chat", "Are you sure you want to delete this conversation?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteDoc(doc(db, "chats", chatId));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }}
    ]);
  };

  const getChatTitle = (chat: any) => {
    if (!auth.currentUser || !chat.participantNames) return "Synq Chat";
    const myId = auth.currentUser.uid;
    const otherNames = Object.entries(chat.participantNames)
      .filter(([uid]) => uid !== myId)
      .map(([_, name]) => name as string);
    if (otherNames.length === 0) return "Just You";
    if (otherNames.length === 1) return `You & ${otherNames[0]}`;
    const lastFriend = otherNames.pop();
    return `You, ${otherNames.join(', ')} & ${lastFriend}`;
  };

  const renderAvatarStack = (images: any) => {
    if (!images) return <View style={styles.inboxCircle}><Ionicons name="people" size={20} color={ACCENT} /></View>;
    const displayImages = Object.entries(images)
      .filter(([uid]) => uid !== auth.currentUser?.uid)
      .map(([_, url]) => url as string).slice(0, 3);
    return (
      <View style={styles.avatarStack}>
        {displayImages.map((uri, index) => (
          <Image key={index} source={{ uri: uri || DEFAULT_AVATAR }} style={[styles.stackedPhoto, { left: index * 12, zIndex: 5 - index }]} />
        ))}
      </View>
    );
  };

  if (loading) return <View style={styles.darkFill}><ActivityIndicator color={ACCENT} /></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {status === 'active' && (
        <View style={{ flex: 1 }}>
          <View style={styles.activeHeader}>
            <TouchableOpacity onPress={() => setIsInboxVisible(true)}>
              <Ionicons name="chatbubbles-outline" size={28} color="white" />
              {allChats.length > 0 && <View style={styles.badge} />}
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Synq is active</Text>
            <TouchableOpacity onPress={() => setIsEditModalVisible(true)}><Ionicons name="create-outline" size={28} color={ACCENT} /></TouchableOpacity>
          </View>
          <FlatList
            data={availableFriends}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity 
                onPress={() => setSelectedFriends(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])}
                style={[styles.friendCard, selectedFriends.includes(item.id) && { borderColor: ACCENT }]}
              >
                <Image source={{ uri: item.imageurl || DEFAULT_AVATAR }} style={styles.friendImg} />
                <View style={{ flex: 1 }}><Text style={styles.whiteBold}>{item.displayName}</Text><Text style={styles.grayText} numberOfLines={1}>{item.memo}</Text></View>
                {selectedFriends.includes(item.id) && <Ionicons name="checkmark-circle" size={24} color={ACCENT} />}
              </TouchableOpacity>
            )}
            contentContainerStyle={{ padding: 20 }}
          />
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.btn, !selectedFriends.length && { opacity: 0.5 }]} onPress={handleConnect} disabled={!selectedFriends.length}>
              <Text style={styles.btnText}>Connect ({selectedFriends.length})</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {(status === 'activating' || status === 'finding') && (
        <View style={styles.activatingContainer}>
            <Text style={styles.unifiedTitle}>{status === 'activating' ? "Synq activated..." : "Finding connections..."}</Text>
            <Image source={require('../../assets/pulse.gif')} style={styles.gifLarge} resizeMode="contain" />
        </View>
      )}

      {status === 'idle' && (
        <View style={styles.inactiveCenter}>
          <Text style={styles.mainTitle}>Ready to activate Synq?</Text>
          <TextInput style={styles.memoInput} value={memo} onChangeText={setMemo} placeholder="What's the plan?" placeholderTextColor="#444" />
          <TouchableOpacity onPress={startSynq} style={styles.pulseBox}>
            <Image source={require('../../assets/pulse.gif')} style={styles.gifLarge} resizeMode="contain" />
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={isInboxVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalBg}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Messages</Text>
            <TouchableOpacity onPress={() => setIsInboxVisible(false)}><Ionicons name="close-circle" size={28} color="#444" /></TouchableOpacity>
          </View>
          <FlatList
            data={allChats}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <Swipeable
                renderRightActions={() => (
                  <TouchableOpacity style={styles.deleteAction} onPress={() => handleDeleteChat(item.id)}>
                    <Ionicons name="trash" size={24} color="white" />
                  </TouchableOpacity>
                )}
              >
                <TouchableOpacity style={styles.inboxItem} onPress={() => { setActiveChatId(item.id); setIsInboxVisible(false); setIsChatVisible(true); }}>
                  {renderAvatarStack(item.participantImages)}
                  <View style={{ flex: 1, marginLeft: Object.keys(item.participantImages || {}).length > 2 ? 35 : 15 }}>
                    <Text style={styles.whiteBold}>{getChatTitle(item)}</Text>
                    <Text style={styles.grayText} numberOfLines={1}>{item.lastMessage}</Text>
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
            <Text style={styles.modalTitle}>{activeChatId && getChatTitle(allChats.find(c => c.id === activeChatId))}</Text>
            <TouchableOpacity onPress={() => setIsChatVisible(false)}><Ionicons name="close-circle" size={30} color="#444" /></TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={10}>
            <FlatList
              data={messages}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const isMe = item.senderId === auth.currentUser?.uid;
                return (
                  <View style={[styles.msgRow, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                    <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                        <Text style={{ color: isMe ? 'black' : 'white', fontSize: 16 }}>{item.text}</Text>
                    </View>
                  </View>
                );
              }}
              contentContainerStyle={{ padding: 20 }}
            />
            <View style={styles.inputRow}>
              <TextInput style={styles.input} value={inputText} onChangeText={setInputText} placeholder="Message..." placeholderTextColor="#666" />
              <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}><Ionicons name="send" size={18} color="black" /></TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={isEditModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setIsEditModalVisible(false)}>
          <View style={styles.centeredModalOverlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.editPanel}>
                <Text style={styles.panelTitle}>Edit your Synq</Text>
                <TextInput style={styles.panelInput} value={memo} onChangeText={setMemo} />
                <TouchableOpacity style={styles.saveBtn} onPress={async () => { await updateDoc(doc(db,'users',auth.currentUser!.uid),{memo}); setIsEditModalVisible(false); }}>
                  <Text style={styles.saveBtnText}>Update Memo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.endSynqBtn} onPress={endSynq}><Text style={styles.endSynqBtnText}>End Session</Text></TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  darkFill: { flex: 1, backgroundColor: 'black', justifyContent: 'center' },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 25, paddingTop: 60, paddingBottom: 20, alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 22, fontFamily: 'Avenir-Black' },
  subheaderTitle: { color: 'white', fontSize: 16, textAlign: 'center', marginBottom: 10 },
  badge: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  friendCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 15, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  friendImg: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  whiteBold: { color: 'white', fontSize: 17, fontFamily: 'Avenir-Heavy' },
  grayText: { color: '#666', fontSize: 13, marginTop: 2 },
  footer: { padding: 25, paddingBottom: 150 },
  btn: { backgroundColor: ACCENT, padding: 18, borderRadius: 20, alignItems: 'center' },
  btnText: { fontSize: 16, color: 'black', fontFamily: 'Avenir-Black' },
  activatingContainer: { flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center' },
  unifiedTitle: { color: 'white', fontSize: 24, fontFamily: 'Avenir-Black', marginBottom: 50, textAlign: 'center' },
  gifLarge: { width: 250, height: 250 },
  inactiveCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  mainTitle: { color: 'white', fontSize: 32, textAlign: 'center', fontFamily: 'Avenir-Black' },
  memoInput: { color: 'white', fontSize: 18, borderBottomWidth: 1, borderBottomColor: '#222', width: '100%', textAlign: 'center', marginVertical: 40, paddingBottom: 10 },
  pulseBox: { width: 250, height: 250, justifyContent: 'center', alignItems: 'center' },
  centeredModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 25 },
  editPanel: { width: '100%', backgroundColor: '#161616', borderRadius: 32, padding: 32, alignItems: 'center' },
  panelTitle: { color: 'white', fontSize: 22, marginBottom: 24, fontFamily: 'Avenir-Black' },
  panelInput: { width: '100%', backgroundColor: '#000', color: 'white', padding: 18, borderRadius: 16, marginBottom: 20, textAlign: 'center' },
  saveBtn: { backgroundColor: ACCENT, width: '100%', padding: 18, borderRadius: 16, alignItems: 'center', marginBottom: 12 },
  saveBtnText: { color: 'black', fontSize: 16, fontFamily: 'Avenir-Black' },
  endSynqBtn: { width: '100%', padding: 18, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FF453A' },
  endSynqBtnText: { color: '#FF453A', fontSize: 16 },
  modalBg: { flex: 1, backgroundColor: '#0A0A0A' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  modalTitle: { color: 'white', fontSize: 19, fontFamily: 'Avenir-Heavy' },
  inboxItem: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#151515', backgroundColor: '#0A0A0A' },
  avatarStack: { width: 60, height: 44, position: 'relative' },
  stackedPhoto: { width: 44, height: 44, borderRadius: 22, position: 'absolute', borderWidth: 2, borderColor: '#0A0A0A' },
  inboxCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  deleteAction: { backgroundColor: '#FF453A', justifyContent: 'center', alignItems: 'center', width: 80, height: '100%' },
  msgRow: { flexDirection: 'row', marginBottom: 15 },
  bubble: { padding: 12, borderRadius: 18, maxWidth: '80%' },
  myBubble: { backgroundColor: ACCENT },
  theirBubble: { backgroundColor: '#222' },
  inputRow: { flexDirection: 'row', padding: 15, paddingBottom: Platform.OS === 'ios' ? 40 : 15, backgroundColor: '#050505', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#151515', borderRadius: 25, paddingHorizontal: 15, paddingVertical: 12, color: 'white' },
  sendBtn: { backgroundColor: ACCENT, width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});