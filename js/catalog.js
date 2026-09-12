import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebase-config.js";

import {
  MAIN_CATEGORIES,
  PRODUCT_TAGS,
  normalizeCategory,
  normalizeTags,
  getCategoryLabel,
  getTagLabel
} from "./catalog-config.js";


const catalogGrid = document.querySelector("#catalog-grid");
const categoryNav = document.querySelector("#category-nav");


const FILTERS = [
  {
    type: "all",
    value: "all",
    label: "Tümü"
  },

  ...MAIN_CATEGORIES.map((category) => ({
    type: "category",
    value: category.slug,
    label: category.label
  })),

  ...PRODUCT_TAGS.map((tag) => ({
    type: "tag",
    value: tag.slug,
    label: tag.label
  }))
];


let products = [];
let activeFilter = FILTERS[0];


function isAllowedCloudinaryImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.includes("/image/upload/")
    );

  } catch {
    return false;
  }
}


function formatPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "";
  }

  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(number);
}


function getProductDate(product) {
  if (!product?.createdAt) {
    return 0;
  }

  if (typeof product.createdAt.toMillis === "function") {
    return product.createdAt.toMillis();
  }

  if (product.createdAt.seconds) {
    return product.createdAt.seconds * 1000;
  }

  if (product.createdAt instanceof Date) {
    return product.createdAt.getTime();
  }

  const parsed = Date.parse(product.createdAt);

  return Number.isNaN(parsed) ? 0 : parsed;
}


function createElement(tag, className, text = "") {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text) {
    element.textContent = text;
  }

  return element;
}


function createProductCard(product) {

  const card = createElement("article", "product-card");


  /* IMAGE */

  const imageWrap = createElement(
    "div",
    "product-image-wrap"
  );


  if (isAllowedCloudinaryImageUrl(product.imageUrl)) {

    const image = document.createElement("img");

    image.className = "product-image";

    image.src = product.imageUrl;

    image.alt =
      product.name ||
      "Güneş Aksesuar & Parfüm ürün görseli";

    image.loading = "lazy";

    image.decoding = "async";


    image.addEventListener("error", () => {

      image.remove();

      imageWrap.appendChild(
        createElement(
          "div",
          "photo-placeholder",
          "Ürün görseli yüklenemedi."
        )
      );

    });


    imageWrap.appendChild(image);

  } else {

    imageWrap.appendChild(
      createElement(
        "div",
        "photo-placeholder",
        "Görsel bulunmuyor."
      )
    );

  }


  card.appendChild(imageWrap);


  /* INFO */

  const info = createElement(
    "div",
    "product-info"
  );


  /* CATEGORY */

  const category =
    normalizeCategory(product.category);


  if (category) {

    info.appendChild(
      createElement(
        "div",
        "product-category",
        getCategoryLabel(category)
      )
    );

  }


  /* TAG BADGES */

  const tags =
    normalizeTags(product.tags);


  if (tags.length) {

    const badges =
      createElement(
        "div",
        "product-badges"
      );


    tags.forEach((tag) => {

      const label =
        getTagLabel(tag);


      if (!label) {
        return;
      }


      badges.appendChild(
        createElement(
          "span",
          "product-badge",
          label
        )
      );

    });


    if (badges.children.length) {
      info.appendChild(badges);
    }

  }


  /* TITLE */

  const title =
    createElement(
      "h3",
      "product-title",
      product.name ||
      "İsimsiz ürün"
    );


  info.appendChild(title);


  /* DESCRIPTION */

  if (product.description) {

    info.appendChild(
      createElement(
        "p",
        "product-description",
        product.description
      )
    );

  }


  /* PRICE */

  const price =
    formatPrice(product.price);


  if (price) {

    info.appendChild(
      createElement(
        "div",
        "product-price",
        price
      )
    );

  }


  /* WHATSAPP */

  const actions =
    createElement(
      "div",
      "product-actions"
    );


  const whatsappMessage =
    encodeURIComponent(
      `Merhaba, "${product.name || "ürün"}" hakkında bilgi almak istiyorum.`
    );


  const whatsappLink =
    document.createElement("a");


  whatsappLink.className =
    "whatsapp-btn";


  whatsappLink.href =
    `https://wa.me/905524084122?text=${whatsappMessage}`;


  whatsappLink.target =
    "_blank";


  whatsappLink.rel =
    "noopener noreferrer";


  whatsappLink.textContent =
    "WhatsApp'tan Bilgi Al";


  actions.appendChild(
    whatsappLink
  );


  info.appendChild(
    actions
  );


  card.appendChild(
    info
  );


  return card;
}


function matchesFilter(product) {

  if (activeFilter.type === "all") {
    return true;
  }


  if (activeFilter.type === "category") {

    return (
      normalizeCategory(product.category) ===
      activeFilter.value
    );

  }


  if (activeFilter.type === "tag") {

    return normalizeTags(
      product.tags
    ).includes(
      activeFilter.value
    );

  }


  return true;
}


function renderProducts() {

  if (!catalogGrid) {
    return;
  }


  catalogGrid.replaceChildren();


  const filteredProducts =
    products
      .filter(matchesFilter)
      .sort((a, b) => {

        const dateDifference =
          getProductDate(b) -
          getProductDate(a);


        if (dateDifference !== 0) {
          return dateDifference;
        }


        return String(
          a.name || ""
        ).localeCompare(
          String(b.name || ""),
          "tr"
        );

      });


  if (!filteredProducts.length) {

    catalogGrid.appendChild(
      createElement(
        "div",
        "empty-note",
        "Bu bölümde henüz ürün yok."
      )
    );

    return;
  }


  const fragment =
    document.createDocumentFragment();


  filteredProducts.forEach((product) => {

    fragment.appendChild(
      createProductCard(product)
    );

  });


  catalogGrid.appendChild(
    fragment
  );
}


function renderTabs() {

  if (!categoryNav) {
    return;
  }


  categoryNav.replaceChildren();


  const wrap =
    document.createElement("div");


  wrap.className =
    "category-nav-inner wrap";


  const fragment =
    document.createDocumentFragment();


  FILTERS.forEach((filter) => {

    const button =
      document.createElement("button");


    button.type = "button";

    button.className = "tab";


    button.dataset.filterType =
      filter.type;


    button.textContent =
      filter.label;


    button.setAttribute(
      "aria-pressed",
      String(
        filter.type === activeFilter.type &&
        filter.value === activeFilter.value
      )
    );


    if (
      filter.type === activeFilter.type &&
      filter.value === activeFilter.value
    ) {

      button.classList.add(
        "active"
      );

    }


    button.addEventListener(
      "click",
      () => {

        activeFilter =
          filter;

        renderTabs();

        renderProducts();

      }
    );


    fragment.appendChild(
      button
    );

  });


  wrap.appendChild(
    fragment
  );


  categoryNav.appendChild(
    wrap
  );
}


/* INITIAL */

renderTabs();

renderProducts();


/* FIRESTORE */

onSnapshot(
  collection(db, "products"),

  (snapshot) => {

    products =
      snapshot.docs.map(
        (doc) => ({
          id: doc.id,
          ...doc.data()
        })
      );


    renderProducts();

  },

  (error) => {

    console.error(
      "Ürünler yüklenemedi:",
      error
    );


    if (catalogGrid) {

      catalogGrid.replaceChildren();

      catalogGrid.appendChild(
        createElement(
          "div",
          "error-state",
          "Ürünler yüklenirken bir sorun oluştu. Lütfen sayfayı yenileyin."
        )
      );

    }

  }
);
