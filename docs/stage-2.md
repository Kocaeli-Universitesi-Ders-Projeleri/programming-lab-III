# Aşama 2 — Oturum ve rol yönetimi

## Kullanım

`npm run dev` sonrasında http://localhost:5173/login adresini açın.

Yeni öğrenciler `/register` üzerinden ad, öğrenci numarası, e-posta ve kendi şifreleriyle kayıt olur; ardından `/login` üzerinden e-posta ile giriş yapar. Profilin diğer alanları `/student/profile` ekranındaki düzenleme formundan tamamlanır. Referans veri seti hesap açmak için gerekli değildir.

Kontrollü admin kurulumu: `npm.cmd run bootstrap:admin -w @kou/server` (eski `seed` komutu aynı admin-only işleminin alias'ıdır). `SEED_PASSWORD` 12 karakter/72 UTF-8 bayt sınırına uymalı. `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME` isteğe bağlı ayarlardır; production'da e-posta zorunludur. Aynı admin varsa bilgileri ve şifresi değiştirilmez; farklı mevcut hesapla çakışmada işlem durur. Bu komut öğrenci oluşturmaz.

İsteğe bağlı sentetik öğrenci fixture'ı: `npm.cmd run seed:demo -w @kou/server`. Production'da çalışmaz; ayrı kontrollü test/geliştirme ortamında kullanın. Mevcut öğrenciye veya şifresine dokunmaz.

Yalnız bu CLI işlemleri açıkça çalıştırılmışsa mevcut olabilecek demo hesapları:

- Yönetici: `admin` veya `admin@example.test`
- Öğrenci: `student` veya `student@example.test`
- Her iki hesap için ilk oluşturma şifresi: yerel `.env` dosyasındaki `SEED_PASSWORD` değeri.

Şifre kaynak koduna veya dokümana yazılmaz. Yeni öğrenciler için `SEED_PASSWORD` kullanılmaz; kendi seçtikleri parola bcrypt ile saklanır. Bootstrap/demo CLI'ları normal uygulama başlangıcında otomatik çalıştırılmaz. Bu geliştirme sırasında production bootstrap/demo komutu çalıştırılmadı.

`POST /api/v1/auth/register` strict body kabul eder: name/studentNumber/email/password/confirmPassword. Rol ve kullanıcı adı sunucu tarafından belirlenir; role/admin/isActive gibi alanlar 400 ile reddedilir. User + minimum profil + audit transaction içindedir, unique çakışma 409'dur. Kayıt otomatik oturum açmaz; giriş ekranına yönlendirir. Kimlik/telefon/adres/sağlık için sahte varsayılan değer yazılmaz.

`PATCH /api/v1/students/me` yalnız profil alanlarını kabul eder: department/nationality/phone/academicYear/identityNumber/birthDate/address/previousInternshipDays/healthStatus. Hesap adı, e-posta, öğrenci no, rol ve başka user ID'si değiştirilemez. Bu alanları değiştirmek için bu aşamada public API yoktur; parola reset/değiştirme de eklenmedi. Profil güncellemesi admin referans kaydını değiştirmez. Raporların kaynak/sürüm geçerliliği PHASE 4'te genişletilecektir.

## Güvenlik davranışları

- User şifresi bcrypt 12 tur ile hashlenir; varsayılan sorgularda hash seçilmez.
- Bir saatlik HS256 JWT; issuer ve audience doğrulanır.
- JWT HttpOnly, SameSite=Strict cookie'dedir; production ortamında Secure zorunludur. Üretimde HTTPS ve aynı origin reverse proxy kullanın.
- Her kimlik doğrulama isteğinde veritabanındaki oturum kaydı ve kullanıcı rolü okunur. Süresi dolan oturumlar TTL indeksiyle temizlenir; TTL gecikse bile expiresAt koşulu erişimi engeller.
- Çıkışta oturum kaydı silinir, cookie temizlenir. Eski token tekrar kullanılamaz.
- Art arda beş hatalı şifre 15 dakika hesap kilidi oluşturur. Başarılı giriş sayacı sıfırlar. Başarısız denemeler atomik güncellenir.
- Başarısız, kilitli ve başarılı girişler ile çıkış AuditLog'a kaydedilir. Parola ve cookie loglanmaz.
- Oturumsuz/geçersiz token: 401; rol uyuşmazlığı: 403; kilitli hesap: 423; geçersiz form: 400.
- Giriş endpointinde IP hız sınırı vardır. Üretimde çoklu API instance kullanılırsa paylaşılan rate-limit deposu ayrıca yapılandırılmalıdır.

## API

| Metot | Yol | Yetki |
|---|---|---|
| POST | `/api/v1/auth/login` | Açık; identifier, password JSON gövdesi |
| POST | `/api/v1/auth/logout` | Oturum |
| GET | `/api/v1/auth/me` | Oturum |
| GET | `/api/v1/students/me` | ROLE_STUDENT; yalnızca kendi profili |
| GET | `/api/v1/admin/access` | ROLE_ADMIN; erişim doğrulaması |

`/student` ve `/admin` bu aşamada rol erişimini ve profil bilgilerini gösterir. Tam yönetim panelleri Aşama 3 kapsamındadır.

## Ortam değişkenleri

`JWT_SECRET` en az 32 karakter olmalıdır; eksikse API açılmaz. Güvenli bir değer üretmek için:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Üretilen değeri kök `.env` içine ekleyin. `NODE_ENV=production` güvenli cookie ayarını etkinleştirir. Yeni ortam değişkenlerinden sonra API'yi yeniden başlatın.

## Testler

`npm test`: health, oturumsuz erişim, sahte token, rol endpointlerinin korunması, giriş gövdesi ve origin kontrolleri. Canlı Atlas testi varsayılan olarak atlanır.

PowerShell ile isteğe bağlı canlı test:

```powershell
$env:LIVE_AUTH_TEST='1'
npm.cmd exec -w @kou/server -- vitest run tests/auth.live.test.ts
Remove-Item Env:LIVE_AUTH_TEST
```

Canlı test `kou_staj_auth_tests` veritabanında benzersiz sentetik kayıtlar oluşturur; kendi kayıtlarını finally bloğunda temizler. Giriş, profil sahipliği, iki rolün ayrılması, kilit süresinin dolması ve logout sonrası token reddi gerçek Atlas üzerinde sınanır.

## Doğrulama sonuçları — 6 Kasım 2026

- İstemci ve sunucu üretim derlemesi başarılı.
- TypeScript kontrolleri başarılı.
- 8 yerel API testi başarılı.
- Ayrı Atlas test veritabanında 1 uçtan uca oturum senaryosu başarılı; oluşturulan test kayıtları temizlendi.
- Demo seed başarılı. Test tokenları ve şifreler çıktıya yazılmadı.
- Tarayıcı üzerinde görsel/etkileşim kontrolü yapılmadı.

## Sonraki aşama planı

Aşama 3: öğrenci ve yönetici panellerinin detaylandırılması, dashboard düzenleri ve ilgili sayfalar. Veri seti aktarımı, başvuru ve belge yönetimi bu aşamada uygulanmadı.
