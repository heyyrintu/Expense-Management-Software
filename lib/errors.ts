// Single source for user-facing error messages and the typed action result.
export type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}
export function err<T = undefined>(error: string): Result<T> {
  return { ok: false, error };
}

export const userErrors = {
  invalidCredentials: "Invalid organization, email, or password.",
  slugTaken: "That workspace URL is already taken.",
  emailTaken: "A user with that email already exists in this organization.",
  inviteInvalid: "This invite link is invalid or has expired.",
  notAuthenticated: "You must be signed in to do that.",
  notAuthorized: "You don't have permission to perform this action.",
  validation: "Please correct the highlighted fields.",
  unknown: "Something went wrong. Please try again.",
} as const;
