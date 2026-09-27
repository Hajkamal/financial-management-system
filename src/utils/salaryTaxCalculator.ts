/**
 * سامانه محاسبه دقیق مالیات حقوق و دستمزد سال ۱۴۰۵
 * منطبق بر آخرین احکام لایحه بودجه سال ۱۴۰۵ و مواد ۸۴ و ۸۵ قانون مالیات‌های مستقیم (ق.م.م)
 * 
 * سقف معافیت سالانه: ۴۸۰ میلیون تومان (۴,۸۰۰,۰۰۰,۰۰۰ ریال)
 * سقف معافیت ماهانه: ۴۰ میلیون تومان (۴۰۰,۰۰۰,۰۰۰ ریال)
 */

export interface TaxSlab {
  id: number;
  label: string;
  minAmountRial: number;        // کف پله به ریال
  maxAmountRial: number | null; // سقف پله به ریال (null برای آخرین پله نامحدود)
  rate: number;                 // نرخ مالیات (مثلاً 0.10 برای ۱۰٪)
  ratePercent: number;          // درصد نرخ (۱۰)
  maxTaxRial?: number;          // حداکثر مالیات ممکن در این پله
}

export interface TaxSlabBreakdownItem {
  slabId: number;
  label: string;
  ratePercent: number;
  minRial: number;
  maxRial: number | null;
  taxableAmountInSlab: number; // مبلغی از حقوق که در این پله قرار گرفته (ریال)
  taxAmountInSlab: number;     // مالیات محاسبه شده این پله (ریال)
}

export interface SalaryTaxCalculationResult {
  grossSalaryRial: number;           // حقوق ناخالص وارد شده (ریال)
  exemptThresholdRial: number;       // سقف معافیت ماهانه سال ۱۴۰۵ (۴۰۰,۰۰۰,۰۰۰ ریال / ۴۰ میلیون تومان)
  exemptAmountRial: number;          // مبلغی که مشمول معافیت شده (ریال)
  taxableAmountRial: number;         // مابه‌التفاوت مشمول مالیات (ریال)
  totalTaxRial: number;              // کل مالیات محاسبه‌شده ماهانه (ریال)
  effectiveTaxRatePercent: number;   // نرخ موثر مالیات
  hasInsurance: boolean;             // آیا کارمند مشمول بیمه تامین اجتماعی است؟
  employeeInsuranceShareRial: number;// سهم بیمه کارگر (۷٪ در صورت مشمولیت، وگرنه ۰)
  netTakeHomeRial: number;           // خالص دریافتی (کسر مالیات و در صورت مشمولیت کسر ۷٪ بیمه)
  netBeforeInsuranceRial: number;    // خالص دریافتی صرفاً با کسر مالیات
  slabsBreakdown: TaxSlabBreakdownItem[]; // تفکیک محاسباتی پله به پله
  appliedYear: number;
  lawTitle: string;
}

// =========================================================================
// جدول پله‌های مالیات حقوق سال ۱۴۰۵ (بر اساس احکام بودجه ۱۴۰۵)
// معافیت ماهانه: ۴۰ میلیون تومان (۴۰۰,۰۰۰,۰۰۰ ریال)
// معافیت سالانه: ۴۸۰ میلیون تومان (۴,۸۰۰,۰۰۰,۰۰۰ ریال)
// =========================================================================
export const SALARY_TAX_SLABS_1405: TaxSlab[] = [
  {
    id: 1,
    label: 'طبقه ۱: تا ۴۰۰ میلیون ریال (تا ۴۰ میلیون تومان در ماه)',
    minAmountRial: 0,
    maxAmountRial: 400_000_000,
    rate: 0,
    ratePercent: 0,
    maxTaxRial: 0,
  },
  {
    id: 2,
    label: 'طبقه ۲: ۴۰۰ تا ۸۰۰ میلیون ریال (۴۰ تا ۸۰ میلیون تومان)',
    minAmountRial: 400_000_000,
    maxAmountRial: 800_000_000,
    rate: 0.10,
    ratePercent: 10,
    maxTaxRial: 40_000_000, // حداکثر ۴ میلیون تومان
  },
  {
    id: 3,
    label: 'طبقه ۳: ۸۰۰ تا ۱,۰۰۰ میلیون ریال (۸۰ تا ۱۰۰ میلیون تومان)',
    minAmountRial: 800_000_000,
    maxAmountRial: 1_000_000_000,
    rate: 0.15,
    ratePercent: 15,
    maxTaxRial: 30_000_000, // حداکثر ۳ میلیون تومان
  },
  {
    id: 4,
    label: 'طبقه ۴: ۱,۰۰۰ تا ۱,۲۰۰ میلیون ریال (۱۰۰ تا ۱۲۰ میلیون تومان)',
    minAmountRial: 1_000_000_000,
    maxAmountRial: 1_200_000_000,
    rate: 0.20,
    ratePercent: 20,
    maxTaxRial: 40_000_000, // حداکثر ۴ میلیون تومان
  },
  {
    id: 5,
    label: 'طبقه ۵: ۱,۲۰۰ تا ۱,۴۰۰ میلیون ریال (۱۲۰ تا ۱۴۰ میلیون تومان)',
    minAmountRial: 1_200_000_000,
    maxAmountRial: 1_400_000_000,
    rate: 0.25,
    ratePercent: 25,
    maxTaxRial: 50_000_000, // حداکثر ۵ میلیون تومان
  },
  {
    id: 6,
    label: 'طبقه ۶: مازاد بر ۱,۴۰۰ میلیون ریال (۱۴۰ میلیون تومان به بالا)',
    minAmountRial: 1_400_000_000,
    maxAmountRial: null,
    rate: 0.30,
    ratePercent: 30,
  },
];

