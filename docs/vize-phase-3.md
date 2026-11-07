# PHASE 3 — Güvenli belge alan çıkarımı

7 Kasım 2026. Kapsam: desteklenen Word/PDF dosyalarının metin/alan okuması, açık okunamama durumları, formda sonuç gösterimi ve manuel veriden ayrı kalıcı snapshot. OCR/HTR, üç kaynaklı karşılaştırma ve admin completed düzenleme bu aşamada eklenmedi.

## Şablon durumu

Proje kaynakları ve kullanıcı attachment klasöründe gerçek DOCX/PDF şablonu aranıp bulunamadı. Private storage'daki kişisel belgeler şablon diye açılmadı. [Alan haritası](ek16-field-mapping.md) gereksinim listesinden türetildi: `label-map-unverified-v1`, `templateVerified=false`. **Gerçek KOÜ Ek-16 uyumu doğrulanmadı.** Bu sınır API ve arayüzde de gösterilir. Sentetik belgenin okunması kurumsal şablon kabulü değildir.

## Tamamlanan işler

- Soyut `DocumentExtractor`; DocxExtractor/PdfExtractor/DocExtractor/UnsupportedImageExtractor ve private readonly strateji dizisine sahip ExtractionService. Aynı supports/extract sözleşmesi üzerinden polimorfik seçim yapılır.
- DOCX ordered XML üzerinden tablo/satır/hücre ve paragraf okuma; gridSpan/vMerge metadata. Boş hücre sonraki satırla doldurulmaz; vertical-merge continuation hücresi yeni dolu alan gibi sayılmaz. Metin kutuları paragraf akışında okunabilir; geometrik şablon uyumu doğrulanmadı.
- PDF.js ile metin katmanı parçaları, sayfa/x/y ve parça ölçüleri; aynı satırda ayrı etiket/değer sütunları. Raster-only PDF OCR olmadan unavailable.
- Eski DOC için buffer tabanlı word-extractor; Word/LibreOffice/harici dönüştürücü veya makro çalıştırılmaz. DOC'ta güvenilir hücre koordinatı varmış gibi gösterilmez; paragraf kaynağı saklanır.
- Sadece açık etiket/değer ilişkileri; kontrollü Unicode/boşluk normalizasyonu ve geçerli tarihlerin ISO biçimine dönüşümü. Kimlik/öğrenci no string olarak kalır; baştaki sıfırlar korunur. Çelişkili veya geçersiz değerler keyfi ilk eşleşme olarak sunulmaz.
- DocumentExtraction modeli: belge ID/sürüm/hash, extractor/template sürümleri, durum, ham metin, alan değerleri ve kaynakları, genel hatalar. Application.data ayrı kalır; öğrenci formu düzeltince orijinal extraction değişmez.
- Başvuru formunda “Belgeden alanları oku”, sonuç tablosu ve açık onayla “Okunan değerleri forma aktar”. Forma uygulanması otomatik değildir; öğrenci sonrasında manuel düzeltebilir. Asıl kayıtta sunucu dosyayı tekrar denetler/okur, istemcinin gönderdiği extraction'a güvenmez.
- Başvuru detayında kendi/admin yetkisiyle kalıcı okuma sonucu; kimlik alanı tablo görünümünde maskelenir. Ham metin ayrı açılır ayrıntıdır ve yalnız sahip/admin tarafından görülebilir. React escaping korunur.

## Durum sözleşmesi

Belge düzeyi: EXTRACTED, PARTIAL, EXTRACTION_UNAVAILABLE, FAILED. Alan düzeyi: EXTRACTED, MISSING, AMBIGUOUS, INVALID. EXTRACTED yalnız alan okuma durumudur; eşleşme, doğruluk veya onay sonucu değildir. Gerçek şablon doğrulanmadı uyarısı her durumda korunur.

Görsellerde, PDF metin katmanı yoksa veya timeout/işçi sınırında otomasyon tamamlanamazsa değer uydurulmaz. Parser hataları genel FAILED açıklamasıyla dönebilir. Güvenliği geçen belgenin manuel kaydı extraction başarısına bağlı değildir; dosya güvenlik kontrolü geçmezse yükleme reddedilir.

## Güvenlik ve kaynak sınırları

Mevcut güvenlik worker'ı önce çalışır. Ayrı extraction worker'ı aynı immutable buffer üzerinde güvenliği tekrar kontrol edip okuyucuyu başlatır. Extraction süresi 15 saniye, JS heap sınırı 256 MB; stdin/stdout üzerinden belge metni loglanmaz. Mevcut güvenlik worker'ının 10 saniye/128 MB ve kullanıcı başına bir ağır iş sınırı gevşetilmedi.

