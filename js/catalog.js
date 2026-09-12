import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// WhatsApp numaranı ülke koduyla, boşluksuz gir. Örnek: Türkiye için 90 ile başlar.
const WHATSAPP_NUMBER = "905524084122";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let allProducts = [];
let activeCategory = "all";

const grid = document.getElementById("product-grid");
const emptyState = document.getElementById("empty-state");
const tabs = document.querySelectorAll(".tab");

function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (s) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[s]));
}

function renderProducts() {
  const filtered = activeCategory === "all"
    ? allProducts
    : allProducts.filter((p) => p.category === activeCategory);

  grid.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  filtered.forEach((p) => {
    const card = document.createElement("article");
    card.className = "product-card";

    const message = encodeURIComponent(`Merhaba, "${p.name}" ürünü hakkında bilgi almak istiyorum.`);

    card.innerHTML = `
      <div class="product-photo">
        ${p.imageUrl
          ? `<img src="${p.imageUrl}" alt="${escapeHtml(p.name)}" loading="lazy">`
          : `<div class="photo-placeholder">Fotoğraf yok</div>`}
      </div>
      <div class="product-body">
        <h3>${escapeHtml(p.name)}</h3>
        ${p.description ? `<p class="product-desc">${escapeHtml(p.description)}</p>` : ""}
        ${p.price ? `<p class="product-price">${escapeHtml(p.price)}</p>` : ""}
        <a class="whatsapp-btn" href="https://wa.me/${WHATSAPP_NUMBER}?text=${message}" target="_blank" rel="noopener">
          WhatsApp'tan Sipariş Ver
        </a>
      </div>
    `;
    grid.appendChild(card);
  });
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    activeCategory = tab.dataset.category;
    renderProducts();
  });
});

try {
  const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
  onSnapshot(
    q,
    (snapshot) => {
      allProducts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderProducts();
    },
    (err) => {
      console.error(err);
      grid.innerHTML = `<p class="error-state">Ürünler yüklenemedi. Lütfen daha sonra tekrar deneyin.</p>`;
    }
  );
} catch (err) {
  console.error(err);
  grid.innerHTML = `<p class="error-state">Site henüz kurulum aşamasında. js/firebase-config.js dosyasını doldurmayı unutma.</p>`;
}
