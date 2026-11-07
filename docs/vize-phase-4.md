# PHASE 4 — Üç kaynaklı karşılaştırma ve rapor güncelliği

7 Kasım 2026. [Tasarım/model geçiş notu](vize-phase-4-design.md) koddan önce kaydedildi. Bu aşama manuel beyanı (A), belgeden ham extraction'ı (B) ve bağımsız admin referansını (C) ayırarak alan bazlı karşılaştırır. Gerçek şablon doğrulanmış kabul edilmedi; OCR/final modülleri eklenmedi.

## Tamamlanan işler

- `DocumentComparisonService`: 12 öğrenci alanında A-B-C; işyeri/yetkili ve çalışma günü alanlarında A-B. Referans uygulanmayan şirket alanlarına REFERENCE_NOT_FOUND yazılmaz.
- Her alanda üç ham değer, kaynak durumları, A-B/A-C/B-C çiftleri, ana sonuç, **birden çok sorunu birlikte** saklayan issues ve açıklama bulunur. MATCH/MISMATCH/MISSING_IN_DOCUMENT/MISSING_IN_FORM/REFERENCE_NOT_FOUND/EXTRACTION_UNAVAILABLE/MANUAL_REVIEW_REQUIRED desteklenir. Eksik, geçersiz veya belirsiz kaynak başarı sayılmaz.
- Kimlik/öğrenci numarası string ve kesin eşleşme; sıfırlar korunur. Tarihler ISO, telefonlar kontrollü uluslararası biçim, metinler Unicode/boşluk/Türkçe büyük harf normalizasyonu kullanır. Website origin'i normalize edilirken büyük/küçük harfe duyarlı path korunur. Sayısal 0 ve boolean false eksik sayılmaz.
- C kaynağı **hesaba bağlı StudentProfile.studentNumber** ile seçilir. Manuel formda farklı numara girilmesi başka öğrencinin referans verisini seçmez. En yüksek kesin referans sürümü alınır; ad/e-posta/fuzzy eşleştirme yoktur. Belirsiz sürümde keyfi ilk kayıt kullanılmaz.
- Extraction snapshot'ının belge hash/sürümüyle uyumu kontrol edilir. Uyum yoksa belge kaynağı güvenilir kabul edilmez. Ham extraction veya referans karşılaştırma sırasında değiştirilmez.
- Yeni `ComparisonReport`: kaynak fingerprint'ine bağlı immutable alan snapshot'ları; kaynak sürümleri, engine sürümü, summary ve admin incelemesi. Aynı fingerprint yeniden oluşturulunca satırlar/manuel inceleme ezilmez; eski snapshot'lar saklanır.
- Application.formVersion eklendi; mevcut başvurulara toplu backfill yapılmadan 1 varsayılır. Yeniden yüklemede form/belge sürümü artırılır. İçerik SHA-256'sı ayrıca kullanıldığı için sürüm sayacı artırılmadan veri değişirse de eski sonuç geçerli sayılmaz.
- GET üzerinde sessizce yeni rapor üretmek yerine **CURRENT / STALE / NOT_GENERATED** döner. Yeni upload/resubmit aynı transaction içinde ilk güncel snapshot'ı üretir. Referans değişiminde açık yeniden karşılaştırma gerekir.
- Başvuru detayında A/B/C tablosu, kaynak çiftleri, bütün sorunlar, sürümler ve STALE uyarısı. Kimlik değerleri tablo görünümünde maskelenir; React escaping sürer. Pencereye dönüşte ve 30 saniyelik aralıkla güncellik kontrol edilir; yazma ve rapor istemci timeout'ları 30 saniyedir.
- Gerekçeli admin incelemesi güncel fingerprint'e bağlıdır: açık onay + en az 10 karakter neden. Bu işlem MATCH üretmez veya uyuşmazlık satırını silmez; aynı snapshot'ın incelemesi ikinci kez değiştirilmez. Yeni kaynak, eski incelemeyi onay için kullanılamaz hâle getirir.
- Onay ve tamamlama sunucuda güncel karşılaştırmayı ayrıca kontrol eder. Karşılaştırma uygunluğu mevcut ValidationEngine ve dört imza/kaşe kontrolünün **yerine geçmez**; onlar PHASE 5 politika ayrımına kadar çalışmaya devam eder.

