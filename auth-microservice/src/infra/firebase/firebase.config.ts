import * as dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: process.env.AUTH_DOMAIN,
  projectId: process.env.PROJECT_ID,
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSAGING_SENDER_ID,
  appId: process.env.APP_ID,
  measurementId: process.env.MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);

let db;
if (process.env.NODE_ENV === 'development') {
  db = getFirestore();
  connectFirestoreEmulator(db, 'localhost', 8080);
} else {
  db = getFirestore(app);
}

// export const firestore = admin.firestore();
export const firestore = db;
