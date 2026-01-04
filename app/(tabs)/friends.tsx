import {
  collection,
  deleteDoc,
  doc,
  getDoc, getDocs, onSnapshot, serverTimestamp, setDoc
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { auth, db } from '../../src/lib/firebase';

const ACCENT = "#7DFFA6";
const { width } = Dimensions.get('window');

interface Friend {
  id: string;
  displayName?: string;
  email?: string;
  imageurl?: string;
  status?: 'available' | 'inactive';
  memo?: string;
}

export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const friendsRef = collection(db, "users", auth.currentUser.uid, "friends");
    const unsubFriends = onSnapshot(friendsRef, async (snapshot) => {
      try {
        const friendsList: Friend[] = await Promise.all(
          snapshot.docs.map(async (fDoc) => {
            const uSnap = await getDoc(doc(db, "users", fDoc.id));
            const data = uSnap.data();
            return { id: fDoc.id, ...data } as Friend;
          })
        );
        const sortedFriends = friendsList.sort((a, b) => 
          (a.displayName || "").localeCompare(b.displayName || "")
        );
        setFriends(sortedFriends);
      } catch (err) {
        console.error("Error fetching friend data:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubFriends();
  }, []);

  const removeFriend = async (friendId: string) => {
    if (!auth.currentUser) return;
    Alert.alert("Remove Friend", "Are you sure you want to remove this friend?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Remove", 
        style: "destructive", 
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "users", auth.currentUser!.uid, "friends", friendId));
            await deleteDoc(doc(db, "users", friendId, "friends", auth.currentUser!.uid));
            setSelectedFriend(null);
          } catch (e) {
            console.error(e);
          }
        } 
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
        <TouchableOpacity onPress={() => setSearchModalVisible(true)}>
          <Icon name="add-circle-outline" size={30} color={ACCENT} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.friendRow} 
              onPress={() => setSelectedFriend(item)}
            >
              <View style={styles.avatar}>
                {item.imageurl ? (
                  <Image source={{ uri: item.imageurl }} style={styles.img} />
                ) : (
                  <Icon name="person" size={24} color="#444" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.friendName}>{item.displayName || "User"}</Text>
                {item.status === 'available' ? (
                  <Text style={styles.synqActive} numberOfLines={1}>
                    {item.memo || "Ready to connect"}
                  </Text>
                ) : (
                  <Text style={styles.synqInactive}>Synq not active</Text>
                )}
              </View>
              <Icon name="chevron-forward" size={18} color="#333" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No friends yet. Tap + to find people.</Text>}
        />
      )}

      {/* Profile Detail Modal */}
      <Modal 
        visible={!!selectedFriend} 
        transparent 
        animationType="fade"
        onRequestClose={() => setSelectedFriend(null)}
      >
        <View style={styles.popupOverlay}>
          <View style={styles.popupContent}>
            <TouchableOpacity 
              style={styles.closeBtn} 
              onPress={() => setSelectedFriend(null)}
            >
              <Icon name="close" size={24} color="white" />
            </TouchableOpacity>

            <Image 
              source={{ uri: selectedFriend?.imageurl || 'https://www.gravatar.com/avatar/?d=mp' }} 
              style={styles.largeAvatar} 
            />

            <Text style={styles.popupName}>{selectedFriend?.displayName}</Text>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: selectedFriend?.status === 'available' ? ACCENT : '#444' }]} />
              <Text style={styles.statusText}>
                {selectedFriend?.status === 'available' ? 'Available now' : 'Inactive'}
              </Text>
            </View>

            {selectedFriend?.memo && (
              <View style={styles.memoBox}>
                <Text style={styles.memoTitle}>Current Memo</Text>
                <Text style={styles.memoText}>{selectedFriend.memo}</Text>
              </View>
            )}

            <TouchableOpacity 
              style={styles.removeBtn} 
              onPress={() => removeFriend(selectedFriend!.id)}
            >
              <Text style={styles.removeBtnText}>Remove Friend</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <SearchModal 
        visible={searchModalVisible} 
        onClose={() => setSearchModalVisible(false)} 
        currentFriends={friends.map(f => f.id)}
      />
    </View>
  );
}

