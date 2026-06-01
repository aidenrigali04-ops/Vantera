import { ComingSoonPage } from '@/components/operational/ComingSoonPage'
import { CreditCard } from 'lucide-react'

export default function BillingPage() {
  return (
    <ComingSoonPage
      icon={CreditCard}
      title="Billing"
      description="Invoices, payment links, and revenue collection tied to active clients and projects."
    />
  )
}
