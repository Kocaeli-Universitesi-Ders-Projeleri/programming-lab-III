# KOÜ VİZE SÜRÜMÜ — FINAL SECURITY & SYSTEM AUDIT

Denetim: 6–7 Kasım 2026. Kapsam: mevcut vize sürümü, React + Express + MongoDB Atlas. OCR/HTR, Google Form ve Ek-17 eklenmedi. Kod incelemesi, bileşen/API testleri, ayrı Atlas test veritabanlarında entegrasyon ve yerel production simülasyonu kullanıldı. Gerçek tarayıcı ve Atlas yönetim paneli doğrulaması yapılamadı.

**FINAL STATUS: NO-GO — üretime geçiş için.** Paylaşılmış Atlas parolasının yenilenmesi ve geniş DB yetkilerinin daraltılması henüz doğrulanmadı. Kontrollü yerel vize gösteriminin test edilen akışları çalışıyor; bu sonuç tüm üretim ortamının güvenli olduğu anlamına gelmez.

## SYSTEM

| Ölçüm | Sonuç |
|---|---|
| Toplam frontend route | 19 açık path; wildcard ve static fallback hariç |
| Toplam backend endpoint | 27 method/path çifti; SPA static servis hariç |
| Mevcut kullanıcı sayfası | 18 route görünümü; `/` yalnız yönlendirme. 13 rol path'i, 2 admin yardımcı sayfa, 3 public sayfa; ortak bileşenler tekrar kullanılır |
| Eksik sayfa | Vize kapsamındaki route için tespit edilen eksik: 0. Resmî kurumsal gizlilik metninin onayı bekliyor |
| Düzeltilen sorun | 12 bulgu kapatıldı; 2 dış P0 açık. TLS dağıtımının gerçek doğrulaması ayrıca bekliyor |

Dosya/satır bazlı route envanteri: [inventory.json](audit-evidence/inventory.json). Mevcut JWT imza/expiry/issuer/audience, bcrypt, Session TTL, sahiplik kontrolleri, private storage, Zod ve transaction korundu. İlk analiz ve risk önerileri düzeltme öncesinde [ayrı kaydedildi](security-audit-initial.md). Başlangıçta 13 client + 52 server = 65 test geçti; 4 canlı test opt-in olduğu için atlandı. Başlangıç ile yeni test sayıları birebir aynı kapsam değildir.

## FUNCTIONAL

PASS yalnız aşağıdaki çalıştırılmış kapsamı ifade eder; tarayıcı uçtan uca test sonucu değildir.

| Alan | Sonuç | Kanıt ve sınır |
|---|---|---|
| Authentication | PASS | Login/logout, eski session reddi, role yönlendirme, kilit yarışı ve aktif olmayan kullanıcı; auth + audit canlı testleri ve Auth bileşeni |
| Authorization | PASS | DB rolü, admin guard, A/B sahipliği, yabancı update/delete ve rapor/belge engeli; audit canlı testi |
| Student Panel | PASS | Profil/başvuru API'leri, form ve rapor bileşenleri; gerçek tarayıcı E2E NOT TESTED |
| Admin Panel | PASS | Liste projeksiyonları, import, manuel kontrol, onay/tamamlama; API + bileşen testleri |
| MongoDB Atlas | PASS | Gerçek TLS bağlantısı/ping ve izole test transaction'ları; yetki minimizasyonu FAIL, Network Access/backup NOT TESTED |
| Dataset Import | PASS | CSV/XLSX parser, önizleme/onay, tekrar/bozuk satır davranışları; import canlı testi |
| Ek-16 Upload | PASS | Gerçek multipart yükleme, imza/MIME ve sınırlar, Türkçe ad, sahiplik; applications/audit canlı testleri |
| Validation Engine | PASS | Kural ve canlı manuel onay/tamamlama regresyonları; resmî DOCX/PDF ile birebir uyum NOT TESTED |
| Internship Days | PASS | Doğrulanmış 2026/2027 takvim, çalışma günü/tatil/boundary testleri; diğer yıllar için veri varsayılmaz |

## SECURITY