// --- SEARCH MODAL COMPONENT ---
function SearchModal({ visible, onClose, currentFriends }: any) {
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchUsers = async (val: string) => {
    setQueryText(val);
    if (val.length < 3) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const usersRef = collection(db, "users");
      const snap = await getDocs(usersRef);
      const filtered = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(u => 
          u.id !== auth.currentUser?.uid && 
          !currentFriends.includes(u.id) &&
          (u.displayName?.toLowerCase().includes(val.toLowerCase()) || 
           u.email?.toLowerCase().includes(val.toLowerCase()))
        );
      setResults(filtered);
    } catch (e) {
      console.error("DEBUG: Search failed", e);
    } finally {
      setIsSearching(false);
    }
  };

  const sendInvite = async (targetUser: any) => {
    if (!auth.currentUser) return;
    try {
      const requestDocRef = doc(db, "users", targetUser.id, "friendRequests", auth.currentUser.uid);
      await setDoc(requestDocRef, {
        fromId: auth.currentUser.uid,
        fromName: auth.currentUser.displayName || "Someone",
        status: "pending",
        sentAt: serverTimestamp()
      });
      Alert.alert("Sent!", `Invite sent to ${targetUser.displayName}`);
      onClose();
    } catch (e: any) {
      console.error("DEBUG ERROR: Failed to send invite", e.message);
      Alert.alert("Error", "Could not send invite.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalBody}>
        <View style={styles.searchBarRow}>
          <TextInput 
            placeholder="Search by name or email..." 
            placeholderTextColor="#666" 
            style={styles.input}
            value={queryText}
            onChangeText={searchUsers}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {isSearching ? <ActivityIndicator color={ACCENT} style={{marginTop: 20}} /> : (
          <FlatList 
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.searchResult}>
                <View>
                    <Text style={styles.friendName}>{item.displayName}</Text>
                    <Text style={styles.emailDetail}>{item.email}</Text>
                </View>
                <TouchableOpacity onPress={() => sendInvite(item)} style={styles.addBtn}>
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={queryText.length >= 3 ? <Text style={styles.empty}>No users found.</Text> : null}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black', paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 80, marginBottom: 20, alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 28, fontWeight: '900', fontFamily: 'Avenir' },
  friendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  separator: { height: 0.5, backgroundColor: '#333', width: '100%' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  img: { width: 50, height: 50, borderRadius: 25 },
  friendName: { color: 'white', fontSize: 17, fontWeight: '700', fontFamily: 'Avenir' },
  synqActive: { color: ACCENT, fontSize: 13, fontFamily: 'Avenir', marginTop: 2 },
  synqInactive: { color: '#666', fontSize: 13, fontFamily: 'Avenir', marginTop: 2 },
  empty: { color: '#444', textAlign: 'center', marginTop: 50, fontFamily: 'Avenir', fontSize: 22 },

  popupOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  popupContent: { width: width * 0.85, backgroundColor: '#111', borderRadius: 30, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  closeBtn: { position: 'absolute', top: 20, right: 20, zIndex: 1 },
  largeAvatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 20, borderWidth: 2, borderColor: ACCENT },
  popupName: { color: 'white', fontSize: 24, fontWeight: '900', fontFamily: 'Avenir' },
  popupEmail: { color: '#666', fontSize: 14, marginBottom: 15 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20, marginBottom: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { color: 'white', fontSize: 12, fontWeight: '600' },
  memoBox: { backgroundColor: '#000', padding: 15, borderRadius: 15, width: '100%', marginBottom: 25 },
  memoTitle: { color: '#444', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 5 },
  memoText: { color: 'white', fontSize: 15, fontFamily: 'Avenir' },
  removeBtn: { marginTop: 10 },
  removeBtnText: { color: '#ff453a', fontWeight: '600' },
  modalBody: { flex: 1, backgroundColor: '#000', padding: 20 },
  searchBarRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
  input: { flex: 1, backgroundColor: '#111', color: 'white', padding: 12, borderRadius: 10, fontFamily: 'Avenir' },
  cancelText: { color: ACCENT, fontWeight: '600', fontFamily: 'Avenir' },
  searchResult: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 0.5, borderBottomColor: '#222' },
  emailDetail: { color: '#666', fontSize: 12, fontFamily: 'Avenir' },
  addBtn: { backgroundColor: ACCENT, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { fontWeight: '900', color: 'black', fontFamily: 'Avenir' }
});