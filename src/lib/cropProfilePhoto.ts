import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "react-native";

export type ProfilePhotoCropParams = {
  imageWidth: number;
  imageHeight: number;
  cropSize: number;
  userScale: number;
  translateX: number;
  translateY: number;
};

export function computeProfilePhotoCropRect({
  imageWidth,
  imageHeight,
  cropSize,
  userScale,
  translateX,
  translateY,
}: ProfilePhotoCropParams) {
  const baseScale = Math.max(cropSize / imageWidth, cropSize / imageHeight);
  const totalScale = baseScale * userScale;
  const scaledW = imageWidth * totalScale;
  const scaledH = imageHeight * totalScale;
  const offsetX = (cropSize - scaledW) / 2 + translateX;
  const offsetY = (cropSize - scaledH) / 2 + translateY;

  const originX = Math.max(0, Math.round(-offsetX / totalScale));
  const originY = Math.max(0, Math.round(-offsetY / totalScale));
  const width = Math.min(imageWidth - originX, Math.round(cropSize / totalScale));
  const height = Math.min(imageHeight - originY, Math.round(cropSize / totalScale));
  const size = Math.min(width, height);

  return { originX, originY, width: size, height: size };
}

/** Bake EXIF orientation into pixels so preview and crop math use the same dimensions. */
export async function prepareProfilePhotoForCrop(
  uri: string
): Promise<{ uri: string; width: number; height: number }> {
  const normalized = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const { width, height } = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      Image.getSize(
        normalized.uri,
        (w, h) => resolve({ width: w, height: h }),
        reject
      );
    }
  );

  return { uri: normalized.uri, width, height };
}

export async function cropProfilePhoto(
  uri: string,
  params: ProfilePhotoCropParams,
  quality = 0.7
): Promise<string> {
  const rect = computeProfilePhotoCropRect(params);
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: rect }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}
