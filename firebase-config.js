// ---------- Firebase configuration ----------
// These values are public client identifiers (not secrets) and are meant
// to be embedded in the front-end. Access is restricted via Realtime
// Database security rules, not by hiding this config.

const firebaseConfig = {
  apiKey: "AIzaSyBDSvBKae556ObWMgs0bVJ267SstCHHAUQ",
  authDomain: "tui72d3dlcuixfncdhfzh5039rencj.firebaseapp.com",
  databaseURL: "https://tui72d3dlcuixfncdhfzh5039rencj-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "tui72d3dlcuixfncdhfzh5039rencj",
  storageBucket: "tui72d3dlcuixfncdhfzh5039rencj.firebasestorage.app",
  messagingSenderId: "264843382284",
  appId: "1:264843382284:web:4497ac46b12614fc8c6829"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
