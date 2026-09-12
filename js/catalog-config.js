export const MAIN_CATEGORIES = [
  { value: "yuz-makyaji", label: "Yüz Makyajı" },
  { value: "goz-makyaji", label: "Göz Makyajı" },
  { value: "dudak-makyaji", label: "Dudak Makyajı" },
  { value: "makyaj-aksesuarlari", label: "Makyaj Aksesuarları", aliases: ["aksesuar"] },
  { value: "parfum", label: "Parfüm" },
  { value: "cilt-bakimi", label: "Cilt Bakımı" },
  { value: "hediyelik-kampanyalar", label: "Hediyelik & Kampanyalar" },
  { value: "saat", label: "Saat" },
];

export const PRODUCT_COLLECTIONS = [
  { value: "cok-satanlar", label: "Çok Satanlar" },
  { value: "yeni-gelenler", label: "Yeni Gelenler" },
  { value: "indirimdekiler", label: "İndirimdekiler" },
  { value: "avantajli-setler", label: "Avantajlı Setler" },
  { value: "hediye-setleri", label: "Hediye Setleri" },
];

const categoryByValue = new Map();
const categoryAliasToValue = new Map();
const collectionByValue = new Map(PRODUCT_COLLECTIONS.map((tag) => [tag.value, tag]));

MAIN_CATEGORIES.forEach((category) => {
  categoryByValue.set(category.value, category);
  categoryAliasToValue.set(category.value, category.value);
  (category.aliases || []).forEach((alias) => categoryAliasToValue.set(alias, category.value));
});

export function normalizeCategory(value) {
  return categoryAliasToValue.get(value) || "parfum";
}

export function getCategoryLabel(value) {
  return categoryByValue.get(normalizeCategory(value))?.label || "Parfüm";
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .filter((tag) => typeof tag === "string" && collectionByValue.has(tag))
    .filter((tag, index, list) => list.indexOf(tag) === index);
}

export function getTagLabel(value) {
  return collectionByValue.get(value)?.label || "";
}

export function isAllowedCloudinaryImageUrl(url) {
  if (typeof url !== "string" || !url.trim()) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "res.cloudinary.com" &&
      parsed.pathname.startsWith("/y7qynhph/image/upload/")
    );
  } catch {
    return false;
  }
}

export function getCreatedAtMillis(product) {
  const createdAt = product?.createdAt;

  if (createdAt?.toMillis) {
    return createdAt.toMillis();
  }

  if (createdAt?.seconds) {
    return createdAt.seconds * 1000;
  }

  return 0;
}
export const PRODUCT_TAGS = PRODUCT_COLLECTIONS;
