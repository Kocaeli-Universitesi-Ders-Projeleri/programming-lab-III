# PHASE 2 — Öğrenci kaydı ve profil tamamlama

7 Kasım 2026. Önceki PHASE 1 referans veri ayrımı korundu. Bu aşamada public öğrenci kaydı, minimum profil, profil tamamlama ve ayrı kontrollü admin kurulumu uygulandı. Mevcut kullanıcı/şifreler toplu değiştirilmedi; üretim reset/migration/seed çalıştırılmadı.

## Tamamlanan işler

- `/register`: mevcut login tasarımıyla uyumlu ad soyad, öğrenci no, e-posta, şifre ve şifre tekrarı. Login'den kayıt bağlantısı var. Başarıdan sonra `/login` ekranına yönlendirir; otomatik oturum açmaz.
- `POST /api/v1/auth/register`: strict Zod, backend sabit ROLE_STUDENT/active, sunucu üretimi benzersiz kullanıcı adı. Öğrenci e-postasıyla mevcut login API'sini kullanır. Referans veri kontrolü kayıt ön koşulu değildir.
- Bcrypt 12 tur; en az 12 karakter ve en fazla 72 UTF-8 bayt (bcrypt truncation engeli). Şifre/tekrarı açık metin saklanmaz veya yanıtta verilmez. Şifre tekrarı sunucuda da doğrulanır.
- User + minimum StudentProfile + audit tek transaction. E-posta/öğrenci no unique yarışı generic 409; kısmi kullanıcı/profil kalmaz. Role/admin/isActive/başka beklenmeyen alanlar 400.
- Minimum profil user/studentNumber ile oluşur. Bölüm, kimlik, sağlık, adres gibi alanlar uydurulmaz. Bölüm schema zorunluluğu ve önceki staj günü otomatik varsayılanı kaldırıldı; mevcut kayıtlar değiştirilmedi.
- `/student/profile` içinde düzenleme/tamamlama formu. `PATCH /api/v1/students/me` yalnız kendi profilinin izinli alanlarını günceller, audit transaction'ı kullanır. GET profileComplete bilgisini ve no-store verir. User rolü/adı/e-postası/öğrenci numarası bu endpoint'ten değiştirilemez.
- Minimum profille dashboard çalışır ve bölüm yerine profil tamamlama metni gösterir. Mevcut başvuru formu kayıtlı profil alanlarını önceden olduğu gibi doldurur; öğrenci formda eksik bilgileri de girebilir.
- Kayıtta IP + normalize e-posta özetiyle limit ve iki eşzamanlı anonim iş sınırı; mevcut CSRF/Origin/query/Helmet/log korumaları devam eder. Profil yazmalarında oturum/rol ve kullanıcı kotası vardır.
- Admin başlangıcı `bootstrap:admin` / mevcut `seed` alias'ı artık yalnız admin oluşturur. Aynı adminin bilgileri/parolası değiştirilmez; başka hesapla çakışmada durur. `seed:demo` ayrı, production'da kapalı ve yalnız sentetik öğrenci oluşturur. Bu CLI'lar otomatik startup işlemi değildir.

## Dosyalar ve sözleşmeler

Yeni: shared `account.ts`; client `Register.tsx`, `ProfileEditor.tsx` ve testleri; server `services/bootstrapAdmin.ts`, `seedDemoData.ts`, registration testleri; registration sequence diyagramı.

Güncellenen: shared index; auth route/model; rate limits; App/Auth/Panels/DashboardCards/Privacy; seed.ts; server package scripts; `.env.example`; README/stage-2 ve model-geçiş notları/use-case diyagramı. `.env` değiştirilmedi, paket kurulmadı.

Yeni endpointler:

| Metot | Yol | Sonuç |
|---|---|---|
| POST | `/api/v1/auth/register` | 201 kayıt; 400 schema/rol enjeksiyonu; 409 unique; 429 kota/admission |
| PATCH | `/api/v1/students/me` | 200 kendi profilini güncelle; 400 beklenmeyen alan; 401/403 yetki; 409 kimlik çakışması |

GET `/students/me` önceki user/profile alanlarını koruyup profileComplete ekler. Kayıt sonrası giriş e-posta ile yapılır; eski username/e-posta girişleri korunur. Yeni oluşturulan kullanıcının teknik username'i kayıt formundan seçilmez.

## Test ve doğrulama

| Kontrol | Sonuç |
|---|---|
| TypeScript workspace kontrolü | PASS |
| Shared/client/server build | PASS; yeni kayıt sayfası lazy yüklenerek giriş bundle'ı büyümesi azaltıldı |
| Client Vitest, maxWorkers=2 | **23 PASS, 0 FAIL** — [JSON](audit-evidence/phase-2-client-tests.json) |
| Server yerel Vitest, maxWorkers=2 | **71 PASS, 0 FAIL, 7 SKIP** — [JSON](audit-evidence/phase-2-server-tests.json) |
| Gerçek API + Atlas registration senaryosu | **1 PASS, 0 FAIL** — [JSON](audit-evidence/phase-2-live-tests.json) |