| Alan | Sonuç | Kanıt ve sınır |
|---|---|---|
| JWT | PASS | Yanlış imza/claims/expiry, DB rolü, iptal edilmiş oturum; jwt/auth/audit testleri |
| NoSQL Injection | PASS | `$ne`, `$gt`, `$regex`, `$where`, dizi query ve bilinmeyen sort reddi; server-side filtre incelemesi; kapsamlı pentest değildir |
| XSS | PASS | Rapor HTML payload'ı metin kalır; React escaping korunur, aktif PDF/DOCX ve URI şeması negatif testleri; gerçek tarayıcı exploit taraması NOT TESTED |
| CSRF | PASS | Eksik/bozuk token, oturum bağı, Origin/Referer ve cross-site reddi; Axios token yenileme ve tek retry |
| IDOR | PASS | Ayrı Atlas test kullanıcılarıyla profil, başvuru, rapor, belge ve yazma denemeleri reddedildi |
| File Security | PASS | İmza, boyut, aktif içerik, hash, traversal, hardlink, worker kontrolleri; Windows gerçek symlink testi EPERM nedeniyle SKIPPED. Antivirüs/CDR yok; sıfır zararlı dosya garantisi verilmez |
| Rate Limiting | PASS | Aynı IP altında farklı kullanıcılar, 429, eşzamanlı iş ve kapasite bırakma; tek process kapsamı |
| CORS | PASS | İzinli origin kabul, yabancı origin 403; wildcard credential yok |
| Security Headers | PASS | API testleri ve yerel production HTML simülasyonu; gerçek TLS edge/deployment NOT TESTED |
| Secrets | FAIL | Kaynak/build literal taramasında sızıntı yok; sohbetle paylaşılmış DB parolası rotation kanıtı yok, Git geçmişi doğrulanamadı |

## UI / UX

| Alan | Sonuç | Kanıt ve sınır |
|---|---|---|
| Error Pages | PASS | Role guard, oturum hatası ve error boundary bileşenleri test edildi; 404 route kod incelemesi, gerçek browser NOT TESTED |
| Cookie Consent | PASS | Üç eylem, kalıcılık ve footer üzerinden tercihler bileşen testleri; opsiyonel çerez yok |
| Local Fonts | PASS | Latin/Latin Extended WOFF2 ve OFL lisansı build/HTTP 200; Türkçe metin regresyonu var, fontun gerçek glyph görünümü NOT TESTED |
| Footer Links | PASS | Footer tercih eylemi ve bağlantılar bileşen testleri; production privacy/cookies URL erişimi source route kapsamı |
| Responsive Design | NOT TESTED | Mevcut mobil menü/breakpoint tasarımı korundu; gerçek viewport/keyboard/PDF preview kontrol aracı yok |

## Bulgular ve düzeltmeler

Önem derecesi ile teslim önceliği farklıdır. High/Critical P0, Medium P1; gerekli UX/girdi iyileştirmeleri de P1 kapsamında ele alındı. “Kapalı” yalnız belirtilen kod/test kapsamına ilişkindir.

### SEC-001 — CSRF token katmanı eksikliği

- **Önem:** Medium / P1. **Yer:** `middleware/csrf.ts`, `app.ts`, client `services/api.ts`; token oluşturma/doğrulama ve Axios interceptor.
- **Risk/tekrar:** Önceden SameSite Strict ve varsa Origin kontrolü vardı; tokensiz unsafe istekler ek bağımsız CSRF kanıtı taşımıyordu. Bu tespit gösterilmiş bir uzaktan hesap ele geçirme değildir.
- **Düzeltme:** Session'a bağlı HMAC double-submit token; HttpOnly strict cookie, unsafe method header kontrolü, Origin/Fetch Metadata/Referer, login/logout cache yenileme.
- **Test/sonuç:** `csrf.test.ts`, `api.test.ts` pozitif/negatif senaryolar PASS; mevcut Atlas akışları da token ile geçti. **Kalan:** Kurumlar arası SSO ayrı tasarım ister. **Durum: kapalı.**

### SEC-002 — Hesap kilidi yarışı ve session sertleştirme

