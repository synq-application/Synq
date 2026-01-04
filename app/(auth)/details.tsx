import { updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore"; // Add this
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
import { auth, db } from "../../src/lib/firebase"; // Add db
import { useAuthRefresh } from "../_layout";

const ACCENT = "#7DFFA6";

export default function Details() {
  const { refreshAuth } = useAuthRefresh();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);

  const canContinue = firstName.trim() && lastName.trim() && !loading;

  const saveDetails = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);

      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      // 1. Update the display name on the Firebase Authentication server
      await updateProfile(auth.currentUser, {
        displayName: fullName,
      });

      // 2. CREATE the searchable document in Firestore
      // We use setDoc with auth.currentUser.uid as the document ID
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        uid: auth.currentUser.uid,
        displayName: fullName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: auth.currentUser.email,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      // 3. Refresh local Firebase user object
      await auth.currentUser.reload();

      // 4. Trigger Layout redirect
      refreshAuth();

    } catch (e: any) {
      console.error("Error saving profile:", e);
      Alert.alert(
        "Couldn't save details",
        e?.message ?? "Something went wrong. Please try again."
      );
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What’s your name?</Text>
      <Text style={styles.subtitle}>
        Help friends recognize you on Synq.
      </Text>

      <View style={{ marginTop: 24 }}>
        <TextInput
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First Name"
          placeholderTextColor="rgba(255,255,255,0.35)"
          autoCapitalize="words"
          autoCorrect={false}
          style={styles.input}
        />

        <TextInput
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last Name"
          placeholderTextColor="rgba(255,255,255,0.35)"
          autoCapitalize="words"
          autoCorrect={false}
          style={[styles.input, { marginTop: 12 }]}
        />
      </View>

      <TouchableOpacity
        disabled={!canContinue}
        onPress={saveDetails}
        style={[styles.button, !canContinue && { opacity: 0.5 }]}
      >
        {loading ? (
          <ActivityIndicator color="black" />
        ) : (
          <Text style={styles.buttonText}>Finish</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    padding: 24,
    justifyContent: "center",
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
    justifyContent: "center",
  },
  buttonText: { color: "black", fontSize: 16, fontWeight: "800" },
});