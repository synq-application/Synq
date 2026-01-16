import { router } from "expo-router";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  Modal,
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
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Hold on", "Please enter both your email and password.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    } catch (error: any) {
      let errorMessage = "Incorrect email or password. Please try again.";
      if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many failed attempts. Try resetting your password.";
      }
      Alert.alert("Login Failed", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReset = async () => {
    if (!resetEmail) return;
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim().toLowerCase());
      setResetModalVisible(false);
      Alert.alert("Check your inbox", "If an account exists for this email, a reset link has been sent.");
    } catch (e) {
      Alert.alert("Error", "Could not send reset email.");
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
            />
            <View>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <TouchableOpacity 
                onPress={() => {
                  setResetEmail(email); 
                  setResetModalVisible(true);
                }}
                style={styles.forgotBtn}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.button, (!email || !password) && { opacity: 0.5 }]} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="black" /> : <Text style={styles.buttonText}>Sign In</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Go Back</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={resetModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <Text style={styles.modalSubtitle}>Enter your email and we'll send you a link to get back into your account.</Text>
              
              <TextInput
                style={[styles.input, { backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 20 }]}
                placeholder="Email address"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={resetEmail}
                onChangeText={setResetEmail}
                autoCapitalize="none"
              />

              <TouchableOpacity style={styles.button} onPress={handleSendReset}>
                <Text style={styles.buttonText}>Send Link</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => setResetModalVisible(false)} style={{ marginTop: 15 }}>
                <Text style={[styles.backText, { color: 'rgba(255,255,255,0.5)' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F1115", paddingHorizontal: 24 },
  inner: { width: '100%', marginTop: height * 0.22 },
  title: { color: "white", fontSize: 32, fontFamily: fonts.black },
  subtitle: { color: "rgba(255,255,255,0.6)", fontSize: 16, marginTop: 8, marginBottom: 32, fontFamily: fonts.medium },
  inputGroup: { gap: 12 },
  input: { backgroundColor: "rgba(255,255,255,0.08)", height: 56, borderRadius: 14, paddingHorizontal: 16, color: "white", fontSize: 16, fontFamily: fonts.medium, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  forgotBtn: { alignSelf: 'flex-end', marginTop: 8, paddingVertical: 4 },
  forgotText: { color: "rgba(255,255,255,0.4)", fontSize: 13, fontFamily: fonts.book },
  button: { backgroundColor: ACCENT, height: 58, borderRadius: 16, justifyContent: "center", alignItems: "center", marginTop: 24 },
  buttonText: { color: "black", fontSize: 18, fontFamily: fonts.black },
  backButton: { marginTop: 24, alignItems: "center" },
  backText: { color: ACCENT, fontSize: 15, fontFamily: fonts.heavy },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#161616', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: 'white', fontSize: 22, fontFamily: fonts.black, marginBottom: 8 },
  modalSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: fonts.medium, marginBottom: 20, lineHeight: 20 }
});