- **Önem:** Medium / P1. **Yer:** `routes/auth.ts` login/logout, `middleware/auth.ts`, User modeli.
- **Risk/tekrar:** Hash karşılaştırması sürerken kilitlenen hesap eski snapshot ile koşulsuz sıfırlanabiliyordu. Eski kullanıcı modelinde aktiflik kontrolü yoktu.
- **Düzeltme:** Güncel hash/active/lock koşullu atomik reset; hatalı denemelerde atomik kilit; current-browser session rotation; logout session/audit transaction; JWT ObjectId claim kontrolü.
- **Test/sonuç:** `audit.live.test.ts` bcrypt bekletilirken DB kilidi koyar, başarılı eski karşılaştırmayı 423 ile reddeder; inactive, rotation, JWT rolü ve logout regresyonları PASS. **Kalan:** MFA/SSO vize kapsamı değil. **Durum: kapalı.**

### SEC-003 — NAT adaleti ve pahalı işlem kabul sınırı

- **Önem:** Medium / P1. **Yer:** `middleware/rateLimits.ts`, upload/import/admin route'ları.
- **Risk/tekrar:** Eski düşük ortak IP kotası kampüs NAT'ında toplu engel; kullanıcı bazlı pahalı işlem sınırı yoktu.
- **Düzeltme:** Yüksek kaba IP + login kimlik + kullanıcı bazlı limit; yüklemeden önce 2 global/1 kullanıcı eşzamanlı iş kabulü; işlem finally ile kapasite bırakır.
- **Test/sonuç:** `security-http.test.ts` aynı IP iki kullanıcı ve eşzamanlılık; canlı upload 429 testi PASS. **Kalan:** Çoklu instance ortak sayaç ve kapasite yük testi P2. **Durum: tek süreç kapsamı kapalı.**

### SEC-004 — Özel dosya substitution savunması

- **Önem:** Medium / P1. **Yer:** `services/privateStorage.ts` save/read/remove; belge indirme route'u.
- **Risk/tekrar:** Yerel storage yazabilen biri normal dosyayı link/değiştirilmiş içerikle değiştirebilirdi. Doğrulanmış uzaktan traversal açığı değildi.
- **Düzeltme:** Canonical root, web kökü yasağı, lstat/no-follow, inode/size/nlink ve SHA-256; bounded read; attachment/no-store; kısıtlı izinler.
- **Test/sonuç:** `storage-security.test.ts` traversal, içerik değişimi ve gerçek hardlink PASS; gerçek symlink oluşturma Windows EPERM nedeniyle **NOT TESTED**. **Kalan:** Hedef OS symlink testi ve Windows ACL operasyon kontrolü. **Durum: kod düzeltildi, bu dış doğrulama açık.**

### SEC-005 — Ana süreçte belge/import ayrıştırma

- **Önem:** Medium / P1. **Yer:** `services/inspection.ts`, `workers/inspectionWorker.ts`, upload/import route'ları.
- **Risk/tekrar:** Senkron karmaşık ayrıştırma ana API event loop'unu tüketebilirdi.
- **Düzeltme:** Worker, 10/15 saniye timeout, 128/256 MB JS heap sınırı, sonlandırma ve kabul kotası. ZIP/piksel/nesne sınırları korundu.
- **Test/sonuç:** `inspection.test.ts` ve gerçek worker kullanan applications/imports canlı testleri PASS. **Kalan:** Native allocation'lar JS heap dışında olabilir; host/container bellek ve CPU limiti işletim gereğidir. **Durum: kapalı.**

### SEC-006 — Production HTTPS/proxy/CSP sözleşmesi

- **Önem:** Medium / P1. **Yer:** `middleware/httpSecurity.ts`, `config/env.ts`, `services/serveClient.ts`, `index.ts`, `deploy/`.
- **Risk/tekrar:** Production güvenli cookie vardı; proxy güveni/TLS zorunluluğu ve HTML sunum başlıkları açık işletim sözleşmesine bağlı değildi. Varsayılan HSTS alt alan etkisi kontrolsüzdü.
- **Düzeltme:** HTTPS origin, canonical redirect; unsafe HTTP reddi; explicit proxy CIDR; same-origin SPA ve CSP; HSTS opt-in; loopback dinleme. Örnek TLS edge dosyası hazırlandı.
- **Test/sonuç:** Güvenilmeyen XFP/Host, HSTS ve 8 production-smoke iddiası PASS. **Kalan:** Gerçek sertifika, edge config testi, CSP altında grafik ve PDF preview browser kontrolü **NOT TESTED**. **Durum: kod kapalı; dağıtım onayı bekler.**

### SEC-007 — HTTP loglarında URL/query/header riski

