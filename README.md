# Nefes Ev & Parfüm — Ürün Kataloğu + Yönetim Paneli

Bu site iki sayfadan oluşuyor:

- `index.html` → Müşterilerin gördüğü ürün kataloğu. Herkese açık, herkes görebilir.
- `admin.html` → Sadece senin/kız kardeşinin gireceği yönetim paneli. E-posta + şifre ile giriş yapılır, ürün eklenir/düzenlenir/silinir.

Site kendisi statik dosyalardan oluştuğu için **GitHub Pages'te ücretsiz** barınabiliyor. Ürünlerin saklandığı yer olarak da Google'ın **Firebase** servisini kullanıyoruz (küçük bir işletme için ücretsiz kotası fazlasıyla yeterli). Kredi kartı istemez, aylık ücret çıkmaz.

Kurulum toplam 15-20 dakika sürer, bir kere yapılır.

## 1. Firebase projesi oluştur

1. https://console.firebase.google.com adresine git, Google hesabınla gir.
2. "Add project" / "Proje ekle" de, bir isim ver (örn. `nefes-ev-parfum`), devam et.
3. Google Analytics sorusu çıkarsa kapatabilirsin, gerekli değil.

## 2. Giriş sistemini (Authentication) aç

1. Sol menüden **Build > Authentication** git, "Get started" de.
2. **Sign-in method** sekmesinde **Email/Password** seçeneğini aç (Enable).
3. **Users** sekmesine geç, "Add user" ile kendi/kız kardeşinin giriş yapacağı bir e-posta ve şifre oluştur. Bu bilgiler `admin.html` sayfasına girilecek.

## 3. Veritabanını (Firestore) aç

1. Sol menüden **Build > Firestore Database** git, "Create database" de.
2. Konum olarak sana yakın bir bölge seç (örn. `eur3` Avrupa), "Production mode" ile devam et.
3. Oluştuktan sonra **Rules** sekmesine git, aşağıdaki kuralları yapıştırıp **Publish** de:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Bu kural: ürünleri herkes görebilir, ama sadece giriş yapmış kişi ekleyip değiştirebilir demek.

## 4. Fotoğraf deposu için Cloudinary hesabı aç

Not: Firebase, Şubat 2026'dan itibaren fotoğraf depolama (Storage) için kredi kartı istiyor (kullanım yine ücretsiz kalsa da kart bağlamak gerekiyor). Kart vermeden ilerleyebilmek için fotoğrafları **Cloudinary** adlı, kart istemeyen ücretsiz bir serviste tutuyoruz.

1. https://cloudinary.com adresinden ücretsiz bir hesap aç (kredi kartı istemez).
2. Giriş yaptıktan sonra ana sayfada (Dashboard) üstte yazan **Cloud name** değerini not al.
3. Sağ üstteki dişli simgesine tıkla > **Settings > Upload** git.
4. "Upload presets" bölümünde **Add upload preset** de.
5. **Signing Mode** olarak **Unsigned** seç (bu, sitenin arka planda özel bir anahtar olmadan resim yükleyebilmesini sağlar). Kaydet ve oluşan preset adını not al.
6. Bu projedeki `js/admin.js` dosyasını aç, en üstlerdeki şu iki satırı kendi bilgilerinle değiştir:

```js
const CLOUDINARY_CLOUD_NAME = "BURAYA_CLOUD_NAME";
const CLOUDINARY_UPLOAD_PRESET = "BURAYA_UPLOAD_PRESET";
```

## 5. Web uygulaması bilgilerini al

1. Sol üstteki dişli simgesine tıkla > **Project settings**.
2. "Your apps" bölümünde `</>` (Web) simgesine tıkla, bir isim ver, "Register app" de.
3. Karşına çıkan `firebaseConfig` kod bloğunu kopyala.
4. Bu projedeki `js/firebase-config.js` dosyasını aç, içindeki `BURAYA_...` yazan yerleri kendi bilgilerinle değiştir.

## 6. WhatsApp numarasını gir

`js/catalog.js` dosyasının en üstünde şu satırı bul:

```js
const WHATSAPP_NUMBER = "905XXXXXXXXX";
```

Kendi WhatsApp numaranla değiştir. Türkiye için `90` ile başlar, başında `+` veya `0` olmadan, boşluksuz yaz. Örnek: `905301234567`.

İstersen `index.html` içindeki başlık, açıklama yazısı ve marka adını da (`Nefes Ev & Parfüm`) kendi işletme adınızla değiştirebilirsin.

## 7. GitHub Pages'e yükle

1. GitHub'da yeni bir repo oluştur (örn. `nefes-ev-parfum`), **public** olsun.
2. Bu klasördeki tüm dosyaları o repoya yükle (GitHub'ın web arayüzünden "Add file > Upload files" ile sürükle-bırak yapabilirsin, terminal bilmene gerek yok).
3. Repo içinde **Settings > Pages** git.
4. "Branch" olarak `main`, klasör olarak `/ (root)` seç, Save de.
5. Birkaç dakika sonra sana `https://kullaniciadi.github.io/repo-adi/` şeklinde bir link verecek. Bu senin canlı siten.
6. Yönetim paneline ulaşmak için linkin sonuna `admin.html` ekle: `https://kullaniciadi.github.io/repo-adi/admin.html`

## Kullanım

- Kız kardeşin `admin.html` linkine girer, e-posta/şifresiyle giriş yapar.
- Formu doldurup fotoğraf seçer, "Ürünü Ekle" der.
- Ürün anında `index.html` sayfasında görünür — sayfayı yeniden yayınlamaya gerek yok.
- Bir ürünü değiştirmek için listede "Düzenle", kaldırmak için "Sil" tuşuna basması yeterli.

## Bilinecekler / sınırlar

- `admin.html` linki herkese açık ama içeri sadece doğru e-posta/şifreyle girilebiliyor — bu linki başkalarıyla paylaşmayın.
- Firebase'in ücretsiz kotası (günlük ~50.000 okuma, 1GB veritabanı gibi) küçük bir katalog için bolca yeterli, kredi kartı istemez.
- Cloudinary'nin ücretsiz kotası da (aylık ~25GB depolama/trafik) küçük bir katalog için fazlasıyla yeterli, o da kredi kartı istemez.
- Bir ürünün fotoğrafını değiştirdiğinde eski fotoğraf Cloudinary'de silinmeden kalır (harcanan yer çok küçük olduğundan sorun yaratmaz, ama bilgi olsun).
- İleride "sepete ekle / online ödeme" istersen bu yapı üzerine eklenebilir, şimdilik WhatsApp'a yönlendiren basit bir katalog olarak kuruldu.
