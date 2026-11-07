# Hocanın son açıklamalarına göre vize uyum analizi

**Tarih:** 7 Kasım 2026. **Tür:** Statik kaynak kodu ve mevcut belge/test incelemesi. Uygulama kodu, ayarlar ve veritabanı değiştirilmedi; bu dosya yalnız rapordur. Bu incelemede yeni test, Atlas sorgusu, parser kurulumu veya migration çalıştırılmadı. Önceki test raporları yeni gereksinimlerin kabul kanıtı sayılmadı.

Kaynak: kullanıcının bu turda paylaştığı “Hoca Açıklamalarına Göre Zorunlu Vize Gereksinimleri Güncellemesi”. Ekteki uygulama talimatları, kullanıcının **“şimdilik kod yazma”** isteği nedeniyle yalnız analiz edildi. Son akademik açıklamalar eski gereksinimlerle çatıştığında değerlendirmede yeni metin esas alındı.

## Sonuç

**Mevcut uygulama yeni vize kabul senaryosunu henüz karşılamıyor.** Temel mimari korunabilir; yeniden yazım gerekmiyor. Güvenli dosya yükleme, oturum/yetki yönetimi, manuel form kaydı, rapor ekranı ve inceleme akışı kullanılabilir. Temel değişiklikler hesap oluşturma biçimi, referans veri modeli, gerçek belge alan çıkarımı, üç kaynaklı karşılaştırma ve tamamlanan kayıtların admin yönetimidir.

Bu değerlendirme önceki güvenlik raporunu iptal etmez; akademik kapsam değişmiştir. Önceki “testler geçti” sonucu yeni kayıt/çıkarım/karşılaştırma akışının mevcut olduğunu göstermez.

## Gereksinim karşılaştırması

| Yeni gereksinim | Mevcut durum | Kod dayanağı / fark |
|---|---|---|
| Öğrenci self-registration, `/register` | **Yok** | `pages/App.tsx` route'larında kayıt sayfası; `routes/auth.ts` içinde kayıt API'si yok |
| Öğrencinin kendi şifresini seçmesi | **Yeni kullanıcı akışında yok** | Import onayı rastgele parola oluşturuyor; bcrypt altyapısı mevcut |
| Backend'in sabit `ROLE_STUDENT` ataması | **Kayıtta uygulanacak** | Import rolü zaten sabit atıyor; public kayıt akışı bulunmuyor |
| E-posta/öğrenci numarası benzersizliği | **Altyapı var** | User.email, StudentProfile.studentNumber unique indeksli; kayıt transaction'ı ve duplicate-key yarış yönetimi yeni akışa eklenmeli |
| Kontrollü admin başlangıç kurulumu | **Kısmi** | `seed.ts` komutla çalışır, env parolası ve bcrypt kullanır; aynı komut demo öğrenci de oluşturur. Admin bootstrap ile demo fixture ayrılmalı |
| CSV/XLSX ve 12 sütun | **Var** | `services/importParser.ts:7` tüm istenen sütunları içeriyor |
| Veri setinin hesaptan bağımsız saklanması | **Yok / mevcut akış çelişiyor** | `routes/imports.ts` User ve StudentProfile oluşturuyor; StudentReferenceRecord benzeri kalıcı bağımsız model yok |
| Veri setinde olmayan öğrencinin kayıt/başvurusu | **Uçtan uca yok** | Kayıt akışı yok; upload StudentProfile arıyor, rapor bu profili referans kabul ediyor |
| Manuel Ek-16 alanları | **Büyük ölçüde var** | `pages/ApplicationForm.tsx:12`, `shared/application.ts:8`; alanlar aşağıda ayrıca incelendi |
| Manuel verinin MongoDB'de kalıcı tutulması | **Var** | `models/application.ts` data; upload transaction'ında saklanır, detail API geri döner |
| Kayıtlı formu tekrar görüntüleme | **Var; düzenleme sınırlı** | Detail tüm veriyi gösterir; edit form önceki data'yı doldurur fakat yalnız INVALID durumda açılır |
| DOCX/PDF/DOC'tan alan çıkarımı | **Yok** | documentSafety yalnız yapı/güvenlik denetliyor; iş alanlarına dönüştürülmüş metin/JSON üretmiyor |
| Görsel/taranmış PDF için açık extraction durumu | **Yok** | Genel “otomatik okunmaz” metni var; dosyaya/alanlara özgü EXTRACTION_UNAVAILABLE ve genişletilebilir extractor arayüzü yok |
| Ham çıkarım ile manuel verinin ayrılması | **Yok** | Application.data ve Document metadata var; raw extraction/field provenance alanları yok |
| Üç yönlü karşılaştırma | **Yok** | buildApplicationReport User + StudentProfile alır; belge verisini ve bağımsız referans kaydını almaz |
| İstenen 7 karşılaştırma sonucu | **Yok** | Mevcut RuleResult.kind farklı sözleşme; A/B/C değerlerini tutmuyor |
| İleri kuralların vize onayını engellememesi | **Uyumsuz** | ValidationEngine otomatik hata ve pending sonuçlarını onay kapısına bağlıyor |
| COMPLETED öğrenci değişikliği yasağı | **Mevcut kodda korunuyor** | Öğrenci yeniden yüklemesi yalnız INVALID; öğrenci delete endpoint'i yok |
| COMPLETED admin güncelleme/silme | **Yok** | İçerik update/delete API'si yok; completed yeniden doğrulaması da 409 |
| Admin audit ve geçmiş | **Temel var** | Status/review/validate işlemleri AuditLog ve sürüm kontrolü kullanır; yeni edit/delete işlemlerine genişletilmeli |
| Soft delete ve silme onayı | **Yok** | deletedAt/deletedBy modeli, delete API'si ve onay UI'si yok |
| Güvenlik katmanlarının korunması | **Mevcut temel kullanılabilir** | JWT/session, DB rolü, ownership, CSRF, scalar validation, worker, rate limit ve private storage korunmalı |
| Yeni akışın API + Atlas kabul testi | **Yok** | Mevcut canlı testler eski import-hesap oluşturma ve değişmez completed davranışını doğruluyor |

