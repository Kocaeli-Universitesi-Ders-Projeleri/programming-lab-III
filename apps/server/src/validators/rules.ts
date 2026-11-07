import { applicationSchema, countInternshipDays, dateValue, type ApplicationInput, type ManualChecks, type RuleResult } from '@kou/shared';
import { ValidationRule, asText, nationality, normalized, type ValidationContext } from './ValidationRule.js';

export function normalizePhone(value: unknown, international = false) {
  let v = asText(value).replace(/[\s().-]/g, '');
  if (v.startsWith('00')) v = '+' + v.slice(2);
  if (!international) {
    if (/^0\d{10}$/.test(v)) v = '+90' + v.slice(1);
    else if (/^\d{10}$/.test(v)) v = '+90' + v;
    else if (/^90\d{10}$/.test(v)) v = '+' + v;
  }
  return v;
}
export function normalizeApplicationContacts(data: ApplicationInput): ApplicationInput {
  return { ...data, phone: normalizePhone(data.phone), companyPhone: normalizePhone(data.companyPhone, data.abroad), employerPhone: normalizePhone(data.employerPhone, data.abroad), fax: asText(data.fax) ? normalizePhone(data.fax, data.abroad) : '', email: asText(data.email).toLowerCase(), companyEmail: asText(data.companyEmail).toLowerCase(), employerEmail: asText(data.employerEmail).toLowerCase() };
}
export class SchemaValidationRule extends ValidationRule {
  validate({ application }: ValidationContext): RuleResult[] {
    const parsed = applicationSchema.safeParse(application);
    return parsed.success ? [this.result('SCHEMA', 'Form yapısı', '', true, 'Temel form yapısı geçerli.')] : parsed.error.issues.map((e, i) => this.result('SCHEMA_' + i, 'Form yapısı', e.path.join('.'), false, `${e.path.join('.')}: Alan eksik veya beklenen biçimde değil.`, 'Formdaki ilgili alanı kontrol edin.', 'invalid'));
  }
}
export class StudentMatchingRule extends ValidationRule {
  validate({ application: a, student: s }: ValidationContext): RuleResult[] {
    const fields = { studentNumber: 'Öğrenci numarası', name: 'Ad soyad', identityNumber: 'Kimlik numarası', nationality: 'Uyruk', department: 'Bölüm' } as const;
    return Object.entries(fields).map(([key, label]) => {
      const field = key as keyof typeof fields;
      const expected = field === 'nationality' ? nationality(s[field]) : normalized(s[field]);
      const actual = field === 'nationality' ? nationality(a[field]) : normalized(a[field]);
      if (!expected) return this.result('MATCH_' + key, 'Hesap profili eşleştirme', key, false, `${label} hesap profilinde eksik; profil eşleştirmesi yapılamadı.`, 'Staj komisyonundan kayıtlı öğrenci verisini düzeltmesini isteyin.', 'missing');
      return this.result('MATCH_' + key, 'Hesap profili eşleştirme', key, actual === expected, actual === expected ? `${label} kayıtla eşleşiyor.` : `${label} kayıtlı öğrenci verisiyle uyuşmuyor.`, 'Formu kayıtlı öğrenci bilgilerinizle karşılaştırın.', !actual ? 'missing' : 'mismatch');
    });
  }
}
export class IdentityValidationRule extends ValidationRule {
  validate({ application: a, options, today }: ValidationContext): RuleResult[] {
    const tc = nationality(a.nationality) === 'TR', id = asText(a.identityNumber);
    const shape = tc ? /^[1-9]\d{10}$/.test(id) : /^99\d{9}$/.test(id);
    const results = [this.result('IDENTITY_FORMAT', 'Öğrenci bilgileri', 'identityNumber', shape, shape ? 'Kimlik numarası biçimi geçerli.' : tc ? 'TC kimlik numarası 11 rakam olmalı ve sıfırla başlamamalı.' : 'Yabancı kimlik numarası 11 rakam olmalı ve 99 ile başlamalı.', 'Kimlik numarası ve uyruk alanlarını düzeltin.', id ? 'invalid' : 'missing')];
    if (tc && shape && options.validateTcChecksum) {
      const n = [...id].map(Number), digit10 = ((n[0]+n[2]+n[4]+n[6]+n[8])*7 - (n[1]+n[3]+n[5]+n[7]) + 100) % 10;
      const valid = digit10 === n[9] && n.slice(0,10).reduce((x,y) => x+y,0) % 10 === n[10];
      results.push(this.result('IDENTITY_CHECKSUM', 'Öğrenci bilgileri', 'identityNumber', valid, valid ? 'TC algoritmik kontrolü geçti.' : 'TC algoritmik kontrolü başarısız.', 'Kimlik numarasını kontrol edin.'));
    }
    const birth = dateValue(asText(a.birthDate));
    results.push(this.result('BIRTH_DATE', 'Öğrenci bilgileri', 'birthDate', Number.isFinite(birth) && birth < dateValue(today), 'Doğum tarihi geçmişte geçerli bir tarih olmalı.', 'Doğum tarihini kontrol edin.'));
    return results;
  }
}
export class ContactValidationRule extends ValidationRule {
  validate({ application: a }: ValidationContext): RuleResult[] {
    const groups = [{ email: 'email', phone: 'phone', label: 'Öğrenci', international: false }, { email: 'companyEmail', phone: 'companyPhone', label: 'İşyeri', international: a.abroad }, { email: 'employerEmail', phone: 'employerPhone', label: 'Yetkili', international: a.abroad }] as const;
    const results: RuleResult[] = [];
    for (const group of groups) {
      const email = asText(a[group.email]), phone = normalizePhone(a[group.phone], group.international);
      results.push(this.result('CONTACT_' + group.email, 'İletişim bilgileri', group.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), `${group.label} e-posta biçimi ${/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'geçerli.' : 'geçersiz veya eksik.'}`, 'Geçerli e-posta adresi girin.', email ? 'invalid' : 'missing'));
      const valid = group.international ? /^\+[1-9]\d{7,14}$/.test(phone) : /^\+90[1-9]\d{9}$/.test(phone);
      results.push(this.result('CONTACT_' + group.phone, 'İletişim bilgileri', group.phone, valid, `${group.label} telefonu ${valid ? 'geçerli.' : 'geçersiz veya eksik.'}`, group.international ? 'Uluslararası telefon numarasını +ülke koduyla girin.' : 'Telefonu +90 xxx xxx xx xx biçiminde girin.', phone ? 'invalid' : 'missing'));
    }
    if (asText(a.fax)) { const fax = normalizePhone(a.fax, a.abroad); results.push(this.result('CONTACT_FAX', 'İletişim bilgileri', 'fax', a.abroad ? /^\+[1-9]\d{7,14}$/.test(fax) : /^\+90[1-9]\d{9}$/.test(fax), 'Faks numarasının biçimi kontrol edildi.', 'Faksı telefon biçiminde girin veya boş bırakın.')); }
    return results;
  }
}
export class AddressValidationRule extends ValidationRule {
  validate({ application: a }: ValidationContext): RuleResult[] {
    const parts = { neighborhood: 'Mahalle', street: 'Cadde / sokak', buildingNumber: 'Bina numarası', apartmentNumber: 'Daire numarası', district: 'İlçe', city: 'İl' };
    const results: RuleResult[] = [];
    for (const prefix of ['', 'company']) for (const [key, label] of Object.entries(parts)) {
      const field = prefix ? prefix + key[0].toUpperCase() + key.slice(1) : key;
      const value = asText(a[field as keyof ApplicationInput]); const valid = Boolean(value) && !/^[-?—.]+$/.test(value);
      results.push(this.result('ADDRESS_' + field, prefix ? 'İşyeri bilgileri' : 'Adres bilgileri', field, valid, `${prefix ? 'İşyeri' : 'İkametgâh'} ${label.toLocaleLowerCase('tr-TR')}: ${valid ? 'girildi.' : 'eksik.'}`, `${label} alanını doldurun; daire yoksa “Müstakil” yazın.`, 'missing'));
    }
    return results;
  }
}
export class DateValidationRule extends ValidationRule {
  validate({ application: a, today }: ValidationContext): RuleResult[] {
    const start = dateValue(asText(a.startDate)), end = dateValue(asText(a.endDate)), submitted = dateValue(asText(a.submissionDate));
    const range = Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= 366 * 86400000;
    const deadline = Number.isFinite(start) ? new Date(start - 30 * 86400000).toISOString().slice(0,10) : 'belirlenemedi';
    return [this.result('DATE_RANGE', 'Tarih kontrolleri', 'endDate', range, range ? 'Staj tarih aralığı geçerli.' : 'Staj tarihleri geçersiz, ters sıralı veya 367 günden uzun.', 'Staj tarih aralığını düzeltin.'), this.result('SUBMISSION_DATE', 'Tarih kontrolleri', 'submissionDate', Number.isFinite(submitted) && submitted <= dateValue(today), 'Teslim tarihi gelecekte olmamalı.', 'Teslim tarihini kontrol edin.'), this.result('SUBMISSION_NOTICE', 'Tarih kontrolleri', 'submissionDate', Number.isFinite(start) && Number.isFinite(submitted) && start - submitted >= 30 * 86400000, `En geç teslim tarihi: ${deadline}.`, 'Başlangıcı en az 30 takvim günü sonrasına planlayın veya staj komisyonuyla görüşün.')];
  }
}
export class AcademicYearValidationRule extends ValidationRule {
  validate({ application: a, options }: ValidationContext): RuleResult[] {
    const year = asText(a.academicYear), valid = /^\d{4}-\d{4}$/.test(year) && +year.slice(5) === +year.slice(0,4)+1;
    const results = [this.result('ACADEMIC_YEAR', 'Akademik dönem', 'academicYear', valid, valid ? 'Öğretim yılı ardışık yıllardan oluşuyor.' : 'Öğretim yılı ardışık iki yıldan oluşmalı.', 'Örnek: 2026-2027.'), this.result('ACADEMIC_SEMESTER', 'Akademik dönem', 'semester', ['Güz','Bahar','Yaz'].includes(a.semester), 'Yarıyıl seçimi kontrol edildi.', 'Güz, Bahar veya Yaz seçin.')];
    const period = options.academicPeriods[`${year} ${a.semester}`];
    if (!period) results.push(this.notice('ACADEMIC_WINDOW_UNKNOWN', 'Akademik dönem', 'Bu dönem için izin verilen staj tarih aralığı tanımlı değil; dönem takvimiyle karşılaştırma yapılmadı.'));
    else { const fits = dateValue(asText(a.startDate)) >= dateValue(period.start) && dateValue(asText(a.endDate)) <= dateValue(period.end); results.push(this.result('ACADEMIC_WINDOW', 'Akademik dönem', 'startDate', fits, `İzin verilen staj aralığı: ${period.start} – ${period.end}.`, 'Staj tarihlerini tanımlı dönem aralığına göre düzeltin.')); }
    return results;
  }
}
export class InternshipDaysValidationRule extends ValidationRule {
  validate({ application: a }: ValidationContext): RuleResult[] {
    const weekdays = Array.isArray(a.workingDays) ? a.workingDays : [];
    const count = countInternshipDays(asText(a.startDate), asText(a.endDate), weekdays);
    const unique = new Set(weekdays).size === weekdays.length;
    const results = [this.result('WORKING_DAYS', 'Staj gün sayısı', 'workingDays', weekdays.length > 0 && unique, 'En az bir çalışma günü seçilmeli; günler tekrarlanmamalı.', 'Haftalık çalışma günlerini kontrol edin.'), this.result('HOLIDAY_COVERAGE', 'Staj gün sayısı', 'startDate', count.days !== null, count.days !== null ? `Tatil hesabı tamamlandı; ${count.excluded} gün düşüldü.` : `${count.message} Eksik yıllar: ${count.missingYears.join(', ') || 'yok; tarih/gün seçimini kontrol edin'}.`, 'Tatil yapılandırmasını tamamlayın veya geçerli tarih/gün seçin.')];
    if (count.days !== null) results.push(this.result('DECLARED_DAYS', 'Staj gün sayısı', 'declaredDays', count.days > 0 && a.declaredDays === count.days, `Hesaplanan: ${count.days}; beyan edilen: ${a.declaredDays} gün.`, 'Belgedeki gün sayısını ve çalışma günlerini birlikte kontrol edin.'));
    if (count.excluded % 1 || (count.days !== null && count.days % 1)) results.push(this.notice('HALF_DAY', 'Staj gün sayısı', 'Yarım tatiller 0,5 gün düşülerek çalışma süresi eşdeğeri hesaplandı; bölümün yarım gün kabul politikasını kontrol edin.'));
    return results;
  }
}
export class EngineerValidationRule extends ValidationRule {
  validate({ application: a }: ValidationContext): RuleResult[] {
    const valid = Number.isInteger(a.engineerCount) && a.engineerCount > 0;
    const results = [this.result('ENGINEER_COUNT', 'İşyeri bilgileri', 'engineerCount', valid, valid ? 'İşyerinde en az bir mühendis bulunuyor.' : 'İşyerinde en az bir mühendis bulunmalı.', 'Mühendis sayısını doğrulayın veya uygun işyeri seçin.'), this.result('EMPLOYEE_COUNT', 'İşyeri bilgileri', 'employeeCount', Number.isInteger(a.employeeCount) && a.employeeCount >= a.engineerCount && a.employeeCount > 0, 'Çalışan sayısı mühendis sayısından az olmamalı.', 'Çalışan ve mühendis sayılarını düzeltin.')];
    if (a.engineerCount >= 1 && a.engineerCount <= 4) results.push(this.result('ENGINEER_DEPARTMENTS', 'İşyeri bilgileri', 'engineerDepartments', asText(a.engineerDepartments).length >= 2, '1–4 mühendis için mezun oldukları bölümler belirtilmeli.', 'Mühendislerin mezun oldukları bölüm bilgilerini girin.', 'missing'));
    return results;
  }
}
export class EmployerValidationRule extends ValidationRule {
  validate({ application: a }: ValidationContext): RuleResult[] {
    const fields = { companyName: 'İşyeri adı', serviceArea: 'Hizmet alanı', companyAddress: 'İşyeri adresi', address: 'İkametgâh adresi', employerName: 'Yetkili adı', employerTitle: 'Yetkili görevi / unvanı' } as const;
    return Object.entries(fields).map(([key, label]) => this.result('EMPLOYER_' + key, 'İşveren bilgileri', key, asText(a[key as keyof ApplicationInput]).length > 1, `${label} kontrol edildi.`, `${label} alanını doldurun.`, 'missing'));
  }
}
export class ManualSignatureRule extends ValidationRule {
  validate({ manualChecks: checks }: ValidationContext): RuleResult[] {
    const labels: Record<keyof ManualChecks, string> = { employerSignature: 'İşveren imzası var', employerStamp: 'İşveren kaşesi var', studentApprovalEmpty: 'Öğrenci onay alanı boş', advisorApprovalEmpty: 'Staj danışmanı onay alanı boş' };
    return Object.entries(labels).map(([key, label]) => {
      const checked = checks?.[key as keyof ManualChecks];
      if (checked === undefined) return this.result('MANUAL_' + key, 'Manuel kontroller', key, false, `${label}: manuel inceleme bekleniyor.`, 'Komisyon orijinal belgeyi inceleyip manuel kontrolleri kaydetmeli.', 'pending', 'pending');
      return this.result('MANUAL_' + key, 'Manuel kontroller', key, checked === true, `${label}: ${checked ? 'doğrulandı.' : 'sağlanmadı.'}`, 'Belgedeki ilgili imza, kaşe veya onay alanını düzeltin.');
    });
  }
}
