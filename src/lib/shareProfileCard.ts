import { Image as ExpoImage } from "expo-image";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import type { RefObject } from "react";
import { Platform, Share } from "react-native";
import { captureRef } from "react-native-view-shot";
import type ViewShot from "react-native-view-shot";
import { storage } from "./firebase";

const SHARE_HEADLINE = "Join me on Synq!";

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function toShareableFileUri(uri: string): string {
  if (uri.startsWith("file://")) return uri;
  return `file://${uri}`;
}

async function prefetchShareCardAvatar(avatarUri: string): Promise<void> {
  const uri = avatarUri.trim();
  if (!uri.startsWith("http")) return;
  try {
    await ExpoImage.prefetch(uri);
  } catch {
    // Default avatar still renders if prefetch fails.
  }
}

async function uploadProfileShareCard(
  localUri: string,
  userId: string
): Promise<void> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, `profileShareCards/${userId}/card.png`);
  await uploadBytesResumable(storageRef, blob, {
    contentType: "image/png",
    cacheControl: "public,max-age=3600",
  });
  await getDownloadURL(storageRef);
}

/**
 * Captures the profile card, uploads it for link previews, then shares the image
 * plus a tappable profile URL.
 */
export async function captureAndShareProfileCard(
  cardRef: RefObject<ViewShot | null>,
  shareUrl: string,
  userId: string,
  avatarUri?: string
): Promise<void> {
  if (!cardRef.current) {
    throw new Error("Profile share card is not ready.");
  }
  if (!shareUrl.trim() || !userId.trim()) {
    throw new Error("Profile share link is not ready.");
  }

  if (avatarUri) {
    await prefetchShareCardAvatar(avatarUri);
  }

  await waitForNextFrame();
  // Off-screen capture needs extra time for expo-image to paint the avatar.
  await new Promise((resolve) => setTimeout(resolve, 400));

  const imageUri = await captureRef(cardRef, {
    format: "png",
    quality: 1,
    result: "tmpfile",
  });
  const shareImageUri = toShareableFileUri(imageUri);

  try {
    await uploadProfileShareCard(imageUri, userId);
  } catch {
    // Still share the card image if upload fails.
  }

  const shareMessage = `${SHARE_HEADLINE}\n${shareUrl}`;

  try {
    if (Platform.OS === "ios") {
      await Share.share({
        message: shareMessage,
        url: shareImageUri,
      });
      return;
    }

    await Share.share({
      title: SHARE_HEADLINE,
      message: shareMessage,
      url: shareImageUri,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/cancel|dismiss/i.test(message)) return;
    throw error;
  }
}