Toplam **95 benzersiz test PASS**. Server'daki 7 skip: altı opt-in canlı senaryo (yalnız registration bu aşamada ayrıca çalıştırıldı), bir Windows symlink izin kısıtı. Diğer beş canlı senaryo bu tur tekrar çalıştırılmadı; önceki aşama kanıtları ayrı tutulur. Gerçek tarayıcı E2E/viewport testi yapılmadı.

Son kaynak/build literal taraması 227 metin dosyasında gerçek env secret eşleşmesi bulmadı; Git geçmişi doğrulanamadı. Envanter bu aşamada 18 frontend path / 31 backend endpoint olarak yenilendi.

Atlas testi ayrı `kou_staj_registration_tests` DB'sinde çalıştı; yalnız kendi sentetik fixture'larını temizledi. Şunları doğruladı: referans yokken kayıt; belirlenen şifrenin bcrypt hash karşılaştırması; Türkçe ad ve başında sıfır olan öğrenci no; minimum profilde uydurulmuş alan bulunmaması; login ve dashboard; kendi profilini tamamlama; yetki/owner/no injection reddi; öğrenci admin endpoint reddi; duplicate e-posta/no; aynı öğrenci no ve aynı e-posta için iki eşzamanlı istekten yalnız bir başarılı kayıt; duplicate profil nedeniyle User insert'inin rollback olması; audit; logout sonrası eski oturum reddi. Bootstrap test servisi admin oluşturma, tekrar çağrıda hash koruma, öğrenci rolünü admin'e dönüştürmeme ve öğrenci profilinin oluşmamasını doğruladı. Gerçek üretim bootstrap komutu çalıştırılmadı.

RTL testleri şifre tekrarı uyuşmazlığında API çağrılmaması, başarılı kayıt→login yönlendirmesi, boş profilde sağlık/gün varsayımı olmaması ve profil kaydı etkileşimini doğruladı. İlk kayıt testi hata mesajı label metnine katıldığı için ikinci alan aramasında başarısız oldu; input'a sabit erişilebilir ad verildi, son koşu geçti. Bu test başarısızlığı gizlenmedi.

## Kullanım ve işletim

Yeni öğrenci: `/register` → kendi şifresini belirle → e-posta ile `/login` → `/student/profile` → “Profil bilgilerimi düzenle”. Referans veri admin tarafından önce veya sonra yüklenebilir; hesap kaydı bundan bağımsızdır. Referansla gerçek karşılaştırma PHASE 4'te bağlanacaktır.

Admin bootstrap için en az `SEED_PASSWORD`, production için ayrıca `BOOTSTRAP_ADMIN_EMAIL` sağlanır. İsteğe bağlı BOOTSTRAP_ADMIN_USERNAME/NAME ayarları `.env.example` içindedir. Eski `seed` komutu demo öğrenci artık üretmez; demo gerekiyorsa ayrı `seed:demo` komutu açıkça kullanılır. Yerel varsayılan bootstrap username admin/email admin@example.test; bunlar parola değildir. Production gerçek e-posta zorunludur. Komutların öncesinde DB/storage yedek planı uygulanmalıdır.

## Kalan kapsam

- Parola reset/değiştirme, hesap adı/e-posta/öğrenci no değiştirme akışı eklenmedi; mevcut parolalar korunur. E-posta adresi doğrulaması eklenmedi; e-posta sahipliği doğrulanmış kabul edilmez.
- Profilde girilen bilgiler hâlâ öğrencinin beyanıdır, bağımsız admin referansı değildir. Öğrencinin profilini değiştirmesi referansı değiştirmez. Eski raporlara kaynak/sürüm/ST​ALE desteği PHASE 4'tedir.
- Anonim admission ve kotalar süreç içidir; çoklu instance ortak sayaç P2 işletim konusudur.
- Gerçek DOCX/PDF/DOC alan çıkarımı PHASE 3, üç kaynak karşılaştırma PHASE 4, VIZE/FINAL ve admin COMPLETED edit/delete PHASE 5, tam kabul/audit PHASE 6 bekler.
- Önceki Atlas parola/yetki, gerçek TLS ve yedek/restore işletim koşulları bu aşamada kapatılmadı.

**Aşama sonucu:** PHASE 2 test edilen kapsamda tamamlandı. Yeni vize sürümünün bütünü henüz tamamlanmadı. Sonraki aşama gerçek şablon alan haritası ve güvenli DOCX/PDF/DOC extraction'dır.
