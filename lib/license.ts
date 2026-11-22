import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { encrypt, hashSecret } from "@/lib/crypto";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateLicenseKey() {
  const block = () =>
    Array.from(randomBytes(4), (byte) => alphabet[byte % alphabet.length]).join(
      "",
    );
  return `PRO-${block()}-${block()}-${block()}`;
}

export async function grantPro(userId: string) {
  const plain = generateLicenseKey();
  const now = new Date();
  await prisma.$transaction([
    prisma.licenseKey.updateMany({
      where: { userId, status: "active" },
      data: { status: "revoked", revokedAt: now },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { plan: "pro" },
    }),
    prisma.licenseKey.create({
      data: {
        userId,
        keyHash: hashSecret(plain),
        keyEncrypted: encrypt(plain),
        status: "active",
      },
    }),
  ]);
  return plain;
}

export async function revokePro(userId: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.licenseKey.updateMany({
      where: { userId, status: "active" },
      data: { status: "revoked", revokedAt: now },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { plan: "free", facebookKeyId: null },
    }),
  ]);
}
