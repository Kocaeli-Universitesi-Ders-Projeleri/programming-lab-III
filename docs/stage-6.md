# Aşama 6 — Doğrulama motoru

## Tamamlananlar

OOP doğrulama motoru; alan bazında Türkçe hata, eksik bilgi, kayıt uyuşmazlığı, uyarı ve öneri üretir. Öğrenci veri setiyle eşleştirme, TC/YKN, telefon/e-posta/faks, ikametgâh ve işyeri adres bileşenleri, akademik yıl/yarıyıl, teslim tarihi, tatilli gün hesabı, mühendis sayısı ve dört manuel kontrol uygulanır.

`ValidationRule` soyutlaması, kalıtım, çok biçimlilik ve başvuru durum kapsüllemesi için [OOP açıklamasını](oop-explanation.md) inceleyin.

## Öğrenci eşleştirme

Beklenen öğrenci numarası, ad soyad, kimlik, uyruk ve bölüm; oturum sahibinin User/StudentProfile kayıtlarından okunur. Formun iddia ettiği başka öğrenci kaydı seçilmez. İsim ve bölümde Unicode, boşluk ve Türkçe harf büyüklüğü normalize edilir; TR/TC/T.C./Türkiye gibi uyruk eş anlamlıları eşleştirilir. Eksik veri seti alanı başarılı sayılmaz.

İlk aşamadaki basit `student` demo profilinin kimlik gibi alanları eksik olabilir. Bu hesapla tam onay beklemeyin; Aşama 4'teki sentetik CSV/XLSX ile yeni, tam kayıtlı öğrenci oluşturup onun hesabıyla başvurun. Tekrar içe aktarma mevcut kayıtları güncellemez. Eksik/asıl veri setinin düzeltilmesi bu aşamada otomatik yapılmaz.

## Alan kuralları

- TC: 11 rakam ve ilk hane sıfır değil. Algoritmik checksum isteğe bağlıdır. Bu bir devlet kimlik sorgusu değildir.
- Yabancı kimlik: 11 rakam ve 99 başlangıcı.
- Öğrenci telefonu Türkiye biçimine normalize edilir; boşluk/parantez/tire kaldırılır. 0, 0090, +90 ve ülke kodu olmadan 10 rakam desteklenir.
- Türkiye işyeri ve yetkilisi için +90 biçimi; yurt dışı işyeri/yetkilisi için uluslararası +ülke kodlu numara kullanılır. Faks boş bırakılabilir; girildiyse denetlenir.
- Üç iletişim grubunun e-postası ve telefonu zorunludur. E-posta/telefonun gerçekten o kişiye ait olduğu doğrulanmaz.
- İkametgâh ve işyeri adresinde mahalle, cadde/sokak, bina, daire, ilçe ve il ayrı girilir. Daire yoksa “Müstakil” yazılabilir. Bileşen varlığı kontrol edilir; gerçek adres doğrulama servisi kullanılmaz. Yurt dışı adresinde eşdeğer bölge/şehir bilgileri girilir.
- Öğretim yılı ardışık olmalı; yarıyıl Güz/Bahar/Yaz olmalı. İzin verilen staj tarih aralıkları yalnızca açıkça yapılandırılmışsa karşılaştırılır.
- Ek-16 başlangıçtan en az 30 takvim günü önce teslim edilmeli; uygun son tarih raporda gösterilir.
- Staj günü sunucuda tekrar hesaplanır. Bilinen tatiller ve yarım tatiller düşülür; eksik takvim veya beyan uyuşmazlığı onayı engeller. Çalışma günleri tekrarlanamaz.
- Sıfır mühendis hatadır. 1–4 mühendis varsa mezun oldukları bölümler gerekir. 5 ve üstü için bölüm bilgisi uyarısı üretilmez. Mühendis sayısı toplam çalışanı aşamaz.
- İşveren imzası ve kaşesi bulunmalı; öğrenci ve danışman onay alanları boş olmalıdır. Bunları komisyon orijinal belge üzerinden manuel işaretler.

OCR/HTR, otomatik belge/form karşılaştırması veya otomatik imza/kaşe tanıma yoktur. Rapor bu sınırı açıkça bildirir. Öğrencinin girdiği alanlar ve orijinal belge yan yana incelenebilir.

## Yapılandırma

`config/validation.json` her doğrulamada okunur. JSON bozuksa veya değerleri geçersizse doğrulama başarısız olur; onay verilmez.

```json
{
  "validateTcChecksum": false,
  "academicPeriods": {}
}
```

`validateTcChecksum` gerçek boolean olmalıdır. Resmî üniversite staj pencereleri sağlanmadığı için `academicPeriods` boş bırakıldı; dönem tarihi uydurulmaz. Bu durumda rapor uyarı verir; yalnızca bu opsiyonel kontrolün yapılamaması otomatik hata değildir.

