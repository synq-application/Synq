import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
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
import { auth } from "../../src/lib/firebase";

const ACCENT = "#7DFFA6";

export default function EmailSignup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const canContinue =
    email.trim().length > 3 && password.length >= 6 && !loading;

  const signUp = async () => {
    try {
      setLoading(true);
      const cleanedEmail = email.trim().toLowerCase();
      
      // When this succeeds, RootLayout will detect the user and redirect automatically
      await createUserWithEmailAndPassword(auth, cleanedEmail, password);
      
    } catch (e: any) {
      console.log("email signup error", e?.code, e?.message);
      Alert.alert(
        "Couldn’t sign up",
        e?.message ?? "Please check your email and password and try again."
      );
      setLoading(false); // Only set loading false on error; on success, the component unmounts
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => router.replace("/(auth)/welcome")}
        style={styles.closeButton}
      >
        <Text style={{ fontSize: 28, color: "white" }}>×</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Sign up with email</Text>
      <Text style={styles.subtitle}>
        Use email instead of SMS to create your account.
      </Text>

      <View style={{ marginTop: 18 }}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="rgba(255,255,255,0.35)"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          style={styles.input}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password (6+ characters)"
          placeholderTextColor="rgba(255,255,255,0.35)"
          secureTextEntry
          textContentType="newPassword"
          style={[styles.input, { marginTop: 12 }]}
        />
      </View>

      <TouchableOpacity
        disabled={!canContinue}
        onPress={signUp}
        style={[styles.button, !canContinue && { opacity: 0.5 }]}
      >
        {loading ? (
          <ActivityIndicator color="black" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.small}>
        By continuing, you agree to receive account-related emails from Synq.
      </Text>
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
  closeButton: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
  },
  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    marginTop: 10,
  },
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
    marginTop: 18,
    backgroundColor: ACCENT,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "800",
  },
  small: {
    marginTop: 14,
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
});