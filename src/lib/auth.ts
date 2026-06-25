import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { isFirebaseAuthConfigured, signInFirebaseUser } from "@/lib/firebase-rest"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "email@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) {
          throw new Error("User not found")
        }

        if (!user.isActive) {
          throw new Error("User account is inactive")
        }

        let isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (isFirebaseAuthConfigured()) {
          try {
            const firebaseUser = await signInFirebaseUser(credentials.email, credentials.password)
            isPasswordValid = true

            if (!user.firebaseUid) {
              await prisma.user.update({
                where: { id: user.id },
                data: { firebaseUid: firebaseUser.uid },
              })
            }
          } catch (error) {
            if (user.firebaseUid) {
              throw new Error("Invalid Firebase credentials")
            }
          }
        }

        if (!isPasswordValid) {
          throw new Error("Invalid password")
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role
        session.user.id = token.id
      }
      return session
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  debug: process.env.NODE_ENV === "development",
}
