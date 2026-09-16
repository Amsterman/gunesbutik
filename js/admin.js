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
  serverTimestamp,
  getDocs,

} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";
import {
  MAIN_CATEGORIES,
  PRODUCT_COLLECTIONS,
  getCategoryLabel,
  getCreatedAtMillis,
  getTagLabel,
  isAllowedCloudinaryImageUrl,
  normalizeCategory,
  normalizeTags,
} from "./catalog-config.js";

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

function setStatusMessage(message, className = "empty-note") {
  productList.replaceChildren();
  const note = document.createElement("p");
  note.className = className;
  note.textContent = message;
  productList.appendChild(note);
}

function sortProducts(products) {
  return [...products].sort((a, b) => {
    const dateDiff = getCreatedAtMillis(b) - getCreatedAtMillis(a);
    if (dateDiff !== 0) {
      return dateDiff;
    }

    return String(a.name || "").localeCompare(String(b.name || ""), "tr");
  });
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
const categorySelect = document.getElementById("p-category");
const tagOptions = document.getElementById("tag-options");

const statsToday = document.getElementById("stats-today");
const statsWeek = document.getElementById("stats-week");
const statsMonth = document.getElementById("stats-month");
const statsTotal = document.getElementById("stats-total");
const statsStatus = document.getElementById("stats-status");
const refreshStatsBtn = document.getElementById("refresh-stats-btn");
const statsStartDate = document.getElementById("stats-start-date");
const statsEndDate = document.getElementById("stats-end-date");
const statsQueryBtn = document.getElementById("stats-query-btn");
const statsClearBtn = document.getElementById("stats-clear-btn");
const statsRangeResult = document.getElementById("stats-range-result");
const statsRangeStatus = document.getElementById("stats-range-status");

let editingId = null;
let unsubscribeList = null;

/* ============================================================
   FORM SEÇENEKLERİ
   ============================================================ */

function renderCategoryOptions() {
  categorySelect.replaceChildren();

  MAIN_CATEGORIES.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.value;
    option.textContent = category.label;
    categorySelect.appendChild(option);
  });
}

function renderTagOptions() {
  tagOptions.replaceChildren();

  PRODUCT_COLLECTIONS.forEach((tag) => {
    const label = document.createElement("label");
    label.className = "tag-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "tags";
    checkbox.value = tag.value;

    const text = document.createElement("span");
    text.textContent = tag.label;

    label.append(checkbox, text);
    tagOptions.appendChild(label);
  });
}

function getSelectedTags() {
  return normalizeTags(
    Array.from(productForm.querySelectorAll('input[name="tags"]:checked'))
      .map((checkbox) => checkbox.value)
  );
}

function setSelectedTags(tags) {
  const selected = new Set(normalizeTags(tags));

  productForm.querySelectorAll('input[name="tags"]').forEach((checkbox) => {
    checkbox.checked = selected.has(checkbox.value);
  });
}

renderCategoryOptions();
renderTagOptions();

/* ============================================================
   AUTH
   ============================================================ */

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginSection.hidden = true;
    panelSection.hidden = false;
    listenProducts();
    loadVisitorStats();
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

  unsubscribeList = onSnapshot(
    collection(db, "products"),
    (snap) => {
      const products = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      renderList(sortProducts(products));
    },
    (err) => {
      console.error("Firestore ürün listeleme hatası:", err);
      setStatusMessage(
        "Ürünler yüklenemedi. Firestore bağlantısını ve güvenlik kurallarını kontrol et.",
        "error-note"
      );
    }
  );
}

/* ============================================================
   ÜRÜN LİSTESİ
   ============================================================ */

