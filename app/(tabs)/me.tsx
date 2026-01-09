import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { signOut as firebaseSignOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  updateDoc
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Icon from 'react-native-vector-icons/Ionicons';
import { presetActivities, stateAbbreviations } from '../../assets/Mocks';
import { auth, db, storage } from "../../src/lib/firebase";

const ACCENT = "#7DFFA6";
const { width } = Dimensions.get('window');
const allActivities = Object.values(presetActivities).flat();

type Connection = {
  name: string;
  imageUrl: string | null;
  synqCount: number;
};

const fonts = {
  black: Platform.OS === 'ios' ? 'Avenir-Black' : 'sans-serif-condensed',
  heavy: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-medium',
  medium: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif',
  book: Platform.OS === 'ios' ? 'Avenir-Book' : 'sans-serif',
};

export default function ProfileScreen() {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isQRExpanded, setQRExpanded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [memo, setMemo] = useState<string>('');
  const [monthlyMemo, setMonthlyMemo] = useState<string>('');
  const [tempMonthlyMemo, setTempMonthlyMemo] = useState<string>('');
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [requestCount, setRequestCount] = useState(0);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    
    const unsubscribeProfile = onSnapshot(userDocRef, (userDocSnap) => {
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        setCity(userData.city || null);
        const stateAbbr = stateAbbreviations[userData.state] || userData.state || null;
        setState(stateAbbr);
        setMemo(userData.memo || '');
        setMonthlyMemo(userData.monthlyMemo || '');
        setInterests(userData.interests || []);
        setSelectedInterests(userData.interests || []);
        setProfileImage(userData?.imageurl || null);
      }
    });

    const reqRef = collection(db, "users", auth.currentUser.uid, "friendRequests");
    const unsubscribeRequests = onSnapshot(reqRef, (snap) => {
        setRequestCount(snap.docs.length);
    });

    const friendsCol = collection(db, "users", auth.currentUser.uid, "friends");
    const unsubscribeFriends = onSnapshot(friendsCol, async (snapshot) => {
      setLoadingConnections(true);
      try {
          const friendsList = await Promise.all(
            snapshot.docs.map(async (friendDoc) => {
              const friendSnap = await getDoc(doc(db, "users", friendDoc.id));
              if (friendSnap.exists()) {
                return {
                  name: friendSnap.data().displayName || "User",
                  imageUrl: friendSnap.data().imageurl || null,
                  synqCount: friendDoc.data().synqCount || 0,
                };
              }
              return null;
            })
          );
          const validFriends = (friendsList.filter(Boolean) as Connection[])
            .sort((a, b) => b.synqCount - a.synqCount);
          setConnections(validFriends);
      } finally {
          setLoadingConnections(false);
      }
    });

    return () => {
      unsubscribeProfile();
      unsubscribeRequests();
      unsubscribeFriends();
    };
  }, []);

  const filteredActivities = allActivities.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteInterest = (interestName: string) => {
    Alert.alert("Remove Interest", `Remove "${interestName}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          const updatedInterests = interests.filter(i => i !== interestName);
          await updateDoc(doc(db, 'users', auth.currentUser!.uid), { interests: updatedInterests });
      }}
    ]);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0].uri) uploadImage(result.assets[0].uri);
  };

  const uploadImage = async (uri: string) => {
    if (!auth.currentUser) return;
    setIsUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `profiles/${auth.currentUser.uid}`);
      const uploadTask = await uploadBytesResumable(storageRef, blob);
      const url = await getDownloadURL(uploadTask.ref);
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { imageurl: url });
      setProfileImage(url);
    } catch (e) {
      Alert.alert("Error", "Could not upload image.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", onPress: () => firebaseSignOut(auth) }
    ]);
  };

  const saveInterests = async () => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { interests: selectedInterests });
      setShowInputModal(false);
      setSearchQuery('');
    } catch (e) {
      Alert.alert("Error", "Could not save interests.");
    }
  };

  const saveMonthlyMemo = async () => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { monthlyMemo: tempMonthlyMemo });
      setShowMemoModal(false);
    } catch (e) {
      Alert.alert("Error", "Could not save monthly memo.");
    }
  };

  const accountData = { id: auth.currentUser?.uid, email: auth.currentUser?.email, displayName: auth.currentUser?.displayName };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/notifications')}>
          <Icon name="notifications-outline" size={26} color={ACCENT} />
          {requestCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{requestCount}</Text></View>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Icon name="settings-outline" size={26} color={ACCENT} />
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        <View style={styles.qrContainer}>
          <View style={styles.qrBg}>
            <QRCode value={JSON.stringify(accountData)} size={160} color="black" backgroundColor="white" />
          </View>
          <TouchableOpacity onPress={pickImage} style={styles.imageWrapper}>
            {isUploading ? (
              <ActivityIndicator color={ACCENT} />
            ) : profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImg} />
            ) : (
              <View style={styles.defaultAvatarContainer}>
                <Icon name="person" size={80} color="rgba(255,255,255,0.2)" />
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setQRExpanded(true)} style={styles.qrToggle}>
            <Icon name="qr-code-outline" size={13} color="black" />
          </TouchableOpacity>
        </View>
        <Text style={styles.nameText}>{auth.currentUser?.displayName}</Text>
        {city && state && (
          <Text style={styles.locationText}>{city}, {state}</Text>
        )}    
        <Text style={styles.memoText}>{memo}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Top Synqs</Text>
          <TouchableOpacity onPress={() => Alert.alert("Synq Score", "Your Top Synqs are the people you message most! Every message sent increases your score.")}>
            <Icon name="information-circle-outline" size={18} color="#444" />
          </TouchableOpacity>
        </View>
        <View style={styles.synqsContainer}>
          {loadingConnections ? (
            <ActivityIndicator color={ACCENT} />
          ) : connections.length > 0 ? (
            connections.slice(0, 3).map((item, i) => (
              <View key={i} style={styles.connItem}>
                <View style={[styles.imageCircle, i === 0 && { borderColor: ACCENT, borderWidth: 2 }]}>
                  {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.connImg} />
                  ) : (
                      <View style={[styles.connImg, styles.connDefaultAvatar]}>
                           <Icon name="person" size={24} color="rgba(255,255,255,0.2)" />
                      </View>
                  )}
                  {i === 0 && <View style={styles.crown}><Icon name="star" size={10} color="black" /></View>}
                </View>
                <Text style={styles.connName} numberOfLines={1}>
                  {item.name.split(' ')[0]}
                </Text>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreText}>{item.synqCount}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Start messaging to see your top synqs.</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Interests</Text>
        <View style={styles.interestsWrapper}>
          {interests.map((interest, i) => (
            <TouchableOpacity key={i} style={styles.interestRect} onPress={() => handleDeleteInterest(interest)}>
              <Text style={styles.interestText}>{interest}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setShowInputModal(true)} style={styles.addRect}>
            <Icon name="add" size={16} color={ACCENT} />
            <Text style={styles.addRectText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Monthly Memo</Text>
          <TouchableOpacity onPress={() => { setTempMonthlyMemo(monthlyMemo); setShowMemoModal(true); }}>
            <Icon name="create-outline" size={18} color={ACCENT} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={[styles.monthlyMemoBox, { borderColor: monthlyMemo ? ACCENT : '#222' }]} 
          onPress={() => { setTempMonthlyMemo(monthlyMemo); setShowMemoModal(true); }}
        >
          <Text style={styles.monthlyMemoSubtitle}>
            What's going on this month that you'd like to share? Tap to edit
          </Text>
          <Text style={styles.monthlyMemoContent}>
            {monthlyMemo || "No plans shared yet for this month. Tap to add your first memo!"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Modal visible={isQRExpanded} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setQRExpanded(false)}>
          <View style={styles.qrModalBox}>
            <QRCode value={JSON.stringify(accountData)} size={260} />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showInputModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1, width: '100%' }} onPress={() => setShowInputModal(false)} />
          <View style={styles.interestContent}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>What are you into?</Text>
                <TouchableOpacity onPress={() => setShowInputModal(false)}>
                    <Icon name="close" size={24} color="white" />
                </TouchableOpacity>
            </View>
            <View style={styles.searchBarContainer}>
                <Icon name="search-outline" size={18} color="#666" style={{marginLeft: 12}} />
                <TextInput style={styles.searchInput} placeholder="Search interests..." placeholderTextColor="#666" value={searchQuery} onChangeText={setSearchQuery} autoCapitalize="none" />
            </View>
            <ScrollView contentContainerStyle={styles.interestGrid}>
              {filteredActivities.map(item => {
                  const active = selectedInterests.includes(item.name);
                  return (
                  <TouchableOpacity key={item.name} onPress={() => setSelectedInterests(prev => active ? prev.filter(i => i !== item.name) : [...prev, item.name])} style={[styles.chip, active && styles.chipActive]}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
                  </TouchableOpacity>
                  );
              })}
            </ScrollView>
            <TouchableOpacity onPress={saveInterests} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showMemoModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1, width: '100%' }} onPress={() => setShowMemoModal(false)} />
          <View style={styles.interestContent}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Monthly Memo</Text>
                <TouchableOpacity onPress={() => setShowMemoModal(false)}>
                    <Icon name="close" size={24} color="white" />
                </TouchableOpacity>
            </View>
            <TextInput 
              style={styles.largeTextInput} 
              placeholder="e.g. May 7th - LP Farmer's Market..." 
              placeholderTextColor="#444" 
              multiline 
              value={tempMonthlyMemo} 
              onChangeText={setTempMonthlyMemo}
              autoFocus
            />
            <TouchableOpacity onPress={saveMonthlyMemo} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save Memo</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  scrollContent: { paddingBottom: 160 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 25, marginTop: 60, alignItems: 'center' },
  badge: { position: 'absolute', right: -4, top: -4, backgroundColor: 'red', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'black' },
  badgeText: { color: 'white', fontSize: 10, fontFamily: fonts.black },
  profileSection: { alignItems: 'center', marginTop: 10 },
  qrContainer: { width: 200, height: 200, justifyContent: 'center', alignItems: 'center' },
  qrBg: { position: 'absolute', opacity: 0.4, backgroundColor: 'white', borderRadius: 25, padding: 10 },
  imageWrapper: { width: 160, height: 160, borderRadius: 80, overflow: 'hidden', borderWidth: 2, borderColor: 'white', backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  profileImg: { width: '100%', height: '100%' },
  defaultAvatarContainer: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  qrToggle: { position: 'absolute', bottom: 10, right: 10, backgroundColor: ACCENT, padding: 10, borderRadius: 25, zIndex: 2 },
  nameText: { color: ACCENT, fontSize: 32, fontFamily: fonts.black, marginTop: 20 },
  locationText: { color: 'white', opacity: 0.6, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4, fontFamily: fonts.heavy },
  memoText: { color: '#888', fontStyle: 'italic', marginTop: 12, paddingHorizontal: 40, textAlign: 'center', fontFamily: fonts.medium, lineHeight: 20 },
  section: { marginTop: 30, paddingHorizontal: 25 },
  sectionTitle: { color: 'white', fontSize: 20, fontFamily: fonts.black, marginBottom: 15 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  synqsContainer: { flexDirection: 'row', justifyContent: 'flex-start', gap: 20 },
  connItem: { alignItems: 'center', width: 80 },
  imageCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  connImg: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#222', borderColor: '#333', borderWidth: 1 },
  connDefaultAvatar: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  crown: { position: 'absolute', bottom: 0, right: 0, backgroundColor: ACCENT, padding: 3, borderRadius: 10, borderWidth: 2, borderColor: 'black', zIndex: 10 },
  connName: { color: 'white', fontSize: 12, marginTop: 10, textAlign: 'center', fontFamily: fonts.heavy },
  scoreBadge: { backgroundColor: '#111', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 5, borderWidth: 1, borderColor: '#222' },
  scoreText: { color: ACCENT, fontSize: 10, fontFamily: fonts.black },
  emptyText: { color: '#333', fontFamily: fonts.medium, fontSize: 14 },
  interestsWrapper: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  interestRect: { backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
  interestText: { color: 'white', fontFamily: fonts.heavy, fontSize: 13 },
  addRect: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: ACCENT, borderStyle: 'dashed', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  addRectText: { color: ACCENT, fontFamily: fonts.heavy, fontSize: 13, marginLeft: 4 },
  monthlyMemoBox: { backgroundColor: '#111', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#222' },
  monthlyMemoSubtitle: { color: '#555', fontSize: 11, fontFamily: fonts.black, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  monthlyMemoContent: { color: 'white', fontSize: 16, fontFamily: fonts.medium, lineHeight: 24 },
  signOutBtn: { alignSelf: 'center', marginTop: 50, paddingVertical: 14, paddingHorizontal: 60, borderRadius: 25, borderWidth: 1.5, borderColor: '#222', backgroundColor: '#0a0a0a' },
  signOutText: { color: '#666', fontFamily: fonts.heavy, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  qrModalBox: { backgroundColor: 'white', padding: 25, borderRadius: 40 },
  interestContent: { backgroundColor: '#0a0a0a', width: '100%', height: '85%', marginTop: 'auto', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 30, alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 25 },
  modalTitle: { color: 'white', fontSize: 26, fontFamily: fonts.black },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 18, width: '100%', marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  searchInput: { flex: 1, color: 'white', padding: 14, fontFamily: fonts.medium, fontSize: 16 },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingBottom: 30 },
  chip: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 30, backgroundColor: '#111', borderWidth: 1, borderColor: '#222', margin: 6 },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipText: { color: '#555', fontFamily: fonts.heavy },
  chipTextActive: { color: 'black' },
  inputLabel: { color: '#666', marginBottom: 15, fontSize: 14, fontFamily: fonts.medium, width: '100%', lineHeight: 20 },
  largeTextInput: { width: '100%', flex: 1, backgroundColor: '#111', color: 'white', borderRadius: 20, padding: 20, fontSize: 17, fontFamily: fonts.medium, textAlignVertical: 'top', marginBottom: 20, borderWidth: 1, borderColor: '#222' },
  saveBtn: { backgroundColor: ACCENT, width: '100%', padding: 20, borderRadius: 22, marginBottom: 20, alignItems: 'center' },
  saveBtnText: { color: 'black', fontFamily: fonts.black, fontSize: 17 }
});