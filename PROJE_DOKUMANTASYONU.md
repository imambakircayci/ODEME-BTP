# 📘 BTP Vendor Dashboard - Teknik Dökümantasyon

## 1. Proje Özeti
Bu proje, SAP BTP (Business Technology Platform) üzerinde çalışan, SAP On-Premise (Yerel Sunucu) sistemindeki satıcı (vendor) açık kalem verilerini canlı olarak çeken ve modern bir ön yüzle (Dashboard) sunan bir Cloud Application Programming Model (CAP) projesidir.

---

## 2. Mimari ve Bağlantı Yapısı (VPN Gerekmez!)

Bu proje **Cloud Connector** teknolojisi kullandığı için, klasik VPN kurulumlarına ihtiyaç duymaz.

### 🔄 Veri Akış Şeması
1. **Kullanıcı (UI):** Tarayıcıdan uygulamaya girer.
2. **AppRouter:** BTP üzerindeki bu servis, gelen isteği karşılar ve kullanıcının oturum açmış olup olmadığını kontrol eder (XSUAA).
3. **CAP Service (Node.js):** İş mantığının döndüğü yerdir. UI'dan gelen isteği alır, SAP'ye uygun formata (OData) çevirir.
4. **Destination Service:** `EXTERNAL_ONPREM_API` isimli hedefin özelliklerini (URL, Kullanıcı Adı, Şifre) okur.
5. **Connectivity Service:** BTP ile şirket sunucusu arasındaki güvenli tüneli tetikler.
6. **Cloud Connector:** Şirket sunucusuna kurulu olan bu ajan yazılım, BTP'den gelen isteği yakalar ve yerel SAP sistemine iletir.
7. **SAP On-Premise:** OData servisini (`FAP_VENDOR_LINE_ITEMS_SRV`) çalıştırır ve veriyi döndürür.

---

## 3. Teknik Detaylar

### 🛠 Kullanılan Teknolojiler
*   **Framework:** SAP CAP (Cloud Application Programming Model) - Node.js
*   **Veri İletişimi:** SAP Cloud SDK (`executeHttpRequest`)
*   **Bağlantı:** SAP Cloud Connector & Connectivity Service
*   **Frontend:** Vanilla JS, CSS3 (Modern Dashboard Tasarımı)
*   **Veritabanı:** SAP S/4HANA (Source System)

### 🔐 Güvenlik
*   **Authentication:** Basic Auth (Servis seviyesinde), OAuth2 (BTP seviyesinde)
*   **Tunneling:** TLS şifreli güvenli tünel (Reverse Proxy)
*   **Principal Type:** `None` (Servis kullanıcısı ile teknik bağlantı)

---

## 4. Uygulamaya Erişim

Müşteriler veya son kullanıcılar uygulamaya iki şekilde erişebilir:

### Yöntem A: Direkt Web Linki
Uygulamanın dağıtıldığı (Deploy) URL üzerinden doğrudan erişim.
*   **URL:** `https://<subaccount>-dev-btp-api-approuter.cfapps.us10-001.hana.ondemand.com/webapp/index.html`

### Yöntem B: SAP Build Work Zone (Launchpad)
Uygulama, SAP Fiori Launchpad (Work Zone) içerisine bir "Tile" olarak entegre edilebilir. Böylece kullanıcılar tek bir giriş noktasından tüm şirket uygulamalarına erişebilir.

---

## 5. Sorun Giderme (Troubleshooting)

Eğer veri gelmezse kontrol edilecek noktalar:

1.  **Cloud Connector:**
    *   Durumu "Connected" mı?
    *   Virtual Host (`sap-test-sanal`) ile Internal Host eşleşmesi doğru mu?
    *   Resource (`/sap/opu/odata/...`) erişimine izin verilmiş mi?

2.  **BTP Destination:**
    *   BTP Cockpit -> Destinations -> `EXTERNAL_ONPREM_API`
    *   "Check Connection" butonu 200 OK dönüyor mu?
    *   URL'de alt çizgi (`_`) yerine tire (`-`) kullanıldı mı? (`http://sap-test-sanal:8000`)

3.  **SAP Kullanıcısı:**
    *   `xgo_abap_3` kullanıcısının şifresi değişti mi?
    *   Kullanıcının OData servisini çağırma yetkisi var mı?

---

## 6. Geliştirme Notları

*   **Mapping:** SAP'den dönen alan adları (örn: `LIFNR`, `Vendor`) ile UI'daki alan adları (`Supplier`) backend servisinde (`vendor-service.js`) otomatik olarak eşleştirilir.
*   **Hata Logları:** `cf logs btp-api-srv --recent` komutu ile detaylı hata analizi yapılabilir.
