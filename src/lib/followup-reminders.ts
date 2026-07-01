import { prisma } from "@/lib/prisma"

export async function createDueFollowUpReminders(scope?: {
  companyId?: string | null
  employeeId?: string | null
  customerId?: string | null
}) {
  const dueFollowUps = await prisma.followUp.findMany({
    where: {
      status: "PENDING",
      reminderSent: false,
      reminderDate: { lte: new Date() },
      ...(scope?.companyId ? { companyId: scope.companyId } : {}),
      ...(scope?.employeeId ? { employeeId: scope.employeeId } : {}),
      ...(scope?.customerId ? { customerId: scope.customerId } : {}),
    },
    take: 100,
    include: {
      quotation: true,
      customer: true,
      employee: { include: { user: true } },
    },
  })

  let created = 0
  for (const followUp of dueFollowUps) {
    const notificationCount = await prisma.$transaction(async (tx) => {
      const claimed = await tx.followUp.updateMany({
        where: { id: followUp.id, reminderSent: false },
        data: { reminderSent: true },
      })
      if (claimed.count === 0) return 0

      const recipients = new Set<string>()
      recipients.add(followUp.createdById)
      if (followUp.employee?.userId) recipients.add(followUp.employee.userId)

      if (followUp.companyId) {
        const admins = await tx.user.findMany({
          where: {
            companyId: followUp.companyId,
            role: { in: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN"] },
            isActive: true,
          },
          select: { id: true },
        })
        admins.forEach((admin) => recipients.add(admin.id))
      }

      if (recipients.size === 0) return 0
      const customerName = followUp.customer?.companyName || followUp.customer?.contactPerson || "Customer"

      await tx.notification.createMany({
        data: Array.from(recipients).map((userId) => ({
          companyId: followUp.companyId,
          userId,
          type: "FOLLOWUP_REMINDER",
          title: "Follow-up reminder",
          message: `${followUp.type} follow-up is due for ${customerName}.`,
          relatedId: followUp.id,
          relatedModel: "FollowUp",
          customerId: followUp.customerId,
          quotationId: followUp.quotationId,
          followUpId: followUp.id,
        })),
      })

      return recipients.size
    })
    created += notificationCount
  }

  return { followUps: dueFollowUps.length, notifications: created }
}
