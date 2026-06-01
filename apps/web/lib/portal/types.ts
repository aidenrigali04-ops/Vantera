export type PortalProject = {
  id: string
  title: string
  stageLabel: string
  stageColor: string
  progress: number
  valueCents: number
  updatedAt: Date
}

export type PortalActivity = {
  id: string
  body: string | null
  activityType: string
  createdAt: Date
}

export type PortalDeliverable = {
  id: string
  title: string
  status: 'pending' | 'in_review' | 'approved' | 'delivered'
  dueAt: Date | null
}

export type PortalApproval = {
  id: string
  title: string
  status: 'pending' | 'approved' | 'rejected'
  requestedAt: Date
}

export type PortalBillingSummary = {
  outstandingCents: number
  nextDueDate: Date | null
  status: 'current' | 'due_soon' | 'overdue'
}

export type PortalWorkspace = {
  contactFirstName: string
  contactLastName: string
  projects: PortalProject[]
  activities: PortalActivity[]
  deliverables: PortalDeliverable[]
  approvals: PortalApproval[]
  billing: PortalBillingSummary
}

export type AdminPortalMeta = {
  portalUrl: string
  portalEnabledCount: number
  previewContactName: string | null
}
