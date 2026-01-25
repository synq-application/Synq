import { ACCENT, BG, BORDER, fonts, Friend, MUTED, MUTED2, MUTED3, SURFACE, TEXT } from "@/constants/Variables";
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
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { auth, db } from "../../src/lib/firebase";
const { width } = Dimensions.get("window");

export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [isFriendsInitialLoading, setIsFriendsInitialLoading] = useState(true);
  const [isFriendsRefreshing, setIsFriendsRefreshing] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const myId = auth.currentUser.uid;
    const friendsRef = collection(db, "users", myId, "friends");

    const unsubFriends = onSnapshot(friendsRef, async (snapshot) => {
      const firstLoad = isFriendsInitialLoading;
      if (firstLoad) setIsFriendsInitialLoading(true);
      else setIsFriendsRefreshing(true);

      try {
        const myFriendIds = snapshot.docs.map((d) => d.id);

        const friendsList: Friend[] = await Promise.all(
          snapshot.docs.map(async (fDoc) => {
            const uSnap = await getDoc(doc(db, "users", fDoc.id));
            const data = uSnap.data();

            const theirFriendsSnap = await getDocs(
              collection(db, "users", fDoc.id, "friends")
            );
            const theirFriendIds = theirFriendsSnap.docs.map((d) => d.id);
            const mutuals = theirFriendIds.filter((id) =>
              myFriendIds.includes(id)
            );

            return {
              id: fDoc.id,
              ...(data as any),
              mutualCount: mutuals.length,
            } as Friend;
          })
        );

        const sortedFriends = friendsList.sort((a, b) =>
          (a.displayName || "").localeCompare(b.displayName || "")
        );

        setFriends(sortedFriends);
      } catch (err) {
        console.error("Error fetching friend data:", err);
      } finally {
        setIsFriendsInitialLoading(false);
        setIsFriendsRefreshing(false);
      }
    });

    return () => unsubFriends();
  }, []);

  const formatLocation = (friend: any) => {
    if (!friend) return "";
    const direct = friend.location ?? friend.currentLocation;
    if (typeof direct === "string") {
      const cleaned = direct.trim();
      return cleaned ? cleaned : "";
    }
    const city = (friend.city ?? "").toString().trim();
    const state = (friend.state ?? "").toString().trim();
    const cityState = [city, state].filter(Boolean).join(", ");
    return cityState;
  };


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
              doc(db, "users", auth.currentUser!.uid, "friends", friendId)
            );
            await deleteDoc(
              doc(db, "users", friendId, "friends", auth.currentUser!.uid)
            );
            setSelectedFriend(null);
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  const renderSkeletonRow = (key: string) => (
    <View key={key} style={styles.friendRow}>
      <View style={[styles.avatar, { backgroundColor: "#151515" }]} />
      <View style={{ flex: 1 }}>
        <View
          style={{
            height: 14,
            width: "55%",
            backgroundColor: "#1f1f1f",
            borderRadius: 8,
            marginBottom: 8,
          }}
        />
        <View
          style={{
            height: 12,
            width: "38%",
            backgroundColor: "#1a1a1a",
            borderRadius: 8,
          }}
        />
      </View>
      <View style={{ height: 12, width: 12 }} />
    </View>
  );

  const renderFriendRow = ({ item }: { item: Friend }) => (
    <TouchableOpacity
      style={styles.friendRow}
      onPress={() => setSelectedFriend(item)}
      activeOpacity={0.75}
    >
      <View style={styles.avatar}>
        {item.imageurl ? (
          <Image source={{ uri: item.imageurl }} style={styles.img} />
        ) : (
          <Icon name="person" size={22} color={MUTED3} />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.friendName}>{item.displayName || "User"}</Text>
        <Text style={styles.mutualText}>
          {item.mutualCount || 0} mutual{" "}
          {item.mutualCount === 1 ? "friend" : "friends"}
        </Text>
      </View>

      <Icon
        name="chevron-forward"
        size={18}
        color="rgba(255,255,255,0.25)"
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
        <TouchableOpacity
          onPress={() => setSearchModalVisible(true)}
          activeOpacity={0.7}
          style={styles.headerAction}
        >
          <Icon name="add-circle-outline" size={30} color={ACCENT} />
        </TouchableOpacity>
      </View>

      <View style={styles.headerDivider} />

      {isFriendsInitialLoading ? (
        <View style={{ paddingBottom: 20 }}>
          {["1", "2", "3", "4", "5"].map((k) => (
            <React.Fragment key={k}>
              {renderSkeletonRow(k)}
              <View style={styles.separator} />
            </React.Fragment>
          ))}
        </View>
      ) : (
        <>
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 20 }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={renderFriendRow}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No friends yet</Text>
                  <Text style={styles.emptyText}>
                    Tap the + to find people and send a request.
                  </Text>
                </View>
              </View>
            }
          />
          {isFriendsRefreshing && (
            <View style={{ paddingVertical: 8, alignItems: "center" }}>
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                Updating…
              </Text>
            </View>
          )}
        </>
      )}

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
              activeOpacity={0.7}
            >
              <Icon name="close" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>

            <Image
              source={{
                uri:
                  selectedFriend?.imageurl ||
                  "https://www.gravatar.com/avatar/?d=mp",
              }}
              style={styles.largeAvatar}
            />

            <Text style={styles.popupName}>
              {selectedFriend?.displayName || "User"}
            </Text>

            {(() => {
              const loc = formatLocation(selectedFriend);
              if (!loc) return null;

              return (
                <Text style={styles.popupLocation}>
                  <Icon
                    name="location-outline"
                    size={14}
                    color="rgba(255,255,255,0.35)"
                  />{" "}
                  <Text style={styles.popupLocationText}>{loc}</Text>
                </Text>
              );
            })()}
            <View style={styles.interestsContainer}>
              <Text style={styles.sectionLabel}>Interests</Text>
              <ScrollView
                style={styles.interestsScroll}
                contentContainerStyle={styles.interestsWrapper}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {selectedFriend?.interests?.length ? (
                  selectedFriend.interests.map((interest: string, i: number) => (
                    <View key={i} style={styles.interestPill}>
                      <Text style={styles.interestText}>{interest}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noInterestsText}>
                    No interests listed
                  </Text>
                )}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => removeFriend(selectedFriend!.id)}
              activeOpacity={0.75}
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