Gerçek, onaylanmış izin verilen staj aralıkları sağlanırsa anahtar `2026-2027 Yaz` biçiminde, değer `{ "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }` olmalıdır. Başlangıç ve bitiş bu aralığın tamamen içinde olmalıdır. Bu alan ders takviminin kendisi değil, izin verilen **staj penceresidir**.

Tatil kapsamı hâlâ yalnızca 2026/2027'dir; kaynaklar ve yarım gün varsayımı [Aşama 5 notlarında](stage-5.md) kayıtlıdır. Bu aşamada başka yıllar için tarih tahmin edilmedi. Üretim paketinde `config/validation.json` ve derlenmiş ortak paketi koruyun.

## Rapor ve onay

Rapor `engineVersion`, `engineComplete`, `automatedPassed`, `readyForApproval`, hesaplanan gün, son teslim tarihi, alan sonuçları, özet sayılar, hatalar, uyarılar, bekleyen kontroller ve öneriler içerir.

`engineComplete: true` motorun çalıştığı anlamındadır; tüm kontrollerin geçtiği anlamında değildir. Onaya hazır olmak için otomatik hatalar olmamalı ve dört manuel kontrol olumlu kaydedilmelidir. Uyarılar tek başına onayı engellemez.

Eski Aşama 5 raporları kendiliğinden başarılıya çevrilmez. Yönetici detay sayfasında **Raporu yeniden doğrula** düğmesiyle güncelleyebilir. İnceleme başlatmak, manuel kontrolleri kaydetmek ve yeniden belge göndermek de raporu günceller.

### Tam senaryo

1. Öğrenci tam kayıtlı hesabıyla formu, adres bileşenlerini ve Ek-16'yı gönderir.
2. Hata varsa rapordan nedenini görür. Yönetici incelemeyi başlatıp gerekçeli düzeltme ister.
3. Öğrenci INVALID durumundaki başvuruyu düzeltir; yeni belgeyle birlikte yeniden gönderir. Önceki manuel kontroller sıfırlanır.
4. Yönetici orijinal belgeyi ve formu karşılaştırır, dört manuel alanı kaydeder.
5. Hatasız raporla **Başvuruyu onayla** açılır. Kullanıcı onayından sonra sunucu, güncel veri seti ve kurallarla yeniden doğrular.
6. **Tamamlandı olarak işaretle** de aynı güncel kontrolü tekrarlar. Veri seti bu sırada değişmişse eski olumlu rapora güvenilmez; işlem 409 ile reddedilir.
7. Tamamlanan belge ayrı listede görünür. Başvuru ve rapor tekrar düzenlenemez.

Rapor, durum/manual değişiklik ve başvuru hedefi içeren audit kaydı aynı MongoDB transaction'ında yazılır. Sürüm koşulu eşzamanlı başvuru güncellemelerini engeller. Başarısız onayda işlem geri alınır; güncel hataları görmek için raporu yeniden doğrulayın.

## Ek endpoint

`POST /api/v1/admin/applications/:id/validate` — ROLE_ADMIN; tamamlanmamış başvuruyu güncel veri seti ve kurallarla yeniden raporlar. Başvuru durumu değişmez. COMPLETED için 409 döner.

## Testler

6 Kasım 2026: 13 arayüz testi ve 52 yerel backend testi başarılı. Ayrı Atlas veritabanındaki canlı senaryo; onay öncesi eksik manuel kontrolün reddini, olumlu rapor sonrasında değişen öğrenci kaydıyla onay/tamamlamanın engellenmesini, kayıt düzeltildikten sonra onay ve tamamlamayı doğruladı. Oluşturulan test kayıtları ve belgeleri temizlendi. Üretim derlemesi ve TypeScript kontrolleri başarılı.

`npm.cmd test`: 22 motor senaryosu, rapor kategorileri/filtreleme, onay düğmesi engeli, kısmi manuel kontrolün false değerleriyle gönderilmesi ve onay diyaloğu dahil yerel testler.

Canlı test ayrı `kou_staj_validation_tests` veritabanında sentetik kullanıcılarla tam onay/tamamlama ve eski raporun güncel kayıt değişikliğini atlayamaması senaryosunu sınar. Test kendi dosya ve kayıtlarını temizler.

```powershell
npm.cmd test
npm.cmd run build
$env:LIVE_AUTH_TEST='1'
npm.cmd exec -w @kou/server -- vitest run tests/validation.live.test.ts
Remove-Item Env:LIVE_AUTH_TEST
```

Gerçek tarayıcıda görsel kontrol yapılmadı; arayüz etkileşimleri React Testing Library ile sınandı.

## Sonraki aşama

Aşama 7: başvuru arama/tarih filtreleri, sunum ve teslim belgeleri, UML/ER/sequence/activity/mimari diyagramları, pseudocode, teknik rapor notları ve demo senaryosunun tamamlanması. Final özellikleri olan OCR/HTR, Google Form ve Ek-17 kapsam dışında kalır.