function renderList(products) {
  productList.replaceChildren();

  if (products.length === 0) {
    setStatusMessage(
      "Henüz ürün eklenmedi. Soldaki formdan ilk ürününü ekleyebilirsin."
    );
    return;
  }

  products.forEach((p) => {
    const row = document.createElement("div");
    row.className = "admin-row";

    const imageUrl = isAllowedCloudinaryImageUrl(p.imageUrl) ? p.imageUrl : "";

    if (imageUrl) {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = "";
      img.className = "admin-thumb";
      img.loading = "lazy";
      row.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "admin-thumb";
      row.appendChild(placeholder);
    }

    const info = document.createElement("div");
    info.className = "admin-row-info";

    const name = document.createElement("strong");
    name.textContent = p.name || "İsimsiz ürün";

    const meta = document.createElement("span");
    const tags = normalizeTags(p.tags)
      .map(getTagLabel)
      .filter(Boolean);
    meta.textContent = [
      getCategoryLabel(p.category),
      p.price || "",
      tags.length ? tags.join(", ") : "",
    ].filter(Boolean).join(" · ");

    info.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "admin-row-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "edit-btn";
    editButton.textContent = "Düzenle";
    editButton.addEventListener("click", () => startEdit(p));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "Sil";
    deleteButton.addEventListener("click", () => removeProduct(p));

    actions.append(editButton, deleteButton);
    row.append(info, actions);
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
  productForm.category.value = normalizeCategory(p.category);
  productForm.price.value = p.price || "";
  productForm.description.value = p.description || "";
  setSelectedTags(p.tags);

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
  setSelectedTags([]);

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

  const isEditing = Boolean(editingId);
  const originalLabel = isEditing
    ? "Değişiklikleri Kaydet"
    : "Ürünü Ekle";

  try {
    const name = productForm.name.value.trim();
    const category = normalizeCategory(productForm.category.value);
    const tags = getSelectedTags();
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

    if (isEditing) {
      submitBtn.textContent = "Ürün kaydediliyor...";

      const updateData = {
        name,
        category,
        tags,
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
          tags,
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
      isEditing
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
   ZİYARETÇİ İSTATİSTİKLERİ
   ============================================================ */

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftDateKey(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return getLocalDateKey(copy);
}

function sumStatsInRange(docs, startKey, endKey) {
  return docs.reduce((total, item) => {
    const data = item.data();
    const key = String(data.dateKey || item.id);
    const count = Number(data.count || 0);
    if (key >= startKey && key <= endKey) return total + (Number.isFinite(count) ? count : 0);
    return total;
  }, 0);
}

async function getAllVisitorStats() {
  const snapshot = await getDocs(collection(db, "visitorStats"));
  return snapshot.docs;
}

async function loadVisitorStats() {
  if (!statsToday || !statsWeek || !statsMonth || !statsTotal) return;

  statsStatus.textContent = "İstatistikler yükleniyor...";
  if (refreshStatsBtn) refreshStatsBtn.disabled = true;

  try {
    const now = new Date();
    const todayKey = getLocalDateKey(now);
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + mondayOffset);
    const weekStartKey = getLocalDateKey(weekStart);
    const monthStartKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const docs = await getAllVisitorStats();
    statsToday.textContent = String(sumStatsInRange(docs, todayKey, todayKey));
    statsWeek.textContent = String(sumStatsInRange(docs, weekStartKey, todayKey));
    statsMonth.textContent = String(sumStatsInRange(docs, monthStartKey, todayKey));
    statsTotal.textContent = String(sumStatsInRange(docs, "0000-01-01", "9999-12-31"));
    statsStatus.textContent = `Son güncelleme: ${new Date().toLocaleTimeString("tr-TR")}`;
  } catch (error) {
    console.error("Ziyaretçi istatistikleri yüklenemedi:", error);
    statsToday.textContent = "-";
    statsWeek.textContent = "-";
    statsMonth.textContent = "-";
    statsTotal.textContent = "-";
    statsStatus.textContent = "İstatistikler okunamadı. Firestore güvenlik kurallarını kontrol et.";
  } finally {
    if (refreshStatsBtn) refreshStatsBtn.disabled = false;
  }
}

async function queryVisitorStatsByDateRange() {
  if (!statsStartDate || !statsEndDate || !statsRangeResult || !statsRangeStatus) return;

  const startKey = statsStartDate.value;
  const endKey = statsEndDate.value;

  if (!startKey || !endKey) {
    statsRangeResult.textContent = "0";
    statsRangeStatus.textContent = "Lütfen başlangıç ve bitiş tarihini seç.";
    return;
  }

  if (startKey > endKey) {
    statsRangeResult.textContent = "0";
    statsRangeStatus.textContent = "Başlangıç tarihi, bitiş tarihinden sonra olamaz.";
    return;
  }

  statsRangeStatus.textContent = "Sorgulanıyor...";
  if (statsQueryBtn) statsQueryBtn.disabled = true;

  try {
    const docs = await getAllVisitorStats();
    const total = sumStatsInRange(docs, startKey, endKey);
    statsRangeResult.textContent = String(total);
    statsRangeStatus.textContent = `${startKey} – ${endKey} aralığı.`;
  } catch (error) {
    console.error("Tarih aralığı sorgusu başarısız:", error);
    statsRangeResult.textContent = "-";
    statsRangeStatus.textContent = "Sorgu yapılamadı. Firestore kurallarını kontrol et.";
  } finally {
    if (statsQueryBtn) statsQueryBtn.disabled = false;
  }
}

function clearVisitorStatsDateRange() {
  if (statsStartDate) statsStartDate.value = "";
  if (statsEndDate) statsEndDate.value = "";
  if (statsRangeResult) statsRangeResult.textContent = "0";
  if (statsRangeStatus) statsRangeStatus.textContent = "";
}

refreshStatsBtn?.addEventListener("click", loadVisitorStats);
statsQueryBtn?.addEventListener("click", queryVisitorStatsByDateRange);
statsClearBtn?.addEventListener("click", clearVisitorStatsDateRange);

/* ============================================================
   ÜRÜN SİL
   ============================================================ */

async function removeProduct(p) {
  const productName = p.name || "Bu ürün";
  const confirmed = confirm(
    `"${productName}" ürününü silmek istediğine emin misin?`
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
