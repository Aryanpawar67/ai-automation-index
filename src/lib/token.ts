import { createHmac } from "crypto";

const SECRET      = process.env.HMAC_SECRET ?? "dev-secret-change-in-prod";
const EXPIRY_DAYS = 7;

export function generateReportToken(companyId: string): {
  token: string;
  expiresAt: Date;
} {
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const expiresTs = expiresAt.getTime().toString();
  const payload   = `${companyId}:${expiresTs}`;
  const sig       = createHmac("sha256", SECRET).update(payload).digest("hex");
  const token     = Buffer.from(`${sig}:${expiresTs}`).toString("base64url");
  return { token, expiresAt };
}

export function verifyReportToken(companyId: string, token: string): boolean {
  try {
    const decoded      = Buffer.from(token, "base64url").toString("utf-8");
    const colonIdx     = decoded.indexOf(":");
    if (colonIdx === -1) return false;
    const sig          = decoded.slice(0, colonIdx);
    const expiresTs    = decoded.slice(colonIdx + 1);
    if (Date.now() > parseInt(expiresTs, 10)) return false;
    const payload      = `${companyId}:${expiresTs}`;
    const expected     = createHmac("sha256", SECRET).update(payload).digest("hex");
    return sig === expected;
  } catch {
    return false;
  }
}
