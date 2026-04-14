import {
  ONBOARDING_H_PADDING,
  ONBOARDING_SCROLL_BOTTOM,
  ONBOARDING_SUBTITLE_SIZE,
  ONBOARDING_TITLE_SIZE,
  onboardingContentTopPadding,
} from "@/constants/onboardingLayout";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  MUTED,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  TEXT,
  fonts,
} from "../../constants/Variables";
import { auth, db, storage } from "../../src/lib/firebase";
import AlertModal from "../alert-modal";

export default function Details() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (message: string, title?: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const canContinue = firstName.trim() && lastName.trim() && !loading && !isUploading;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert("We need access to your photos.", "Permission Denied");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0].uri) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    if (!auth.currentUser) return;

    setIsUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `profiles/${auth.currentUser.uid}`);
      const uploadTask = await uploadBytesResumable(storageRef, blob);
      const url = await getDownloadURL(uploadTask.ref);

      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        { imageurl: url },
        { merge: true }
      );

      setImage(url);
    } catch (e) {
      showAlert("Could not upload image.", "Error");
    } finally {
      setIsUploading(false);
    }
  };

  const saveDetails = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      await updateProfile(auth.currentUser, {
        displayName: fullName,
        photoURL: image ?? null, 
      });

      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        {
          uid: auth.currentUser.uid,
          displayName: fullName,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          imageurl: image ?? null, 
          status: "inactive",
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await auth.currentUser.reload();
      router.push("/location");
    } catch (e: any) {
      console.error("[Details] saveDetails error:", e);
      showAlert(e?.message ?? "Something went wrong.", "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: onboardingContentTopPadding() },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        >
        <View style={styles.innerContent}>
          <View style={styles.headerSection}>
            <Text style={styles.title}>What’s your name?</Text>
            <Text style={styles.subtitle}>Help friends recognize you on Synq.</Text>
          </View>

          <View style={styles.avatarContainer}>
            <TouchableOpacity onPress={pickImage} style={styles.avatarCircle} disabled={isUploading}>
              {image ? (
                <ExpoImage
                  source={{ uri: image }}
                  style={styles.avatarImage}
                  cachePolicy="memory-disk"
                  transition={0}
                  recyclingKey={image}
                />
              ) : (
                <View style={styles.placeholderIcon}>
                  <Icon name="camera-outline" size={28} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.addPhotoText}>
                    {isUploading ? "Uploading..." : "Add Photo"}
                  </Text>
                </View>
              )}

              <View style={styles.plusBadge}>
                {isUploading ? (
                  <ActivityIndicator color="black" />
                ) : (
                  <Icon name="add" size={15} color="black" />
                )}
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
            {loading ? (
              <ActivityIndicator color="black" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
          <AlertModal
            visible={alertVisible}
            title={alertTitle}
            message={alertMessage}
            onClose={() => setAlertVisible(false)}
          />
        </View>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: ONBOARDING_H_PADDING,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: ONBOARDING_SCROLL_BOTTOM + 48,
  },
  innerContent: {
    width: "100%",
  },
  headerSection: {
    marginBottom: 10,
  },
  title: {
    color: TEXT,
    fontSize: ONBOARDING_TITLE_SIZE,
    // Single-line headline: slightly tighter than shared onboarding line height
    lineHeight: 38,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: MUTED,
    fontSize: ONBOARDING_SUBTITLE_SIZE,
    marginTop: 9,
    marginBottom: 10,
    fontFamily: fonts.book,
    lineHeight: 22,
  },
  avatarContainer: {
    alignItems: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  avatarImage: { width: 86, height: 86, borderRadius: 43 },
  placeholderIcon: { alignItems: "center" },
  addPhotoText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    marginTop: 4,
    fontFamily: fonts.heavy,
  },
  plusBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: ACCENT,
    width: 26,
    height: 26,
    borderRadius: BUTTON_RADIUS,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "black",
  },
  optionalText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    marginTop: 6,
    fontFamily: fonts.book,
  },
  inputContainer: {
    marginTop: 6,
  },
  input: {
    color: "white",
    backgroundColor: "rgba(255,255,255,0.08)",
    height: 52,
    borderRadius: BUTTON_RADIUS,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  button: {
    marginTop: 32,
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    backgroundColor: ACCENT,
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "black",
    fontSize: 18,
    fontFamily: fonts.heavy,
  },
});
