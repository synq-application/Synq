import { Ionicons } from '@expo/vector-icons';
import * as Location from "expo-location";
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

/**
 * US-only state name -> abbreviation mapping
 */
const US_STATE_ABBREV: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "District of Columbia": "DC",
};

export default function EditProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const [locating, setLocating] = useState(false);
  const [locationUsed, setLocationUsed] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

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

  const fillFromCurrentLocation = async () => {
    try {
      setLocationUsed(true); // hide the row immediately
      setLocating(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location permission needed",
          "Enable location access to update your city and state."
        );
        setLocationUsed(false);
        setLocating(false);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setCoords({ lat, lng });

      const results = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      const best = results?.[0];
      const detectedCity =
        (best?.city || best?.subregion || best?.district || "").trim();
      const detectedRegion = (best?.region || "").trim();

      if (!detectedCity || !detectedRegion) {
        Alert.alert("Couldn’t detect city/state", "Please enter it manually.");
        setLocationUsed(false);
        setLocating(false);
        return;
      }

      const abbrev =
        US_STATE_ABBREV[detectedRegion] ?? detectedRegion.toUpperCase().slice(0, 2);

      setCity(detectedCity);
      setState(abbrev);
      setLocating(false);
    } catch (e: any) {
      console.error(e);
      setLocationUsed(false);
      setLocating(false);
      Alert.alert("Error", "Could not get your current location.");
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setSaving(true);

    try {
      const c = city.trim();
      const s = state.trim().toUpperCase();

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        displayName: displayName.trim(),
        city: c,
        state: s,
        locationDisplay: c && s ? `${c}, ${s}` : "",
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        locationUpdatedAt: new Date().toISOString(),
      });

      Alert.alert("Success", "Profile updated!");
      router.back();
    } catch (e) {
      Alert.alert("Error", "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.darkFill}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={ACCENT} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
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

        {!locationUsed && (
          <TouchableOpacity
            onPress={fillFromCurrentLocation}
            disabled={saving || locating}
            activeOpacity={0.85}
            style={[styles.locationRow, (saving || locating) && { opacity: 0.7 }]}
          >
            <View style={styles.locationLeft}>
              <Text style={styles.locationIcon}>📍</Text>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.locationPrimary}>
                  {locating ? "Using current location…" : "Update using current location"}
                </Text>
                <Text style={styles.locationSecondary}>
                  {locating ? "Finding your city and state" : "Auto-fill city & state"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
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
  label: {
    color: '#666',
    fontSize: 12,
    fontFamily: fonts.heavy,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 1
  },
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
  row: { flexDirection: 'row' },

  // Location row (same behavior as onboarding: disappears after tap)
  locationRow: {
    marginTop: 6,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  locationIcon: { fontSize: 16 },
  locationPrimary: { color: "white", fontSize: 14, fontWeight: "800" },
  locationSecondary: { marginTop: 2, color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "600" }
});
