import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
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
  View,
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
      await createUserWithEmailAndPassword(auth, cleanedEmail, password);
    } catch (e: any) {
      console.log("email signup error", e?.code, e?.message);
      Alert.alert(
        "Couldn’t sign up",
        e?.message ?? "Please check your email and password and try again."
      );
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <Text style={styles.closeIcon}>×</Text>
        </TouchableOpacity>

        <View style={styles.innerContent}>
          <Text style={styles.title}>Sign up with email</Text>
          <Text style={styles.subtitle}>
            Use email instead of SMS to create your account.
          </Text>

          <View style={{ marginTop: 24 }}>
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
  innerContent: {
    width: '100%',
    marginTop: height * 0.22, // Fixed position from top
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 25,
    zIndex: 10,
    padding: 10,
  },
  closeIcon: {
    fontSize: 36,
    color: "white",
    fontFamily: fonts.book,
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
    fontFamily: fonts.medium,
    lineHeight: 22,
  },
  input: {
    color: "white",
    backgroundColor: "rgba(255,255,255,0.08)",
    height: 56,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  button: {
    marginTop: 24,
    backgroundColor: ACCENT,
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "black",
    fontSize: 18,
    fontFamily: fonts.black,
  },
  small: {
    marginTop: 20,
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    fontFamily: fonts.book,
  },
});