DOCX main XML en fazla 4 MB; DTD/entity bildirimi reddedilir. PDF en fazla 30 sayfa, sayfa başına en fazla 10.000 metin parçası. Sonuç en fazla 500.000 karakter, 10.000 segment, segment başına 10.000 karakter ve kaynak metadata JSON'u 2 milyon karakterle sınırlıdır. Eksik/unavailable durumunda başvuru kayıt akışı manuel veriyle devam eder. Native bellek/host sınırları süreç işletim limitlerinin yerine geçmez.

PDF sadece buffer verisiyle okunur; URL yükleme API'si verilmez, remote worker fetch/WASM ve font yükleme seçenekleri kapalıdır; sayfa render veya script/action çalıştırma çağrısı yoktur. Seçilen PDF.js 6 sürümünde eski `isEvalSupported` parametresi bulunmadığı yerel tip/koddan görüldü; olmayan bir seçeneğin etkili olduğu iddia edilmedi. Aktif PDF/DOCX ve makrolu DOC reddi mevcut documentSafety katmanında devam eder.

## API ve veri geçişi

| Metot | Yol | Davranış |
|---|---|---|
| POST | `/api/v1/applications/extract` | Öğrenci, CSRF/kota/admission; yalnız file multipart. Geçici okuma sonucu + SHA-256, no-store. Başvuru/DocumentExtraction kaydı oluşturmaz |
| GET | `/api/v1/applications/:id/extraction` | Sahip öğrenci veya admin; güncel belgenin okuma snapshot'ı, no-store. Yabancı ID 404, oturumsuz 401 |

Mevcut create/resubmit uçları güvenlik ve extraction sonrasında Document + Application + ValidationReport + DocumentExtraction + audit'i transaction içinde yazar. Sonuçlar documentId üzerinde unique'dir. Yeniden yüklenen belge yeni Document/extraction oluşturur; eski belge ve ham snapshot korunur. Orijinal ham metin genel liste yanıtlarına eklenmez.

Eski kayıtlara otomatik backfill/migration yoktur. Eski belgenin extraction kaydı yoksa açık unavailable sonucu döner. Üretim koleksiyonları reset edilmedi, eski kullanıcı/şifreler değiştirilmedi; canlı test sadece ayrı application test DB'sinde çalıştı. Yeni model/indeks dağıtımından önce [DB + storage yedek planı](backup-and-recovery.md) geçerlidir. Model/geçiş yaklaşımı [alan haritasında](ek16-field-mapping.md) kod değişikliğinden önce kaydedildi.

## Değiştirilen dosyalar

Yeni shared `extraction.ts`; server `services/extraction/{fieldMapping,extractors}.ts`, `models/DocumentExtraction.ts`, yerel word-extractor tip bildirimi; client `ExtractionView.tsx`; extraction fixture/test dosyaları ve UI sonucu testi.

Güncellenen shared index, inspection servis/worker, application route, ApplicationForm/ApplicationViews; applications/validation/audit canlı testlerinin kendi extraction fixture temizliği; App lazy panel testinin bekleme süresi; package/lock; README/stage-5/OOP belgeleri; sınıf/ER/mimari ve yeni extraction akış diyagramı. `.env` değiştirilmedi.

Yeni server bağımlılıkları: pdfjs-dist 6.5.438 (Apache-2.0), fast-xml-parser 5.12.0 (MIT), word-extractor 1.0.4 (MIT). Kurulumun npm audit sonucu 0 bilinen açık. PDF.js Node.js 22.13+ gerektirir; test makinesi 22.17.1. Paketler client bundle'a eklenmedi. Başlangıçta kısıtlı ağ kurulumu ilerlemedi; durdurulup native izinli tek kurulum yapıldı.

## Test kapsamı

Değişiklikten önce 23 client + 71 yerel server testi PASS; 7 server skip. Yeni extraction senaryoları:

- Gerçek sentetik ZIP/DOCX tablosu, Türkçe ad, birleşik hücre, boş alan, bölüm bağlamı, baştaki sıfırlar, tarih normalizasyonu.
- Gerçek PDF metin katmanı ve koordinatlar; aynı yatay satırdaki iki alan; metin içermeyen raster PDF için unavailable.
- Sentetik geçerli Word97 OLE/Unicode metninin gerçek DOC okuyucusuyla okunması; bozuk DOC hatası.
- Görselde boş/unavailable, aktif PDF'nin güvenlik katmanında reddi, çelişen alan ve geçersiz tarih.
- UI'de kısmi/belirsiz sonuç, XSS metninin escape edilmesi, kimlik maskesi, forma açık onayla aktarım ve manuel düzeltmenin ham sonucu değiştirmemesi.
- Ayrı Atlas testinde geçici önizlemenin başvuru oluşturmaması; PNG unavailable snapshot; sahip/admin/anonim/yabancı öğrenci erişimi; yeniden DOCX yüklemede yeni sürüm/hash; manuel isim ile farklı belge isminin ayrı kalması; önceki upload/status/completed güvenlik regresyonu.

