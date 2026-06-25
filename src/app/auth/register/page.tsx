"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { registerSchema } from "@/lib/schemas"
import { ZodError } from "zod"

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
    password: "",
    confirmPassword: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setValidationErrors({})
    setIsLoading(true)

    try {
      // Validate form data
      registerSchema.parse(formData)

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Registration failed. Please try again.")
      } else {
        // Redirect to login
        router.push("/auth/login?registered=true")
      }
    } catch (err) {
      if (err instanceof ZodError) {
        const errors: Record<string, string> = {}
        err.errors.forEach((error) => {
          if (error.path) {
            errors[error.path[0] as string] = error.message
          }
        })
        setValidationErrors(errors)
      } else {
        setError("An unexpected error occurred. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-lg mb-4">
            QC
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Quotely CRM</h1>
          <p className="text-gray-600 mt-2">Create your account</p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Join Quotely CRM</CardTitle>
            <CardDescription>Start managing quotations professionally</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleChange}
                    disabled={isLoading}
                    required
                    className={validationErrors.firstName ? "border-red-500" : ""}
                  />
                  {validationErrors.firstName && (
                    <p className="text-xs text-red-500">{validationErrors.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleChange}
                    disabled={isLoading}
                    required
                    className={validationErrors.lastName ? "border-red-500" : ""}
                  />
                  {validationErrors.lastName && (
                    <p className="text-xs text-red-500">{validationErrors.lastName}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isLoading}
                  required
                  className={validationErrors.email ? "border-red-500" : ""}
                />
                {validationErrors.email && (
                  <p className="text-xs text-red-500">{validationErrors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name (Optional)</Label>
                <Input
                  id="companyName"
                  name="companyName"
                  placeholder="Your Company Ltd"
                  value={formData.companyName}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="+1 (555) 123-4567"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading}
                  required
                  className={validationErrors.password ? "border-red-500" : ""}
                />
                {validationErrors.password && (
                  <p className="text-xs text-red-500">{validationErrors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={isLoading}
                  required
                  className={validationErrors.confirmPassword ? "border-red-500" : ""}
                />
                {validationErrors.confirmPassword && (
                  <p className="text-xs text-red-500">{validationErrors.confirmPassword}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
