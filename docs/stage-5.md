# Aşama 5 — Ek-16 başvuru ve belge sistemi

## Kullanım

1. Öğrenci hesabıyla **Ek-16 evrak yükle** sayfasını açın.
2. Kayıtlı profil bilgilerini kontrol edin; eksik alanları, işyeri ve yetkili bilgilerini girin.
3. Başlangıç/bitiş tarihlerini, yarıyılı ve haftalık çalışma günlerini seçin. Hesaplanan sayı ile belgede beyan edilen sayıyı kontrol edin.
4. Gerçek Ek-16 dosyasını seçip gönderin. Teslim tarihi sunucunun Türkiye tarihidir; geriye tarih verilemez.
5. Başvuru detayında belgeyi indirin/önizleyin, girilen alanları, tarih/gün ön raporunu ve geçmişi görüntüleyin.
6. Yönetici **Başvuru yönetimi** sayfasında başvuruyu açıp incelemeyi başlatabilir, manuel kontrolleri kaydedebilir ve gerekçe yazarak düzeltme isteyebilir.
7. Öğrenci yalnızca **Hatalı / Eksik** başvuruda formu ve belgeyi yeniden gönderebilir. Yeni belge güncel sürüm olur; eski dosya saklanır, manuel kontroller sıfırlanır.

Geliştirme sunucusu açıksa bu aşamadaki paket ve ortak modül değişiklikleri için yeniden başlatın: `npm.cmd run dev`. Kök komut ortak paketi önce derler.

## Kapsam

Öğrenci kimliği/iletişim/akademik bilgileri, sağlık statüsü, işyeri ve yetkili bilgileri, tarihler, hafta günleri, çalışan/mühendis sayıları, ücret ve yurt dışı bilgisi ayrı form alanlarıdır. Telefon, e-posta, tarih ve sayıların temel biçim doğrulaması istemci ve sunucuda Zod ile yapılır. Form React Hook Form kullanır.

Gerçek PDF ve Ek-16 DOCX çalışma klasöründe bulunmadığından kaynak belge incelemesi yapılamadı. Alanlar kullanıcının paylaştığı ayrıntılı listeden oluşturuldu. Formdaki verilerin belgeyle aynı olduğu iddia edilmez. OCR, metin çıkarımı veya otomatik imza/kaşe tanıma uygulanmadı.

Kapsamlı öğrenci veri eşleştirme, tüm doğrulama kuralları ve OOP doğrulama motoru **Aşama 6** kapsamındadır. Mevcut ValidationReport tarih, 30 günlük teslim aralığı ve beyan edilen/hesaplanan gün ön kontrollerini içerir; `engineComplete: false` saklanır. Bu nedenle **onay ve tamamlamaya geçiş kapalıdır**. Manuel kontroller tek başına onay sağlamaz.

## Gün hesabı ve kaynaklar

Başlangıç ve bitiş tarihleri dahil edilir. Seçilmeyen hafta günleri sayılmaz. Tam tatiller 1, yarım gün tatiller 0,5 düşülür; aynı güne gelen tatil iki kez düşülmez. Saat dilimi kaymalarını engellemek için gün döngüsü UTC takvim tarihleriyle çalışır. İşgünü hesabı hem istemcide anlık yapılır hem sunucuda yeniden hesaplanıp saklanır; istemcinin sonucu kabul edilmez.

Takvim verisi ayrı `packages/shared/src/holidays.ts` yapılandırmasındadır. 6 Kasım 2026 tarihinde doğrulanan resmî kaynaklar:

- [Diyanet 2026 resmî tatil listesi](https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=158)
- [Diyanet 2027 resmî tatil listesi](https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=159)

Şu anda yalnızca 2026 ve 2027 için kesin hesap yapılır. Kapsanmayan yıl varsa gün sayısı `null`, eksik yıl ve uyarı döner; doğru hesap yapılmış gibi sunulmaz. Böyle bir başvuru ön kontrol hatasıyla saklanabilir, onaylanamaz. Yurt dışı seçimi ülkeye özgü ayrı tatil takvimi seçmez; bu sürüm Türkiye takvimini uygular. Yarım günün staj kredisi olarak kabulü bölüm politikasına bağlıysa Aşama 6'da ayrıca kural tanımlanmalıdır; bu aşamada çalışma süresi eşdeğeri gösterilir.

## Belge saklama ve kontroller

- İzin verilen türler: PDF, DOC, DOCX, JPG/JPEG, PNG.
- `MAX_DOCUMENT_MB` varsayılanı 10; 1–20 MB arasında yapılandırılabilir.
- Uzantı ve bildirilen MIME eşleşmesi, dosya imzası ve türüne göre yapısal kontrol uygulanır.
- PDF parser ile açılır; şifreli/bozuk, etkin eylem veya gömülü içerik belirten dosyalar reddedilir. Bazı zararsız başlangıç eylemleri de bu sıkı kontrol nedeniyle reddedilebilir.
- DOCX arşiv girişleri ve gerçek açılmış boyutlar sınırlandırılır; makro, gömülü nesne, dış ilişki, özel XML entity gibi içerikler reddedilir. Bu nedenle dış hiperlink içeren bazı Word belgeleri de reddedilebilir.
- Legacy DOC için Word/FIB ve tablo akışı, şifre/makro/gömülü nesne belirtileri denetlenir; bu tam Word içerik doğrulaması değildir.
- Görseller Sharp ile tamamen decode edilir; 16 milyon piksel sınırı uygulanır. Orijinal dosya baytları korunur.
- Bunlar antivirüs taraması değildir; tüm zararlı içerikleri tespit etme garantisi verilmez. Üretimde ayrıca antivirüs/CDR ve izole dosya işleme servisi değerlendirilebilir.
- Dosyalar statik `public` ağacında sunulmaz. Varsayılan yol kök `storage/documents`; isteğe bağlı `PRIVATE_STORAGE_DIR` ile değiştirilebilir.
- Depolama anahtarı rastgele UUID'dir; orijinal ad yol olarak kullanılmaz. Metadata, SHA-256 ve sahiplik MongoDB'de saklanır; storageKey varsayılan sorgularda gizlidir.
- İndirme oturum ve sahiplik kontrolünden geçer, attachment ve `Cache-Control: no-store` ile döner. Öğrenci başka öğrencinin dosyasına erişemez.
- Görsel/PDF için önizleme, Word için indirme sunulur. PDF tarayıcı sandbox kısıtlaması nedeniyle görünmezse indirme seçeneği kullanılabilir.

