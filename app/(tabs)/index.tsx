import { Ionicons } from '@expo/vector-icons';
import {
  addDoc,
  collection,
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
  TouchableOpacity, // Added Keyboard
  TouchableWithoutFeedback // Added TouchableWithoutFeedback
  ,


  View
} from 'react-native';
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

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  useEffect(() => {
    if (!auth.currentUser) return;

    const init = async () => {
      try {
        const userRef = doc(db, 'users', auth.currentUser!.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.status === 'available' && data.synqStartedAt) {
            const startTime = data.synqStartedAt.toDate().getTime();
            const currentTime = new Date().getTime();
            const hoursElapsed = (currentTime - startTime) / (1000 * 60 * 60);

            if (hoursElapsed > EXPIRATION_HOURS) {
              await updateDoc(userRef, { status: 'inactive', memo: '' });
              setStatus('idle');
              setMemo('');
            } else {
              setUserProfile(data);
              setMemo(data.memo || '');
              setStatus('active');
              fetchAvailableFriends();
            }
          } else {
            setUserProfile(data);
            setMemo(data.memo || '');
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
      where("participants", "array-contains", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setAllChats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    let timer: any; 

    if (status === 'activating') {
      timer = setTimeout(() => {
        setStatus('finding');
      }, 3000);
    } else if (status === 'finding') {
      timer = setTimeout(() => {
        setStatus('active');
        fetchAvailableFriends();
      }, 3000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [status]);

  useEffect(() => {
    if (!activeChatId || !isChatVisible) return;
    const q = query(collection(db, "chats", activeChatId, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [activeChatId, isChatVisible]);

  const fetchAvailableFriends = async () => {
    if (!auth.currentUser) return;
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
    setAvailableFriends(friendsList.filter(Boolean) as any);
  };

  const startSynq = async () => {
    if (!auth.currentUser) return;
    await updateDoc(doc(db, 'users', auth.currentUser.uid), { 
      memo, 
      status: 'available',
      synqStartedAt: serverTimestamp() 
    });
    setStatus('activating');
  };

  const endSynq = async () => {
    Alert.alert(
      "End Synq?",
      "You will no longer be visible as available to your friends.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "End Session", 
          style: "destructive",
          onPress: async () => {
            if (!auth.currentUser) return;
            await updateDoc(doc(db, 'users', auth.currentUser.uid), { 
              status: 'inactive',
              memo: '' 
            });
            setMemo(''); 
            setStatus('idle');
            setIsEditModalVisible(false);
          }
        }
      ]
    );
  };

  const handleConnect = async () => {
    if (selectedFriends.length === 0 || !auth.currentUser) return;
    try {
      const myId = auth.currentUser.uid;
      const participants = [myId, ...selectedFriends].sort();
      const existing = allChats.find(c => JSON.stringify(c.participants.sort()) === JSON.stringify(participants));

      if (existing) {
        setActiveChatId(existing.id);
      } else {
        const nameMap: any = { [myId]: userProfile?.displayName || "User" };
        const imgMap: any = { [myId]: userProfile?.imageurl || DEFAULT_AVATAR };
        
        for (const fId of selectedFriends) {
          const fSnap = await getDoc(doc(db, 'users', fId));
          if (fSnap.exists()) {
            nameMap[fId] = fSnap.data().displayName;
            imgMap[fId] = fSnap.data().imageurl || DEFAULT_AVATAR;
          }
        }

        const chatRef = await addDoc(collection(db, "chats"), {
          participants,
          participantNames: nameMap,
          participantImages: imgMap,
          createdAt: serverTimestamp(),
          lastMessage: "Synq established!",
        });
        setActiveChatId(chatRef.id);
      }
      setIsChatVisible(true);
      setSelectedFriends([]);
    } catch (e) { console.error(e); }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !activeChatId || !auth.currentUser) return;
    const text = inputText;
    setInputText('');
    await addDoc(collection(db, "chats", activeChatId, "messages"), {
      text,
      senderId: auth.currentUser.uid,
      imageurl: userProfile?.imageurl || DEFAULT_AVATAR,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "chats", activeChatId), { lastMessage: text });
  };

  const currentChat = allChats.find(c => c.id === activeChatId);

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
            <TouchableOpacity onPress={() => setIsEditModalVisible(true)}>
              <Ionicons name="create-outline" size={28} color={ACCENT} />
            </TouchableOpacity>
          </View>

          <View>
            <Text style={styles.subheaderTitle}>Available Friends</Text>
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.whiteBold}>{item.displayName}</Text>
                  <Text style={styles.grayText} numberOfLines={1}>{item.memo}</Text>
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
          </View>
        </View>
      )}

      {(status === 'activating' || status === 'finding') && (
        <View style={styles.activatingContainer}>
            <Text style={styles.unifiedTitle}>
              {status === 'activating' ? "Synq activated..." : "Finding available connections..."}
            </Text>
            <Image 
                source={require('../../assets/pulse.gif')} 
                style={styles.gifLarge}
                resizeMode="contain"
            />
        </View>
      )}

      {status === 'idle' && (
        <View style={styles.inactiveCenter}>
          <Text style={styles.mainTitle}>Ready to activate Synq?</Text>
          <TextInput 
            style={styles.memoInput} 
            value={memo} 
            onChangeText={setMemo} 
            placeholder="Anyone want to grab a drink?" 
            placeholderTextColor="#444" 
          />
          <TouchableOpacity onPress={startSynq} style={styles.pulseBox}>
                <Image 
                    source={require('../../assets/pulse.gif')} 
                    style={styles.gifLarge}
                    resizeMode="contain"
                />
          </TouchableOpacity>
        </View>
      )}

      {/* REWRITTEN EDIT MODAL */}
      <Modal visible={isEditModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback 
          onPress={() => {
            Keyboard.dismiss();
            setIsEditModalVisible(false);
          }}
        >
          <View style={styles.centeredModalOverlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.editPanel}>
                {/* Top Right X Button */}
                <TouchableOpacity 
                  style={styles.modalCloseIcon} 
                  onPress={() => setIsEditModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>

                <Text style={styles.panelTitle}>Edit your Synq</Text>
                <TextInput 
                  style={styles.panelInput}
                  value={memo}
                  onChangeText={setMemo}
                  placeholder="Update your note..."
                  placeholderTextColor="#666"
                  multiline
                />
                <TouchableOpacity 
                  style={styles.saveBtn} 
                  onPress={async () => {
                    await updateDoc(doc(db, 'users', auth.currentUser!.uid), { memo });
                    setIsEditModalVisible(false);
                  }}
                >
                  <Text style={styles.saveBtnText}>Update Memo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.endSynqBtn} onPress={endSynq}>
                  <Text style={styles.endSynqBtnText}>End Synq Session</Text>
                </TouchableOpacity>
                {/* Visual Cancel Text as secondary option */}
                <TouchableOpacity onPress={() => setIsEditModalVisible(false)} style={{ marginTop: 24 }}>
                  <Text style={{ color: 'white', opacity: 0.6, fontFamily: 'Avenir-Medium' }}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={isInboxVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalBg}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Your Synqs</Text>
            <TouchableOpacity onPress={() => setIsInboxVisible(false)}><Ionicons name="close-circle" size={28} color="#444" /></TouchableOpacity>
          </View>
          <FlatList
            data={allChats}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.inboxItem} onPress={() => { setActiveChatId(item.id); setIsInboxVisible(false); setIsChatVisible(true); }}>
                <View style={styles.inboxCircle}><Ionicons name="people" size={20} color={ACCENT} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.whiteBold}>{getChatTitle(item)}</Text>
                  <Text style={styles.grayText} numberOfLines={1}>{item.lastMessage}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      <Modal visible={isChatVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalBg}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>{currentChat ? getChatTitle(currentChat) : 'Chat'}</Text>
            <TouchableOpacity onPress={() => setIsChatVisible(false)}><Ionicons name="close-circle" size={30} color="#444" /></TouchableOpacity>
          </View>
          
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={10}>
            <FlatList
              data={messages}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const isMe = item.senderId === auth.currentUser?.uid;
                const displayImg = item.imageurl || currentChat?.participantImages?.[item.senderId] || DEFAULT_AVATAR;
                return (
                  <View style={[styles.msgRow, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                    {!isMe && <Image source={{ uri: displayImg }} style={styles.bubbleImg} />}
                    <View style={{ maxWidth: '75%', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                            <Text style={{ color: isMe ? 'black' : 'white', fontSize: 16, fontFamily: 'Avenir-Medium' }}>{item.text}</Text>
                        </View>
                        <Text style={styles.timestampText}>{formatTime(item.createdAt)}</Text>
                    </View>
                    {isMe && <Image source={{ uri: displayImg }} style={styles.bubbleImg} />}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  darkFill: { flex: 1, backgroundColor: 'black', justifyContent: 'center' },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 25, paddingTop: 60, paddingBottom: 20, alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 22, fontFamily: 'Avenir-Black' },
  subheaderTitle: { color: 'white', fontSize: 16, fontFamily: 'Avenir', alignItems: 'center', textAlign: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  friendCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 15, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  friendImg: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  whiteBold: { color: 'white', fontSize: 17, fontFamily: 'Avenir-Heavy' },
  grayText: { color: '#666', fontSize: 13, marginTop: 2, fontFamily: 'Avenir-Medium' },
  footer: { padding: 25, paddingBottom: 150 },
  btn: { backgroundColor: ACCENT, padding: 18, borderRadius: 20, alignItems: 'center' },
  btnText: { fontSize: 16, color: 'black', fontFamily: 'Avenir-Black' },
  activatingContainer: { flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center' },
  unifiedTitle: { color: 'white', fontSize: 24, fontFamily: 'Avenir-Black', marginBottom: 50, textAlign: 'center' },
  gifLarge: { width: 250, height: 250 },
  inactiveCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  mainTitle: { color: 'white', fontSize: 32, textAlign: 'center', fontFamily: 'Avenir-Black' },
  memoInput: { color: 'white', fontSize: 18, borderBottomWidth: 1, borderBottomColor: '#222', width: '100%', textAlign: 'center', marginVertical: 40, paddingBottom: 10, fontFamily: 'Avenir-Medium' },
  pulseBox: { width: 250, height: 250, justifyContent: 'center', alignItems: 'center' },
  
  centeredModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 25 },
  editPanel: { width: '100%', backgroundColor: '#161616', borderRadius: 32, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  
  // New X style
  modalCloseIcon: { position: 'absolute', top: 20, right: 20, zIndex: 10 },

  panelTitle: { color: 'white', fontSize: 22, marginBottom: 24, fontFamily: 'Avenir-Black' },
  panelInput: { width: '100%', backgroundColor: '#000', color: 'white', padding: 18, borderRadius: 16, fontSize: 16, marginBottom: 20, textAlign: 'center', fontFamily: 'Avenir-Medium' },
  saveBtn: { backgroundColor: ACCENT, width: '100%', padding: 18, borderRadius: 16, alignItems: 'center', marginBottom: 12 },
  saveBtnText: { color: 'black', fontSize: 16, fontFamily: 'Avenir-Black' },
  endSynqBtn: { width: '100%', padding: 18, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FF453A' },
  endSynqBtnText: { color: '#FF453A', fontSize: 16, fontFamily: 'Avenir-Heavy' },

  modalBg: { flex: 1, backgroundColor: '#0A0A0A' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 25, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  modalTitle: { color: 'white', fontSize: 19, flex: 1, fontFamily: 'Avenir-Heavy' },
  inboxItem: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#151515' },
  inboxCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  msgRow: { flexDirection: 'row', marginBottom: 20, alignItems: 'flex-start' },
  bubbleImg: { width: 30, height: 30, borderRadius: 15, marginHorizontal: 8 },
  bubble: { padding: 12, borderRadius: 18 },
  myBubble: { backgroundColor: ACCENT, borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: '#222', borderBottomLeftRadius: 4 },
  timestampText: { color: '#444', fontSize: 10, fontFamily: 'Avenir-Medium', marginTop: 4, marginHorizontal: 5 },
  inputRow: { flexDirection: 'row', padding: 15, paddingBottom: Platform.OS === 'ios' ? 40 : 15, backgroundColor: '#050505', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#151515', borderRadius: 25, paddingHorizontal: 15, paddingVertical: 12, color: 'white', fontFamily: 'Avenir-Medium' },
  sendBtn: { backgroundColor: ACCENT, width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});