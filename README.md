# KOU Staj Evrak Doğrulama ve Yönetim Sistemi

**PHASE 5:** VIZE/FINAL doğrulama politikası, gerekçeli admin içerik/belge düzeltmesi ve onaylı soft delete eklendi. Completed öğrenci kilidi sürer; admin düzeltmesi başvuruyu UNDER_REVIEW'a döndürür, eski karşılaştırma/onay yenilenmelidir. Silinen kayıtlar normal URL'lerden kapanır; dosyalar ve admin audit geçmişi korunur. [Tasarım](docs/vize-phase-5-design.md), [aşama raporu](docs/vize-phase-5.md). Tüm aşamaların son kabul/audit kontrolü PHASE 6'dadır. Aşağıdaki özetler tarihli aşama kayıtlarıdır.

**PHASE 4:** Başvuru detayında manuel–belge–referans raporu, kaynak/sürüm takibi ve STALE kontrolü eklendi. Referanslar hesaba bağlı öğrenci numarasıyla seçilir; eksik/okunamayan kaynaklar MATCH sayılmaz. Gerçek şablon doğrulanmadığından onay için güncel rapora bağlı gerekçeli komisyon incelemesi gerekir. [Tasarım](docs/vize-phase-4-design.md), [aşama/test raporu](docs/vize-phase-4.md). VIZE/FINAL politika ayrımı ve admin completed içerik düzenleme/silme sonraki aşamadır. Aşağıdaki notlar tarihli aşama özetleridir.

**PHASE 3:** Güvenli DOCX/PDF/DOC alan çıkarımı, başvuru formunda okunan değerleri açık onayla uygulama ve belgeye bağlı ham extraction kaydı eklendi. Gerçek Ek-16 şablonu bulunmadığından kurumsal alan eşlemesi **doğrulanmadı**; belirsiz alanlar tahmin edilmez. [Alan haritası](docs/ek16-field-mapping.md), [rapor](docs/vize-phase-3.md). PDF okuyucusu Node.js **22.13+** gerektirir; test ortamı 22.17.1. Üç kaynaklı karşılaştırma ve admin completed düzenleme/silme henüz uygulanmadı. Aşağıdaki PHASE 1/2 notları tarihli aşama özetleridir.

**Aşama 1–6** uygulanmıştır: temel kurulum, oturum/rol yönetimi, paneller, CSV/XLSX öğrenci aktarımı, Ek-16 başvuru/belge sistemi ve OOP doğrulama motoru. Giriş için [Aşama 2](docs/stage-2.md), paneller için [Aşama 3](docs/stage-3.md), aktarım için [Aşama 4](docs/stage-4.md), belgeler için [Aşama 5](docs/stage-5.md), güncel doğrulama/onay akışı için [Aşama 6](docs/stage-6.md) ve [OOP açıklamasını](docs/oop-explanation.md) inceleyin.

**Hocanın yeni gereksinimleri — PHASE 1:** CSV/XLSX aktarımı artık yalnız bağımsız, sürümlü referans kaydı oluşturur; hesap veya parola üretmez. Mevcut kullanıcılar korunur. Admin referansları `/admin/import` içinde görür. [Model/geçiş planı](docs/vize-gap-analysis.md), [kullanım](docs/stage-4.md) ve [aşama raporu](docs/vize-phase-1.md). Self-registration, belge alan çıkarımı ve üç kaynaklı karşılaştırma sonraki aşamalardır; henüz tamamlanmış sayılmaz.

**PHASE 2:** Öğrenci kaydı `/register`, e-posta/kişisel şifreyle giriş `/login`, profil tamamlama `/student/profile`. Admin kurulumu `npm.cmd run bootstrap:admin -w @kou/server`, isteğe bağlı demo öğrenci `npm.cmd run seed:demo -w @kou/server`; mevcut `seed` artık yalnız admin oluşturur. Ayrıntılar [oturum/kayıt kullanımı](docs/stage-2.md) ve [PHASE 2 raporunda](docs/vize-phase-2.md). DOCX/PDF/DOC alan çıkarımı ve üç kaynaklı karşılaştırma henüz uygulanmadı.

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
