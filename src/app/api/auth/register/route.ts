import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { registerSchema } from "@/lib/schemas"
import { ZodError } from "zod"
import { createFirebaseUser, isFirebaseAuthConfigured } from "@/lib/firebase-rest"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validatedData = registerSchema.parse(body)

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      )
    }

    const displayName = `${validatedData.firstName} ${validatedData.lastName}`
    const firebaseUser = isFirebaseAuthConfigured()
      ? await createFirebaseUser(validatedData.email, validatedData.password, displayName)
      : null

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        firebaseUid: firebaseUser?.uid,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        password: hashedPassword,
        phone: validatedData.phone || null,
        role: "CUSTOMER", // Default role for self-registration
        isActive: true,
        isEmailVerified: false,
      },
    })

    // Create customer profile
    await prisma.customer.create({
      data: {
        userId: user.id,
        phone: validatedData.phone || "",
        companyName: validatedData.companyName || null,
        status: "ACTIVE",
      },
    })

    return NextResponse.json(
      { message: "Account created successfully" },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    )
  }
}
