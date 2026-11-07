import type { ApplicationInput, ManualChecks } from '@kou/shared';
import type { ValidationContext } from '../../src/validators/ValidationRule.js';
export const positiveManualChecks: ManualChecks = { employerSignature: true, employerStamp: true, studentApprovalEmpty: true, advisorApprovalEmpty: true };
export function validationFixture(): ValidationContext {
  const application: ApplicationInput = {
    name: 'Sentetik Öğrenci', studentNumber: 'TEST2026001', identityNumber: '10000000146', nationality: 'TR', department: 'Yazılım Mühendisliği', birthDate: '2003-01-15', academicYear: '2025-2026', semester: 'Yaz', previousInternshipDays: 0, email: 'sentetik@example.test', phone: '+905550000001', address: 'Örnek Mahallesi Test Sokak No:1 D:1 İzmit Kocaeli', healthStatus: 1,
    neighborhood: 'Örnek Mahallesi', street: 'Test Sokak', buildingNumber: '1', apartmentNumber: '1', district: 'İzmit', city: 'Kocaeli',
    startDate: '2026-07-01', endDate: '2026-07-31', submissionDate: '2026-06-01', workingDays: [1,2,3,4,5], declaredDays: 22,
    companyName: 'Sentetik İşletme', abroad: false, serviceArea: 'Yazılım', companyPhone: '+905550000002', fax: '', companyEmail: 'company@example.test', website: '', employeeCount: 20, engineerCount: 5, engineerDepartments: '', paid: false, companyAddress: 'Örnek Mahallesi Test Sokak No:2 İzmit Kocaeli',
    companyNeighborhood: 'Örnek Mahallesi', companyStreet: 'Test Sokak', companyBuildingNumber: '2', companyApartmentNumber: 'Müstakil', companyDistrict: 'İzmit', companyCity: 'Kocaeli',
    employerName: 'Sentetik Yetkili', employerTitle: 'Mühendis', employerEmail: 'employer@example.test', employerPhone: '+905550000003',
  };
  return { application, student: { name: application.name, studentNumber: application.studentNumber, identityNumber: application.identityNumber, nationality: application.nationality, department: application.department }, manualChecks: null, options: { validateTcChecksum: false, academicPeriods: {} }, today: '2026-06-01' };
}
