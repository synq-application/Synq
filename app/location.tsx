// app/location.tsx
import { useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from '../src/lib/firebase';
import { useAuthRefresh } from "./_layout";

const ACCENT = "#7DFFA6";

export default function LocationDetails() {
  const router = useRouter();
  const { refreshAuth } = useAuthRefresh();
  
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);

  const canContinue = city.trim() && state.trim() && !loading;

  const saveLocation = async () => {
    if (!auth.currentUser) return;
    try {
      setLoading(true);
      
      // Save data to Firestore
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        city: city.trim(),
        state: state.trim().toUpperCase(),
        locationDisplay: `${city.trim()}, ${state.trim().toUpperCase()}`
      }, { merge: true });

      // Update local state and force navigation to tabs
      refreshAuth();
      router.replace("/(tabs)"); 
      
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", "Could not save location.");
      setLoading(false); // Stop the infinite spinner on error
    }
  };

  const handleSkip = () => {
    refreshAuth();
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Where do you live?</Text>
      <Text style={styles.subtitle}>
        This helps friends see who is nearby for a quick Synq.
      </Text>

      <View style={{ marginTop: 24 }}>
        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder="City (e.g. Seattle)"
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.input}
        />

        <TextInput
          value={state}
          onChangeText={setState}
          placeholder="State (e.g. WA)"
          placeholderTextColor="rgba(255,255,255,0.35)"
          autoCapitalize="characters"
          maxLength={2}
          style={[styles.input, { marginTop: 12 }]}
        />
      </View>

      <TouchableOpacity
        disabled={!canContinue}
        onPress={saveLocation}
        style={[styles.button, !canContinue && { opacity: 0.5 }]}
      >
        {loading ? (
          <ActivityIndicator color="black" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#0F1115", 
    padding: 24, 
    justifyContent: "center" 
  },
  title: { color: "white", fontSize: 28, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.7)", fontSize: 16, marginTop: 8 },
  input: {
    color: "white",
    backgroundColor: "rgba(255,255,255,0.08)",
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  button: { 
    marginTop: 24, 
    backgroundColor: ACCENT, 
    height: 52, 
    borderRadius: 14, 
    alignItems: "center", 
    justifyContent: "center" 
  },
  buttonText: { color: "black", fontSize: 16, fontWeight: "800" },
  skipButton: { marginTop: 20, alignSelf: 'center' },
  skipText: { color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: "600" }
});