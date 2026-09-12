```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

/*
 * ============================================================
 * CLOUDINARY AYARLARI
 * ============================================================
 *
 * Cloudinary panelindeki:
 * - Cloud name
 * - Unsigned Upload Preset
 *
 * bilgilerini buraya yaz.
 */
const CLOUDINARY_CLOUD_NAME = "y7qynhph";
const CLOUDINARY_UPLOAD_PRESET = "bdhcra0l";

/*
 * Güvenlik / kullanım sınırları
 */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ============================================================
   YARDIMCI FONKSİYONLAR
   ============================================================ */

function escapeHtml(str = "") {
  return String(str).replace(/[&<>\"']/g, (s) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[s]));
}

function getCloudinaryErrorMessage(data, response) {
  if (data?.error?.message) {
    return data.error.message;
  }

  if (response.status === 400) {
    return "Cloudinary yükleme isteğini kabul etmedi. Upload Preset ayarlarını kontrol et.";
  }

  if (response.status === 401) {
    return "Cloudinary kimlik doğrulama hatası.";
  }

  if (response.status === 403) {
    return "Cloudinary yükleme yetkisi reddedildi. Upload Preset'in Unsigned olduğundan emin ol.";
  }

  if (response.status === 413) {
    return "Fotoğraf çok büyük.";
  }

  return `Fotoğraf yüklenemedi. Sunucu kodu: ${response.status}`;
}

/* ============================================================
   CLOUDINARY FOTOĞRAF YÜKLEME
   ============================================================ */

async function uploadImage(file) {
  if (!file) {
    throw new Error("Fotoğraf seçilmedi.");
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(
      "Desteklenmeyen fotoğraf formatı. JPG, PNG, WEBP veya GIF kullan."
    );
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(
      "Fotoğraf çok büyük. Lütfen 10 MB'dan küçük bir fotoğraf seç."
    );
  }

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary ayarları eksik. Cloud name ve Upload Preset kontrol edilmeli."
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const uploadUrl =
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(
      CLOUDINARY_CLOUD_NAME
    )}/image/upload`;

  let response;

  try {
    response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    console.error("Cloudinary bağlantı hatası:", error);

    throw new Error(
      "Fotoğraf sunucusuna bağlanılamadı. İnternet bağlantını ve Cloudinary ayarlarını kontrol et."
    );
  }

  let data = null;

  try {
    data = await response.json();
  } catch (error) {
    console.error("Cloudinary JSON okunamadı:", error);
  }

  if (!response.ok) {
    console.error("Cloudinary hata cevabı:", data);

    throw new Error(
      getCloudinaryErrorMessage(data, response)
    );
  }

  if (!data?.secure_url) {
    console.error("Cloudinary beklenmeyen cevap:", data);

    throw new Error(
      "Fotoğraf yüklendi ancak Cloudinary fotoğraf adresini döndürmedi."
    );
  }

  return data.secure_url;
}

/* ============================================================
   DOM ELEMANLARI
   ============================================================ */

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

/* ============================================================
   AUTH
   ============================================================ */

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginSection.hidden = true;
    panelSection.hidden = false;
    listenProducts();
  } else {
    loginSection.hidden = false;
    panelSection.hidden = true;

    if (unsubscribeList) {
      unsubscribeList();
      unsubscribeList = null;
    }
  }
});

/* ============================================================
   GİRİŞ
   ============================================================ */

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  loginError.hidden = true;

  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error("Giriş hatası:", err);

    let message =
      "Giriş başarısız. E-posta veya şifreni kontrol et.";

    if (err.code === "auth/invalid-credential") {
      message = "E-posta veya şifre hatalı.";
    } else if (err.code === "auth/too-many-requests") {
      message =
        "Çok fazla başarısız giriş denemesi yapıldı. Bir süre sonra tekrar dene.";
    } else if (err.code === "auth/network-request-failed") {
      message =
        "İnternet bağlantısı nedeniyle giriş yapılamadı.";
    }

    loginError.textContent = message;
    loginError.hidden = false;
  }
});

/* ============================================================
   ÇIKIŞ
   ============================================================ */

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Çıkış hatası:", err);
  }
});

/* ============================================================
   ÜRÜNLERİ DİNLE
   ============================================================ */

function listenProducts() {
  if (unsubscribeList) {
    unsubscribeList();
  }

  const q = query(
    collection(db, "products"),
    orderBy("createdAt", "desc")
  );

  unsubscribeList = onSnapshot(
    q,
    (snap) => {
      const products = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      renderList(products);
    },
    (err) => {
      console.error("Firestore ürün listeleme hatası:", err);

      productList.innerHTML = `
        <p class="error-note">
          Ürünler yüklenemedi.
          Firestore bağlantısını ve güvenlik kurallarını kontrol et.
        </p>
      `;
    }
  );
}

/* ============================================================
   ÜRÜN LİSTESİ
   ============================================================ */

