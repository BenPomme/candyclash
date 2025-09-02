// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAwf3LiC9q-IaJDFHM3WyZw7LVYpT-JY8Y",
  authDomain: "candyclash-85fd4.firebaseapp.com",
  projectId: "candyclash-85fd4",
  storageBucket: "candyclash-85fd4.firebasestorage.app",
  messagingSenderId: "1023963383517",
  appId: "1:1023963383517:web:c5d7deaae4f8c03213fd34",
  measurementId: "G-Q1JLW46T3R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const database = getDatabase(app);

export default app;