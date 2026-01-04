import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from "../src/lib/firebase";

const ACCENT = "#7DFFA6";

const fonts = {
  black: Platform.OS === 'ios' ? 'Avenir-Black' : 'sans-serif-condensed',
  heavy: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-medium',
  medium: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif',
};

export default function EditProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  useEffect(() => {
    const loadUserData = async () => {
      if (!auth.currentUser) return;
      const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (snap.exists()) {
        const data = snap.data();
        setDisplayName(data.displayName || '');
        setCity(data.city || '');
        setState(data.state || '');
      }
      setLoading(false);
    };
    loadUserData();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        displayName,
        city,
        state: state.toUpperCase(), 
      });
      Alert.alert("Success", "Profile updated!");
      router.back();
    } catch (e) {
      Alert.alert("Error", "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.darkFill}><ActivityIndicator color={ACCENT} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={ACCENT} /> : <Text style={styles.saveText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput 
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor="#444"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 2, marginRight: 15 }]}>
            <Text style={styles.label}>City</Text>
            <TextInput 
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="e.g. New York"
              placeholderTextColor="#444"
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>State</Text>
            <TextInput 
              style={styles.input}
              value={state}
              onChangeText={setState}
              placeholder="NY"
              placeholderTextColor="#444"
              maxLength={2}
              autoCapitalize="characters"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  darkFill: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222'
  },
  headerTitle: { color: 'white', fontSize: 18, fontFamily: fonts.black },
  saveText: { color: ACCENT, fontSize: 16, fontFamily: fonts.heavy },
  form: { padding: 25 },
  inputGroup: { marginBottom: 25 },
  label: { color: '#666', fontSize: 12, fontFamily: fonts.heavy, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
  input: { 
    backgroundColor: '#111', 
    color: 'white', 
    padding: 15, 
    borderRadius: 12, 
    fontSize: 16, 
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: '#222'
  },
  row: { flexDirection: 'row' }
});