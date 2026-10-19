import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export function seal(value: string, keyText: string, owner: string) {
  const key = Buffer.from(keyText, "base64");
  if (key.length !== 32) throw new Error("Cheia de criptare trebuie să aibă 32 de octeți.");
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(owner));
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(b => b.toString("base64url")).join(".");
}
export function unseal(value: string, keyText: string, owner: string) {
  const parts = value.split(".").map(p => Buffer.from(p, "base64url"));
  if (parts.length !== 3 || parts[0].length !== 12 || parts[1].length !== 16) throw new Error("Date de conectare invalide.");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyText, "base64"), parts[0]);
  decipher.setAAD(Buffer.from(owner)); decipher.setAuthTag(parts[1]);
  return Buffer.concat([decipher.update(parts[2]), decipher.final()]).toString("utf8");
}
