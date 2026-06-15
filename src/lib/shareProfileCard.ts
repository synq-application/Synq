import type { RefObject } from "react";
import { Platform, Share } from "react-native";
import { captureRef } from "react-native-view-shot";
import type ViewShot from "react-native-view-shot";

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

function isShareDismissed(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /cancel|dismiss/i.test(message);
}

/**
 * iOS Messages turns a lone https URL into a link preview titled from the page
 * (we set og:title to "Join me on Synq!" on the server).
 */
export async function shareProfileLink(shareWebUrl: string): Promise<void> {
  const url = shareWebUrl.trim();
  if (!url) {
    throw new Error("Profile share link is not ready.");
  }

  try {
    await Share.share({
      message: Platform.OS === "ios" ? url : `Join me on Synq!\n${url}`,
    });
  } catch (error) {
    if (isShareDismissed(error)) return;
    throw error;
  }
}

/** Shares the profile card image plus a friendly link preview below it. */
export async function captureAndShareProfileCard(
  cardRef: RefObject<ViewShot | null>,
  shareWebUrl: string
): Promise<void> {
  if (!cardRef.current) {
    throw new Error("Profile share card is not ready.");
  }
  if (!shareWebUrl.trim()) {
    throw new Error("Profile share link is not ready.");
  }

  await waitForNextFrame();
  await new Promise((resolve) => setTimeout(resolve, 150));

  const imageUri = await captureRef(cardRef, {
    format: "png",
    quality: 0.92,
    result: "tmpfile",
  });

  const link = shareWebUrl.trim();
  const shareImageUri = toShareableFileUri(imageUri);

  try {
    if (Platform.OS === "ios") {
      // Image attachment + https URL unfurls as "Join me on Synq!" (og:title).
      await Share.share({ message: link, url: shareImageUri });
      return;
    }

    await Share.share({
      title: "Join me on Synq!",
      message: `Join me on Synq!\n${link}`,
      url: shareImageUri,
    });
  } catch (error) {
    if (isShareDismissed(error)) return;
    throw error;
  }
}
