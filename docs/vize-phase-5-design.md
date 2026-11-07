# PHASE 5 — Politika ve yetkili düzeltme tasarımı

7 Kasım 2026. Uygulama öncesi model/geçiş notu. Kurallar silinmez: ValidationEngine açık VIZE/FINAL politikası kullanır. Uygulama config varsayılanı VIZE; eski doğrudan sınıf çağrılarının FINAL davranışı korunur. VIZE'de temel şema ve kaydedilmiş komisyon kontrolleri zorunlu, ileri kurallar bilgilendirici olur. Karşılaştırma güncelliği/gerekçeli inceleme ve dosya güvenliği her iki politikada zorunludur. İstemci politikayı request body ile seçemez. Eski policy'siz rapor GET'te güncel sayılmaz; sunucu yeniden doğrular.

Application'a deletedAt/deletedBy/deletionReason eklenir. deletedAt:null filtresi eski alanı bulunmayan kayıtları aktif kabul eder; toplu backfill/reset yoktur. Tüm liste/sayaç/detail/rapor/extraction/comparison/download yolları silinmiş üst başvuruyu dışlamalı. Dosyalar, extraction/karşılaştırma geçmişi kalıcı olarak silinmez. Admin audit endpoint'i silinmiş kaydın geçmişine erişir; öğrenciye açılmaz.

Yeni ApplicationRevision koleksiyonu admin update/delete için önceki ve sonraki form/belge/durum/sürüm snapshot'ı ve aktör/gerekçe/zaman saklar. (application, fromVersion) unique indeks olur. Güncelleme ve soft delete mevcut optimistic version koşuluyla transaction içindedir. Eski sürümle yarışan istek 409 alır.

Admin update tam form, gerekçe, beklenen version ve isteğe bağlı yeni dosya kabul eder. Yeni dosya mevcut güvenlik/extraction/private storage katmanından geçer. Başvuru UNDER_REVIEW'a döner; manuel kontroller temizlenir, formVersion artırılır, eski ValidationReport onaya kapatılır. Yeni comparison otomatik üretilmez: eski rapor STALE kalır, yeniden karşılaştırma ve inceleme gerekir. Eski dosya/snapshot revision'da korunur. Öğrenci edit/silme/reupload yetkisi genişletilmez.

Üretim koleksiyonları toplu taşınmaz, kullanıcı/şifreler değişmez. Yeni index/model dağıtımından önce MongoDB + özel storage birlikte yedeklenmelidir: [plan](backup-and-recovery.md). Testler yalnız ayrı test DB'sinde kendi fixture'larıyla yapılacaktır. Gerçek production restore veya seed çalıştırılmayacaktır.
