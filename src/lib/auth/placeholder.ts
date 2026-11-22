/**
 * PHASE 1 PLACEHOLDERS — these do NOT sign anyone in.
 *
 * They exist so the auth forms can show real loading, error and success states
 * before a real auth provider is chosen. Later, replace each function with the
 * provider's matching call and keep the same AuthResult return shape.
 */

export type AuthResult = { ok: true } | { ok: false; error: string };

const NOT_CONNECTED: AuthResult = {
  ok: false,
  error: "Authentication isn't connected yet. It will be enabled in a later phase.",
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  void email;
  void password;
  await wait(800);
  return NOT_CONNECTED;
}

export async function signUpWithPassword(
  fullName: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  void fullName;
  void email;
  void password;
  await wait(800);
  return NOT_CONNECTED;
}

export async function signInWithGoogle(): Promise<AuthResult> {
  await wait(800);
  return NOT_CONNECTED;
}

/** Returns success so the "check your email" message can be previewed. No email is sent. */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  void email;
  await wait(800);
  return { ok: true };
}

/** Returns success so the "email sent" message can be previewed. No email is sent. */
export async function resendVerificationEmail(): Promise<AuthResult> {
  await wait(800);
  return { ok: true };
}
