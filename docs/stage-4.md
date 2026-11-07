# Aşama 4 — Bağımsız referans veri seti yönetimi

7 Kasım 2026 PHASE 1 değişikliği: aktarım öğrenci hesabı açmaz, parola üretmez. Önceden açılan hesaplar ve şifreleri korunur. Kendi hesabını oluşturma PHASE 2'dir; henüz uygulanmış değildir. Referansların üç kaynaklı rapora bağlanması PHASE 4'tür.

## Kullanım

Yöneticiyle `/admin/import` sayfasını açın. Örnek CSV/XLSX dosyaları sentetiktir. Dosyayı seçip önizleme oluşturun; geçerli/hatalı satırları inceleyin. Önizleme yazma yapmaz, yalnız yöneticiye bağlı geçici batch oluşturur. Onay verildiğinde geçerli satırlar bağımsız StudentReferenceRecord kayıtlarına dönüşür; hatalı satırlar atlanır. Sonuç ekranında sayılar gösterilir; giriş bilgileri indirme adımı yoktur.

Aynı sayfada **Kayıtlı referans verileri** bölümünden öğrenci numarası/ad ile arayın. Her numaranın son sürümü listelenir. İncele düğmesi yetkili ayrıntıları açar; kimlik numarası arayüzde maskelenir. Genel liste API'si kimlik, doğum tarihi, adres, sağlık statüsü, telefon ve e-posta göndermez. Ayrıntı API'si bu bilgileri yalnız admin'e verir ve no-store kullanır.

## Dosya sözleşmesi

CSV UTF-8/BOM ve virgül/noktalı virgül; XLSX tek sayfa. En fazla 5 MB ve 500 veri satırı. XLS/XLSM yoktur. Mevcut arşiv, formül, bağlantı ve kaynak sınırları korunur; ayrıştırma bounded worker içinde yapılır.

| Dosya sütunu | Referans alanı | Biçim |
|---|---|---|
| name | fullName | Ad soyad |
| identityNumber | identityNumber | 11 rakam; yabancı uyruk için 99 başlangıcı |
| nationality | nationality | Uyruk |
| studentNumber | studentNumber | 3–30 harf/rakam; metin, baştaki sıfırlar korunur |
| birthDate | dateOfBirth | Geçmişte geçerli YYYY-AA-GG |
| address | residenceAddress | İkametgâh adresi |
| department | department | Bölüm |
| academicYear | academicYear | Ardışık yıl, ör. 2026-2027 |
| previousInternshipDays | previousInternshipDays | 0–365 tam sayı |
| email | email | Geçerli e-posta |
| phone | phone | +90 ve 10 rakam; yerel biçim normalize edilir |
| healthStatus | healthCoverageStatus | 1–6 tam sayı |

Tüm sütunlar zorunlu, sıraları değişebilir. Aynı dosyadaki mükerrer öğrenci no/kimlik/e-posta ilgili satırları hatalı yapar. Kullanıcı hesabının veya StudentProfile'ın zaten var olması referans import hatası değildir. Dosya satırları eski profillerden otomatik türetilmez.

## Sürüm ve transaction

Referanslar append-only saklanır. StudentNumber/version bileşik unique indekslidir; ilk aktarım v1, tekrar aktarım v2 olur. Önceki içerik silinmez. Kaynak dosya adı, satır, batch ID ve oluşturan admin her sürümde tutulur. Referans kaydında TTL yoktur; geçici ImportBatch TTL ile silinse de referans ve kaynak metadata'sı kalır. MongoDB referansları zorunlu foreign key değildir. PHASE 4'ten itibaren yeni referans sürümü, ilgili başvuruların karşılaştırma raporunu STALE yapar; eşzamanlı onay güvenliği için mevcut başvuru optimistic version sayacı aynı transaction içinde artırılır. Form, belge ve durum değiştirilmez.

Önizleme geçerli satırların mevcut sürümünü kaydeder. Onay sırasında aynı sürüm beklenir. Araya yeni aktarım girerse 409 döner; tüm kabul edilen satırlar birlikte rollback olur. Eşzamanlı ilk aktarımda unique indeks yarışa karşı son korumadır. Batch claim, referans insert ve audit aynı transaction'dadır. Aynı başarılı onayı tekrar göndermek yeni sürüm oluşturmaz; aynı özet ve alreadyCommitted döner. Önizlemeyi tekrar oluşturup onaylamak yeni sürüm oluşturur.

Yeni batch'ler purpose=REFERENCE taşır. Eski etiketsiz hesap-import batch'leri onaylanamaz; 409 ile yeniden dosya yüklenmesi istenir. Eski batch'in sonucu üzerinden parola/credentials verilmez. Mevcut User/Profile içerikleri yazılmaz veya taşınmaz; Application için yalnız yukarıdaki sürüm metadata işlemi yapılır.

## API

| Metot | Yol | Açıklama |
|---|---|---|
| POST | `/api/v1/admin/students/import` | `file` multipart; önizleme, satırlar ve nextVersion |
| POST | `/api/v1/admin/students/import/:id/confirm` | `{ "confirm": true }`; successful/failed/failures, replay'de alreadyCommitted |
| GET | `/api/v1/admin/student-references?q=&page=1` | Güncel referansların sınırlı alanlı listesi |
| GET | `/api/v1/admin/student-references/:id` | Yetkili referans ayrıntısı; belirli sürümün ID'si |

ROLE_ADMIN tüm rotalarda zorunlu; yazmalarda CSRF ve mevcut kullanıcı bazlı rate/admission limitleri devam eder. Başka admin batch'i ve süresi dolmuş batch 404; geçersiz onay/dosya/query 400; eski batch veya sürüm yarışı 409. **Sözleşme değişikliği:** confirm yanıtında credentials yoktur. Önceki istemciler güncellenmelidir.

Örnek dosyalar `apps/client/public/samples/students.csv` ve `students.xlsx`; yeniden üretim `node scripts/generate-import-samples.mjs`. Güncel aşama test kanıtları [PHASE 1 raporunda](vize-phase-1.md) yer alır. Eski “import hesabıyla giriş” testi yeni sözleşmeye göre değiştirilmiştir.

Canlı test yalnız ayrı `kou_staj_import_tests` DB'sinde kendi sentetik kayıtlarıyla çalışır:

```powershell
$env:LIVE_AUTH_TEST='1'
npm.cmd exec -w @kou/server -- vitest run tests/imports.live.test.ts
Remove-Item Env:LIVE_AUTH_TEST
```
