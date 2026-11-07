# Vize master uygulama ön incelemesi — 7 Kasım 2026

Kaynaklar yeniden incelendi: App/ApplicationForm/ApplicationViews/ImportPage, auth/import/application route'ları, modeller, parser/güvenlik servisleri, rapor motoru, shared sözleşmeler ve testler. Önceki ayrıntılı analiz [burada](vize-requirements-gap-analysis.md); bu dosya yeni uygulama aşamalarının başlangıç kaydıdır.

| Bileşen | Durum | İşlem |
|---|---|---|
| React/Express/Mongoose mimarisi ve mevcut UI | MEVCUT / KORUNMALI | Yeniden kurulum yok |
| JWT/session, ownership, CSRF, upload güvenliği, rate limit, audit | MEVCUT / KORUNMALI | Yeni API'ler aynı katmanlardan geçmeli |
| Import parser, preview ve transaction | MEVCUT / KORUNMALI | CSV/XLSX ve hatalı satır davranışı korunacak |
| Import → User/StudentProfile/parola | DEĞİŞTİRİLMELİ | PHASE 1: bağımsız referans kayıtları |
| Bağımsız referans modeli ve kayıt görünümü | EKSİK | PHASE 1 |
| Self-registration ve minimum profil tamamlama | EKSİK | PHASE 2 |
| Kontrollü admin bootstrap | KISMEN MEVCUT | PHASE 2: demo fixture'dan ayır |
| Manuel form ve Application.data kalıcılığı | MEVCUT / KORUNMALI | Şablon uyumu ayrıca doğrulanacak |
| DOCX/PDF/DOC alan çıkarımı ve extraction modeli | EKSİK | PHASE 3 |
| Gerçek şablon | BULUNAMADI | Kaynaklarda şablon saptanmadı; doğrulanmış eşleme iddia edilmez |
| Üç kaynaklı karşılaştırma/sürüm/stale | EKSİK | PHASE 4; mevcut profil karşılaştırması bunun yerine geçmez |
| ValidationEngine ve kural sınıfları | MEVCUT / DEĞİŞTİRİLMELİ | PHASE 5: VIZE/FINAL onay politikası |
| COMPLETED öğrenci kilidi | MEVCUT / KORUNMALI | PHASE 5 admin istisnaları ayrı |
| COMPLETED admin içerik update/soft delete | EKSİK | PHASE 5 |
| Yeni kabul senaryosu ve diyagramlar | DEĞİŞTİRİLMELİ | Her aşama ilgili test; bütün kabul PHASE 6 |

## PHASE 1 öncesi veri modeli ve geçiş planı

- Yeni `StudentReferenceRecord` koleksiyonu eklenir. User/StudentProfile/Application koleksiyonları yeniden yazılmaz, kopyalanmaz veya silinmez. Yeni modelde öğrenci numarası string, `studentNumber + version` benzersiz indeks olur.
- Tekrar aktarım mevcut referansı ezmez: aynı öğrenci numarası için yeni immutable sürüm eklenir. Liste güncel sürümü gösterir; eski sürümler saklanır. Aynı dosyadaki tekrarlar mevcut parser tarafından reddedilir. Eşzamanlı sürüm çakışması güvenli 409 ve transaction rollback üretir.
- ImportBatch yeni akış için `purpose=REFERENCE` etiketi ve önizleme anındaki referans sürümünü taşır. Eski etiketsiz batch'ler yeni referans gibi yorumlanmaz; tekrar dosya yüklenmesi istenir. Eski hesapların ve şifrelerin çalışması korunur.
- Import onayı artık hesap/şifre üretmez; önizleme ve sonuç UI'sindeki credentials indirme kaldırılır. Mevcut endpoint yolları korunur, yanıtın credentials alanı kaldırıldığı için bu sözleşme değişikliği belgelenir.
- Yeni DB/index kodunu dağıtmadan önce MongoDB + private storage birlikte yedeklenmelidir: [plan](backup-and-recovery.md). Bu çalışma üretim migration/restore çalıştırmaz. Model indeksleri yalnız kontrollü uygulama başlangıcı/model init veya ilk kullanımda oluşturulabilir; testler ayrı DB kullanır. Prod indeks oluşturma deployment adımıdır.
- Rollback uygulama sürümünü geri almak olabilir; eski import davranışı tekrar hesap üretir, bu nedenle yazma rotasını kontrol etmeden eski sürüme dönülmemeli. Yeni koleksiyonu silmek rollback adımı değildir.
- Bu aşamada referans koleksiyonu mevcut doğrulama motoruna bağlanmaz. Bağımsız referansların rapora katılması PHASE 4'tür; yeni importun kayıtlı öğrenci/dashboardsayılarını artırmaması beklenen davranıştır.

Bu kayıt, değişiklik öncesi tasarım ve veri koruma açıklamasıdır. Aşama tamamlanma kanıtları ayrı raporlanacaktır.

## PHASE 2 model/geçiş notu

StudentProfile.department zorunluluğu kaldırıldı; previousInternshipDays için otomatik 0 varsayımı kaldırıldı. Böylece minimum profil yalnız user/studentNumber ile saklanır; diğer alanlar gerçekten girilene kadar eksik kalır. Eski belgeler ve hesaplar yeniden yazılmaz. Mevcut unique user/studentNumber ve partial identityNumber indeksleri korunur; yeni profil koleksiyonu veya toplu migration yoktur. Yeni kayıt User + profil + audit transaction'ıdır. Profil güncellemesi yalnız kendi user kimliğine bağlı allowlist alanlarını değiştirir, referans kaydı oluşturmaz/değiştirmez.

Yedekleme gereksinimi ve üretim doğrulaması önceki planla aynıdır. Bu tur mevcut üretim hesaplarına bootstrap/seed çalıştırılmadı. Yeni API'ler ve bootstrap servis testi ayrı registration test DB'sindedir. PHASE 1/2 tamamlanma raporları başlangıçtaki EKSİK tablosunun sonraki durumunu gösterir; tablo düzeltme öncesi kanıt olarak bırakıldı.