## Önceki gereksinimlerle somut çelişkiler

### 1. Hesap oluşturma ile veri seti aktarımı birbirine bağlı

`routes/imports.ts:55` her satır için rastgele parola üretir; yaklaşık 68–73. satırlarda User/StudentProfile yazar ve credentials döndürür. UI `ImportPage.tsx`, giriş bilgilerini CSV olarak indirtir ve indirilmeden yeni aktarıma geçişi sınırlar.

Bu eski talebe uygun çalışıyordu; son açıklamaya göre kaldırılması gereken davranıştır. Yalnız `/register` eklemek yeterli olmaz: import hesabı oluşturmaya devam ederse çift hesap/unique çakışmaları ve iki farklı kayıt yöntemi kalır. Parser/önizleme/transaction korunup onay hedefi bağımsız referans kayıtlarına çevrilmeli; credentials üretimi/indirme zorunluluğu yeni akıştan çıkarılmalıdır.

**Önemli yan etki:** `markExisting`, öğrencinin zaten hesabı/profili olmasını import hatası kabul ediyor. Yeni gereksinimde öğrenci önce kayıt olup admin sonra referans yükleyebilir. Dolayısıyla hesapta var olmak referans aktarımı için mükerrerlik ölçütü olamaz. Referansın kendi tekrar/güncelleme politikası gerekir.

### 2. Mevcut profil, bağımsız doğrulama referansı değildir

`buildApplicationReport.ts:6` hesap adı ve StudentProfile alanlarını motorun student kaynağına verir. Yeni öğrencinin kendi oluşturduğu hesabı/profiliyle formunu karşılaştırmak bağımsız C kaynağını doğrulamaz. Referans veri hesabın üzerine kopyalanıp tek kaynağa indirgenmemelidir.

ImportBatch geçici staging kaydıdır; TTL'i vardır, onaydan sonra rows silinir. Bu nedenle ImportBatch yeni kalıcı referans modeli yerine kullanılamaz.

### 3. Dosya güvenlik incelemesi, belgeden veri çıkarımı değildir

`documentSafety.ts:61` belgeyi açıp uzantı/MIME/imza, PDF nesneleri, DOCX XML güvenliği, DOC CFB yapısı veya görsel decode sınırlarını denetler. Dönüşü yalnız name/ext/mime'dır. DOCX tablosundan öğrenci adı veya PDF koordinatlarından etiket/değer çıkarmıyor.

