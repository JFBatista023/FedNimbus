import * as dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  Firestore,
  getFirestore,
} from 'firebase/firestore';
import {
  connectStorageEmulator,
  FirebaseStorage,
  getStorage,
} from 'firebase/storage';

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
let str;
if (process.env.NODE_ENV === 'development') {
  db = getFirestore();
  str = getStorage();
  // connectFirestoreEmulator(db, 'host.docker.internal', 8080);
  // connectStorageEmulator(db, 'host.docker.internal', 9199);
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(str, 'localhost', 9199);
} else {
  db = getFirestore(app);
  str = getStorage(app);
}

// export const firestore = admin.firestore();
export const firestore: Firestore = db;
export const storage: FirebaseStorage = str;