Başvuru, belge metadata'sı, rapor ve audit kaydı MongoDB transaction'ında yazılır. Dosya önce özel dizine yazılır; başarısız transaction'da referans bulunmadığı doğrulanırsa temizlenir. Disk ve veritabanı birlikte atomik değildir: süreç çökmesi veya belirsiz bağlantı hatasında sahipsiz dosya kalabilir. Otomatik sahipsiz dosya temizleme ve dosya/DB yedekleme bu aşamada yoktur. Şüpheli commit durumunda mevcut kaydın belgesini silmemek için dosya korunur.

## Durumlar ve erişim

`InternshipApplication` sınıfı izin verilen geçişleri kapsüller: UPLOADED → UNDER_REVIEW → INVALID → UPLOADED; UNDER_REVIEW → APPROVED → COMPLETED yalnızca kapsamlı doğrulamalar ve manuel kontroller hazırsa mümkündür.

Durum ve manuel kontrol güncellemeleri sürüm koşuluyla yapılır; eşzamanlı değişiklik 409 üretir. Yönetici güncellemeleri audit kaydıyla aynı transaction'dadır. Öğrenci güncellemeleri yalnızca kendi INVALID başvurusuna izin verir; tamamlanmış/onaylı/incelemedeki/yeni yüklenmiş başvuru değiştirilemez. Silme endpointi yoktur.

## API

| Metot | Yol | İşlev |
|---|---|---|
| GET | `/api/v1/applications/calendar` | Desteklenen yıllar ve dosya sınırı |
| POST | `/api/v1/applications/calculate-days` | Sunucu gün hesabı |
| POST | `/api/v1/applications` | Multipart `data` JSON + `file` ile yeni öğrenci başvurusu |
| POST | `/api/v1/applications/:id/documents` | INVALID başvuru için tam form + yeni belge |
| GET | `/api/v1/students/me/applications` | Öğrencinin sayfalı listesi |
| GET | `/api/v1/students/me/dashboard` | Gerçek başvuru sayıları ve son belge |
| GET | `/api/v1/applications/:id` | Sahiplik kontrollü detay |
| GET | `/api/v1/applications/:id/report` | Ön kontrol raporu |
| GET | `/api/v1/admin/applications` | Yönetici listesi ve durum filtresi |
| GET | `/api/v1/admin/applications/completed` | Tamamlananlar |
| GET | `/api/v1/admin/applications/:id` | Yönetici detayı |
| PATCH | `/api/v1/admin/applications/:id/status` | Kurallı durum geçişi |
| POST | `/api/v1/admin/applications/:id/review` | Manuel kontrol kaydı |
| GET | `/api/v1/documents/:id/download` | Özel belge indirme |

## Doğrulama

6 Kasım 2026: 8 arayüz testi ve 30 yerel backend testi başarılı. Ayrı Atlas veritabanındaki canlı başvuru senaryosu başarılı; oluşturulan dosya ve kayıtlar temizlendi. Üretim derlemesi ve TypeScript kontrolleri başarılı. Son bağımlılık kurulum denetimi 0 açık bildirdi.

Yerel testler gün hesabı, yarım tatil, çakışan tatil, eksik takvim, durum geçişi, PDF/Word/görsel yapı denetimleri ve formdaki anlık hesabı kapsar. Canlı senaryo ayrı `kou_staj_application_tests` veritabanında sentetik kullanıcılarla gerçek dosya yazma, indirme, sahiplik reddi, yönetici incelemesi, yeniden yükleme, tamamlanmış kaydın değişmezliği ve güvenli olmayan dosyanın reddini sınar. Oluşturduğu kayıt ve dosyaları temizler.

```powershell
npm.cmd test
npm.cmd run build
# İsteğe bağlı canlı Atlas testi:
$env:LIVE_AUTH_TEST='1'
npm.cmd exec -w @kou/server -- vitest run tests/applications.live.test.ts
Remove-Item Env:LIVE_AUTH_TEST
```

Arayüz etkileşimi React Testing Library ile sınandı; gerçek tarayıcıda görsel/PDF önizleme kontrolü yapılmadı. Ortak paket artık derlenmiş TypeScript çıktısından kullanılır; yalnızca sunucuyu dağıtırken de `packages/shared/dist` ve workspace bağlantısını koruyun. Shared kaynaklarını değiştirdikten sonra kökten build/dev/test çalıştırın.

## Sonraki aşama

Aşama 6: ValidationRule soyutlaması ve alt sınıflarla öğrenci veri eşleştirme, kimlik/telefon/adres/akademik dönem/mühendis kontrolleri, anlaşılır kapsamlı rapor ve doğrulama sonrası onaylama.
