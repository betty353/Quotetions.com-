import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { loginSchema } from "@/lib/schemas"
import { auditAuthEvent } from "@/lib/audit"
import { rateLimit } from "@/lib/rate-limit"
import { normalizeLegacyRole } from "@/lib/tenant"

const isProduction = process.env.NODE_ENV === "production"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email, phone, or NRC", type: "text", placeholder: "email@example.com, phone, or NRC" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) {
          throw new Error("Invalid email or password")
        }

        const { email: identifier, password } = parsed.data
        const limit = rateLimit(`login:${identifier}`, 8, 60_000)
        if (!limit.ok) {
          await auditAuthEvent({ action: "LOGIN_FAILED", email: identifier, metadata: { reason: "rate_limited" } })
          throw new Error("Too many attempts. Please try again shortly.")
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: identifier },
              { phone: identifier },
              { customer: { is: { nrc: identifier } } },
              { customer: { is: { phone: identifier } } },
              { customer: { is: { whatsappNumber: identifier } } },
            ],
          },
          select: {
            id: true,
            email: true,
            password: true,
            firstName: true,
            lastName: true,
            role: true,
            companyId: true,
            isActive: true,
          },
        })

        if (!user) {
          await auditAuthEvent({ action: "LOGIN_FAILED", email: identifier, metadata: { reason: "invalid_credentials" } })
          throw new Error("Invalid login details or password")
        }

        const isPasswordValid = await bcrypt.compare(password, user.password)
        if (!isPasswordValid) {
          await auditAuthEvent({ action: "LOGIN_FAILED", userId: user.id, companyId: user.companyId, email: user.email, metadata: { reason: "invalid_credentials", identifier } })
          throw new Error("Invalid login details or password")
        }

        if (!user.isActive) {
          await auditAuthEvent({ action: "LOGIN_FAILED", userId: user.id, companyId: user.companyId, email: user.email, metadata: { reason: "inactive_user", identifier } })
          throw new Error("Invalid login details or password")
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        })
        await auditAuthEvent({ action: "LOGIN", userId: user.id, companyId: user.companyId, email: user.email })

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: normalizeLegacyRole(user.role) as any,
          companyId: user.companyId,
          firstName: user.firstName,
          lastName: user.lastName,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.role = (user as any).role
        token.companyId = (user as any).companyId ?? null
        token.firstName = (user as any).firstName
        token.lastName = (user as any).lastName
      }
      if (trigger === "update" && session) {
        const updatedUser = (session as any).user ?? session
        if (updatedUser.id) token.id = updatedUser.id
        if (updatedUser.email) token.email = updatedUser.email
        if (updatedUser.role) token.role = updatedUser.role
        if ("companyId" in updatedUser) token.companyId = updatedUser.companyId ?? null
        if (updatedUser.firstName) token.firstName = updatedUser.firstName
        if (updatedUser.lastName) token.lastName = updatedUser.lastName
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.email = token.email
        session.user.role = token.role
        session.user.companyId = token.companyId ?? null
        session.user.firstName = token.firstName
        session.user.lastName = token.lastName
      }
      return session
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.id) {
        await auditAuthEvent({
          action: "LOGOUT",
          userId: token.id as string,
          companyId: (token.companyId as string | null) ?? null,
          email: typeof token.email === "string" ? token.email : null,
        })
      }
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name: `${isProduction ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  debug: false,
}
