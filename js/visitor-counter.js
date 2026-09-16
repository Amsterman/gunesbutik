import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  increment,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig, "gunespariltisi-counter");
const db = getFirestore(app);

function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function countOnceToday() {
  const dateKey = getDateKey();
  const localKey = `gunespariltisi_counted_${dateKey}`;

  // Aynı tarayıcı aynı gün içinde tekrar sayılmaz.
  if (localStorage.getItem(localKey) === "1") return;

  // Sunucuya ziyaretçi kimliği, IP, user-agent veya isim gönderilmez.
  localStorage.setItem(localKey, "1");

  try {
    await setDoc(
      doc(db, "visitorStats", dateKey),
      {
        dateKey,
        count: increment(1),
      },
      { merge: true }
    );
  } catch (error) {
    localStorage.removeItem(localKey);
    console.warn("Ziyaret sayacı kaydı yapılamadı:", error);
  }
}

countOnceToday().catch((error) => {
  console.warn("Ziyaret sayacı hatası:", error);
});