/**
 * محاسبه خودکار و پلکانی مالیات حقوق سال ۱۴۰۵
 * @param grossSalaryRial مبلغ حقوق ماهانه ناخالص به ریال
 * @param hasInsurance آیا کارمند بیمه دارد؟ (اگر بله، ۷٪ سهم بیمه محاسبه و کسر می‌شود؛ در غیر اینصورت سهم بیمه صفر است و فقط مالیات کسر می‌گردد)
 */
export function calculateSalaryTax1405(
  grossSalaryRial: number,
  hasInsurance: boolean = false
): SalaryTaxCalculationResult {
  const salary = Math.max(0, Math.round(grossSalaryRial || 0));
  const exemptThreshold = 400_000_000; // ۴۰ میلیون تومان در ماه (۴۸۰ م.ت سالانه)

  // سهم ۷٪ بیمه تامین اجتماعی کارگر: صرفاً در صورت مشمولیت بیمه
  const employeeInsuranceShareRial = hasInsurance ? Math.round(salary * 0.07) : 0;

  // مبنای محاسبه مالیات: حقوق ناخالص مصوب
  const taxBaseSalary = salary;

  let totalTax = 0;
  const slabsBreakdown: TaxSlabBreakdownItem[] = [];

  for (const slab of SALARY_TAX_SLABS_1405) {
    if (taxBaseSalary <= slab.minAmountRial) {
      slabsBreakdown.push({
        slabId: slab.id,
        label: slab.label,
        ratePercent: slab.ratePercent,
        minRial: slab.minAmountRial,
        maxRial: slab.maxAmountRial,
        taxableAmountInSlab: 0,
        taxAmountInSlab: 0,
      });
      continue;
    }

    const slabFloor = slab.minAmountRial;
    const slabCeil = slab.maxAmountRial;

    let taxableInThisSlab = 0;
    if (slabCeil === null) {
      // بالاترین پله بدون سقف
      taxableInThisSlab = taxBaseSalary - slabFloor;
    } else {
      taxableInThisSlab = Math.min(taxBaseSalary, slabCeil) - slabFloor;
    }

    const taxInThisSlab = Math.round(taxableInThisSlab * slab.rate);
    totalTax += taxInThisSlab;

    slabsBreakdown.push({
      slabId: slab.id,
      label: slab.label,
      ratePercent: slab.ratePercent,
      minRial: slab.minAmountRial,
      maxRial: slab.maxAmountRial,
      taxableAmountInSlab: taxableInThisSlab,
      taxAmountInSlab: taxInThisSlab,
    });
  }

  const taxableAmountRial = Math.max(0, taxBaseSalary - exemptThreshold);
  const exemptAmountRial = Math.min(taxBaseSalary, exemptThreshold);
  const effectiveTaxRatePercent = salary > 0 ? Number(((totalTax / salary) * 100).toFixed(2)) : 0;
  const netBeforeInsuranceRial = Math.max(0, salary - totalTax);
  // خالص پرداختی: در صورت داشتن بیمه، سهم ۷٪ هم کسر می‌شود؛ در غیر اینصورت فقط مالیات کسر می‌گردد
  const netTakeHomeRial = Math.max(0, salary - totalTax - employeeInsuranceShareRial);

  return {
    grossSalaryRial: salary,
    exemptThresholdRial: exemptThreshold,
    exemptAmountRial,
    taxableAmountRial,
    totalTaxRial: totalTax,
    effectiveTaxRatePercent,
    hasInsurance,
    employeeInsuranceShareRial,
    netTakeHomeRial,
    netBeforeInsuranceRial,
    slabsBreakdown,
    appliedYear: 1405,
    lawTitle: 'لایحه بودجه سال ۱۴۰۵ (سقف معافیت ۴۰ میلیون تومان در ماه و ۴۸۰ میلیون تومان در سال)',
  };
}
