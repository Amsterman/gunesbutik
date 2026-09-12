import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Fotoğraflar Cloudinary'de tutulur (kredi kartı istemeyen ücretsiz servis).
// Bu iki değeri README.md'deki adımları izleyerek kendi Cloudinary hesabından alacaksın.
const CLOUDINARY_CLOUD_NAME = "BURAYA_CLOUD_NAME";
const CLOUDINARY_UPLOAD_PRESET = "BURAYA_UPLOAD_PRESET";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error("Fotoğraf yüklenemedi");
  const data = await res.json();
  return data.secure_url;
}

const loginSection = document.getElementById("login-section");
const panelSection = document.getElementById("panel-section");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");

const productForm = document.getElementById("product-form");
const productList = document.getElementById("product-list");
const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

let editingId = null;
let unsubscribeList = null;

function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (s) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[s]));
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginSection.hidden = true;
    panelSection.hidden = false;
    listenProducts();
  } else {
    loginSection.hidden = false;
    panelSection.hidden = true;
    if (unsubscribeList) unsubscribeList();
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error(err);
    loginError.textContent = "Giriş başarısız. E-posta veya şifreni kontrol et.";
    loginError.hidden = false;
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

function listenProducts() {
  const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
  unsubscribeList = onSnapshot(q, (snap) => {
    const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderList(products);
  });
}

function renderList(products) {
  productList.innerHTML = "";
  if (products.length === 0) {
    productList.innerHTML = `<p class="empty-note">Henüz ürün eklenmedi. Soldaki formdan ilk ürününü ekleyebilirsin.</p>`;
    return;
  }
  products.forEach((p) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <img src="${p.imageUrl || ""}" alt="" class="admin-thumb">
      <div class="admin-row-info">
        <strong>${escapeHtml(p.name)}</strong>
        <span>${p.category === "parfum" ? "Parfüm" : "Aksesuar"}${p.price ? " · " + escapeHtml(p.price) : ""}</span>
      </div>
      <div class="admin-row-actions">
        <button type="button" class="edit-btn">Düzenle</button>
        <button type="button" class="delete-btn">Sil</button>
      </div>
    `;
    row.querySelector(".edit-btn").addEventListener("click", () => startEdit(p));
    row.querySelector(".delete-btn").addEventListener("click", () => removeProduct(p));
    productList.appendChild(row);
  });
}

function startEdit(p) {
  editingId = p.id;
  formTitle.textContent = "Ürünü Düzenle";
  productForm.name.value = p.name || "";
  productForm.category.value = p.category || "parfum";
  productForm.price.value = p.price || "";
  productForm.description.value = p.description || "";
  submitBtn.textContent = "Değişiklikleri Kaydet";
  cancelEditBtn.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  productForm.reset();
  formTitle.textContent = "Yeni Ürün Ekle";
  submitBtn.textContent = "Ürünü Ekle";
  cancelEditBtn.hidden = true;
}

cancelEditBtn.addEventListener("click", resetForm);

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  const originalLabel = submitBtn.textContent;
  submitBtn.textContent = "Kaydediliyor...";

  try {
    const name = productForm.name.value.trim();
    const category = productForm.category.value;
    const price = productForm.price.value.trim();
    const description = productForm.description.value.trim();
    const file = productForm.image.files[0];

    let imageUrl = null;
    if (file) {
      imageUrl = await uploadImage(file);
    }

    if (editingId) {
      const updateData = { name, category, price, description };
      if (imageUrl) updateData.imageUrl = imageUrl;
      await updateDoc(doc(db, "products", editingId), updateData);
    } else {
      await addDoc(collection(db, "products"), {
        name,
        category,
        price,
        description,
        imageUrl: imageUrl || null,
        createdAt: serverTimestamp(),
      });
    }
    resetForm();
  } catch (err) {
    console.error(err);
    alert("Bir hata oluştu, lütfen tekrar dene.");
    submitBtn.textContent = originalLabel;
  } finally {
    submitBtn.disabled = false;
  }
});

async function removeProduct(p) {
  if (!confirm(`"${p.name}" ürününü silmek istediğine emin misin?`)) return;
  try {
    await deleteDoc(doc(db, "products", p.id));
  } catch (err) {
    console.error(err);
    alert("Silinemedi, lütfen tekrar dene.");
  }
}
