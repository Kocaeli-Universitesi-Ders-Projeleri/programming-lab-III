# Ön inceleme — düzeltmelerden önce

6 Kasım 2026. Bu dosya kod incelemesi bulgularıdır; test PASS raporu değildir. Başlangıç testleri değişiklikten önce çalıştırıldı; sonuçlar final raporunda ayrıca verilecektir.

## Korunacak mevcut önlemler

JWT HS256 imzası, expiration/issuer/audience doğrulaması; bcrypt 12 tur; MongoDB session kaydı ve logout'ta silme; beş hatalı girişte kilit; DB'den rol okuma; başvuru/rapor/belge sahipliği; Zod'dan scalar alanlarla sunucu taraflı filtre kurma; regex escape; unique indeksler; sınırlı özel dosya depolama; belge içerik denetimleri; transaction ve durum sınıfı; React escaping ve sandbox önizleme zaten var.

İncelenen sorgularda istemcinin MongoDB filtre nesnesinin doğrudan yayılması veya istemci rolüyle yetkilendirme tespit edilmedi. Bunların olmadığı varsayımıyla mimari yeniden yazılmayacak.

## Öncelikli gerçek boşluklar

| ID | Öncelik / önem | Dosya ve işlev | Gözlem ve öneri |
|---|---|---|---|
| SEC-001 | P1 / Medium | `app.ts` Origin middleware | SameSite=Strict ve varsa Origin kontrolü var; token kontrolü yok, Origin yoksa ek kanıt aranmıyor. Oturuma bağlı imzalı CSRF token ve istemci entegrasyonu ekle. |
| SEC-002 | P1 / Medium | `routes/auth.ts` login | Şifre karşılaştırmasından önce okunan kilit verisi ile sonra koşulsuz sıfırlanan sayaç arasında yarış var. Başarılı girişte güncel kilit/hash koşullu atomik güncelleme uygula. |
| SEC-003 | P1 / Medium | `app.ts`, `routes/auth.ts`, upload/import routes | Genel 120/IP/dakika ve login 30/IP/15 dakika var; NAT paylaşımında tüm kullanıcıları etkileyebilir. Pahalı istekler kullanıcıya göre sınırlı değil; eşzamanlı import onayları hash maliyetini tekrar harcar. Kullanıcı bazlı sınır ve sınırlı eşzamanlı iş ekle. |
| SEC-004 | P1 / Medium | `privateStorage.ts`, documents/download | UUID, wx ve private storage mevcut; indirme normal yol izlediğinden yerel sembolik bağlantı/substitution riskini kontrol etmiyor. Canonical root, no-follow açma ve metadata hash/boyut kontrolü ekle. Bu, doğrulanmış uzaktan path traversal değildir; yazılabilir yerel depolamaya karşı savunmadır. |
| SEC-005 | P1 / Medium | `documentSafety.ts` checkDocument | Boyut/arşiv/piksel sınırları var; PDF/CFB ayrıştırıcıları ana süreçte çalışıyor. Kötü biçimli dosyada CPU/süre taşması ana API'yi etkileyebilir. Worker bellek/süre sınırı ve giriş kabul sınırı ekle. |
| SEC-006 | P1 / Medium | `app.ts`, `env.ts` production setup | Secure cookie production'da mevcut. Uygulama/reverse proxy TLS yönlendirme ve trust-proxy sözleşmesi yok; varsayılan Helmet HSTS alt alanları da kapsıyor. Doğrulanmış proxy allowlist, production HTTPS şartı, kontrollü HSTS ve HTML için CSP sağla. |
| SEC-007 | P1 / Medium | `config/logger.ts`, error middleware | Cookie/header redaction var; varsayılan istek URL/query logları hassas key/value taşıyabilir. Hata logunda teknik sınıflandırma/request ID bağı zayıf. Gövde/query/header yerine sınırlı serializer ve güvenli teknik hata kaydı kullan. |
| SEC-008 | P1 / Low | route schemas, JWT payload | Çoğu giriş Zod ile ayıklanıyor; bazı ObjectId/confirm/query kontrolleri dağınık. Bilinmeyen sıralama alanları uygulanmıyor ama sessizce ayıklanıyor. Kimlik biçimini ve query allowlist'i merkezileştir; body güncelleme allowlist'lerini koru. |
| SEC-009 | P1 / Low | frontend main/App | Hata sınırı ve çerez tercihi/gizlilik bağlantıları yok. Gerçekte analytics/marketing yok; sahte kategoriler eklemeden zorunlu çerez envanteri ve tercihler ekle. |
| SEC-010 | P0 / High (production öncesi dış işlem) | local secret provisioning | Atlas parolası daha önce sohbet üzerinden paylaşılmış. Değer rapora yazılmayacak; rotation gerektiği kaydedilecek. Atlas yönetim erişimi olmadan döndürüldüğü iddia edilmeyecek. |

## Dış doğrulama sınırları

- `git status` “not a git repository” döndü. `.gitignore` mevcut; geçmişte `.env` commit edilmediği doğrulanamaz.
- Atlas Network Access, kullanıcı rolleri ve backup ayarları yönetim paneli bağlantısı olmadan doğrulanamaz. Salt okunur connectionStatus/ping ayrı denenebilir; bu panel denetiminin yerine geçmez.
- CSS sistem/yerel cihaz fontları kullanıyor; font CDN veya harici script ekleme yok. Font dosyası/lisansı uydurulmayacak.
- Yedekleme/restore çalıştığına ilişkin kanıt yok; plan ve izole test durumu final raporunda ayrılacak.

## Teknik dayanaklar

CSRF için mevcut SameSite/Origin önlemlerine token katmanı eklemek [OWASP yaklaşımıyla](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) uyumludur. Proxy güveni ağ topolojisine göre seçilmelidir ([Express](https://expressjs.com/en/guide/behind-proxies/)). Helmet varsayılanları uygulama ve TLS durumuna göre özelleştirilmelidir ([Helmet](https://helmet.js.org/)). Bu kaynaklar mevcut projede bir açığın sömürüldüğünü göstermez.