function SearchModal({
  visible,
  onClose,
  currentFriends,
}: {
  visible: boolean;
  onClose: () => void;
  currentFriends: string[];
}) {
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQueryText("");
    setResults([]);
    setIsSearching(false);
  }, [visible]);

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
              u.email?.toLowerCase().includes(val.toLowerCase()))
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

      const meSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
      const meData = meSnap.exists() ? meSnap.data() : {};

      const requestDocRef = doc(
        db,
        "users",
        targetUser.id,
        "friendRequests",
        auth.currentUser.uid
      );

      const senderName = meData?.displayName || auth.currentUser.displayName || "Someone";
      const senderImageUrl = meData?.imageurl || null;

      await setDoc(requestDocRef, {
        senderId: auth.currentUser.uid,
        senderName,
        senderImageUrl,
        fromId: auth.currentUser.uid,
        fromName: senderName,
        fromImageUrl: senderImageUrl,
        status: "pending",
        sentAt: serverTimestamp(),
        notifyOnCreate: true,
      });

      Alert.alert("Sent!", `Invite sent to ${targetUser.displayName}`);
      onClose();
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", "Could not send invite.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalBody}>
        <StatusBar barStyle="light-content" />

        <View style={styles.searchHeader}>
          <Text style={styles.searchTitle}>Add friends</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchInputWrap}>
          <TextInput
            placeholder="Search by name or email..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={styles.searchInput}
            value={queryText}
            onChangeText={searchUsers}
            autoCapitalize="none"
          />
        </View>

        {isSearching ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <View style={styles.searchResult}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <View style={styles.avatar}>
                    {item.imageurl ? (
                      <Image source={{ uri: item.imageurl }} style={styles.img} />
                    ) : (
                      <Icon name="person" size={22} color={MUTED3} />
                    )}
                  </View>
                  <View style={{ paddingRight: 12 }}>
                    <Text style={styles.friendName}>{item.displayName || "User"}</Text>
                    <Text style={styles.emailDetail}>{item.email}</Text>
                  </View>
                </View>

                <TouchableOpacity onPress={() => sendInvite(item)} style={styles.addBtn} activeOpacity={0.8}>
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              queryText.length >= 3 ? (
                <View style={{ paddingTop: 24 }}>
                  <Text style={{ color: MUTED2, textAlign: "center", fontFamily: fonts.book }}>
                    No results found.
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 78,
    alignItems: "flex-end",
  },
  headerTitle: { color: TEXT, fontSize: 32, fontFamily: fonts.heavy, letterSpacing: 0.2 },
  headerSub: { color: MUTED, fontSize: 14, fontFamily: fonts.book, marginTop: 6 },
  headerAction: { paddingLeft: 12, paddingVertical: 6 },
  headerDivider: { marginTop: 16, height: 1, backgroundColor: BORDER },
  friendRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  separator: { height: 1, backgroundColor: BORDER, width: "100%" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  img: { width: 52, height: 52, borderRadius: 26 },
  friendName: { color: TEXT, fontSize: 18, fontFamily: fonts.heavy },
  mutualText: { color: MUTED2, fontSize: 13, fontFamily: fonts.book, marginTop: 3 },
  emptyContainer: { flex: 1, justifyContent: "center", marginTop: 30, paddingHorizontal: 10 },
  emptyCard: {
    backgroundColor: SURFACE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
  },
  emptyTitle: { color: TEXT, textAlign: "center", fontFamily: fonts.heavy, fontSize: 18 },
  emptyText: { color: MUTED, textAlign: "center", fontFamily: fonts.book, fontSize: 14, marginTop: 8, lineHeight: 20 },
  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  popupContent: {
    width: width * 0.90,
    maxHeight: "86%",
    backgroundColor: "rgba(18,18,18,0.96)",
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  closeBtn: { position: "absolute", top: 16, right: 16, padding: 8, zIndex: 2 },
  largeAvatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
    marginTop: 10,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  popupName: { color: TEXT, fontSize: 24, fontFamily: fonts.heavy, letterSpacing: 0.2 },
  popupLocation: { marginTop: 6, color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: fonts.book },
  popupLocationText: { color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: fonts.book },
  interestsContainer: { width: "100%", marginTop: 10, marginBottom: 10 },
  sectionLabel: {
    color: MUTED2,
    fontSize: 11,
    fontFamily: fonts.heavy,
    textTransform: "uppercase",
    marginBottom: 10,
    letterSpacing: 0.9,
  },
  interestsScroll: { maxHeight: 150, width: "100%" },
  interestsWrapper: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", paddingBottom: 4 },
  interestPill: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: { color: TEXT, fontFamily: fonts.book, fontSize: 13 },
  noInterestsText: {
    color: MUTED2,
    fontSize: 13,
    fontFamily: fonts.book,
    fontStyle: "italic",
    textAlign: "left",
    alignSelf: "flex-start",
    width: "100%",
  },
  removeBtn: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 12 },
  removeBtnText: { color: "#ff453a", fontFamily: fonts.heavy, fontSize: 14 },
  modalBody: { flex: 1, backgroundColor: BG, padding: 20 },
  searchHeader: {
    marginTop: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  searchTitle: { color: TEXT, fontSize: 28, fontFamily: fonts.heavy, letterSpacing: 0.2 },
  cancelText: { color: ACCENT, fontFamily: fonts.book, fontSize: 16 },
  searchInputWrap: { marginTop: 14, marginBottom: 12 },
  searchInput: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    color: TEXT,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    fontFamily: fonts.medium,
    fontSize: 16,
  },
  searchResult: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  emailDetail: { color: MUTED2, fontSize: 13, fontFamily: fonts.book, marginTop: 2 },
  addBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  addBtnText: { color: "#061006", fontFamily: fonts.heavy, fontSize: 14, letterSpacing: 0.2 },
});
