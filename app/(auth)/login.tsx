import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import { auth } from "../../src/lib/firebase";

const { height } = Dimensions.get('window');
const ACCENT = "#7DFFA6";

const fonts = {
  black: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif-condensed',
  heavy: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif-medium',
  medium: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif',
  book: Platform.OS === 'ios' ? 'Avenir-Book' : 'sans-serif',
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    } catch (error: any) {
      console.error(error);
      Alert.alert("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>Welcome Back!</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          <View style={styles.inputGroup}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, (!email || !password) && { opacity: 0.5 }]} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="black" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    paddingHorizontal: 24,
  },
  inner: {
    width: '100%',
    // Static positioning: 18% from the top of the screen
    marginTop: height * 0.25,
  },
  title: {
    color: "white",
    fontSize: 32,
    fontFamily: fonts.black,
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    marginTop: 8,
    marginBottom: 32,
    fontFamily: fonts.medium,
  },
  inputGroup: {
    gap: 12,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    height: 56,
    borderRadius: 14,
    paddingHorizontal: 16,
    color: "white",
    fontSize: 16,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  button: {
    backgroundColor: ACCENT,
    height: 58,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  buttonText: {
    color: "black",
    fontSize: 18,
    fontFamily: fonts.black,
  },
  backButton: {
    marginTop: 24,
    alignItems: "center",
  },
  backText: {
    color: ACCENT,
    fontSize: 15,
    fontFamily: fonts.heavy,
  }
});