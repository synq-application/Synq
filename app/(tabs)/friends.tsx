import {
  ACCENT,
  BG,
  BORDER,
  fonts,
  Friend,
  MUTED,
  MUTED2,
  MUTED3,
  SURFACE,
  TEXT,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { auth, db } from "../../src/lib/firebase";
import AlertModal from "../alert-modal";

const { width } = Dimensions.get("window");

export default function FriendsScreen() {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [isFriendsInitialLoading, setIsFriendsInitialLoading] = useState(true);
  const [isFriendsRefreshing, setIsFriendsRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");

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
            const friendId = fDoc.id;
            const uSnap = await getDoc(doc(db, "users", friendId));

            if (!uSnap.exists()) {
              return {
                id: friendId,
                displayName: "Unknown",
                mutualCount: 0,
              } as Friend;
            }

            const data = uSnap.data() as any;

            const theirFriendsSnap = await getDocs(
              collection(db, "users", friendId, "friends")
            );
            const theirFriendIds = theirFriendsSnap.docs.map((d) => d.id);
            const mutuals = theirFriendIds.filter((id) => myFriendIds.includes(id));

            const friendObj = {
              id: friendId,
              ...(data as any),
              mutualCount: mutuals.length,
            } as Friend;

            return friendObj;
          })
        );

        const sortedFriends = friendsList.sort((a, b) =>
          (a.displayName || "").localeCompare(b.displayName || "")
        );

        setFriends(sortedFriends);
      } catch (err) {
        console.error("[FriendsScreen] Error fetching friend data:", err);
      } finally {
        setIsFriendsInitialLoading(false);
        setIsFriendsRefreshing(false);
      }
    });

    return () => {
      unsubFriends();
    };
  }, []);

  const filteredFriends = friends.filter((f) =>
    (f.displayName || "")
      .toLowerCase()
      .includes(searchText.toLowerCase())
  );

  const renderSkeletonRow = (key: string) => (
    <View key={key} style={styles.friendRow}>
      <View style={[styles.avatar, { backgroundColor: "#151515" }]} />
      <View style={{ flex: 1 }}>
        <View style={{ height: 14, width: "55%", backgroundColor: "#1f1f1f", borderRadius: 8, marginBottom: 8 }} />
        <View style={{ height: 12, width: "38%", backgroundColor: "#1a1a1a", borderRadius: 8 }} />
      </View>
      <View style={{ height: 12, width: 12 }} />
    </View>
  );

  const renderFriendRow = ({ item }: { item: Friend }) => (
    <TouchableOpacity
      style={styles.friendRow}
      onPress={() =>
        router.push({
          pathname: "/friend-profile",
          params: { friendId: item.id },
        })
      }
    >
      <View style={styles.avatar}>
        {(item as any)?.imageurl ? (
          <Image source={{ uri: (item as any).imageurl }} style={styles.img} />
        ) : (
          <Icon name="person" size={22} color={MUTED3} />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.friendName}>{item.displayName || "User"}</Text>
        <Text style={styles.mutualText}>
          {item.mutualCount || 0} mutual {item.mutualCount === 1 ? "friend" : "friends"}
        </Text>
      </View>

      <Icon name="chevron-forward" size={18} color="rgba(255,255,255,0.25)" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
        <TouchableOpacity onPress={() => setSearchModalVisible(true)}>
          <Icon name="add-circle-outline" size={30} color="white" />
        </TouchableOpacity>
      </View>
      <View style={styles.headerDivider} />
      <View style={styles.searchBarWrap}>
        <Ionicons name="search-outline" size={18} color={MUTED2} />
        <TextInput
          placeholder="Search friends..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          style={styles.searchBarInput}
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText("")}>
            <Ionicons name="close-circle" size={18} color={MUTED2} />
          </TouchableOpacity>
        )}
      </View>

      {isFriendsInitialLoading ? (
        <View style={{ paddingBottom: 20 }}>
          {["1", "2", "3"].map((k) => renderSkeletonRow(k))}
        </View>
      ) : (
        <>
          <FlatList
            data={filteredFriends}
            keyExtractor={(item) => item.id}
            renderItem={renderFriendRow}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListFooterComponent={<View style={{ height: 40 }} />}
          />
        </>
      )}

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
  const router = useRouter();
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title?: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!visible) return;
    setQueryText("");
    setResults([]);
    setIsSearching(false);
  }, [visible]);

  useEffect(() => {
    if (!visible || !auth.currentUser) return;

    const fetchSuggested = async () => {
      try {
        const myId = auth.currentUser!.uid;

        const myFriendsSnap = await getDocs(
          collection(db, "users", myId, "friends")
        );
        const myFriendIds = myFriendsSnap.docs.map((d) => d.id);

        const usersSnap = await getDocs(collection(db, "users"));
        const users = usersSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as any)
        );

        const suggestionsWithMutuals = await Promise.all(
          users.map(async (user) => {
            if (
              user.id === myId ||
              currentFriends.includes(user.id)
            ) return null;

            try {
              const theirFriendsSnap = await getDocs(
                collection(db, "users", user.id, "friends")
              );

              const theirFriendIds = theirFriendsSnap.docs.map((d) => d.id);

              const mutuals = theirFriendIds.filter((id) =>
                myFriendIds.includes(id)
              );

              if (mutuals.length > 0) {
                return {
                  ...user,
                  mutualCount: mutuals.length,
                };
              }

              return null;
            } catch {
              return null;
            }
          })
        );

        const suggestions = suggestionsWithMutuals
          .filter(Boolean)
          .sort((a: any, b: any) => b.mutualCount - a.mutualCount);

        setSuggested(suggestions.slice(0, 8));
      } catch (e) {
        console.error("[Suggested] error:", e);
      }
    };

    fetchSuggested();
  }, [visible]);

  const debounceRef = React.useRef<any>(null);


  const searchUsers = (val: string) => {
    setQueryText(val);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      if (val.length < 1) {
        setResults([]);
        return;
      }

      setIsSearching(true);

      try {
        const usersRef = collection(db, "users");
        const snap = await getDocs(usersRef);

        const mapped = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as any)
        );

        const normalize = (str: string) =>
          str.toLowerCase().trim().replace(/\s+/g, " ");

        const search = normalize(val);

        const filtered = mapped.filter((u) => {
          const displayName = normalize(u.displayName || "");
          const fullName = normalize(`${u.firstName || ""} ${u.lastName || ""}`);
          const email = normalize(u.email || "");

          const matches =
            displayName.includes(search) ||
            fullName.includes(search) ||
            email.includes(search);

          return (
            u.id !== auth.currentUser?.uid &&
            matches
          );
        });

        setResults(filtered);
      } catch (e) {
        console.error("[SearchModal] Search failed", e);
      } finally {
        setIsSearching(false);
      }
    }, 300); // debounce delay (can tweak 250–400)
  };

  const sendInvite = async (targetUser: any) => {
    if (!auth.currentUser) {
      return;
    }

    try {
      Keyboard.dismiss();

      const myId = auth.currentUser.uid;
      const targetId = targetUser.id;

      const requestDocRef = doc(
        db,
        "users",
        targetId,
        "friendRequests",
        myId
      );

      const meSnap = await getDoc(doc(db, "users", myId));
      const meData = meSnap.exists() ? (meSnap.data() as any) : {};
      const senderName =
        meData?.displayName ||
        auth.currentUser.displayName ||
        "Someone";

      const senderImageUrl = meData?.imageurl || null;

      const payload = {
        from: myId,
        to: targetId,
        senderName,
        senderImageUrl,
        status: "pending",
        sentAt: serverTimestamp(),
      };
      await setDoc(requestDocRef, payload);

      setAlertConfig({
        title: "Sent!",
        message: `Invite sent to ${targetUser.displayName}`,
      });
      setAlertVisible(true);
      onClose();

    } catch (e: any) {
      if (e?.code === "permission-denied") {
        setAlertConfig({
          title: "Already sent",
          message: "You’ve already sent this user a friend request.",
        });
        setAlertVisible(true);
        return;
      }

      setAlertConfig({
        title: "Error",
        message: e?.message || "Could not send invite.",
      });
      setAlertVisible(true);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalBody}>
        <StatusBar barStyle="light-content" />

        <View style={styles.searchHeader}>
          <Text style={styles.searchTitle}>Add friends</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={28} color="#444" />
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

        {!queryText && suggested.length > 0 && (
          <View style={{ marginTop: 10, paddingBottom: 160 }}>
            <Text style={styles.sectionLabel}>Suggested</Text>
            <FlatList
              data={suggested}
              keyExtractor={(item) => item.id}
              scrollEnabled={true}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={<View style={{ height: 40 }} />}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <View style={styles.searchResult}>
                  <TouchableOpacity
                    onPress={() => {
                      onClose();

                      setTimeout(() => {
                        router.push({
                          pathname: "/friend-profile",
                          params: { friendId: item.id },
                        });
                      }, 250);
                    }}
                    style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.avatar}>
                      {item.imageurl ? (
                        <Image source={{ uri: item.imageurl }} style={styles.img} />
                      ) : (
                        <Icon name="person" size={22} color={MUTED3} />
                      )}
                    </View>

                    <View style={{ paddingRight: 12 }}>
                      <Text style={styles.friendName}>
                        {item.displayName || "User"}
                      </Text>
                      <Text style={styles.mutualText}>
                        {item.mutualCount} mutual{" "}
                        {item.mutualCount === 1 ? "friend" : "friends"}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => sendInvite(item)}
                    style={styles.addBtn}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListFooterComponent={<View style={{ height: 40 }} />}
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
                    <Text style={styles.friendName}>
                      {item.displayName || "User"}
                    </Text>
                    <Text style={styles.emailDetail}>{item.email}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    if (!currentFriends.includes(item.id)) {
                      sendInvite(item);
                    }
                  }}
                  style={[
                    styles.addBtn,
                    currentFriends.includes(item.id) && { opacity: 0.4 }
                  ]}
                  disabled={currentFriends.includes(item.id)}
                >
                  <Text style={styles.addBtnText}>
                    {currentFriends.includes(item.id) ? "Friends" : "Add"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      </View>
      <AlertModal
        visible={alertVisible}
        title={alertConfig?.title}
        message={alertConfig?.message || ""}
        onClose={() => setAlertVisible(false)}
      />
    </Modal>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 88,
    alignItems: "center",
  },
  headerTitle: { color: TEXT, fontSize: 32, fontFamily: fonts.heavy, letterSpacing: 0.2 },
  headerSub: { color: MUTED, fontSize: 14, fontFamily: fonts.book, marginTop: 6 },
  headerAction: { paddingLeft: 12, paddingVertical: 6 },
  headerDivider: { marginTop: 16, height: 1, backgroundColor: BORDER },
  friendRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  separator: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginLeft: 66,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: SURFACE,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    borderWidth: .8,
    borderColor: BORDER
  },
  img: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
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
    width: width * 0.9,
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
    fontSize: 16,
    fontFamily: fonts.heavy,
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
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  addBtn: { backgroundColor: ACCENT, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14 },
  addBtnText: { color: "#061006", fontFamily: fonts.heavy, fontSize: 14, letterSpacing: 0.2 },
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 14,
    marginBottom: 6,
  },
  searchBarInput: {
    flex: 1,
    color: TEXT,
    marginLeft: 8,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
});
