import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  MAIN_CATEGORIES,
  PRODUCT_COLLECTIONS,
  getCreatedAtMillis,
  isAllowedCloudinaryImageUrl,
  normalizeCategory,
  normalizeTags,
} from "./catalog-config.js";

// WhatsApp numaranı ülke koduyla, boşluksuz gir. Örnek: Türkiye için 90 ile başlar.
const WHATSAPP_NUMBER = "905524084122";

const FILTERS = [
  { type: "all", value: "all", label: "Tümü" },
  ...MAIN_CATEGORIES.map((category) => ({
    type: "category",
    value: category.value,
    label: category.label,
  })),
  ...PRODUCT_COLLECTIONS.map((tag) => ({
    type: "tag",
    value: tag.value,
    label: tag.label,
  })),
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let allProducts = [];
let activeFilter = FILTERS[0];

const grid = document.getElementById("product-grid");
const emptyState = document.getElementById("empty-state");
const tabsContainer = document.getElementById("category-tabs");

function sortProducts(products) {
  return [...products].sort((a, b) => {
    const dateDiff = getCreatedAtMillis(b) - getCreatedAtMillis(a);
    if (dateDiff !== 0) {
      return dateDiff;
    }

    return String(a.name || "").localeCompare(String(b.name || ""), "tr");
  });
}

function showGridMessage(message, className = "error-state") {
  grid.replaceChildren();
  const note = document.createElement("p");
  note.className = className;
  note.textContent = message;
  grid.appendChild(note);
}

function productMatchesFilter(product) {
  if (activeFilter.type === "all") {
    return true;
  }

  if (activeFilter.type === "category") {
    return normalizeCategory(product.category) === activeFilter.value;
  }

  return normalizeTags(product.tags).includes(activeFilter.value);
}

function renderTabs() {
  tabsContainer.replaceChildren();

  FILTERS.forEach((filter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab";
    button.textContent = filter.label;
    button.dataset.filterType = filter.type;
    button.dataset.filterValue = filter.value;

    if (filter.type === activeFilter.type && filter.value === activeFilter.value) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      activeFilter = filter;
      renderTabs();
      renderProducts();
    });

    tabsContainer.appendChild(button);
  });
}

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";

  const photo = document.createElement("div");
  photo.className = "product-photo";

  if (isAllowedCloudinaryImageUrl(product.imageUrl)) {
    const image = document.createElement("img");
    image.src = product.imageUrl;
    image.alt = product.name || "Ürün fotoğrafı";
    image.loading = "lazy";
    photo.appendChild(image);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "photo-placeholder";
    placeholder.textContent = "Fotoğraf yok";
    photo.appendChild(placeholder);
  }

  const body = document.createElement("div");
  body.className = "product-body";

  const title = document.createElement("h3");
  title.textContent = product.name || "İsimsiz ürün";
  body.appendChild(title);

  if (product.description) {
    const description = document.createElement("p");
    description.className = "product-desc";
    description.textContent = product.description;
    body.appendChild(description);
  }

  if (product.price) {
    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent = product.price;
    body.appendChild(price);
  }

  const message = encodeURIComponent(
    `Merhaba, "${product.name || "bu ürün"}" ürünü hakkında bilgi almak istiyorum.`
  );
  const button = document.createElement("a");
  button.className = "whatsapp-btn";
  button.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
  button.target = "_blank";
  button.rel = "noopener";
  button.textContent = "WhatsApp'tan Sipariş Ver";
  body.appendChild(button);

  card.append(photo, body);
  return card;
}

function renderProducts() {
  const filtered = allProducts.filter(productMatchesFilter);

  grid.replaceChildren();

  if (filtered.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  filtered.forEach((product) => {
    grid.appendChild(createProductCard(product));
  });
}

renderTabs();

try {
  onSnapshot(
    collection(db, "products"),
    (snapshot) => {
      allProducts = sortProducts(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
      renderProducts();
    },
    (err) => {
      console.error("Firestore ürün listeleme hatası:", err);
      emptyState.hidden = true;
      showGridMessage("Ürünler yüklenemedi. Lütfen daha sonra tekrar deneyin.");
    }
  );
} catch (err) {
  console.error("Firebase başlatma hatası:", err);
  emptyState.hidden = true;
  showGridMessage("Site henüz kurulum aşamasında. Firebase ayarlarını kontrol edin.");
}
