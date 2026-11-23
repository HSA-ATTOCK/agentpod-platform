/**
 * Business details used on the Terms of Service and Privacy Policy pages.
 * FILL THESE IN before launch, and have both pages checked by a lawyer in your country.
 * While any value still starts with "[", the pages show a "draft" notice.
 */
export const legalConfig = {
  companyName: "[COMPANY LEGAL NAME]",
  companyAddress: "[REGISTERED ADDRESS]",
  country: "[COUNTRY]",
  contactEmail: "[CONTACT EMAIL]",
  /** Date the current versions take effect (shown on both pages). */
  effectiveDate: "[EFFECTIVE DATE]",
};

export const legalIsDraft = Object.values(legalConfig).some((value) => value.startsWith("["));
