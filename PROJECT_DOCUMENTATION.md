# 📘 BTP Vendor Management & Settings - Proje Teknik Dokümantasyonu

Bu belge, SAP BTP (Business Technology Platform) üzerinde çalışan, HANA Cloud veritabanı kullanan ve modern bir arayüze sahip Vendor Management uygulamasının teknik mimarisini, çalışma mantığını ve veri akışını açıklar.

---

## 🏗️ 1. Mimari Genel Bakış
Uygulama, SAP'nin **Cloud Application Programming Model (CAP)** mimarisi üzerine kurulmuştur ve Cloud Foundry ortamında çalışır.

### Bileşenler:
1.  **Veritabanı Katmanı (DB):** SAP HANA Cloud (HDI Container).
2.  **Servis Katmanı (SRV):** Node.js tabanlı CAP Servisi (OData V4).
3.  **Arayüz Katmanı (APP):** AppRouter ve HTML5/JS Frontend.
4.  **Güvenlik (XSUAA):** SAP BTP Authentication Service.

```mermaid
[Kullanıcı] -> [AppRouter] -> [XSUAA (Yetki)] -> [CAP Servisi (Node.js)] -> [HANA Cloud (DB)]
```

---

## 🛠️ 2. Modüller ve Görevleri

### A. Veritabanı Modülü (`/db`)
HANA Cloud üzerinde tabloların ve ilişkilerin tanımlandığı yerdir.
- **Teknoloji:** SAP CDS (Core Data Services), `.hdbtable`
- **Dosya:** `db/schema.cds`
- **Ana Tablolar:**
    - `ApproverGroups`: Onaycı departman tanımları (Muhasebe, Finans vb.)
    - `ApproverUsers`: Gruplara bağlı kullanıcılar. `Group_GroupCode` üzerinden ana tabloya bağlanır.
- **Deploy:** `cds build` komutu ile `.hdbtable` dosyalarına dönüşür ve `btp-api-db-deployer` uygulaması tarafından HANA'ya basılır.

### B. Servis Modülü (`/srv`)
Backend mantığının çalıştığı yerdir. Veritabanını dış dünyaya **OData V4** API olarak açar.
- **Teknoloji:** Node.js, Express, `@sap/cds`
- **Dosya:** `srv/vendor-service.cds`
- **Özellikler:**
    - **Yetkilendirme:** Sadece yetkili kullanıcıların erişmesi için XSUAA entegrasyonu vardır.
    - **Draft/CRUD:** OData protokolü sayesinde Create, Read, Update, Delete işlemleri otomatik yönetilir.
    - **Validasyon:** Gelen verilerin veri tipleri burada kontrol edilir.

### C. Frontend Modülü (`/app`)
Kullanıcının etkileşime girdiği arayüzdür.
- **Teknoloji:** Vanilla JS, HTML5, CSS (Modern Dark UI), `@sap/approuter`
- **Dosya:** `app/vendor-open-items/webapp/js/app.js`
- **Çalışma Mantığı:**
    - Uygulama açıldığında `fetch` API ile backend'den verileri çeker.
    - **SM30 Tarzı Editor:** Tanımlamalar sayfası, Excel benzeri bir UX sunar.
    - **Güvenlik:** Backend'e yazma işlemi yapmadan önce `x-csrf-token` alır.

---

## 🔄 3. Veri Akışı ve İşlem Adımları

Bir kullanıcı "Tanımlamalar" ekranında **Yeni Giriş** yapıp **Kaydet** butonuna bastığında arka planda şunlar olur:

1.  **Token Fetch:** Frontend, önce Backend'e boş bir `HEAD` isteği atar (`Fetch-CSRF-Token`).
2.  **Security Handshake:** Backend (XSUAA), kullanıcının oturumunu doğrular ve geçici bir **Token** üretip Header'da döner.
3.  **POST İsteği:** Frontend, formdaki veriyi JSON'a çevirir ve aldığı Token'ı Header'a ekleyerek `POST /api/vendor/ApproverGroups` adresine gönderir.
4.  **CAP İşleme:** Node.js servisi isteği alır, doğrular ve HANA veritabanına `INSERT` komutu gönderir.
5.  **HANA Kayıt:** Veri, disk üzerinde kalıcı olarak saklanır.
6.  **Yanıt:** Backend "201 Created" döner, Frontend kullanıcıya "Başarılı" mesajı gösterir.

---

## 🔐 4. Güvenlik ve Best Practices

Projede uygulanan en iyi yöntemler:
- **HDI Isolation:** Veritabanına doğrudan erişim yoktur, sadece servis üzerinden ve HDI Container kullanıcısı ile erişilir.
- **CSRF Koruması:** Siteler arası istek sahteciliğini önlemek için Token zorunluluğu vardır.
- **OData V4:** Endüstri standardı OData protokolü kullanılmıştır.
- **Environment Variables:** Veritabanı şifreleri kod içinde değil, BTP Environment değişkenlerinde tutulur (`VCAP_SERVICES`).

## 🚀 5. Nasıl Deploy Edilir?

1.  **Build:** `cds build --production` komutu ile kaynak kodlar (`.cds`) HANA ve Node.js için derlenir (`gen` klasörü oluşur).
2.  **Manifest:** `manifest.yaml` dosyası belleği (Memory) ve rotaları (Routes) belirler.
3.  **Push:** `cf push -f manifest.yaml` komutu ile:
    - Önce DB Deployer şemayı günceller.
    - Sonra Backend Servisi başlar.
    - En son AppRouter arayüzü yayına alır.

---
*Hazırlayan: Antigravity AI - 2026*
