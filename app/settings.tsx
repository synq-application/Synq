import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useState } from 'react';
import {
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from "../src/lib/firebase";

const ACCENT = "#7DFFA6";
const BACKGROUND = "black";
const SURFACE = "#161616";

const fonts = {
  black: Platform.OS === 'ios' ? 'Avenir-Black' : 'sans-serif-condensed',
  heavy: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-medium',
  medium: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif',
};

export default function SettingsScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    if (!auth.currentUser?.uid) return;

    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        setUserData(snap.data());
      }
    });

    return () => unsubscribe();
  }, []);

  const SettingItem = ({ label, onPress, isSwitch, value, onValueChange }: any) => (
    <TouchableOpacity 
      style={styles.item} 
      onPress={onPress} 
      disabled={isSwitch}
    >
      <View style={styles.itemLeft}>
        <Text style={styles.itemLabel}>{label}</Text>
      </View>
      {isSwitch ? (
        <Switch
          trackColor={{ false: "#333", true: ACCENT }}
          thumbColor={Platform.OS === 'ios' ? "#fff" : (value ? "#fff" : "#f4f3f4")}
          ios_backgroundColor="#333"
          onValueChange={onValueChange}
          value={value}
        />
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#666" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preferences</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.userSection}>
          <Image 
            source={{ 
              uri: userData?.imageurl || 'https://www.gravatar.com/avatar/?d=mp' 
            }} 
            style={styles.avatar} 
          />
          <Text style={styles.userName}>
            {userData?.displayName || auth.currentUser?.displayName || 'User'}
          </Text>
        </View>

        <Text style={styles.groupTitle}>Account Settings</Text>
        <View style={styles.group}>
         <SettingItem label="Edit profile" onPress={() => router.push('/edit-profile')} />
          <SettingItem label="Change password" onPress={() => {}} />
          <SettingItem 
            label="Push notifications" 
            isSwitch 
            value={pushEnabled} 
            onValueChange={setPushEnabled} 
          />
        </View>

        <Text style={styles.groupTitle}>More</Text>
        <View style={styles.group}>
          <SettingItem label="About us" onPress={() => {}} />
          <SettingItem label="Privacy policy" onPress={() => {}} />
          <SettingItem label="Terms and conditions" onPress={() => {}} />
          <SettingItem label="Feedback" onPress={() => {}} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  header: {
    height: 80,
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: fonts.heavy,
    color: 'black',
    marginBottom: 2,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    margin: 20,
    padding: 15,
    borderRadius: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    backgroundColor: '#333',
  },
  userName: {
    color: 'white',
    fontSize: 18,
    fontFamily: fonts.heavy,
  },
  groupTitle: {
    color: '#666',
    fontSize: 14,
    fontFamily: fonts.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 25,
    marginBottom: 10,
    marginTop: 10,
  },
  group: {
    backgroundColor: SURFACE,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 25,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#252525',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemLabel: {
    color: 'white',
    fontSize: 16,
    fontFamily: fonts.medium,
  }
});