`ApplicationForm.tsx:57` ve `ApplicationViews.tsx` bu eski davranışı doğru biçimde açıklar: otomatik okuma yok, belge-form eşleşmesini komisyon inceler. Yeni metinle vize kapsamına giren DOCX/PDF/DOC okuma uygulanınca bu açıklamalar da güncellenmeli. OCR/HTR ise hâlâ kapsam dışıdır.

### 4. İleri kuralların tümü tavsiye niteliğinde değil

`ValidationEngine.ts:7` tüm kuralları varsayılan çalıştırır; error/pending ve dört manuel kontrol readyForApproval sonucuna etki eder. Ayrıntılı adres bileşenleri, 30 gün, tatil kapsamı/beyan gün eşitliği ve mühendis kuralları onayı engelleyebilir. TC checksum zaten yapılandırılabilir; tüm motor için vize/final politika ayrımı yoktur.

İleri kurallar silinmemeli. Vize kabulünü engelleyen temel kontroller ile danışma/ileri rapor ayrılmalı. Güvenlik denetimleri bu ayrımın dışında zorunlu kalmalı. İmza/kaşe **otomatik** analiz edilmiyor; dört alan manuel komisyon kontrolü. Yeni metin manuel incelemeyi kaldırmıyor; bunu otomatik imza analizi varmış gibi raporlamamak gerekir.

### 5. COMPLETED herkes için fiilen kilitli

`shared/internship.ts:28` COMPLETED'dan geçiş tanımlamaz. `routes/applications.ts:134` completed raporunu yeniden doğrulamayı reddeder; öğrenci upload'u yalnız INVALID durumunu kabul eder. Admin için içerik güncelleme/silme yetkisi hiç tanımlı değildir.

Çözüm tüm kullanıcılar için kilidi açmak değildir. Öğrencinin yasağı korunurken admin'e ayrı, gerekçeli, sürüm kontrollü ve audit'li komutlar gerekir. Admin veri/belge değiştirdiğinde eski karşılaştırmanın geçerli görünmesi önlenmelidir.

## Manuel formun ayrıntılı değerlendirmesi

Kaynakta yeni listede istenen 12 öğrenci alanı, işyeri/yetkili alanları mevcut. Tarihler/gün sayısı ayrı bölümde; yurt dışı ve ücret checkbox; hafta sonu çalışma, workingDays içindeki cumartesi/pazar seçiminden türetiliyor. Bu temsil veri bakımından kullanılabilir; gerçek DOCX alan yapısıyla birebir aynı olduğu henüz kanıtlanmış değildir.

Başvuru Application.data içinde kalıcı tutuluyor; ayrı salt okunur detay ekranı ve INVALID için önceki verileri dolduran edit ekranı var. Otomatik taslak kaydı veya kayıt sonrası kişisel profil düzenleme akışı bulunmuyor. Taslak zorunluluğu son metinde açıkça istenmediği için ek zorunluluk sayılmadı. Ancak self-registration sonrasında minimum profille başvuru ekranına ulaşmak sağlanmalıdır: StudentProfile.department şu anda required, `/students/me` ve dashboard profil bekliyor. Eksik alanları sahte değerlerle doldurmak yerine yeni hesap/minimum profil ve profil tamamlama tasarımı gerekir.

**Kaynak bağımlılığı:** Çalışma kaynaklarında gerçek Ek-16 DOCX/yönerge PDF şablonu bulunamadı; storage'daki kullanıcı belgeleri bu analizde açılmadı. Yeni ekte alan listesi var, şablonun kendisi yok. Hücre birleşimleri, etiketlerin tam yazımı, PDF konumları ve hafta sonu/sağlık seçeneklerinin şablona birebir uyumu gerçek dosya olmadan doğrulanamaz. Extractor alan eşlemesinin temel girdisi bu şablon olacaktır.

## Önerilen veri ayrımı — yalnız tasarım

| Bileşen | Sorumluluk |
|---|---|
| User + StudentProfile | Kendi kaydını açan hesabın kimliği ve profil bilgileri; referans veri değil |
| StudentReferenceRecord | Admin veri setinin bağımsız, kalıcı, sürümlü satırları; import kaynağı ve zaman bilgisi |
| Application.data | Öğrencinin manuel beyanı; mevcut kayıtlar korunur |
| DocumentExtraction (ayrı model veya bağlı alt belge) | Dosya hash/sürümü, parser/şablon sürümü, durum, ham metin/hücre/konum kaynağı, çıkarılan alanlar ve alan hataları |
| ComparisonReport | Manuel veri, extraction ve referans sürümlerine bağlı alan bazlı sonuç; güncellik ve inceleme durumu |

