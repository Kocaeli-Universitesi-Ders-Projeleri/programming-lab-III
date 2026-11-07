# Üretim işletim notları

Mevcut durum: **NO-GO**. Yerel test başarısı, üretim TLS/Atlas/yedek onayı değildir. Açık engeller final güvenlik raporundadır.

## Dağıtım

`npm.cmd run build` ardından sunucu derlenmiş entrypoint'i çalıştırılır. Worker dosyaları da derlenir; yalnız TS kaynağını dağıtmak yeterli değildir. Üretimde Express derlenmiş client'ı aynı origin altında sunar. Vite geliştirme proxy'si üretim sunucusu değildir.

`deploy/production.env.example` ve `deploy/nginx.conf.example` gerçek değer içermeyen örneklerdir. Nginx kurulu olmadığından `nginx -t` çalıştırılmadı. Sertifika ve alan adı operatör tarafından sağlanır. Örnek güvenlik başlıkları Express'ten gelir; edge'in bunları düşürmediği gerçek tarayıcıyla doğrulanmalıdır.

- `NODE_ENV=production`, `CLIENT_ORIGIN=https://kurum-alani` zorunlu. Origin path içermez.
- `LISTEN_HOST=127.0.0.1` varsayılanı API'yi yerelde tutar. Proxy başka makinedeyse ağ erişimini kısıtlayarak açıkça yapılandır.
- `TRUSTED_PROXY_CIDRS` sadece gerçek proxy IP/CIDR'leri; genel internet veya koşulsuz trust proxy kullanma. Edge X-Forwarded-* başlıklarını istemci girdisiyle birleştirmeden yeniden yazmalıdır.
- `HSTS_MAX_AGE=0` varsayılan. TLS ve alan adı doğrulandıktan sonra kontrollü aç; includeSubDomains/preload eklenmedi.
- `PRIVATE_STORAGE_DIR` kalıcı, mutlak ve web kökü dışında olmalı. Uygulama hesabı dışında erişimi kapat. POSIX 0700/0600 uygulanır; Windows ACL doğrulaması ayrıca gereklidir.
- URI TLS doğrulamasını kapatamaz. JWT anahtarı güçlü ve ortamlar arasında farklı olmalı. Paylaşılmış Atlas parolasını döndür; uygulamaya yalnız kendi DB'si için gerekli yetki ver. Canlı denetimde geniş yazma yetkisi görüldü.

Önce tek API instance kullan. Rate limit ve ağır iş kabul sayacı süreç içidir; yatay ölçek için ortak sayaç/kuyruk gerekir. Belge işçisi yaklaşık 10 saniye/128 MB, import işçisi 15 saniye/256 MB limitlidir; bunlar container toplam bellek kotasının yerine geçmez. İki eşzamanlı ağır iş ve kullanıcı başına bir iş sınırı vardır. Import hash işlemleri ana süreçte asenkron bcrypt kullanır; yük testiyle kapasite belirlenmelidir.

## API ve gözlem

Yazan istekten önce `GET /api/v1/auth/csrf`, aynı cookie jar ile dönen değeri `X-CSRF-Token` başlığında gönder. Login/logout sonrasında token yenilenir. Frontend bunu otomatik yapar. SameSite Strict kurumlar arası SSO akışı için tasarlanmamıştır.

Loglar method/status/request ID ve sınırlı hata sınıfı içerir; URL/query, istek gövdesi, cookie ve token loglanmaz. Log erişimi/saklaması işletmeci sorumluluğundadır. AuditLog içindeki IP dahil kişisel veriler için kurum saklama politikası gerekir. Dashboard IP'yi göstermez. Sağlık verisi genel öğrenci listelerine gönderilmez.

`/api/v1/health/ready` DB bağlantısında 200, bağlantı yoksa 503 döner. Dış izleme, disk kapasitesi, yedek hataları ve 5xx alarmı henüz kurulmadı. Kapanışta çalışan istekler için process-manager süreleri ayarlanmalıdır.

## Kanıt komutları

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
node scripts/production-smoke.mjs
node scripts/security-scan.mjs
node scripts/audit-inventory.mjs
node scripts/atlas-readonly-audit.mjs
```

Son komut bağlantı gerektirir, salt okunur kontroller yapar ve değerleri gizler. Canlı entegrasyonlar `LIVE_AUTH_TEST=1` ile açılır; kodun ayrı test DB adlarını kontrol etmeden değiştirme. Üretim üzerinde manuel toplu reset çalıştırma.

Çerez tercihleri yalnız zorunlu cookie'lerle çalışır. Analytics/marketing yoktur. Üç banner eylemi bununla tutarlıdır; tercihler localStorage'da 180 gün saklanır. `/privacy` ve `/cookies` teknik açıklamadır; kurumun veri sorumlusu/iletişim/saklama metni hukuki olarak onaylanmış değildir. Noto Sans Latin/Latin Extended yerelden sunulur, OFL lisansı `public/fonts` içindedir.
