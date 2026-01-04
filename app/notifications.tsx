import { router } from 'expo-router';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { auth, db } from '../src/lib/firebase';

const ACCENT = "#7DFFA6";

export default function NotificationsScreen() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const reqRef = collection(db, "users", auth.currentUser.uid, "friendRequests");
    
    const unsubscribe = onSnapshot(reqRef, (snapshot) => {
      const reqList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
      }));
      setRequests(reqList);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Snapshot failed:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRequest = async (request: any, accept: boolean) => {
    if (!auth.currentUser) return;

    try {
      if (accept) {
        if (!request.fromId) throw new Error("Missing sender ID.");

        // 1. Add to MY friends list
        await setDoc(doc(db, "users", auth.currentUser.uid, "friends", request.fromId), {
          synqCount: 0,
          since: serverTimestamp(),
          displayName: request.fromName || "User"
        });

        // 2. Add ME to THEIR friends list
        await setDoc(doc(db, "users", request.fromId, "friends", auth.currentUser.uid), {
          synqCount: 0,
          since: serverTimestamp(),
          displayName: auth.currentUser.displayName || "User"
        });

        Alert.alert("Success", `You are now connected with ${request.fromName}!`);
      }

      // 3. Delete the request document
      await deleteDoc(doc(db, "users", auth.currentUser.uid, "friendRequests", request.id));

    } catch (e: any) {
      Alert.alert("Error", `Could not process request: ${e.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="notifications-off-outline" size={60} color="#333" />
              <Text style={styles.emptyText}>No new notifications</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.requestCard}>
              <View style={styles.infoSection}>
                <View style={styles.avatar}>
                  <Icon name="person" size={20} color="#666" />
                </View>
                {/* flex: 1 on this wrapper ensures the text wraps instead of overlapping */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestTitle}>Friend Request</Text>
                  <Text style={styles.requestSubtitle}>
                    <Text style={styles.boldWhite}>{item.fromName || "Someone"}</Text>
                    <Text style={styles.grayText}> wants to be your friend.</Text>
                  </Text>
                </View>
              </View>

              <View style={styles.actionSection}>
                <TouchableOpacity
                  onPress={() => handleRequest(item, true)}
                  style={styles.acceptBtn}
                >
                  <Icon name="checkmark" size={20} color="black" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRequest(item, false)}
                  style={styles.denyBtn}
                >
                  <Icon name="close" size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222'
  },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '800', fontFamily: 'Avenir' },
  headerSpacer: { width: 28 },
  backBtn: { padding: 5 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 15 },
  requestCard: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222'
  },
  infoSection: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1, // Takes up remaining space
    marginRight: 10 // Space between text and buttons
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  requestTitle: { color: ACCENT, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 2 },
  requestSubtitle: { fontSize: 14, color: 'white', lineHeight: 18 },
  boldWhite: { fontWeight: '800', color: 'white' },
  grayText: { color: '#aaa' },
  actionSection: { flexDirection: 'row', alignItems: 'center' },
  acceptBtn: {
    backgroundColor: ACCENT,
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8
  },
  denyBtn: {
    backgroundColor: '#222',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333'
  },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#444', fontSize: 16, marginTop: 15, fontWeight: '600' }
});