- **Önem:** Medium / P1. **Yer:** `config/logger.ts`, `app.ts` pinoHttp options, error middleware.
- **Risk/tekrar:** Pino HTTP varsayılan serializer URL/query/başlıkları kaydedebilirdi; yalnız logger altındaki serializer ayarı middleware tarafından ezilebiliyordu.
- **Düzeltme:** Gerçek pinoHttp options seviyesinde minimal req/res serializer, CSRF redaction, rastgele request ID, generic error response ve güvenli sınıf/stack-frame logu.
- **Test/sonuç:** `logging.test.ts` gerçek Writable log çıktısında sentinelli query/token/cookie bulunmadığını doğrular; malformed JSON/oversize hata testleri PASS. **Kalan:** Operasyonel log erişim ve saklama politikası. **Durum: kapalı.**

### SEC-008 — Dağınık query/ObjectId kontrolleri

- **Önem:** Low / gerekli P1. **Yer:** `middleware/requestValidation.ts`, auth/import/application schemas.
- **Risk/tekrar:** Bazı bilinmeyen alanlar sessizce yok sayılıyordu; mevcut kodda doğrudan operatör yayma tespit edilmedi.
- **Düzeltme:** Strict query allowlist, scalar/sayfa sınırları, ortak ObjectId, explicit import confirm. Body allowlist/rol sahipliği korundu.
- **Test/sonuç:** Operatör/array/sort negatifleri ve canlı mass-assignment testleri PASS. **Kalan:** Tüm payload kombinasyonlarını kapsayan fuzzing yapılmadı. **Durum: kapalı.**

### SEC-009 — Hata sınırı, çerez tercihleri ve yerel font teslimi

- **Önem:** Low / gerekli P1. **Yer:** client `components/Privacy.tsx`, `ErrorBoundary.tsx`, `main.tsx`, `index.css`, `public/fonts/`.
- **Risk/tekrar:** UI render hatasında ortak fallback, çerez envanteri/tercih footer'ı yoktu. Önceden font CDN yoktu; sistem fontu kullanılıyordu.
- **Düzeltme:** Error boundary, public gizlilik/çerez açıklamaları, üç banner eylemi ve footer; yalnız zorunlu kategoriler. OFL lisanslı Noto Sans yerel Latin/Latin Extended.
- **Test/sonuç:** Privacy/ErrorBoundary testleri ve font/lisans HTTP smoke PASS. **Kalan:** Kurumsal metin onayı, görsel erişilebilirlik/responsive/glyph kontrolü. **Durum: kod kapalı.**

### SEC-010 — Sohbette paylaşılmış Atlas parolası

- **Önem:** High / P0. **Yer:** dış secret provisioning; gerçek değer raporda yok.
- **Risk/tekrar:** Veritabanı parolası önceki kullanıcı mesajında paylaşılmıştır; secret artık yalnız kurum kasasında kalmış sayılamaz.
- **Öneri/işlem:** Atlas yönetiminde parolayı yenile, `.env`/deployment secret'ını güncelle, eski parolanın reddini ve yeni bağlantıyı doğrula. Mevcut arayüz Atlas kullanıcı yönetimi sağlamıyor; uygulama DB komutuyla keyfi kullanıcı/rol değişikliği yapılmadı.
- **Test/sonuç:** Kaynak ve build literal taraması temiz; rotation **NOT TESTED**. **Kalan: parolanın yenilenmesi. Durum: AÇIK, üretim engeli.**

### SEC-011 — İç içe PDF action ve kodlanmış DOCX içeriği

- **Önem:** Medium / P1. **Yer:** `services/documentSafety.ts` PDF object walker ve XML kontrolleri.
- **Risk/tekrar:** Güvenli sentetik iç içe `/S /Launch` PDF testi eski kontrolü geçti; test önce başarısız oldu. Dosya çalıştırılmadı. XML entity ile gizlenen aktif ilişki adları da incelemede sertleştirildi.
- **Düzeltme:** Sınırlı derinlik/nesne recursive PDF dict/array/stream kontrolü, decoded name/action/URI denetimi; strict UTF-8 ve numeric entity decoding DOCX kontrolü.
- **Test/sonuç:** `pdf-security.test.ts` ve belge negatif testleri PASS, normal belge regresyonu PASS. **Kalan:** Tam malware scanner/CDR veya parser zero-day güvencesi yok. **Durum: kapalı.**

