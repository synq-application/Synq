import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { auth, db } from "../../src/lib/firebase";

const ACCENT = "#7DFFA6";
const { width } = Dimensions.get("window");

const fonts = {
  black: Platform.OS === "ios" ? "Avenir-Black" : "sans-serif-condensed",
  heavy: Platform.OS === "ios" ? "Avenir-Heavy" : "sans-serif-medium",
  medium: Platform.OS === "ios" ? "Avenir-Medium" : "sans-serif",
  book: Platform.OS === "ios" ? "Avenir-Book" : "sans-serif",
};

interface Friend {
  id: string;
  displayName?: string;
  email?: string;
  imageurl?: string;
  status?: "available" | "inactive";
  memo?: string;
  monthlyMemo?: string;
  interests?: string[];
  mutualCount?: number;
}

export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const friendsRef = collection(db, "users", myId, "friends");

    const unsubFriends = onSnapshot(friendsRef, async (snapshot) => {
      try {
        const myFriendIds = snapshot.docs.map((d) => d.id);

        const friendsList: Friend[] = await Promise.all(
          snapshot.docs.map(async (fDoc) => {
            const uSnap = await getDoc(doc(db, "users", fDoc.id));
            const data = uSnap.data();

            const theirFriendsSnap = await getDocs(
              collection(db, "users", fDoc.id, "friends"),
            );
            const theirFriendIds = theirFriendsSnap.docs.map((d) => d.id);
            const mutuals = theirFriendIds.filter((id) =>
              myFriendIds.includes(id),
            );

            return {
              id: fDoc.id,
              ...data,
              mutualCount: mutuals.length,
            } as Friend;
          }),
        );

        const sortedFriends = friendsList.sort((a, b) =>
          (a.displayName || "").localeCompare(b.displayName || ""),
        );
        setFriends(sortedFriends);
      } catch (err) {
        console.error("Error fetching friend data:", err);
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
            await deleteDoc(
              doc(db, "users", auth.currentUser!.uid, "friends", friendId),
            );
            await deleteDoc(
              doc(db, "users", friendId, "friends", auth.currentUser!.uid),
            );
            setSelectedFriend(null);
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
        <TouchableOpacity onPress={() => setSearchModalVisible(true)}>
          <Icon name="add-circle-outline" size={32} color={ACCENT} />
        </TouchableOpacity>
      </View>

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
              <View style={styles.nameRow}>
                <Text style={styles.friendName}>
                  {item.displayName || "User"}
                </Text>
                {item.status === "available" && (
                  <View style={styles.activeDotInline} />
                )}
              </View>
              <Text style={styles.mutualText}>
                {item.mutualCount || 0} mutual friends
              </Text>
            </View>
            <Icon name="chevron-forward" size={18} color="#222" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.empty}>
              No friends yet.{"\n"}Tap + to find people.
            </Text>
          </View>
        }
      />

      <Modal visible={!!selectedFriend} transparent animationType="fade">
        <View style={styles.popupOverlay}>
          <View style={styles.popupContent}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setSelectedFriend(null)}
            >
              <Icon name="close" size={24} color="white" />
            </TouchableOpacity>

            <Image
              source={{
                uri:
                  selectedFriend?.imageurl ||
                  "https://www.gravatar.com/avatar/?d=mp",
              }}
              style={styles.largeAvatar}
            />

            <Text style={styles.popupName}>{selectedFriend?.displayName}</Text>
            <View style={styles.statusBadge}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      selectedFriend?.status === "available" ? ACCENT : "#444",
                  },
                ]}
              />
              <Text style={styles.statusText}>
                {selectedFriend?.status === "available"
                  ? "Available now"
                  : "Inactive"}
              </Text>
            </View>

            {selectedFriend?.monthlyMemo && (
              <View style={[styles.memoBox, { borderColor: ACCENT, borderWidth: 1 }]}>
                <Text style={[styles.memoTitle, { color: ACCENT }]}>
                  Monthly Memo
                </Text>
                <Text style={styles.memoText}>{selectedFriend.monthlyMemo}</Text>
              </View>
            )}

            <View style={styles.interestsContainer}>
              <Text style={styles.sectionLabel}>Interests</Text>
              <View style={styles.interestsWrapper}>
                {selectedFriend?.interests && selectedFriend.interests.length > 0 ? (
                  selectedFriend.interests.map((interest, i) => (
                    <View key={i} style={styles.interestRect}>
                      <Text style={styles.interestText}>{interest}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noInterestsText}>No interests listed</Text>
                )}
              </View>
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
        currentFriends={friends.map((f) => f.id)}
      />
    </View>
  );
}

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
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter(
          (u) =>
            u.id !== auth.currentUser?.uid &&
            !currentFriends.includes(u.id) &&
            (u.displayName?.toLowerCase().includes(val.toLowerCase()) ||
              u.email?.toLowerCase().includes(val.toLowerCase())),
        );

      setResults(filtered);
    } catch (e) {
      console.error("Search failed", e);
    } finally {
      setIsSearching(false);
    }
  };

  const sendInvite = async (targetUser: any) => {
    if (!auth.currentUser) return;
    try {
      Keyboard.dismiss();

      const requestDocRef = doc(
        db,
        "users",
        targetUser.id,
        "friendRequests",
        auth.currentUser.uid,
      );

      await setDoc(requestDocRef, {
        fromId: auth.currentUser.uid,
        fromName: auth.currentUser.displayName || "Someone",
        status: "pending",
        sentAt: serverTimestamp(),
      });

      Alert.alert("Sent!", `Invite sent to ${targetUser.displayName}`);
      onClose();
    } catch (e: any) {
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

        {isSearching ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"    
            renderItem={({ item }) => (
              <View style={styles.searchResult}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <View style={styles.avatar}>
                    {item.imageurl ? (
                      <Image source={{ uri: item.imageurl }} style={styles.img} />
                    ) : (
                      <Icon name="person" size={24} color="#444" />
                    )}
                  </View>
                  <View>
                    <Text style={styles.friendName}>{item.displayName || "User"}</Text>
                    <Text style={styles.emailDetail}>{item.email}</Text>
                  </View>
                </View>

                <TouchableOpacity onPress={() => sendInvite(item)} style={styles.addBtn}>
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black", paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 70,
    marginBottom: 20,
    alignItems: "center",
  },
  headerTitle: { color: "white", fontSize: 32, fontFamily: fonts.black },
  friendRow: { flexDirection: "row", alignItems: "center", paddingVertical: 15 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  activeDotInline: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
    marginLeft: 8,
  },
  separator: { height: 0.5, backgroundColor: "#1a1a1a", width: "100%" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  img: { width: 52, height: 52, borderRadius: 26 },
  friendName: { color: "white", fontSize: 18, fontFamily: fonts.heavy },
  mutualText: { color: "#666", fontSize: 13, fontFamily: fonts.medium, marginTop: 2 },
  emptyContainer: { flex: 1, justifyContent: "center", marginTop: 100 },
  empty: {
    color: "#333",
    textAlign: "center",
    fontFamily: fonts.heavy,
    fontSize: 20,
    lineHeight: 28,
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.94)",
    justifyContent: "center",
    alignItems: "center",
  },
  popupContent: {
    width: width * 0.88,
    backgroundColor: "#111",
    borderRadius: 32,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#222",
  },
  closeBtn: { position: "absolute", top: 20, right: 20, zIndex: 1 },
  largeAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  popupName: { color: "white", fontSize: 26, fontFamily: fonts.black },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
    marginTop: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { color: "white", fontSize: 13, fontFamily: fonts.heavy },
  interestsContainer: { width: "100%", marginBottom: 20 },
  sectionLabel: {
    color: "#444",
    fontSize: 11,
    fontFamily: fonts.black,
    textTransform: "uppercase",
    marginBottom: 10,
    letterSpacing: 1,
  },
  interestsWrapper: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  interestRect: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#222",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 6,
    marginBottom: 6,
  },
  interestText: { color: "white", fontFamily: fonts.medium, fontSize: 13 },
  noInterestsText: {
    color: "#333",
    fontSize: 13,
    fontFamily: fonts.book,
    fontStyle: "italic",
  },
  memoBox: { backgroundColor: "black", padding: 18, borderRadius: 20, width: "100%", marginBottom: 15 },
  memoTitle: {
    color: "#666",
    fontSize: 11,
    fontFamily: fonts.black,
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  memoText: { color: "white", fontSize: 15, fontFamily: fonts.medium, lineHeight: 20 },
  removeBtn: { marginTop: 15, padding: 10 },
  removeBtnText: { color: "#ff453a", fontFamily: fonts.heavy, fontSize: 14 },
  modalBody: { flex: 1, backgroundColor: "black", padding: 20 },
  searchBarRow: { flexDirection: "row", alignItems: "center", gap: 15, marginBottom: 20, marginTop: 40 },
  input: {
    flex: 1,
    backgroundColor: "#111",
    color: "white",
    padding: 14,
    borderRadius: 14,
    fontFamily: fonts.medium,
    fontSize: 16,
  },
  cancelText: { color: ACCENT, fontFamily: fonts.heavy, fontSize: 16 },
  searchResult: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: "#222",
  },
  emailDetail: { color: "#666", fontSize: 13, fontFamily: fonts.book },
  addBtn: { backgroundColor: ACCENT, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  addBtnText: { color: "black", fontFamily: fonts.black, fontSize: 14 },
});
