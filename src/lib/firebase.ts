import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  // @ts-ignore - some TS setups don’t expose this type even though runtime supports it
  getReactNativePersistence,
  initializeAuth,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { ENV_VARS } from "./config.js";

const firebaseConfig = {
  apiKey: ENV_VARS.apiKey,
  authDomain: ENV_VARS.authDomain,
  projectId: ENV_VARS.projectId,
  storageBucket: ENV_VARS.storageBucket,
  messagingSenderId: ENV_VARS.messagingSenderId,
  appId: ENV_VARS.appId,
  measurementId: ENV_VARS.measurementId,
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export const storage = getStorage(app);

if (__DEV__) {
  auth.settings.appVerificationDisabledForTesting = true;
}

export {
  app, createUserWithEmailAndPassword, firebaseConfig, signInWithEmailAndPassword,
  signInWithPhoneNumber
};

