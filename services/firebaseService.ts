
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';


// IMPORTANT: Replace these with your actual Firebase project configuration values
// These values are typically found in your Firebase project settings.
const firebaseConfig = {
  apiKey: "AIzaSyA_-iH9xiJWuFtBc7K2hhuxemJEHEqSH_M", // Replace with your Firebase project's API Key
  authDomain: "featured-listing-maker.firebaseapp.com", // Replace with your Firebase project's Auth Domain
  projectId: "featured-listing-maker", // Replace with your Firebase project's Project ID
  storageBucket: "featured-listing-maker.firebasestorage.app", // Replace with your Firebase project's Storage Bucket
  messagingSenderId: "788360845558", // Replace with your Firebase project's Messaging Sender ID
  appId: "1:788360845558:web:34f1f3a212141ea137b4d7", // Replace with your Firebase project's App ID
  measurementId: "G-F1SNFL7LDE" // Optional: if you use Google Analytics
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth: Auth = getAuth(app);

export { app, auth };
