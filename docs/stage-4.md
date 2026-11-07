# Aşama 4 — Veri seti yönetimi

## Kullanım

Yönetici hesabıyla giriş yapıp **Veri seti aktarımı** menüsünü açın: `/admin/import`.

1. Sayfadaki örnek CSV veya Excel dosyasını indirin. Dosyalar yalnızca sentetik veriler içerir.
2. Aynı sütun adlarını koruyarak bir CSV/XLSX seçin ve önizlemeyi oluşturun.
3. Geçerli/hatalı sayıları, satır hatalarını ve “Alanları göster” ayrıntılarını inceleyin. Bu aşamada User veya StudentProfile oluşturulmaz.
4. “Geçerli satırları onayla ve kaydet” düğmesine basın ve onay diyaloğunu kabul edin. Hatalı satırlar atlanır.
5. Sonuç ekranında başarılı ve atlanan kayıt sayılarını kontrol edin. **Öğrenci giriş bilgilerini indirin.** Her öğrenci için ayrı rastgele şifre üretilir; kullanıcı adı `student-<küçük harfle öğrenci numarası>` biçimindedir.
6. Öğrenci yönetimi ve dashboard kayıt sayısı güncellenir. Yeni öğrenci indirilen bilgilerle giriş yapabilir.

Şifreler yalnızca ilk başarılı kayıt yanıtında bulunur; veritabanında bcrypt hash'i saklanır. Sonuç ekranını kaybederseniz veya başarılı yanıt ağda kaybolursa şifreler yeniden gösterilemez. Parola sıfırlama bu aşamada uygulanmadı. Aynı dosyayı tekrar yüklemek mevcut hesapların şifresini değiştirmez. Giriş bilgileri dosyasını öğrencilere güvenli biçimde ulaştırmak yöneticiye aittir; uygulama e-posta göndermez.

## Dosya sözleşmesi

En fazla 5 MB, 500 veri satırı ve tek çalışma sayfası. CSV UTF-8 olmalıdır; virgül/noktalı virgül ve BOM desteklenir. XLSX arşivi açılmadan önce dosya imzası, arşiv yapısı, 500 giriş sınırı ve açılmış toplam 20 MB sınırı kontrol edilir. Gerçekte açılan akış boyutları da sayılır. Şifreli, makrolu veya dış bağlantılı arşivler reddedilir. Excel formülleri ve özel hücre nesneleri kabul edilmez. XLS ve XLSM desteklenmez.

| Sütun | Beklenen değer |
|---|---|
| name | Ad soyad |
| identityNumber | 11 rakam, ilk hane sıfır değil; yabancı uyruk için 99 başlangıcı |
| nationality | TR veya uyruk bilgisi |
| studentNumber | 3–30 harf/rakam; Excel'de metin tutun |
| birthDate | Geçmişte geçerli YYYY-AA-GG tarihi |
| address | İkametgâh adresi |
| department | Bölüm |
| academicYear | Ardışık yıllar, ör. 2026-2027 |
| previousInternshipDays | 0–365 tam sayı; boş bırakılamaz |
| email | Geçerli e-posta |
| phone | +90 ve 10 rakam; 0 ile başlayan yerel biçim normalize edilir |
| healthStatus | 1–6 tam sayı |

Tüm sütunlar zorunludur; sıraları değişebilir. Dosyada mükerrer öğrenci numarası, kimlik veya e-posta varsa ilgili satırların tamamı hatalı gösterilir. Mevcut Atlas öğrenci numarası/kimlik/e-posta/kullanıcı adı çakışmaları da raporlanır. Onay sırasında mükerrerler yeniden denetlenir. Veritabanı unique indeksleri eşzamanlı çakışmaları da engeller. TC algoritmik kontrolü ve ayrıntılı adres bileşeni kontrolü bu içe aktarım aşamasının kapsamı değildir.

## Saklama ve transaction

- Orijinal dosya diske veya açık depolamaya yazılmaz; sınırlı boyutta bellekte parse edilir.
- ImportBatch önizlemesi yöneticiye bağlıdır ve 1 saat geçerlidir. TTL temizliği gecikse bile endpoint süreyi kontrol eder.
- Kişisel bilgiler önizlemede yalnızca yetkili yöneticiye verilir. Profil kimlik, doğum tarihi ve adres alanları varsayılan Mongoose sorgularından gizlidir.
- Onayda User, StudentProfile, batch sonucu ve audit olayı aynı Atlas transaction'ında kaydedilir. Transaction başarısızsa öğrenci/kullanıcı kısmi kaydı kalmaz.
- Onaylanan batch'in satır içeriği kaldırılır; özet sonuç tutulur. Aynı onayın tekrarı yeni kullanıcı oluşturmaz; özet döner, şifreler dönmez.
- Şifre hash'leri transaction başlamadan hazırlanır. Büyük dosyalarda hesap oluşturma birkaç dakika sürebilir; istemci onay isteği zaman aşımı 10 dakikadır. Yoğun üretim kullanımı için arka plan iş kuyruğu sonraki iyileştirmedir.

## API

| Metot | Yol | İçerik |
|---|---|---|
| POST | `/api/v1/admin/students/import` | multipart/form-data, `file`; önizleme döner |
| POST | `/api/v1/admin/students/import/:id/confirm` | `{ "confirm": true }`; atomik kayıt ve sonuç |

Her iki endpoint ROLE_ADMIN gerektirir. Başka yönetici batch'i ve süresi dolmuş batch 404, geçersiz dosya/onay 400, transaction çakışması 409 döner.

## Örnekler ve test

Örnekler: `apps/client/public/samples/students.csv` ve `students.xlsx`. Yeniden üretmek için `node scripts/generate-import-samples.mjs`.

6 Kasım 2026: 7 arayüz testi ve 19 yerel backend testi başarılı. Ayrı `kou_staj_import_tests` Atlas veritabanında önizleme/kayıt, onay zorunluluğu, farklı admin sahipliği, mevcut mükerrer kontrolü, tekrar onayın idempotent olması, yeni öğrenciyle giriş, öğrenci rolünün reddi, audit ve süresi dolmuş batch senaryosu başarılı. Test kendi kayıtlarını temizler. Canlı test varsayılan test komutunda atlanır:

```powershell
$env:LIVE_AUTH_TEST='1'
npm.cmd exec -w @kou/server -- vitest run tests/imports.live.test.ts
Remove-Item Env:LIVE_AUTH_TEST
```

Üretim derlemesi başarılı. Bağımlılık denetimi 0 açık bildirdi. ExcelJS'in UUID bağımlılığı yamalı 11.x sürümüne override edilmiştir; XLSX okuma/yazma testleri bu sürümle geçmiştir. Tarayıcıda görsel kontrol yapılmadı; form etkileşimi React Testing Library ile sınandı.

## Sonraki aşama

Aşama 5: Ek-16 yapılandırılmış başvuru formu, özel belge saklama, belge güvenlik kontrolleri, staj tarihleri ve çalışma günleri, başvuru durumları ve yeniden yükleme. PDF ve gerçek Ek-16 DOCX hâlâ çalışma klasöründe bulunmuyor.
