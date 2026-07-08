// -------------------------------------------------------------
// Authentication Helpers — Cookie-Based Session
//
// Uses Web Crypto API (built into Node 18+) for HMAC signing.
// No external dependencies required.
// -------------------------------------------------------------

const COOKIE_NAME = "pg-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Fallback for development — in production AUTH_SECRET should be set
    return "price-guard-dev-secret-change-me";
  }
  return secret;
}

// --- Password Hashing (SHA-256, no deps) ---

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(plain: string): Promise<string> {
  // Simple salted SHA-256 hash
  return sha256("pg-salt:" + plain);
}

export async function verifyPassword(
  plain: string,
  storedHash: string
): Promise<boolean> {
  const hash = await hashPassword(plain);
  return hash === storedHash;
}

// --- Session Cookie (HMAC-SHA256 Signed) ---

async function hmacSign(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type UserRole = "AP_CLERK" | "CONTROLLER";

export interface SessionPayload {
  valid: boolean;
  role: UserRole | null;
}

export async function createSessionToken(role: UserRole = "CONTROLLER"): Promise<string> {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${role}:${expires}`;
  const sig = await hmacSign(payload);
  return `${payload}.${sig}`;
}

export async function decodeSessionToken(token: string): Promise<SessionPayload> {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return { valid: false, role: null };

  const payload = token.substring(0, lastDot);
  const sig = token.substring(lastDot + 1);

  // Verify signature
  const expectedSig = await hmacSign(payload);
  if (sig !== expectedSig) return { valid: false, role: null };

  // Check expiry & role
  const parts = payload.split(":");
  if (parts.length < 2) return { valid: false, role: null };

  const roleOrAuth = parts[0];
  const expires = parseInt(parts[1], 10);
  if (isNaN(expires) || Date.now() > expires) return { valid: false, role: null };

  let role: UserRole = "CONTROLLER";
  if (roleOrAuth === "AP_CLERK") {
    role = "AP_CLERK";
  } else if (roleOrAuth === "CONTROLLER" || roleOrAuth === "authenticated") {
    role = "CONTROLLER";
  }

  return { valid: true, role };
}

export async function verifySessionToken(token: string): Promise<boolean> {
  const decoded = await decodeSessionToken(token);
  return decoded.valid;
}

export async function getSessionRoleFromCookie(cookieValue?: string): Promise<UserRole | null> {
  if (!cookieValue) return null;
  const decoded = await decodeSessionToken(cookieValue);
  return decoded.valid ? decoded.role : null;
}

export { COOKIE_NAME, SESSION_MAX_AGE };

/**
 * Returns the admin password hash from env, or null if not set.
 * When null, the app uses a default password "admin" on first run.
 */
export async function getAdminPasswordHash(): Promise<string> {
  if (process.env.ADMIN_PASSWORD_HASH) {
    return process.env.ADMIN_PASSWORD_HASH;
  }
  // Default password for first-run: "admin"
  return hashPassword("admin");
}
