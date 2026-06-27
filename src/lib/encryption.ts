import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"

function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_KEY
  if (!secret) {
    throw new Error("ENCRYPTION_KEY is not configured")
  }

  if (/^[a-f0-9]{64}$/i.test(secret)) {
    return Buffer.from(secret, "hex")
  }

  const base64 = Buffer.from(secret, "base64")
  if (base64.length === 32) {
    return base64
  }

  return crypto.createHash("sha256").update(secret).digest()
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`
}

export function decryptSecret(value: string) {
  const [ivText, tagText, encryptedText] = value.split(":")
  if (!ivText || !tagText || !encryptedText) {
    throw new Error("Invalid encrypted secret")
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivText, "base64"))
  decipher.setAuthTag(Buffer.from(tagText, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64")),
    decipher.final(),
  ]).toString("utf8")
}