function renderList(products) {
  productList.innerHTML = "";

  if (products.length === 0) {
    productList.innerHTML = `
      <p class="empty-note">
        Henüz ürün eklenmedi. Soldaki formdan ilk ürününü ekleyebilirsin.
      </p>
    `;
    return;
  }

  products.forEach((p) => {
    const row = document.createElement("div");
    row.className = "admin-row";

    const imageUrl =
      typeof p.imageUrl === "string" &&
      /^https:\/\/res\.cloudinary\.com\//i.test(p.imageUrl)
        ? p.imageUrl
        : "";

    row.innerHTML = `
      ${
        imageUrl
          ? `<img
              src="${escapeHtml(imageUrl)}"
              alt=""
              class="admin-thumb"
              loading="lazy"
            >`
          : `<div class="admin-thumb"></div>`
      }

      <div class="admin-row-info">
        <strong>${escapeHtml(p.name || "İsimsiz ürün")}</strong>

        <span>
          ${
            p.category === "parfum"
              ? "Parfüm"
              : "Aksesuar"
          }

          ${
            p.price
              ? " · " + escapeHtml(p.price)
              : ""
          }
        </span>
      </div>

      <div class="admin-row-actions">
        <button type="button" class="edit-btn">
          Düzenle
        </button>

        <button type="button" class="delete-btn">
          Sil
        </button>
      </div>
    `;

    row
      .querySelector(".edit-btn")
      .addEventListener("click", () => startEdit(p));

    row
      .querySelector(".delete-btn")
      .addEventListener("click", () => removeProduct(p));

    productList.appendChild(row);
  });
}

/* ============================================================
   ÜRÜN DÜZENLEME
   ============================================================ */

function startEdit(p) {
  editingId = p.id;

  formTitle.textContent = "Ürünü Düzenle";

  productForm.name.value = p.name || "";
  productForm.category.value = p.category || "parfum";
  productForm.price.value = p.price || "";
  productForm.description.value = p.description || "";

  submitBtn.textContent = "Değişiklikleri Kaydet";
  cancelEditBtn.hidden = false;

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

/* ============================================================
   FORM SIFIRLAMA
   ============================================================ */

function resetForm() {
  editingId = null;

  productForm.reset();

  formTitle.textContent = "Yeni Ürün Ekle";
  submitBtn.textContent = "Ürünü Ekle";

  cancelEditBtn.hidden = true;
}

/* ============================================================
   DÜZENLEMEDEN VAZGEÇ
   ============================================================ */

cancelEditBtn.addEventListener("click", resetForm);

/* ============================================================
   ÜRÜN EKLE / GÜNCELLE
   ============================================================ */

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  submitBtn.disabled = true;

  const originalLabel = editingId
    ? "Değişiklikleri Kaydet"
    : "Ürünü Ekle";

  try {
    const name = productForm.name.value.trim();
    const category = productForm.category.value;
    const price = productForm.price.value.trim();
    const description = productForm.description.value.trim();
    const file = productForm.image.files[0];

    if (!name) {
      throw new Error("Ürün adı boş bırakılamaz.");
    }

    if (!category) {
      throw new Error("Lütfen ürün kategorisini seç.");
    }

    /*
     * FOTOĞRAF YÜKLEME
     */

    let imageUrl = null;

    if (file) {
      submitBtn.textContent = "Fotoğraf yükleniyor...";

      imageUrl = await uploadImage(file);
    }

    /*
     * ÜRÜNÜ GÜNCELLE
     */

    if (editingId) {
      submitBtn.textContent = "Ürün kaydediliyor...";

      const updateData = {
        name,
        category,
        price,
        description,
      };

      /*
       * Yeni fotoğraf seçilmişse değiştir.
       * Seçilmemişse mevcut fotoğraf korunur.
       */
      if (imageUrl) {
        updateData.imageUrl = imageUrl;
      }

      await updateDoc(
        doc(db, "products", editingId),
        updateData
      );
    }

    /*
     * YENİ ÜRÜN EKLE
     */

    else {
      submitBtn.textContent = "Ürün kaydediliyor...";

      await addDoc(
        collection(db, "products"),
        {
          name,
          category,
          price,
          description,
          imageUrl: imageUrl || null,
          createdAt: serverTimestamp(),
        }
      );
    }

    resetForm();

    /*
     * Kullanıcıya başarılı olduğunu bildir.
     */
    alert(
      editingId
        ? "Ürün başarıyla güncellendi."
        : "Ürün başarıyla eklendi."
    );

  } catch (err) {
    console.error("Ürün kaydetme hatası:", err);

    alert(
      `İşlem başarısız.\n\n${err.message || "Bilinmeyen bir hata oluştu."}`
    );

    submitBtn.textContent = originalLabel;

  } finally {
    submitBtn.disabled = false;
  }
});

/* ============================================================
   ÜRÜN SİL
   ============================================================ */

async function removeProduct(p) {
  const confirmed = confirm(
    `"${p.name || "Bu ürün"}" ürününü silmek istediğine emin misin?`
  );

  if (!confirmed) {
    return;
  }

  try {
    await deleteDoc(
      doc(db, "products", p.id)
    );
  } catch (err) {
    console.error("Ürün silme hatası:", err);

    alert(
      `Ürün silinemedi.\n\n${
        err.message || "Bilinmeyen bir hata oluştu."
      }`
    );
  }
}
```