## Eşzamanlılık ve güncellik

Yeni referans importu ilgili hesapların Application.version sayacını referansla **aynı transaction** içinde artırır. Form, durum, dosya ve User/Profile verisi değiştirilmez. Snapshot oluşturma/manuel inceleme de optimistic Application.version koşuluyla yazılır. Onay işleminde kaynaklar transaction snapshot'ından tekrar okunur; eşzamanlı referans importu aynı Application'a yazdığından conflict/retry veya version 409 üretir. Böylece ilk kontrolden sonra değişen referansla eski onay commit edilmez.

Fingerprint: karşılaştırma motor sürümü, formVersion ve form içeriği hash'i; documentId/version/hash; extraction ID/alan/status/template/extractor sürümleri ve güncelleme bilgisi; referans ID/version/içerik hash'i; hesap numarası ve belirsizlik bilgisi. Durum değişikliği/manuel imza kaydı gibi form içeriğini değiştirmeyen işlemler tek başına karşılaştırmayı stale yapmaz.

Eski tamamlanmış başvurular GET ile stale görülebilir; öğrenci tamamlanan raporu yeniden üretemez. Admin karşılaştırmayı yenileyebilir ancak bu aşamada completed içerik düzenleme/silme veya imza incelemesini yeniden açma akışı yoktur. Bunlar PHASE 5'tir.

## API ve dosyalar

| Metot | Yol | Yetki / sözleşme |
|---|---|---|
| GET | `/api/v1/applications/:id/comparison` | Sahip öğrenci/admin; state, güncel sourceFingerprint/sourceVersions ve saklı report |
| POST | `/api/v1/applications/:id/comparison` | Sahip öğrenci/admin, boş JSON; kota/CSRF ve version kontrollü yeniden üretim. Completed öğrenci için 409 |
| POST | `/api/v1/admin/applications/:id/comparison-review` | Admin, UNDER_REVIEW; `{sourceFingerprint, reason, confirm:true}`. Eksik/ek alan 400, eski kaynak 409 |

GET `/applications/:id/report` mevcut doğrulama alanlarını korur; comparisonState ekler ve readyForApproval değerini güncel karşılaştırma koşuluyla birleştirir. Rapor GET'leri no-store kullanır. Sahip olmayan öğrenci 404, oturumsuz 401 alır. Hassas A/B/C değerleri audit veya HTTP loglarına yazılmaz; audit yalnız işlem/fingerprint kaydeder.

Yeni: shared comparison.ts; server `DocumentComparisonService.ts`, `comparisonReports.ts`, `ComparisonReport.ts`; client ComparisonView ve testi; pure/API karşılaştırma testleri; tasarım/akış belgesi.

Güncellenen: shared index, Application modeli, application/import route'ları; ApplicationViews/ReviewControls/ImportPage; eski canlı testlerin kendi ComparisonReport fixture temizliği; doğrulama kabul testine gerekçeli karşılaştırma adımı; README, stage-4 ve sınıf/ER/mimari diyagramları. Yeni paket kurulmadı. Eski snapshot/profil/kullanıcılar toplu dönüştürülmedi veya silinmedi.

## Test kanıtları

| Kontrol | Sonuç / kanıt |
|---|---|
| Workspace TypeScript | PASS |
| Shared/client/server build | PASS; yalnız mevcut Zod PURE yorum uyarıları |
| Client Vitest | **27 PASS, 0 FAIL** — [JSON](audit-evidence/phase-4-client-tests.json) |
| Yerel server Vitest | **80 PASS, 0 FAIL, 8 SKIP** — [JSON](audit-evidence/phase-4-server-tests.json) |
| Yeni Atlas karşılaştırma kabulü | **1 PASS, 0 FAIL** — [JSON](audit-evidence/phase-4-live-tests.json) |
| Önceki doğrulama/onay/tamamlama Atlas regresyonu | **1 PASS, 0 FAIL** — [JSON](audit-evidence/phase-4-validation-regression-tests.json) |

