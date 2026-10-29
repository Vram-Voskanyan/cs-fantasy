// Maps Better Auth error codes to keys in the "errors" namespace of strings_en.json.
export type AuthErrorKey = "userExists" | "invalidCredentials" | "tooManyRequests" | "emailInvalid" | "generic";

export function authErrorKey(error: { code?: string; status?: number } | null | undefined): AuthErrorKey {
  if (!error) return "generic";
  if (error.status === 429) return "tooManyRequests";
  const code = error.code ?? "";
  if (code.startsWith("USER_ALREADY_EXISTS")) return "userExists";
  if (code === "INVALID_EMAIL_OR_PASSWORD") return "invalidCredentials";
  if (code === "INVALID_EMAIL") return "emailInvalid";
  return "generic";
}