Son test sayı ve sonuçları aşağıdaki kanıt dosyalarından verilir; gerçek tarayıcı E2E veya gerçek kurum şablonu kabul testi yapılmadı.

| Son kontrol | Sonuç / kanıt |
|---|---|
| TypeScript | PASS, workspace kontrolü |
| Üretim derlemesi | PASS, shared/client/server; yalnız mevcut Zod PURE comment uyarıları |
| Client testleri | **25 PASS, 0 FAIL** — [JSON](audit-evidence/phase-3-client-tests.json) |
| Yerel server testleri | **76 PASS, 0 FAIL, 7 SKIP** — [JSON](audit-evidence/phase-3-server-tests.json) |
| Son extraction + inspection tekrarı | **6 PASS, 0 FAIL** — [JSON](audit-evidence/phase-3-extraction-tests.json); üstteki server testlerinin alt kümesi, ikinci kez toplanmaz |
| Gerçek Atlas upload/extraction kabulü | **1 PASS, 0 FAIL** — [JSON](audit-evidence/phase-3-live-tests.json) |
| Kaynak/build literal secret taraması | 249 metin dosyası, 0 eşleşme; Git geçmişi doğrulanamadı |
| Route envanteri | 18 frontend path / 33 backend endpoint |

Bu aşamada **102 benzersiz test PASS**. Yedi server skip: altı opt-in canlı senaryo (yalnız applications senaryosu bu tur ayrıca çalıştırıldı), bir Windows symlink oluşturma izin kısıtı. Diğer canlı senaryoların bu tur yeniden geçtiği iddia edilmez. Yeni OOP/ER/akış diyagramları Mermaid kaynaklarıdır; dış renderer ile görsel doğrulama yapılmadı.

Ara başarısızlıklar: ilk derleme PDF.js 6'nın desteklemediği eski isEvalSupported parametresini yakaladı; parametre kaldırılıp yerel API tiplerine uygun çağrı test edildi. Ağır eşzamanlı kontrol sırasında eski inspection testi bir kez timeout verdi; güvenlik timeout'u gevşetilmeden tek worker tekrarında geçti. Client toplu koşusunda lazy admin paneli testi 5 saniyeyi aştı; bu UI testinin bekleme sınırı 10 saniye/test sınırı 15 saniye yapıldı, son seri koşuda geçti. Sonuçlar yalnız son başarılı koşuların üzerine kurulsa da bu ara FAIL'ler gizlenmedi.

## Sonuç

**PHASE 3'ün etiket tabanlı temel çıkarım ve güvenli kayıt akışı test edilen kapsamda tamamlandı. Gerçek Ek-16 şablon uyumu doğrulanmadı.** Bu sınır giderilmeden bütün kurumsal alanların doğru okunduğu veya tüm yeni vize sürümünün hazır olduğu söylenemez. Sonraki aşama PHASE 4 — bağımsız manuel/belge/referans karşılaştırması ve sürüm güncelliğidir.

## Teknik dayanaklar

[PDF.js getDocument/text-content API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html), [word-extractor buffer okuma API'si](https://github.com/morungos/node-word-extractor), [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser). Bu kaynaklar API seçimini destekler; uygulamanın gerçek şablon uyumunu kanıtlamaz.

## Kalan kapsam

Gerçek boş/dolu Ek-16 DOCX/PDF ile alan haritası kabulü; textbox/checkbox/sağlık seçeneklerinin kurum şablonuna özel eşlemesi; farklı Word/PDF üreticileriyle kapsamlı korpus testi henüz yok. Hafta sonu seçeneğinden çalışma günleri tahmin edilmez, imza/kaşe otomatik analiz edilmez. DOC testleri sentetik geçerli dosya ve bozuk dosyayla sınırlıdır.

Bu aşama belge alanlarını okur; manuel–belge–referans karşılaştırması/MATCH veya STALE raporu üretmez. Bunlar PHASE 4'tür. VIZE/FINAL onay politikası ve admin completed update/soft delete PHASE 5'tir. Gerçek tarayıcı, hedef işletim/backup/TLS ve önceki Atlas parola/yetki koşulları ayrıca bekler. OCR/HTR, Google Form ve Ek-17 kapsam dışı kalır.
