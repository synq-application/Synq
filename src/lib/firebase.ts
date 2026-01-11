import { initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, initializeAuth, signInWithEmailAndPassword, signInWithPhoneNumber } from "firebase/auth"; // Import necessary Firebase Auth methods
import 'firebase/firestore';
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { ENV_VARS } from './config.js';

const firebaseConfig = {
  apiKey: ENV_VARS.apiKey ,
  authDomain: ENV_VARS.authDomain,
  projectId: ENV_VARS.projectId,
  storageBucket: ENV_VARS.storageBucket,
  messagingSenderId: ENV_VARS.messagingSenderId,
  appId: ENV_VARS.appId,
  measurementId: ENV_VARS.measurementId
};

const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app);
const storage = getStorage(app);
export const db = getFirestore(app);
if (__DEV__) {
  auth.settings.appVerificationDisabledForTesting = true;
}
export { app, auth, createUserWithEmailAndPassword, firebaseConfig, signInWithEmailAndPassword, signInWithPhoneNumber, storage };

