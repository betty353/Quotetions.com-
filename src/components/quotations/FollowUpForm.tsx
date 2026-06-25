"use client"

import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createFollowUpSchema } from "@/lib/schemas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ApiResponse, CreateFollowUpInput } from "@/types"

interface EmployeeOption {
  id: string
  user: { name: string }
}

interface FollowUpFormProps {
  quotationId: string
  customerId: string
  employees: EmployeeOption[]
}

export default function FollowUpForm({ quotationId, customerId, employees }: FollowUpFormProps) {
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateFollowUpInput>({
    resolver: zodResolver(createFollowUpSchema) as any,
    defaultValues: {
      quotationId,
      customerId,
      employeeId: employees[0]?.id,
      type: "CALL",
      callNotes: "",
      meetingNotes: "",
      feedback: "",
      nextFollowUpDate: undefined,
      reminderDate: undefined,
    },
  })

  async function onSubmit(values: CreateFollowUpInput) {
    setSuccess(null)
    setError(null)

    try {
      const res = await fetch("/api/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const data: ApiResponse = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to schedule follow-up")
        return
      }
      setSuccess("Follow-up scheduled successfully")
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (err: any) {
      setError(err.message || "Unexpected error")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {success && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div>
        <Label htmlFor="employeeId">Assigned Employee</Label>
        <select id="employeeId" {...register("employeeId") as any} className="w-full rounded border p-2">
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.user.name}</option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="type">Type</Label>
        <select id="type" {...register("type") as any} className="w-full rounded border p-2">
          {['CALL', 'EMAIL', 'MEETING', 'NOTE'].map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="callNotes">Call Notes</Label>
        <Textarea id="callNotes" {...register("callNotes")} rows={3} />
      </div>

      <div>
        <Label htmlFor="meetingNotes">Meeting Notes</Label>
        <Textarea id="meetingNotes" {...register("meetingNotes")} rows={3} />
      </div>

      <div>
        <Label htmlFor="feedback">Feedback</Label>
        <Textarea id="feedback" {...register("feedback")} rows={2} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="nextFollowUpDate">Next Follow-Up</Label>
          <Input id="nextFollowUpDate" type="date" {...register("nextFollowUpDate" as any)} />
        </div>
        <div>
          <Label htmlFor="reminderDate">Reminder Date</Label>
          <Input id="reminderDate" type="date" {...register("reminderDate" as any)} />
        </div>
      </div>

      <Button type="submit">Schedule Follow-Up</Button>
    </form>
  )
}
