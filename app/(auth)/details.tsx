import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import Icon from 'react-native-vector-icons/Ionicons';
import { auth, db } from '../../src/lib/firebase';

const { height } = Dimensions.get('window');
const ACCENT = "#7DFFA6";

// Font scaling logic for consistency across platforms
const fonts = {
  black: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-condensed',
  heavy: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-medium',
  medium: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif',
  book: Platform.OS === 'ios' ? 'Avenir-Book' : 'sans-serif',
};

export default function Details() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canContinue = firstName.trim() && lastName.trim() && !loading;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const saveDetails = async () => {
    if (!auth.currentUser) return;
    try {
      setLoading(true);
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      await updateProfile(auth.currentUser, { displayName: fullName, photoURL: image });
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        uid: auth.currentUser.uid,
        displayName: fullName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        imageurl: image, 
        status: 'inactive', 
        createdAt: new Date().toISOString(),
      }, { merge: true });
      await auth.currentUser.reload();
      router.push('/location'); 
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View style={styles.innerContent}>
          
          <View style={styles.headerSection}>
            <Text style={styles.title}>What’s your name?</Text>
            <Text style={styles.subtitle}>Help friends recognize you on Synq.</Text>
          </View>

          <View style={styles.avatarContainer}>
            <TouchableOpacity onPress={pickImage} style={styles.avatarCircle}>
              {image ? (
                <Image source={{ uri: image }} style={styles.avatarImage} />
              ) : (
                <View style={styles.placeholderIcon}>
                  <Icon name="camera-outline" size={32} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </View>
              )}
              <View style={styles.plusBadge}>
                <Icon name="add" size={16} color="black" />
              </View>
            </TouchableOpacity>
            <Text style={styles.optionalText}>(Optional)</Text>
          </View>

          <View style={styles.inputContainer}>
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
            {loading ? <ActivityIndicator color="black" /> : <Text style={styles.buttonText}>Continue</Text>}
          </TouchableOpacity>

        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#0F1115", 
    paddingHorizontal: 24 
  },
  innerContent: {
    width: '100%',
    marginTop: height * 0.15, 
  },
  headerSection: { 
    marginBottom: 20 
  },
  title: { 
    color: "white", 
    fontSize: 28, 
    fontFamily: fonts.black,
    textAlign: 'center' 
  },
  subtitle: { 
    color: "rgba(255,255,255,0.7)", 
    fontSize: 16, 
    marginTop: 8, 
    fontFamily: fonts.medium,
    textAlign: 'center' 
  },
  avatarContainer: { 
    alignItems: 'center', 
    marginVertical: 20 
  },
  avatarCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarImage: { width: 110, height: 110, borderRadius: 55 },
  placeholderIcon: { alignItems: 'center' },
  addPhotoText: { 
    color: 'rgba(255,255,255,0.4)', 
    fontSize: 12, 
    marginTop: 4, 
    fontFamily: fonts.heavy 
  },
  plusBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: ACCENT,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'black'
  },
  optionalText: { 
    color: 'rgba(255,255,255,0.3)', 
    fontSize: 12, 
    marginTop: 8,
    fontFamily: fonts.book
  },
  inputContainer: {
    marginTop: 10,
  },
  input: {
    color: "white",
    backgroundColor: "rgba(255,255,255,0.08)",
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  button: {
    marginTop: 32,
    backgroundColor: ACCENT,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { 
    color: "black", 
    fontSize: 18, 
    fontFamily: fonts.black 
  },
});