Toplam **109 benzersiz test PASS**. Server'daki 8 skip: yedi opt-in canlı senaryo (yalnız comparison ve validation bu tur ayrıca çalıştırıldı), bir Windows symlink izin kısıtı. Diğer beş canlı senaryo bu tur yeniden çalıştırılmadı. Client timeout ayarı sonrası ilgili karşılaştırma/inceleme testleri ayrıca geçti; tekrarlar toplama eklenmedi. Gerçek tarayıcı E2E/viewport testi yoktur.

Son kaynak/build literal taraması 269 metin dosyasında gerçek env secret eşleşmesi bulmadı; Git geçmişi doğrulanamadı. Envanter 18 frontend path / 36 backend endpoint olarak yenilendi. Yeni diyagramlar Mermaid kaynaklarıdır; renderer ile görsel doğrulama yapılmadı.

Pure testler: aynı alanda referans yok + extraction yok; şirket için C uygulanmaz; çift bazlı uyuşmazlık; sıfırlı numara, tarih/telefon/URL normalizasyonu; false/0; belirsiz extraction/ref; boş değerden sahte MATCH üretmeme ve fingerprint sırası. UI testleri: stale uyarısı, çoklu sorun, maske/XSS escaping, gerekçe+checkbox zorunluluğu ve tam fingerprint'in API'ye gönderilmesi.

Yeni Atlas testi yalnız `kou_staj_comparison_tests` DB'sinde kendi sentetik fixture'larını kullandı. Gerçek DOCX yüklemesiyle snapshot; referans yokken rapor; diğer öğrenci GET/POST reddi; kaynak numarası enjeksiyonu reddi; gerçek CSV referans importu sonrası stale; referans/manual/belge adlarının ayrı gösterimi; form numarası DB fixture'ında değişse bile hesaba bağlı referans seçimi; sürüm artırılmadan içerik değişiminde stale; gerekçeli manuel inceleme; eski incelemenin yeni referansta geçersizliği; extractor hash uyumsuzluğu; completed öğrenci kilidi doğrulandı.

**Gerçek yarış testi:** Onay isteği karşılaştırma kontrolünden sonra buildApplicationReport noktasında bekletildi. Bu sırada yeni referans sürümü gerçek import API'siyle kaydedildi. Onay serbest bırakıldığında 409 aldı, durum UNDER_REVIEW kaldı. Yeni rapor+gerekçe sonrasında onay/tamamlama 200 oldu. Önceki kural/profile değişikliklerinin onayı engellemesi de ayrı `kou_staj_validation_tests` regresyonunda sürdü. Üretim reset/seed/migration çalıştırılmadı.

## Kullanım

Başvuruyu açın → karşılaştırma tablosunu inceleyin. STALE ise yeniden oluşturun; otomatik olarak eski sonuçları yeniymiş gibi göstermeyin. Admin incelemeyi başlatıp kaynak farklarını orijinal belgeyle kontrol eder; gerekiyorsa gerekçe ve açık onay kaydeder. Sonra mevcut dört manuel kontrol ve doğrulama koşulları da sağlanırsa başvuru onaylanabilir. Referansın yenilenmesi önceki kaynak incelemesini geçersiz kılar.

## Kalan sınırlar

Gerçek Ek-16 şablonu hâlâ bulunmadığından templateVerified=false; otomatik alan eşleşmesi bağımsız doğrulanmış belge gerçeği sayılmaz. Bu yüzden güncel raporlar gerekçeli komisyon incelemesi ister. Bu işlem “eksikler giderildi” veya bütün alanlar MATCH demek değildir. Ham dosya verisi değişmeden kalır.

VIZE/FINAL ileri kural ayrımı, admin completed içerik güncelleme/soft delete, tüm 16 adımın browser demosu ve son audit sonraki aşamalardır. Büyük veri hacminde geçmiş snapshot saklama/saklama politikası ve performans ayrıca değerlendirilmelidir. Gerçek tarayıcı/kurum şablonu, üretim TLS/backup/Atlas least-privilege ve parola rotation koşulları bu tur kapatılmadı.

**Aşama sonucu:** PHASE 4'ün üç kaynaklı rapor, güncellik ve eski rapordan onayı engelleme akışı test edilen kapsamda tamamlandı. Sonraki aşama PHASE 5 — vize politikası ve admin completed yetkileridir.