### SEC-012 — Atlas uygulama hesabının geniş yetkisi

- **Önem:** High / P0. **Yer:** Atlas DB kullanıcı yetkisi; `scripts/atlas-readonly-audit.mjs` connectionStatus incelemesi.
- **Risk/tekrar:** Salt okunur yetki incelemesinde `broadWritePrivileges: true`, 38 resource kaydı görüldü. Bu kaynak sayısı 38 ayrı rol anlamına gelmez.
- **Öneri/işlem:** Sadece uygulama DB'sine gereken CRUD/index yetkisini ver; kullanıcı yönetimi/başka DB yazma yetkisini çıkar; test ortamını ayrı principal ile sınırla. Yetki testi başka DB'ye yazmadan yapılmalıdır.
- **Test/sonuç:** TLS ping PASS, minimum yetki kontrolü **FAIL**. Yönetim panelinden değişiklik yapılmadı. **Kalan: least-privilege rol ve tekrar doğrulama. Durum: AÇIK, üretim engeli.**

### SEC-013 — Liste yanıtlarında gereksiz kişisel veri

- **Önem:** Medium / P1. **Yer:** `routes/panels.ts` dashboard/student list, `routes/applications.ts` student dashboard.
- **Risk/tekrar:** Genel öğrenci listesi healthStatus, dashboard audit listesi IP gibi kullanım için gereksiz alanları döndürebiliyordu. Bu admin dışı yetki atlama değildir; veri minimizasyonu açığıdır.
- **Düzeltme:** Açık projection ile sadece kullanılan alanlar; öğrenci kendi ayrıntılı form profilini yetkili endpoint'ten alır.
- **Test/sonuç:** Son `audit.live.test.ts` health/identity/address liste dışı ve audit IP dışı olduğunu gerçek Mongo response'unda doğrular, PASS. **Kalan:** Kurumsal saklama/erişim politikası. **Durum: kapalı.**

### SEC-014 — Türkçe multipart dosya adının bozulması

- **Önem:** Low / gerekli P1. **Yer:** `services/filename.ts` safeFilename; belge ve import metadata.
- **Risk/tekrar:** Gerçek multipart `Türkçe-İğüşöç.png` adı önce mojibake olarak döndü; audit testi FAIL oldu.
- **Düzeltme:** Geçerli UTF-8 Latin-1 byte dönüşümü, NFC, basename ve kontrol/bidi temizliği; saklama anahtarı yine rastgele.
- **Test/sonuç:** Yeni unit test ve aynı Atlas multipart assertion PASS; normal legacy ve traversal regresyonları PASS. **Kalan:** Tüm eski tarayıcı kodlamaları desteklenmez. **Durum: kapalı.**

## Test kanıtları

| Çalıştırma | Sonuç |
|---|---|
| `npm.cmd run typecheck` | PASS, exit 0 |
| `npm.cmd run build` | PASS, exit 0; üçüncü taraf Zod PURE comment uyarısı çıktıyı engellemedi |
| Client Vitest | 20/20 PASS — [JSON](audit-evidence/client-tests.json) |
| Server Vitest | 70 PASS, 0 FAIL, 6 SKIPPED — [JSON](audit-evidence/server-tests.json) |
| Atlas canlı regresyon | 5/5 PASS, ayrı test DB'leri — [JSON](audit-evidence/live-tests.json) |
| Son Atlas veri minimizasyonu/Türkçe ad tekrarı | 1/1 PASS — [JSON](audit-evidence/audit-last-tests.json), aynı audit senaryosunun tekrarı; toplam test sayısına ikinci kez eklenmez |
| Yerel production smoke | 8/8 iddia PASS; redirect, HTML/CSP, Secure cookie, API404, HSTS default off, font ve lisans |
| Bağımlılık denetimi | Denetim sırasında `npm audit`: 0 bilinen açık; son offline tekrar da 0. Bu tüm paketlerin güvenli/destekleniyor olduğunu kanıtlamaz |
| Literal secret taraması | 0 eşleşme; `.env` ignore kuralı var; Git geçmişi NOT TESTED |