Bunlar yeni model zorunluluğu iddiası değil, sorumluluk ayrımı önerisidir. Mevcut ValidationReport yeni sonuçları içerecek şekilde de genişletilebilir. Ham kişisel veri loglara veya genel listelere taşınmamalı; extraction/karşılaştırma API'leri de belge kadar ownership kontrolüne tabi olmalıdır.

**Extraction yaklaşımı:** Güvenlik kontrolü geçen dosyaya format bazlı extractor çalışır. DOCX tablo/hücre yapısı korunur; metin katmanlı PDF'de koordinat ve sıralama kullanılır. DOC için kontrollü okuyucu veya izole dönüştürücü seçimi/uyumluluk araştırması gerekir; mevcut CFB güvenlik kontrolü tek başına okuyucu değildir. Görseller ve metinsiz PDF için okunamama durumu açık döner. Çıkarmak için dosya çalıştırılmaz; mevcut süre/bellek/arşiv sınırları sürdürülür. Bu raporda kütüphane kurulmadı veya belirli bir kütüphanenin Ek-16 üzerinde çalıştığı iddia edilmedi.

## Karşılaştırma sözleşmesi ve karar ayrıntıları

Her alan için A manuel, B belge, C referans değerleri ile kaynakların bulunabilirliği kaydedilmeli. Belge çıktısını öğrenci düzeltirse bu düzeltme orijinal extraction üzerine yazılmamalı; beyan/düzeltme geçmişi ayrı tutulmalı. Aksi hâlde öğrencinin düzeltmesi belgenin gerçekten söylediği bilgi gibi görünür.

- MATCH: Yeterli ve karşılaştırılabilir kaynaklar eşleştiğinde. Bir kaynağın okunamaması başarı değildir.
- MISMATCH: Hangi kaynak çiftinin farklı olduğu açıklanmalı.
- MISSING_IN_DOCUMENT / MISSING_IN_FORM: Alan eksikliği ilgili kaynağa ait belirtilmeli.
- REFERENCE_NOT_FOUND: Hesap oluşturmayı engellemez; bağımsız referans doğrulamasının yapılmadığı açık kalır.
- EXTRACTION_UNAVAILABLE: Desteklenmeyen/metinsiz/başarısız çıkarım; tahmini değer üretmez.
- MANUAL_REVIEW_REQUIRED: Belirsizlik veya otomasyonun karar veremediği durum; kayıtlı komisyon değerlendirmesi gerekir.

**Bir alanda birden fazla sorun olabilir:** hem referans yok hem extraction başarısız olabilir. Tek status değerinin diğer bilgiyi kaybettirmemesi için kaynak durumları ve alt karşılaştırmalar ayrıca saklanmalı; UI ana sonucu ve tüm nedenleri göstermelidir.

**Uygulanabilirlik:** Referans veri seti yalnız öğrenci alanlarını içeriyor. İşyeri/yetkili alanlarında C kaynağı doğal olarak yoktur; her şirket alanına REFERENCE_NOT_FOUND yazmak yanlış olur. Hangi alanın A-B-C, hangisinin yalnız A-B karşılaştırıldığı şema düzeyinde tanımlanmalıdır.

**Normalizasyon:** Tarihler ortak ISO biçimi; metinlerde kontrollü Unicode/boşluk normalizasyonu. Kimlik ve öğrenci numarası string olarak tutulmalı; baştaki sıfırlar kaybedilmemeli, fuzzy eşleştirme uygulanmamalı. E-posta/ad benzerliği tek başına referans sahipliğinin kanıtı değildir. Birden fazla/çelişkili aday kayıtta keyfi ilk satır seçilmemelidir.

**Politika açıklığı gereken nokta:** Yeni metin, referans bulunmayan veya extraction yapılamayan başvurunun manuel komisyon kararıyla hangi koşullarda tamamlanacağını ayrıntılandırmıyor. Kesin olan: kayıt engellenmez ve otomatik MATCH/başarılı karşılaştırma gösterilmez. İş akışı bu bilgileri korumalı; öneri yeterli manuel kanıt ve gerekçe kaydı olmadan “teslime hazır” üretmemektir. Belge değişince extraction, form/referans değişince karşılaştırma güncelliği yeniden hesaplanmalıdır.

