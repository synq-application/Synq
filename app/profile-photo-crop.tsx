import ProfilePhotoCropView from "@/src/components/ProfilePhotoCropView";
import {
  consumePendingProfilePhotoSource,
  setPendingProfilePhoto,
} from "@/src/lib/pendingProfilePhoto";
import { uploadProfilePhoto } from "@/src/lib/uploadProfilePhoto";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { BG } from "@/constants/Variables";
import { StyleSheet, View } from "react-native";
import AlertModal from "./alert-modal";

export default function ProfilePhotoCropScreen() {
  const router = useRouter();
  const { uri, onboarding } = useLocalSearchParams<{ uri?: string; onboarding?: string }>();
  const isOnboarding = onboarding === "1";

  const [imageUri] = useState<string | null>(() => {
    const fromPending = consumePendingProfilePhotoSource();
    if (fromPending) return fromPending;
    if (typeof uri === "string" && uri.length > 0) {
      return decodeURIComponent(uri);
    }
    return null;
  });
  const [uploading, setUploading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  useEffect(() => {
    if (!imageUri) {
      router.back();
    }
  }, [imageUri, router]);

  const showError = useCallback((message: string) => {
    setAlertMessage(message);
    setAlertVisible(true);
  }, []);

  const handleChoose = useCallback(
    async (croppedUri: string) => {
      if (isOnboarding) {
        setPendingProfilePhoto(croppedUri);
        router.back();
        return;
      }

      setUploading(true);
      try {
        await uploadProfilePhoto(croppedUri);
        router.back();
      } catch {
        showError("Could not upload image.");
      } finally {
        setUploading(false);
      }
    },
    [isOnboarding, router, showError]
  );

  if (!imageUri) {
    return <View style={styles.empty} />;
  }

  return (
    <>
      <StatusBar style="light" />
      <ProfilePhotoCropView
        imageUri={imageUri}
        processing={uploading}
        onCancel={() => router.back()}
        onChoose={handleChoose}
      />
      <AlertModal
        visible={alertVisible}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    backgroundColor: BG,
  },
});
