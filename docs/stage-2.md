# Aşama 2 — Oturum ve rol yönetimi

## Kullanım

`npm run dev` sonrasında http://localhost:5173/login adresini açın.

Sentetik demo hesapları:

- Yönetici: `admin` veya `admin@example.test`
- Öğrenci: `student` veya `student@example.test`
- Her iki hesap için ilk oluşturma şifresi: yerel `.env` dosyasındaki `SEED_PASSWORD` değeri.

Şifre kaynak koduna veya dokümana yazılmaz. Seed komutu mevcut hesap şifresini değiştirmez: `npm run seed -w @kou/server`. Yeni kurulumda en az 12 karakterli `SEED_PASSWORD` belirleyin. Seed yalnızca sentetik hesaplar oluşturur.

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
