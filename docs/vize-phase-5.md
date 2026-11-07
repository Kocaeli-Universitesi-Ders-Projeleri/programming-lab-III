# PHASE 5 — Vize politikası ve yönetici düzeltme/silme

7 Kasım 2026. VIZE/FINAL ayrımı, gerekçeli admin düzenlemesi, soft delete ve korunan değişiklik geçmişi uygulandı. Üretim veritabanına toplu migration/reset, seed veya parola değişikliği yapılmadı.

## Davranış

Sunucu yapılandırması VIZE kullanır. Temel form şeması ve dört manuel komisyon kontrolü zorunludur; tarih, gün hesabı, mühendis ve profil gibi ileri kurallar sonuçları kaybetmeden bilgilendirici uyarı olur. FINAL politikasında ileri kontroller onayı engelleyebilir. Politika istemci isteğiyle seçilemez. Dosya güvenliği, yetki ve güncel karşılaştırma gereklilikleri her iki politikada korunur. Eski politika/motor sürümüne ait raporlar yeniden doğrulanmadan hazır görünmez. Motor sürümü 1.1.0'dır.

Admin başvuru detayından tam formu gerekçeyle düzeltebilir; yeni belge isteğe bağlıdır. APPROVED/COMPLETED başvuru aynı form korunarak da gerekçeli yeniden incelemeye açılabilir. Başvuru UNDER_REVIEW'a döner, manuel kontroller temizlenir, form sürümü artar ve eski rapor onaya kapanır. Karşılaştırma STALE olur; yeni karşılaştırma, inceleme ve onay gerekir. Yeni dosya aynı güvenlik/extraction katmanından geçer ve dosya sürümü artar. Öğrencinin COMPLETED değiştirme/silme/yeniden yükleme yetkisi yoktur.

Silme en az 10 karakter gerekçe, checkbox, kullanıcı onayı ve backend confirm:true gerektirir. Soft delete liste/sayaçlardan kaydı çıkarır; detay, rapor, extraction, comparison ve eski/yeni dosya URL'leri 404 verir. Dosya ve geçmiş fiziksel olarak korunur. Admin ayrı geçmiş ekranından silinen kaydın gerekçesine ve değişikliklerine erişir; bu endpoint öğrenciye açık değildir.

ApplicationRevision önceki/sonraki veri, dosya, durum ve sürümleri; aktör, zaman ve gerekçeyi saklar. Güncelleme/silme ve audit transaction içindedir. Beklenen sürümle yarışan ikinci istek 409 alır. Dosya sahipliği asıl öğrencide kalır. Gerekçe ve kişisel snapshot genel loglara taşınmaz.

## Eklenen yollar

| Yöntem | API | İşlev |
|---|---|---|
| PATCH | `/api/v1/admin/applications/:id` | JSON veya multipart tam form/gerekçe/version; isteğe bağlı dosya |
| DELETE | `/api/v1/admin/applications/:id` | Sürüm, gerekçe ve açık onayla soft delete |
| GET | `/api/v1/admin/applications/:id/audit?page=1` | Admin için sayfalı geçmiş |

Admin arayüzüne `/admin/applications/:id/edit` ve `/admin/applications/:id/audit` eklendi. Envanter: 20 frontend path / 39 backend endpoint. [Tasarım](vize-phase-5-design.md), [akış](diagrams/admin-completed-update-delete.mmd), [ER](diagrams/database.mmd).

## Doğrulama

- Root production build ve workspace typecheck geçti. Vite bağımlılık açıklaması uyarıları build'i engellemedi.
- Yerel server: **83 PASS, 0 FAIL, 9 SKIP** — [kanıt](audit-evidence/phase-5-server-tests.json).
- Client: **30 PASS, 0 FAIL** — [kanıt](audit-evidence/phase-5-client-tests.json).
- FINAL politikası eski doğrulama/onay/tamamlama canlı regresyonu: **1 PASS** — [kanıt](audit-evidence/phase-5-final-policy-tests.json).
- VIZE/admin Atlas canlı kabulü: **1 PASS, 0 FAIL** — [kanıt](audit-evidence/phase-5-live-tests.json). Aynı formu gerekçeyle yeniden incelemeye açma dahil son sürüm çalıştırıldı.

Toplam **115 benzersiz test PASS**, 0 FAIL; yerel suite'te 9 SKIP. Tekrar çalıştırılan 24 politika/doğrulama testi toplama ikinci kez eklenmedi.

Yerel skip'ler opt-in canlı testler ve Windows symlink izin sınırıdır; tüm eski canlı senaryolar bu aşamada yeniden çalıştırılmadı. Client testleri gerekçe/onay iptali, doğru sürüm/payload, dosyasız admin düzenlemesi, eski başvuru tarihinin korunması, silinen kayıt ekranı ve güvenli metin/maske gösterimini kapsar.

Yeni canlı test yalnız `kou_staj_admin_application_tests` içinde kendi sentetik kullanıcı/başvuru/dosyalarını oluşturur ve temizler. VIZE ileri uyarılara rağmen kontrollü tamamlamayı; tamamlanan kaydı aynı formla yeniden açmayı; JSON düzeltme ve dosya değiştirmeyi; iki admin yarışını; öğrenci/CSRF/foreign erişim reddini; onaysız/eski sürümle silme reddini; soft delete sonrası tüm normal URL'lerin kapanmasını, sayaçları, audit ve dosyaların fiziksel korunmasını denetler. İlk sandbox denemesi Atlas SRV DNS zaman aşımı verdi; ağ erişimli tekrar ayrı çalıştırıldı.

Kaynak/build literal taraması 287 dosyada gerçek env secret eşleşmesi bulmadı; Git geçmişi doğrulanamadı. Envanter script'ine yeni admin router eklendi. Gerçek tarayıcı E2E/responsive inceleme ve Mermaid render doğrulaması yapılmadı.

## Kalan sınırlar ve sonraki aşama

Gerçek Ek-16 şablonu sağlanmadığı için extraction alan haritası hâlâ `label-map-unverified-v1`, templateVerified:false'dır; şablon kabulü iddia edilmez. OCR/HTR eklenmedi. Üretim yedek/restore, TLS, Atlas parola yenileme ve minimum DB yetkisi bu aşamayla doğrulanmış sayılmaz.

PHASE 6: aşamalar arası kabul senaryosu, güvenlik regresyonu, güncel teknik teslimler ve açık koşulların son değerlendirmesi. Bu rapor PHASE 5 kapsamını belgeler; tüm sistemin nihai kabulü değildir.