## Mevcut verileri koruma ve geçiş riskleri

1. **Hesapları silme/reset yapma.** Önceden importla oluşan hesaplar giriş yapmaya devam edebilir; yeni yöntemle yeniden oluşturulmaz. Parola seçme isteğinin eski hesaplara uygulanması gerekiyorsa kontrollü parola belirleme/reset akışı ayrıca kararlaştırılmalı; toplu varsayılan parola atanmaz.
2. **Referansın kökenini koru.** Eski StudentProfile satırlarını doğrudan “admin orijinal referansı” kabul etme. ImportBatch onayda satırları kaldırdığı için orijinal veri seti her zaman geri üretilemez; yeniden yükleme veya açıkça legacy kaynak etiketi gerekebilir.
3. **Unique kontrolleri ayır.** Aynı öğrenci numarası User/Profile tarafında bir hesaba, referans tarafında kendi versiyon politikasına göre tutulmalı. Kullanıcının hesabının varlığı referans importunu engellememeli.
4. **Admin soft delete:** Liste, sayaç, detay, rapor ve dosya indirme sorgularının hepsi silinmiş başvuruyu doğru ele almalı. Sadece listeden gizlemek indirme erişimini kapatmaz. Silme öncesi onay UI'si backend yetki/CSRF kontrolünün yerine geçmez.
5. **Sürüm ve geçmiş:** Admin düzeltmesinde önceki form/belge sürümünü gerektiği kadar koru, raporu stale yap, güncelleme gerekçesi/actor/time sakla. COMPLETED durumunun korunup “rapor güncel değil” gösterilmesi mi, tekrar incelemeye dönülmesi mi seçilecek açık politika olmalı.
6. **Veritabanı yedeği:** Yeni indeks/model/geçiş işlemlerinden önce DB ve private storage birlikte yedeklenmeli. Bu tur hiçbir veri geçişi çalıştırılmadı.

## 16 adımlı yeni kabul senaryosunun durumu

Buradaki “var”, statik kod dayanağıdır; bu tur çalıştırılmış PASS değildir.

| Adım | Mevcut değerlendirme |
|---|---|
| 1 Kendi hesabını oluşturur | Eksik |
| 2 Kendi şifresini belirler | Yeni kayıt için eksik |
| 3 Giriş yapar | Var; mevcut hesaplarla |
| 4 Admin test seti yükler | Parser/UI var; hedef hesap oluşturduğu için uyumsuz |
| 5 Ek-16 yükler | Var; öğrenci profili şartına bağlı |
| 6 Biçim kontrol edilir | Var; uzantı/MIME/imza/yapı |
| 7 Manuel bilgiler girilir | Var; gerçek şablon uyumu doğrulanmadı |
| 8 Manuel bilgiler MongoDB'de saklanır | Kodda var |
| 9 Desteklenen belgeden otomatik alan okuma | Eksik |
| 10 Belge–manuel karşılaştırma | Eksik |
| 11 Bağımsız test kaydıyla karşılaştırma | Eksik; mevcut profil eşleştirmesi aynı iş değil |
| 12 Alan bazlı üç yönlü rapor | Eksik; mevcut kural raporu aynı iş değil |
| 13 Uyuşmazlıkların gösterimi | Kısmi; mevcut form/profil kural mesajları var |
| 14 İnceleme/onay | Var; ileri kuralların zorunluluğu yeni kapsamla uyumsuz |
| 15 Completed öğrenci değişikliği engeli | Kodda var |
| 16 Completed admin update/delete | Eksik |

## Geliştirmeye geçildiğinde önerilen sıra

