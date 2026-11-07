# KOU Staj Evrak Doğrulama ve Yönetim Sistemi

**Aşama 1–6** uygulanmıştır: temel kurulum, oturum/rol yönetimi, paneller, CSV/XLSX öğrenci aktarımı, Ek-16 başvuru/belge sistemi ve OOP doğrulama motoru. Giriş için [Aşama 2](docs/stage-2.md), paneller için [Aşama 3](docs/stage-3.md), aktarım için [Aşama 4](docs/stage-4.md), belgeler için [Aşama 5](docs/stage-5.md), güncel doğrulama/onay akışı için [Aşama 6](docs/stage-6.md) ve [OOP açıklamasını](docs/oop-explanation.md) inceleyin.

7 Kasım 2026 güvenlik/kalite denetimi tamamlandı: [final rapor ve test kanıtları](docs/security-audit-final.md), [üretim işletim notları](docs/production-readiness.md), [yedek/restore planı](docs/backup-and-recovery.md), [diyagramlar ve sunum senaryosu](docs/technical-deliverables.md). Üretim durumu **NO-GO**: paylaşılmış Atlas parolası yenilenmeli ve geniş DB yetkileri daraltılmalıdır. Gerçek TLS/backup/browser kabul kontrolleri de beklemektedir.

## Başlatma

Node.js 22 LTS ve npm 10+ kullanın. Proje kökünde:

```powershell
npm.cmd install
# Yalnızca yeni kurulumda; mevcut .env dosyanızın üzerine yazmayın:
Copy-Item .env.example .env
# .env içindeki MONGODB_URI ve JWT_SECRET alanlarını doldurun
npm.cmd run dev
```

PowerShell çalıştırma ilkesi npm.ps1 dosyasını engelliyorsa `npm.cmd` kullanın. Diğer kabuklarda `npm` kullanılabilir.

- Arayüz: http://localhost:5173
- API: http://localhost:4000/api/v1/health
- Veritabanı hazırlık kontrolü: http://localhost:4000/api/v1/health/ready

Atlas'ta yalnız uygulama veritabanına gerekli yetkileri olan bir kullanıcı oluşturun, uygulamanın IP adresini ağ erişim listesine ekleyin ve Connect → Drivers bağlantısını kök `.env` dosyasındaki `MONGODB_URI` alanına girin. Paroladaki özel karakterleri URL kodlayın. Gerçek bağlantı bilgilerini kaynak kontrolüne eklemeyin. URI `mongodb+srv://` ile başlamalıdır. Son kaynak/build taramasında gerçek secret bulunmadı; çalışma klasörü Git deposu olmadığından geçmiş commit'ler doğrulanamadı.

`PORT` API portunu, `CLIENT_ORIGIN` izin verilen arayüz origin'ini belirler. API portunu değiştirirseniz `apps/client/vite.config.ts` proxy hedefini de güncelleyin.

## Kontroller

```sh
npm run typecheck
npm run build
npm test
```

Üretim API'si: `npm run start -w @kou/server`. İstemci çıktısı `apps/client/dist` altındadır. Üretimde bu çıktıyı sunacak sunucu ve `/api` reverse proxy yapılandırması ayrıca yapılmalıdır; geliştirme Vite proxy'si üretim çıktısının parçası değildir.

## Yapı

- `apps/client`: React, Vite, TypeScript, React Router, TanStack Query, Axios, Sonner, Tailwind; shadcn/ui Button bileşeni ve bileşen yapılandırması.
- `apps/server`: Express, TypeScript, Mongoose, Helmet, CORS, hız sınırı, Zod ortam doğrulaması, Pino logları, kontrollü kapanış.
- `packages/shared`: istemci ve API sözleşmeleri için ortak tipler.
- `docs`: aşama kapsamı ve mimari notları.

Health endpointi API çalışıyorsa 200 döner; Atlas yoksa `status: degraded` ve `database: disconnected` bildirir. Readiness endpointi Atlas bağlı değilse 503 döner. Atlas hataları bağlantı parolasını loglamadan raporlanır. İlk bağlantı başarısızsa ayarları düzelttikten sonra sunucuyu yeniden başlatın.

## Kapsam ve kaynaklar

Geçici palet kullanıcı gereksiniminden alınmıştır; resmî marka paleti olarak sunulmaz. Logo e-Devlet kurum sayfasından alınmıştır; kaynak bilgisi `docs/branding.md` dosyasındadır. PDF ve Ek-16 DOCX çalışma klasöründe bulunmadığından incelenmemiştir.

Kimlik doğrulama, öğrenci aktarımı, Ek-16 işlemleri ve kapsamlı doğrulama hazırdır. Otomatik kurallar ve kaydedilmiş manuel kontroller geçtiğinde yönetici onaylayıp tamamlayabilir. Seed ve örnek dosyalar sentetik veri kullanır. Eski raporlar yönetici tarafından yeniden doğrulanabilir. OCR/HTR, Google Form ve Ek-17 uygulanmamıştır.

Yerel bağlantı bilgileri `.gitignore` kuralıyla dışlanan kök `.env` dosyasındadır. Atlas TLS/ping doğrulandı; bu kontrol kayıt oluşturmaz. Normal testler DB bağlantısız çalışır; opt-in canlı regresyonlar ayrı sentetik test veritabanlarını kullanır. Son denetimde 95 benzersiz test geçti; Windows symlink oluşturma izni nedeniyle bir kontrol atlandı. Ayrıntılı kapsam ve üretim engelleri final raporundadır.
