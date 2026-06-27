import { prisma } from "@/lib/prisma"

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function slugifyCompanyName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function createUniqueCompanySlug(name: string) {
  const base = slugifyCompanyName(name) || "company"
  let slug = base
  let suffix = 1

  while (await prisma.company.findUnique({ where: { slug }, select: { id: true } })) {
    suffix += 1
    slug = `${base}-${suffix}`
  }

  return slug
}

export function isCompanyAdminRole(role?: string | null) {
  return role === "COMPANY_ADMIN" || role === "SUPER_ADMIN" || role === "ADMIN"
}

export function normalizeLegacyRole(role?: string | null) {
  if (role === "ADMIN") return "COMPANY_ADMIN"
  return role
}
