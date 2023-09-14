// Import the functions you need from the SDKs you need
const { initializeApp } = require("firebase/app");
const { getAuth, GoogleAuthProvider } = require("firebase/auth");
const { getFirestore } = require("firebase/firestore");
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDlDFydOgbsI9VWidog191uyT67xqKj8TA",
  authDomain: "telegram-bot-9a2f8.firebaseapp.com",
  projectId: "telegram-bot-9a2f8",
  storageBucket: "telegram-bot-9a2f8.appspot.com",
  messagingSenderId: "242239164349",
  appId: "1:242239164349:web:cbb06b396ea4943fb80cd4",
  // apiKey: "AIzaSyA6ibAYZtgp574OQCB6_W97PbzYfJUYg9k",
  // authDomain: "test-bot-67863.firebaseapp.com",
  // projectId: "test-bot-67863",
  // storageBucket: "test-bot-67863.appspot.com",
  // messagingSenderId: "728089595770",
  // appId: "1:728089595770:web:68e219d63cb50984aa10c3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
module.exports = { auth, db, googleProvider };
