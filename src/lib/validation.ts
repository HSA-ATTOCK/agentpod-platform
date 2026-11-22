/** Simple, client-side form validation helpers. */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string) {
  return EMAIL_PATTERN.test(email.trim());
}

export type PasswordRule = { id: string; label: string; test: (value: string) => boolean };

export const passwordRules: PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { id: "letter", label: "Contains a letter", test: (v) => /[a-zA-Z]/.test(v) },
  { id: "number", label: "Contains a number", test: (v) => /[0-9]/.test(v) },
];

export function meetsPasswordRules(value: string) {
  return passwordRules.every((rule) => rule.test(value));
}
