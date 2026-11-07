# Yedekleme ve geri dönüş planı

7 Kasım 2026. Bu bir işletim planıdır; gerçekleştirilmiş restore kanıtı değildir. Makinede `mongodump` / `mongorestore` bulunmadı. Atlas snapshot, PITR, saklama ve Network Access ayarlarına yönetim erişimi yoktur. Restore: **NOT TESTED**.

## Yedek kapsamı

MongoDB kayıtları ve özel belge dizini birlikte korunmalıdır. Yalnızca Atlas snapshot'ı belgeleri içermez. Kaynak/config sürümü ve doğrulama konfigürasyonu da kaydedilir; parolalar yedek manifestine veya komut satırına yazılmaz. Şifreleme anahtarları ayrı yetkili kasada tutulur. Öğrenci kimlik/sağlık verisi nedeniyle erişim, saklama süresi ve imha politikası kurumca onaylanmalıdır.

Önerilen başlangıç hedefi günlük yedek ve 30 gün saklama; RPO 24 saat, RTO 4 saat. Bunlar sağlanmış SLA değildir. Kurum ihtiyacına göre kararlaştırılıp restore süresi ölçülmelidir.

## Tutarlı kopya

1. Bakım penceresinde yeni yazmaları durdur; devam eden import/yükleme işlemlerinin bitmesini bekle.
2. Atlas'ın yetkili snapshot/export mekanizmasıyla veritabanını yedekle. Şifreli çıktı, başlangıç/bitiş zamanı ve snapshot kimliğini yetkili kayda geçir.
3. `PRIVATE_STORAGE_DIR` içeriğini bağımsız, şifreli yedek hedefe **kopyala**. Hardlink kullanma: indirme güvenliği çok bağlantılı dosyayı reddeder. Dosyaları web köküne koyma.
4. Document kayıtlarındaki storageKey, size ve SHA-256 ile dosya manifestini karşılaştır. Kayıp/fazla dosyaları kişisel veri içermeyen sayılarla raporla. Manifest de hassas varlıktır.
5. Örnek dosyaların hash'ini ve yedek okunabilirliğini doğrula, ardından yazmaları aç. Yedeği kaynak sunucuyla aynı arıza alanında tutma.

## İzole restore tatbikatı

Üretim URI'si üzerinde restore, drop veya reset çalıştırma. Ayrı Atlas test projesi/veritabanı, ayrı kullanıcı ve boş özel dosya dizini kullan. Yedek verileri gerçek kişisel veri içeriyorsa erişimi ve test ortamını üretim kadar koru.

1. Snapshot'ı izole hedefe geri yükle, dosya kopyasını ayrı dizine aç; hedeflerin üretimden farklı olduğunu iki kişi doğrulasın.
2. Dosya hash/boyutlarını, ilişki ve kayıt sayılarını karşılaştır; yetim kayıtları raporla.
3. Test kullanıcısıyla giriş, kendi belge indirme, yabancı belge 403/404, rapor okuma ve tamamlanan kayıt değişmezliği senaryolarını çalıştır. Eski Session kayıtlarını geçersiz kılacak ayrı test JWT anahtarı kullan.
4. RPO/RTO'yu ölç, restore tutanağını tarih/sürüm/sorumlu/sonuç ile sakla. Başarısızlığı PASS olarak kapatma.
5. İzole ortamı kurumun saklama/imha prosedürüne göre kapat. Üretim üzerinde temizlik yapma.

Üretim geçişinden önce ilk başarılı tatbikat ve periyodik tekrar sorumlusu atanmalıdır.