Server'daki 6 skip: normal koşuda 5 opt-in canlı senaryo (ayrı koşuda beşi de geçti) + Windows'ta symlink oluşturma izni yok. Benzersiz çalıştırılmış test: **95 PASS** (20 client + 70 server + 5 canlı); production smoke ayrıca 8 iddiadır. 1 symlink senaryosu doğrulanmadı. Sayı bir güvenlik sertifikası değildir.

Browser otomasyonu aracı mevcut değildi. Responsive, tam kullanıcı yolculuğu, görsel font/Türkçe glyph ve PDF sandbox önizleme **NOT TESTED**. Atlas Network Access/backup/PITR, gerçek proxy sertifikası/HSTS dağıtımı, Windows ACL ve restore tatbikatı **NOT TESTED**. `mongodump`, `mongorestore`, `nginx` kurulu değil. Üretimde silme/reset/migration veya toplu güncelleme yapılmadı; canlı regresyon yalnız ayrı test DB ve kendi sentetik dosyalarını kullandı.

## Çerez ve depolama envanteri

| Ad | Amaç / oluşturan | Süre | Zorunlu |
|---|---|---|---|
| `kou_session` | Auth route, imzalı oturum kimliği; HttpOnly, Strict, production Secure | 1 saat; logout'ta silinir | Evet |
| `kou_csrf` | CSRF middleware, imzalı token eşleştirme; HttpOnly, Strict, production Secure | 1 saat; logout'ta silinir | Evet |
| `kou.cookie-preferences` localStorage | PrivacyProvider; version/mode/expiry, kişisel veri yok | 180 gün | Tercih kaydı |
| TanStack Query memory | Oturum süresince UI veri cache'i, kalıcı storage değil | Sayfa/oturum; logout/401 temizler | İşlevsel |

Analytics/marketing veya üçüncü taraf font script'i yok. “Tümünü Kabul Et” ve “Zorunlu Olanlarla Devam Et” mevcut durumda aynı zorunlu davranışı açıklar; sahte opsiyonel kategori yok. Kurumsal gizlilik metni için veri sorumlusu ve saklama süreleri yetkili birimce tamamlanmalıdır.

## DELIVERABLES

- UML diagrams / Class diagram / Database diagram / Flowcharts: [kaynaklar ve demo algoritması](technical-deliverables.md). Mermaid kaynakları hazır; render doğrulaması yapılmadı.
- OOP explanation: [oop-explanation.md](oop-explanation.md).
- README: [README](../README.md), kurulum ve denetim bağlantıları.
- Test results: [audit-evidence](audit-evidence/); JSON raporları çalıştırılmış sonuçlardır.
- Security audit report: bu dosya ve [ön analiz](security-audit-initial.md).
- Backup plan: [backup-and-recovery.md](backup-and-recovery.md); restore NOT TESTED.
- Production setup: [production-readiness.md](production-readiness.md) ve `deploy/` örnekleri; deploy edilmedi.

## ISSUES

**Remaining P0:** SEC-010 secret rotation; SEC-012 Atlas minimum yetki. Bu iki madde dış yönetim erişimi olmadan çözüldü denemez.

**Remaining P1:** Üretim öncesinde gerçek TLS/proxy, Atlas Network Access, yedek/restore ve hedef dosya ACL/symlink doğrulaması; tarayıcıda CSP/PDF/form/çerez/mobil akış kontrolü; kurum gizlilik metni onayı. Bunlar kanıt bekleyen işletim/kabul koşullarıdır, doğrulanmış yeni exploit iddiası değildir. Resmî Ek-16/yönerge dosyaları olmadan kurumsal form uyumu nihai kabul edilemez.

**Deferred P2:** Çoklu instance ortak rate store/kuyruk, yük/kapasite testi, ileri monitoring/alerting, kapsamlı fuzzing ve malware/CDR entegrasyonu değerlendirmesi. Final özellikleri ertelendi.

## FINAL STATUS

**NO-GO (production).** P0'lar kapatılıp P1 kabul kontrolleri kanıtlanmadan üretim onayı verilmez. Yerel vize gösterimi için kod/build ve test edilen öğrenci/admin akışları PASS; gerçek tarayıcı sunum provası ayrıca yapılmalıdır. GO WITH KNOWN NON-CRITICAL ISSUES seçeneği açık High/P0 bulunduğundan kullanılmadı.
