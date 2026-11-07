# Ek-16 alan haritası — PHASE 3

7 Kasım 2026. Proje kaynakları ve kullanıcı attachment klasöründe DOCX/PDF şablon arandı; gerçek Ek-16 şablonu bulunamadı. Örnek adı `20231115_c4b13_ek-16-1-a0f.docx` olan dosya mevcut kabul edilmedi. Private storage'daki kişisel belgeler şablon diye kullanılmadı.

**Şablon sürümü: `label-map-unverified-v1`. Gerçek KOÜ şablon uyumu: DOĞRULANMADI.** Aşağıdaki etiket tabanlı harita yeni gereksinim listesinden türetilmiştir. Sentetik tablolu DOCX/PDF/DOC testleri gerçek şablon kabulünün yerine geçmez. Etiket eşleşmesi bulunmayan/çelişen hücreler tahminle doldurulmaz.

| Grup | Manuel alan / extraction anahtarı | Desteklenecek açık etiketler |
|---|---|---|
| Öğrenci | name | Ad soyad, Adı soyadı |
| Öğrenci | studentNumber | Öğrenci numarası, Öğrenci no |
| Öğrenci | identityNumber | TC / yabancı kimlik numarası, TC kimlik no |
| Öğrenci | nationality | Uyruk, Uyruğu |
| Öğrenci | department | Bölüm, Bölümü |
| Öğrenci | birthDate | Doğum tarihi |
| Öğrenci | academicYear | Öğretim yılı |
| Öğrenci | previousInternshipDays | Önceden yapılan staj günü, Önceki staj günü |
| Öğrenci | email / phone / address | E-posta, Telefon, İkametgâh adresi |
| Öğrenci | healthStatus | Sağlık yardımı statüsü |
| İşyeri | companyName / serviceArea / abroad | İşyeri adı, Hizmet alanı, Yurt dışı stajı |
| İşyeri | startDate / endDate / declaredDays | Staj başlangıç tarihi, Staj bitiş tarihi, Staj gün sayısı |
| İşyeri | companyPhone / fax / companyEmail / website | İşyeri telefonu, Faks, İşyeri e-postası, Web adresi |
| İşyeri | employeeCount / engineerCount / engineerDepartments | Çalışan sayısı, Mühendis sayısı, Mühendislerin mezun olduğu bölümler |
| İşyeri | paid / companyAddress | Ücret alma durumu, İşyeri adresi |
| Yetkili | employerName / employerTitle / employerPhone / employerEmail | Yetkili ad soyad, Görev/unvan, Yetkili telefonu, Yetkili e-postası |

Tekrarlanan Ad soyad/Telefon/E-posta/Adres etiketleri yalnız açık bölüm başlığıyla bağlanır. Belirsiz bölümde birden çok aday varsa otomatik seçim yapılmaz. Metin kutuları XML paragraf akışında incelenebilir; görsel konum ve şekil ilişkilerinin gerçek şablonla uyumu doğrulanmadı.

DOCX: sıralı XML node'ları, tablo/satır/hücre ve gridSpan/vMerge kaynak metadata'sı korunur. Boş hücre değeri sonraki satırdan alınmaz. PDF: metin parçası koordinatları korunur, aynı yatay satırdaki açık etiket/değer ilişkileri kullanılır. DOC: buffer tabanlı Word okuyucusu; gövde metnindeki açık etiketler değerlendirilir, hücre koordinatı varmış gibi gösterilmez.

Hafta sonu çalışma tek başına haftanın hangi günlerinin seçildiğini kanıtlamaz; çalışma günleri tahmin edilmez. İmza/kaşe ve boş onay alanları otomatik analiz edilmez. Checkbox seçenekleri ve birleşik görsel sağlık alanları, açık etiket/değer yoksa manuel inceleme gerektirir. Sadece metin çıkarabilmek bütün alanların doğru okunduğu anlamına gelmez.

Yeni `DocumentExtraction` kaydı immutable Document ID/hash/sürümüne bağlı eklenecek; Application.data korunacak. Eski başvurular otomatik backfill edilmez, extraction API'si eski kayıtlar için açık unavailable sonucu verecek. Yeni indeks yalnız extraction koleksiyonuna aittir. Üretim migration/restore/seed çalıştırılmayacak; dağıtımdan önce [DB ve dosya yedek planı](backup-and-recovery.md) uygulanmalıdır.
