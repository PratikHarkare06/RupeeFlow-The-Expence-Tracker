import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "dummy_api_key",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "dummy_auth_domain",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "dummy_project_id",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "dummy_storage_bucket",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "dummy_sender_id",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "dummy_app_id"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
