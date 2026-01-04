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
    if (!auth.currentUser) {
        console.log("DEBUG: No user logged in, skipping listener.");
        return;
    }

    // Logging the path we are listening to
    const path = `users/${auth.currentUser.uid}/friendRequests`;
    console.log(`DEBUG: Starting listener on path: ${path}`);

    const reqRef = collection(db, "users", auth.currentUser.uid, "friendRequests");
    
    const unsubscribe = onSnapshot(reqRef, (snapshot) => {
      console.log(`DEBUG: Snapshot received. Documents found: ${snapshot.docs.length}`);
      
      const reqList = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`DEBUG: Found request from ${data.fromName || 'Unknown'} (Doc ID: ${doc.id})`);
        return {
          id: doc.id,
          ...data
        };
      });
      
      setRequests(reqList);
      setLoading(false);
    }, (error) => {
      console.error("DEBUG ERROR: Firestore Snapshot failed:", error.code, error.message);
      setLoading(false);
    });

    return () => {
        console.log("DEBUG: Cleaning up Notifications listener.");
        unsubscribe();
    };
  }, []);

  const handleRequest = async (request: any, accept: boolean) => {
    if (!auth.currentUser) return;

    console.log(`DEBUG: User clicked ${accept ? 'ACCEPT' : 'DENY'} for request from ${request.fromName}`);

    try {
      if (accept) {
        if (!request.fromId) {
            throw new Error("Missing fromId in request document. Cannot establish friendship.");
        }

        console.log(`DEBUG: Creating mutual friendship between ${auth.currentUser.uid} and ${request.fromId}`);

        // 1. Add to MY friends list
        await setDoc(doc(db, "users", auth.currentUser.uid, "friends", request.fromId), {
          synqCount: 0,
          since: serverTimestamp(),
          displayName: request.fromName || "User"
        });
        console.log("DEBUG: Successfully wrote to CURRENT user's friends list.");

        // 2. Add ME to THEIR friends list
        await setDoc(doc(db, "users", request.fromId, "friends", auth.currentUser.uid), {
          synqCount: 0,
          since: serverTimestamp(),
          displayName: auth.currentUser.displayName || "User"
        });
        console.log("DEBUG: Successfully wrote to REQUESTER's friends list.");

        Alert.alert("Success", `You are now connected with ${request.fromName}!`);
      }

      // 3. Delete the request
      console.log(`DEBUG: Deleting request document at: users/${auth.currentUser.uid}/friendRequests/${request.id}`);
      await deleteDoc(doc(db, "users", auth.currentUser.uid, "friendRequests", request.id));
      console.log("DEBUG: Request document deleted successfully.");

    } catch (e: any) {
      console.error("DEBUG ERROR: handleRequest failed:", e.message);
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
                <View>
                  <Text style={styles.requestTitle}>Friend Request</Text>
                  <Text style={styles.requestSubtitle}>
                    <Text style={styles.boldWhite}>{item.fromName || "Unknown"}</Text>
                    <Text style={styles.grayText}> wants to synq.</Text>
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
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '800' },
  headerSpacer: { width: 28 },
  backBtn: { padding: 5 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 20 },
  requestCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  infoSection: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  requestTitle: { color: ACCENT, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  requestSubtitle: { fontSize: 14, marginTop: 2 },
  boldWhite: { fontWeight: '700', color: 'white' },
  grayText: { color: '#aaa' },
  actionSection: { flexDirection: 'row', marginLeft: 10 },
  acceptBtn: {
    backgroundColor: ACCENT,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  denyBtn: {
    backgroundColor: '#333',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#444', fontSize: 16, marginTop: 15, fontWeight: '600' }
});