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
  storageUrl: string
}

export type PortalApproval = {
  id: string
  title: string
  status: 'pending' | 'approved' | 'rejected'
  requestedAt: Date
  storageUrl: string
}

export type PortalInvoice = {
  id: string
  recordTitle: string | null
  amountCents: number
  paidCents: number
  status: string
  dueAt: Date | null
  paidAt: Date | null
  paymentLinkUrl: string | null
  createdAt: Date
}

export type PortalDocument = {
  id: string
  title: string
  docType: string
  storageUrl: string
  requiresSignature: boolean
  signedAt: Date | null
  createdAt: Date
}

export type PortalMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  subject: string | null
  sentAt: Date | null
  createdAt: Date
  readAt: Date | null
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
  invoices: PortalInvoice[]
  documents: PortalDocument[]
  messages: PortalMessage[]
  unreadMessageCount: number
}

export type AdminPortalMeta = {
  portalUrl: string
  portalEnabledCount: number
  previewContactName: string | null
}

export type PortalAccessState = {
  portalUrl: string
  portalAccess: boolean
  portalInvitedAt: Date | null
  portalLastLoginAt: Date | null
  email: string | null
}
