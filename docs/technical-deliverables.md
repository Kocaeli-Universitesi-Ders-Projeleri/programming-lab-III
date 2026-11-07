# Vize teknik teslimleri

PHASE 5 güncel durum: [politika ve admin yönetimi raporu](vize-phase-5.md), [completed düzeltme/silme akışı](diagrams/admin-completed-update-delete.mmd). VIZE ileri kuralları bilgilendirici tutar; temel şema, manuel komisyon kontrolleri ve güncel karşılaştırma zorunludur. FINAL ileri kuralları da onay kapısına dahil eder. Admin gerekçeli düzenleme sonrası UNDER_REVIEW ve yeniden karşılaştırma gerekir; öğrenci COMPLETED kilidi korunur. Aşağıdaki eski aşama notları tarihli açıklamalardır.

PHASE 4: [üç kaynak karşılaştırma akışı](diagrams/three-way-comparison.mmd), [tasarım/güncellik sözleşmesi](vize-phase-4-design.md), [aşama ve test kanıtları](vize-phase-4.md). Önceki aşama notlarından farklı olarak alan bazlı A/B/C raporu ve STALE kontrolü uygulanmıştır. VIZE/FINAL ayrımı ve admin completed içerik yetkileri hâlâ sonraki aşamadır.

PHASE 3 ekleri: [gerçek extractor sınıfları](diagrams/class.mmd), [extraction akışı](diagrams/document-extraction-flow.mmd), [alan haritası ve şablon doğrulama sınırı](ek16-field-mapping.md), [test raporu](vize-phase-3.md). Alan okuma ile üç kaynaklı karşılaştırma farklı aşamalardır; karşılaştırma henüz uygulanmadı.

Mermaid kaynakları: [mimari](diagrams/architecture.mmd), [sınıf](diagrams/class.mmd), [veri ilişkileri](diagrams/database.mmd), [giriş sequence](diagrams/authentication-sequence.mmd), [işlem akışı](diagrams/validation-flow.mmd), [kullanım senaryoları](diagrams/use-cases.mmd). UML sınıf/sequence ve akış kaynakları hazırlanmıştır; dış renderer ile görsel doğrulama yapılmadı. ER ilişkileri Mongoose referanslarıdır; MongoDB foreign-key constraint sağlamaz. Transaction ve uygulama kontrolleri ayrıca gereklidir.

[OOP açıklaması](oop-explanation.md) soyut sınıf, kalıtım, kapsülleme ve polimorfizmin gerçek kod karşılıklarını içerir. Güvenlik katmanları mevcut route/service/model yapısını korur; yeni final özellikleri eklenmedi.

## Temel algoritma

```text
validate(application, student, options, manualChecks):
  results = her ValidationRule.validate(context) sonucunu birleştir
  days = seçilmiş çalışma günlerini say, doğrulanmış tatilleri çıkar
  automaticPassed = aktif politikanın zorunlu kontrollerinde hata bulunmaması
  manualPassed = dört komisyon kontrolünün de true olması
  readyForApproval = automaticPassed AND manualPassed AND zorunlu pending yok
  sonucu, önerileri ve dayanakları raporla

approve(application):
  yetkiyi ve geçerli durum geçişini doğrula
  güncel veri ve kurallarla yeniden validate et
  güncel karşılaştırma ve gerektiğinde gerekçeli komisyon incelemesi ara
  readyForApproval değilse reddet
  optimistic version koşuluyla durum ve audit kaydını transaction içinde yaz
```

## Sunum senaryosu

1. Sentetik veriyle admin girişini, referans veri seti önizlemesini, hatalı satırların ayrılmasını ve onay sonrası bağımsız referans listesini göster. Aynı öğrenci için tekrar aktarımın eski referansı koruyup yeni sürüm eklediğini göster; hesap/parola üretilmez. [Aktarım akışı](diagrams/dataset-import-activity.mmd) günceldir.
2. Mevcut öğrenci hesabıyla profil, Ek-16 dosyası ve yapılandırılmış alanları gönder; hatalı tarih/eksik imza durumunun raporunu göster. Yeni self-registration PHASE 2'de, referans karşılaştırması PHASE 4'te uygulanacaktır; mevcut kural raporunu üç kaynaklı karşılaştırma olarak sunma.
3. Başka öğrenciye ait belge/başvuruya erişimin reddedildiğini göster.
4. Admin olarak orijinal belgeyi karşılaştır, manuel kontrolleri kaydet, yeniden doğrula; uygun başvuruyu onaylayıp tamamla.
5. Tamamlanan kaydın değiştirilemediğini, logout sonrası korunan API'nin 401 verdiğini ve çerez tercihlerini göster.

Canlı API ve bileşen testleri bu akışların parçalarını doğrular; bu senaryo gerçek tarayıcıda baştan sona uygulanmış olarak raporlanmaz. Resmî Ek-16 DOCX ve yönerge PDF dosyaları teslim edilmediğinden görsel belge eşleştirmesi ve tüm kurumsal kuralların kaynakla birebir doğrulaması bekler. OCR/HTR, Google Form ve Ek-17 kapsam dışıdır.
