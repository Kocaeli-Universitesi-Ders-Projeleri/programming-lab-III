# Aşama 3 — Öğrenci ve yönetici tasarımı

## Tamamlananlar

- Role göre sidebar, kullanıcı bilgileri, çıkış, aktif sayfa başlığı ve ana sayfa yönlendirmesi.
- Mobil menü; arka plana tıklayarak, kapat düğmesiyle veya Escape ile kapanır. Kapalı mobil menü klavye odağına girmez.
- Giriş ekranı panel yerleşiminin dışında kalır.
- Öğrenci dashboard'u: gerçek profil, öğrenci numarası, bölüm, öğretim yılı, hazırlık rehberi ve belge boş durumları.
- Öğrenci profil sayfası: yalnızca oturum sahibinin akademik ve iletişim bilgileri.
- Yönetici dashboard'u: Atlas'tan öğrenci sayısı, son eklenen öğrenciler ve son oturum hareketleri.
- Öğrenci yönetimi: sunucuda arama, bölüm filtresi, 10 kayıtlık sayfalama ve sonuç sayısı.
- Başvurular, tamamlanan belgeler, veri seti ve evrak yükleme için kapsamı açık sayfalar ve hazırlık rehberleri.
- Loading skeleton, boş durum, hata ve tekrar deneme; yatay kaydırılabilir tablolar.

## Gerçek veri ile henüz etkin olmayan alanların ayrımı

Öğrenci sayısı StudentProfile koleksiyonundan, öğrenci bilgileri User ilişkisi üzerinden, oturum hareketleri AuditLog koleksiyonundan gelir.

Başvuru modeli ve modülü Aşama 5 kapsamındadır. Bu nedenle başvuru sayıları `—`, API sözleşmesinde `applications: null` ve `applicationModuleReady: false` gösterilir. Başvuru durumu grafiği için boş durum vardır; sahte istatistik veya grafik üretilmez. Dosya seçme/kaydetme düğmesi bu aşamada sunulmaz. Rehber bağlantıları çalışan sayfalara gider.

## API

| Yol | Davranış |
|---|---|
| GET `/api/v1/admin/dashboard/stats` | Öğrenci sayısı, son 5 öğrenci ve son 5 başarılı giriş/çıkış |
| GET `/api/v1/admin/students?q=&department=&page=1` | Öğrenci numarası/ad/e-posta arama, bölüm filtresi, sayfalama |
| GET `/api/v1/students/me` | Önceki aşamadaki sahiplik kontrollü profil endpointi |

İki yeni admin endpointi de sunucu tarafında ROLE_ADMIN gerektirir. Arama regex karakterleri escape edilir, sorgu uzunluğu ve sayfa parametreleri Zod ile doğrulanır. Kullanıcı ilişkisi yalnızca ad ve e-posta alanlarıyla getirilir.

## Sayfalar

Öğrenci: `/student`, `/student/profile`, `/student/applications`, `/student/completed`, `/student/upload`.

Yönetici: `/admin`, `/admin/students`, `/admin/applications`, `/admin/completed`, `/admin/import`, `/system`, `/setup`.

## Kontroller

6 Kasım 2026: üretim derlemesi ve TypeScript kontrolleri başarılı. 6 arayüz testi ve 8 yerel API testi başarılı. Arayüz testleri girişin panel dışında olmasını, iki role göre menüleri, öğrenci profil geçişini, rol reddini ve giriş/çıkış yönlendirmelerini kontrol eder. Ayrı Atlas test veritabanındaki canlı senaryo da başarılı: öğrenci için admin endpointleri 403, gerçek dashboard sayımı, öğrenci arama/bölüm filtresi, regex karakterlerinin düz metin aranması ve geçersiz sayfa için 400 doğrulandı. Test kendi kayıtlarını temizledi. Tarayıcıda görsel kontrol yapılmadı.

## Sonraki aşama

Aşama 4: CSV/XLSX dosyasını parse etme, sütun ve satır doğrulaması, mükerrer denetimi, önizleme ve yönetici onayından sonra Atlas'a kayıt. Bu aşamada yalnızca mevcut kayıtların okunması eklendi; içe aktarma geliştirilmedi.
