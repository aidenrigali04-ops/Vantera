import { redirect } from 'next/navigation'

type Props = {
  params: { id: string }
}

export default function LegacyLeadDetailRedirect({ params }: Props) {
  redirect(`/admin/crm/pipeline/${params.id}`)
}
