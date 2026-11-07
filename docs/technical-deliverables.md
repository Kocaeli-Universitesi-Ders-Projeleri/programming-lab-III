# Vize teknik teslimleri

Mermaid kaynakları: [mimari](diagrams/architecture.mmd), [sınıf](diagrams/class.mmd), [veri ilişkileri](diagrams/database.mmd), [giriş sequence](diagrams/authentication-sequence.mmd), [işlem akışı](diagrams/validation-flow.mmd), [kullanım senaryoları](diagrams/use-cases.mmd). UML sınıf/sequence ve akış kaynakları hazırlanmıştır; dış renderer ile görsel doğrulama yapılmadı. ER ilişkileri Mongoose referanslarıdır; MongoDB foreign-key constraint sağlamaz. Transaction ve uygulama kontrolleri ayrıca gereklidir.

[OOP açıklaması](oop-explanation.md) soyut sınıf, kalıtım, kapsülleme ve polimorfizmin gerçek kod karşılıklarını içerir. Güvenlik katmanları mevcut route/service/model yapısını korur; yeni final özellikleri eklenmedi.

## Temel algoritma

```text
validate(application, student, options, manualChecks):
  results = her ValidationRule.validate(context) sonucunu birleştir
  days = seçilmiş çalışma günlerini say, doğrulanmış tatilleri çıkar
  automaticPassed = otomatik hata bulunmaması
  manualPassed = dört komisyon kontrolünün de true olması
  readyForApproval = automaticPassed AND manualPassed AND pending yok
  sonucu, önerileri ve dayanakları raporla

approve(application):
  yetkiyi ve geçerli durum geçişini doğrula
  güncel veri ve kurallarla yeniden validate et
  readyForApproval değilse reddet
  optimistic version koşuluyla durum ve audit kaydını transaction içinde yaz
```

## Sunum senaryosu

1. Sentetik veriyle admin girişini, öğrenci veri seti önizlemesini, hatalı satırların ayrılmasını ve onay sonrası tek seferlik hesap çıktısını göster.
2. Öğrenci hesabıyla profil, Ek-16 dosyası ve yapılandırılmış alanları gönder; hatalı tarih/eksik imza durumunun raporunu göster.
3. Başka öğrenciye ait belge/başvuruya erişimin reddedildiğini göster.
4. Admin olarak orijinal belgeyi karşılaştır, manuel kontrolleri kaydet, yeniden doğrula; uygun başvuruyu onaylayıp tamamla.
5. Tamamlanan kaydın değiştirilemediğini, logout sonrası korunan API'nin 401 verdiğini ve çerez tercihlerini göster.

Canlı API ve bileşen testleri bu akışların parçalarını doğrular; bu senaryo gerçek tarayıcıda baştan sona uygulanmış olarak raporlanmaz. Resmî Ek-16 DOCX ve yönerge PDF dosyaları teslim edilmediğinden görsel belge eşleştirmesi ve tüm kurumsal kuralların kaynakla birebir doğrulaması bekler. OCR/HTR, Google Form ve Ek-17 kapsam dışıdır.
