# PHASE 1 — Veri ayrımı tamamlanma raporu

7 Kasım 2026. Kapsam: yeni master talebinin ilk aşaması. Önce [mevcut durum ve model/geçiş planı](vize-gap-analysis.md) kaydedildi; ardından kod değiştirildi. Üretim verileri üzerinde toplu taşıma, reset, silme veya parola güncellemesi yapılmadı.

## Tamamlanan işler

- CSV/XLSX önizleme ve dosya/satır doğrulama korunarak onay hedefi `StudentReferenceRecord` oldu. Import route'unda User/StudentProfile yazımı ve parola üretimi kaldırıldı.
- Kalıcı referanslar hesaplardan bağımsızdır; istenen alanlar, kaynak dosya/satır/batch, sürüm ve oluşturan admin saklanır. Aynı öğrenci no tekrarında önceki sürüm korunur, yeni sürüm eklenir. Hesabın varlığı mükerrer import hatası değildir.
- Önizleme sürümünü onayda tekrar kontrol eden transaction, bileşik unique indeks, stale preview 409 ve idempotent batch onayı eklendi.
- Eski etiketsiz batch'ler yeni referans aktarımı olarak yorumlanmaz; yeniden dosya yükleme istenir. Eski hesaplar ve şifreleri korunur; profiller otomatik referansa dönüştürülmez.
- Giriş bilgileri CSV üretimi/indirme zorunluluğu kaldırıldı; aktarım UI'si yeni davranışı açıklar. Güncel referans listesi/arama/sayfalama ve ayrıntı mevcut import sayfasına eklendi. Kimlik arayüzde maskelenir; listede hassas alanlar gönderilmez.
- Güncel kullanım belgesi, README notu, ER/use-case ve dataset activity kaynakları güncellendi.

## Modeller ve API

Yeni model: `StudentReferenceRecord`. Güncellenen model: `ImportBatch` — optional purpose etiketi ve satırda referenceVersion; eski kayıtlara default atanmadı.

Korunan POST yolları: `/api/v1/admin/students/import`, `/api/v1/admin/students/import/:id/confirm`. **Sözleşme değişikliği:** confirm artık credentials döndürmez. Yeni önizleme satırları nextVersion taşır. Yanıt başarılı/hatalı sayıları ve nedenlerini korur.

Yeni endpointler:

- `GET /api/v1/admin/student-references?q=&page=1`: güncel sürümlerin sınırlı alanlı listesi.
- `GET /api/v1/admin/student-references/:id`: ROLE_ADMIN için belirli referans sürümünün ayrıntısı; no-store.

Her ikisi mevcut JWT/session/DB rolü/query doğrulamasına bağlıdır. Import onayı mevcut CSRF, kullanıcı kotası, kabul sınırı ve audit katmanlarını kullanır. Güncel envanter 17 frontend path / 29 backend endpoint; envanter snapshot'ı bu aşamada yenilendi. Eski güvenlik raporundaki sayılar tarihli kanıttır.

## Değiştirilen dosyalar

| Alan | Dosyalar |
|---|---|
| Backend/model | `src/models/StudentReferenceRecord.ts` (yeni), `src/models/ImportBatch.ts` |
| Backend/API | `src/routes/imports.ts`, `src/middleware/requestValidation.ts` |
| Frontend | `src/pages/ImportPage.tsx`, `src/pages/ReferenceRecords.tsx` (yeni) |
| Test | server `tests/imports.live.test.ts`; client `ImportPage.test.tsx`, `ReferenceRecords.test.tsx` (yeni) |
| Belgeler | `README.md`, `docs/vize-gap-analysis.md`, `docs/stage-4.md`, `docs/technical-deliverables.md`, bu rapor |
| Diyagram | `database.mmd`, `use-cases.mmd`, yeni `dataset-import-activity.mmd` |
| Kanıt | `docs/audit-evidence/phase-1-*.json`, güncel `inventory.json` |

Model/parser/şablon bağımlılıkları için yeni paket eklenmedi. ValidationEngine ve başvuru durum makinesi bu aşamada değiştirilmedi.

## Çalıştırılan kontroller

