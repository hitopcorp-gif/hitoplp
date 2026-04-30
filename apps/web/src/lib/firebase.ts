import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
// CarBasicInfo の maxPower / maxTorque / tagline のような optional フィールドは
// 未入力時に undefined になるが、Firestore はデフォルトで undefined を拒否する。
// アプリ全体で「undefined はフィールド省略と同義」として扱いたいため有効化。
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true })
export const storage = getStorage(app)
