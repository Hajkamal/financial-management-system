import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export const normalizePassword = (value: string) =>
  String(value)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .trim();
export function hashPassword(password: string, prefix = "scrypt"): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  }).toString("hex");
  return `${prefix}:${salt}:${hash}`;
}
export function verifyPassword(password: string, stored: string): boolean {
  const normalized = normalizePassword(password);
  const [kind, salt, hex] = String(stored || "").split(":");
  if (
    (kind !== "scrypt" && kind !== "scrypt-sha256") ||
    !/^[a-f0-9]{32}$/.test(salt || "") ||
    !/^[a-f0-9]{128}$/.test(hex || "")
  )
    return false;
  const input =
    kind === "scrypt-sha256"
      ? createHash("sha256").update(normalized).digest("hex")
      : normalized;
  const actual = scryptSync(input, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(actual, Buffer.from(hex, "hex"));
}
export function migratePassword(stored: string): string {
  if (stored?.startsWith("scrypt:") || stored?.startsWith("scrypt-sha256:"))
    return stored;
  const digest = String(stored || "").replace(/^sha256:/, "");
  if (/^[a-fA-F0-9]{64}$/.test(digest))
    return hashPassword(digest.toLowerCase(), "scrypt-sha256");
  if (!stored)
    throw new Error(
      "User has no password; explicit administrator reset required",
    );
  return hashPassword(normalizePassword(stored));
}
export function requireStrongPassword(value: unknown): string {
  if (typeof value !== "string")
    throw Object.assign(new Error("رمز عبور لازم است"), { status: 400 });
  const p = normalizePassword(value);
  if (
    p.length < 12 ||
    p.length > 128 ||
    ["admin", "123456", "user1234", "viewer123"].includes(p)
  )
    throw Object.assign(
      new Error("رمز عبور باید بین ۱۲ تا ۱۲۸ کاراکتر و غیرپیش‌فرض باشد"),
      { status: 400 },
    );
  return p;
}