| Kontrol | Sonuç | Kanıt / sınır |
|---|---|---|
| Değişiklik öncesi testler | 20 client PASS; server 69 PASS + 1 timeout + 6 skip | Worker testi tek başına tekrarında PASS. İlk hata gizlenmedi; ürün timeout sınırı artırılmadı |
| `npm.cmd run typecheck` | PASS | Client/server TypeScript, exit 0 |
| `npm.cmd run build` | PASS | Shared/client/server, exit 0; Zod PURE comment uyarıları engelleyici değil |
| Tüm client testleri, maxWorkers=2 | **21 PASS, 0 FAIL** | [phase-1-client-tests.json](audit-evidence/phase-1-client-tests.json) |
| Tüm yerel server testleri, maxWorkers=2 | **70 PASS, 0 FAIL, 6 SKIP** | [phase-1-server-tests.json](audit-evidence/phase-1-server-tests.json) |
| Gerçek Atlas import kabul testi | **1 PASS, 0 FAIL** | [phase-1-live-tests.json](audit-evidence/phase-1-live-tests.json), ayrı `kou_staj_import_tests` DB |
| Literal kaynak/build secret taraması | PASS | 206 metin dosyasında gerçek env secret eşleşmesi yok; Git geçmişi doğrulanmadı |

Bu aşamada toplam **92 benzersiz test PASS** (21 + 70 + 1). Server koşusundaki beş opt-in canlı testten yalnız import senaryosu ayrıca bu aşamada çalıştırıldı; diğer dört canlı senaryo bu tur tekrar çalıştırılmadı. Altıncı skip, önceki Windows symlink oluşturma izni kısıtıdır. UI testleri gerçek tarayıcı E2E testi değildir.

Canlı import testi tek test fonksiyonu içinde şunları doğruladı: önizleme yazmama; hatalı satır atlama; aynı öğrenci no/e-postaya sahip eski hesabın importu engellememesi; hesap/profil/parola üretmeme; eski parola hash'inin korunması ve eski hesapla giriş; referanstan sonra hesap açılabilmesi (fixture, public registration değil); onay zorunluluğu; başka admin batch sahipliği; süresi dolan batch; replay; immutable v1/v2; stale preview transaction rollback; iki farklı adminin eşzamanlı unique sürüm yarışı; audit; admin list/detail; hassas liste alanlarının yokluğu; öğrenci/anonim erişimin reddi; NoSQL query nesnesinin reddi ve regex escape; eski batch'in güvenli reddi.

**Ara FAIL'ler:** İlk UI testi eski “şifre indir” beklentisi nedeniyle başarısız oldu; yeni API/UI sözleşmesine göre düzeltildi. İlk eşzamanlı test aynı adminle iki ağır iş başlattığı için mevcut güvenlik katmanı 429 üretti; güvenlik limiti gevşetilmedi, test iki ayrı adminle gerçek DB sürüm yarışını ölçecek şekilde düzeltildi. Son kanıt dosyaları başarılı tekrarları içerir.

## Test edilmemiş alanlar ve bilinen eksikler

- Gerçek tarayıcıda görsel/mobil/klavye kontrolü bu tur yapılmadı; mevcut tasarım bileşenleri korundu, RTL etkileşimleri doğrulandı.
- Yeni listeleme aggregate'ı için büyük hacim kapasite testi yapılmadı. Sayfa 10 kayıt döner; çok sayıda tarihsel sürümde indeks/kapasite ayrıca izlenmeli.
- Üretim indeks dağıtımı, DB/storage yedek/restore tatbikatı ve önceki Atlas parola/yetki/TLS işletim koşulları yeniden doğrulanmadı. Üretime deploy edilmedi; canlı test yalnız ayrı test DB'sinde kendi fixture'larını temizledi.
- Self-registration/minimum profil/admin bootstrap ayrımı **PHASE 2: henüz yok**.
- Gerçek şablon alan haritası ve extraction **PHASE 3: henüz yok**.
- Yeni referanslar mevcut kural raporuna henüz bağlanmadı; bağımsız üç kaynaklı karşılaştırma ve stale rapor **PHASE 4: henüz yok**. Mevcut rapor User/Profile üzerinden eski doğrulamayı sürdürür.
- VIZE/FINAL politikası ve admin COMPLETED update/soft delete **PHASE 5: henüz yok**.
- Tam 16 adımlı yeni kabul ve tüm akademik diyagramlar **PHASE 6: henüz tamamlanmadı**. Var olmayan extraction/kayıt sınıfları çalışıyormuş gibi diyagrama eklenmedi.

**Aşama sonucu:** PHASE 1'in veri ayrımı ve bağımsız referans aktarımı test edilen kapsamda tamamlandı. Projenin tüm yeni vize kriterleri henüz tamamlanmış değildir. Sonraki aşama PHASE 2 — self-registration ve profil tamamlamadır.