1. **Şablon ve kararlar:** Gerçek boş/dolu Ek-16 DOCX ve metin katmanlı PDF örnekleriyle alan haritasını belirle. Referans yok/çıkarım yok onay politikası ve admin completed düzeltme politikasını netleştir.
2. **Bağımsız referans modeli:** CSV/XLSX parser ve güvenliği koru; onayı referans kaydına yönlendir. Hesap/parola üretimini ve credentials UI'sini çıkar. Hesap önce/sonra import sıralarını destekle.
3. **Self-registration ve profil:** `/register`, güvenli kayıt API'si, sabit öğrenci rolü, öğrenci numarası/e-posta indeks yarışları, bcrypt ve ayrı admin bootstrap. Minimum profille giriş/dashboard/başvuru akışı çalışmalı.
4. **Extraction:** Güvenli worker sınırları içinde DOCX/PDF/DOC okuyucuları, açık başarısızlık durumları ve kaynağı koruyan çıktı saklama. Manuel giriş çalışmaya devam etmeli.
5. **Karşılaştırma:** Kaynak/sürüm bağı, yedi sonuç, alan uygulanabilirliği, A/B/C rapor ekranı ve gerekli düzeltme UI'si.
6. **Vize politikası ve admin completed:** İleri kuralları silmeden onay kapısından ayır; admin update/soft delete/audit/onay/güncellik ekle. Öğrenci kilidi aynen korunur.
7. **Yeni kabul testleri ve teslimler:** Gerçek API + izole Atlas'ta 16 adım; yeni ER/UML/akışlar ve README güncellemesi. Eski çelişen test beklentileri değiştirilir, güvenlik negatif testleri korunur.

En büyük belirsizlik ve iş yükü extraction/gerçek şablon eşleştirmesidir. Kayıt ekranının tek başına eklenmesi veya mevcut doğrulama raporunun adının değiştirilmesi yeni kabul senaryosunu sağlamaz. Şablonlar incelenmeden kesin süre tahmini güvenilir değildir.

## Doğrulanması gereken testler

- Referans kaydı olmadan self-registration ve giriş; kullanıcı rol/admin alanı enjekte edemez; tekrar/aynı anda kayıt unique ihlalini güvenle yönetir.
- Öğrenci önce kayıt, admin sonra import; ters sıra; import hiçbir User/parola üretmez. Referans tekrarı ve sürüm seçimi deterministik olur.
- Dolu/boş DOCX hücreleri, birleşik hücreler, Türkçe etiketler; PDF sıralaması/konumu; DOC başarı/timeout; görsel ve metinsiz PDF unavailable. Bozuk/aktif içerikli dosyalar önce güvenlik katmanında reddedilir.
- Manuel veri ile orijinal extraction ayrı kalır; öğrenci düzeltmesi belge gerçeği gibi sunulmaz. Eksik alan, uyuşmazlık, referans yok ve extraction yok için sahte MATCH üretilmez.
- Referans uygulanmayan işyeri alanları yanlış hata üretmez; kimlik/öğrenci numarasında fuzzy eşleştirme veya sıfır kaybı olmaz.
- Form/dosya/referans sürüm değişince rapor stale; güncel olmayan sonuçla otomatik hazır/onay çıkmaz. İleri danışma kuralları tek başına vizeyi bloke etmez.
- COMPLETED öğrenci update/delete/reupload reddi; admin gerekçeli update/soft delete başarısı, audit/geçmiş, onay iptali ve eşzamanlı sürüm çakışması. Silinmiş belgeye doğrudan download ve eski rapor yolu da korunur.
- Eski login/logout, CSRF, IDOR, NoSQL/XSS, file limit/hash ve rate-limit regresyonları. Tarayıcıda kayıt→yükleme→rapor→admin düzeltme tam akışı.

## Önceki belgelerin güncelliği

Stage-4 hesap aktarımı ve credentials, stage-5/6 otomatik okumama ve herkes için completed değişmezliği, ilgili UML/ER/akışlar geliştirme sonrasında güncellenmelidir. Eski güvenlik raporu tarihli denetim kanıtı olarak tutulmalı; yeni akademik kapsamın onayı diye kullanılmamalıdır. Aradaki UI değişikliklerinden dolayı eski rapordaki route sayısı da güncel envanter değildir.

Önceki denetimde açık kalan Atlas parola yenileme, geniş DB yetkisi, gerçek TLS/backup/browser doğrulama koşulları bu tur yeniden kontrol edilmedi. Bunlar yeni akademik geliştirme tamamlanınca kendiliğinden kapanmaz.

**Karar:** Analiz tamamlandı; uygulama geliştirmesine başlanmadı. Yeni vize kapsamı için önce referans–hesap ayrımı ve gerçek belge şablonuna dayalı extraction tasarımı ele alınmalıdır.
