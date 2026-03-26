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

export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `authenticated:${expires}`;
  const sig = await hmacSign(payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;

  const payload = token.substring(0, lastDot);
  const sig = token.substring(lastDot + 1);

  // Verify signature
  const expectedSig = await hmacSign(payload);
  if (sig !== expectedSig) return false;

  // Check expiry
  const parts = payload.split(":");
  const expires = parseInt(parts[1], 10);
  if (isNaN(expires) || Date.now() > expires) return false;

  return true;
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
