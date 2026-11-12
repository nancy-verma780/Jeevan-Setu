import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

// Node's built-in scrypt (memory-hard, like Argon2id) needs no native add-on,
// so it runs on locked-down Windows machines. The Python backend uses Argon2id.
export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

const DUMMY = hashPassword("timing-equaliser");

export function verifyPassword(stored, password) {
  const [, saltHex, hashHex] = (stored ?? DUMMY).split("$");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 32, { N: 16384, r: 8, p: 1 });
  return Boolean(stored) && timingSafeEqual(actual, Buffer.from(hashHex, "hex"));
}

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token) => createHash("sha256").update(token).digest("hex");
export const newOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
export const hashOtp = (phone, code, pepper) => createHmac("sha256", pepper).update(`${phone}:${code}`).digest("hex");

export function sameHash(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Returns +91XXXXXXXXXX or null. */
export function normaliseIndianMobile(raw) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}
