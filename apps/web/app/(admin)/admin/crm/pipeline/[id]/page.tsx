import { redirect } from 'next/navigation'

type Props = {
  params: { id: string }
}

export default function CrmLeadDetailRedirect({ params }: Props) {
  redirect(`/admin/pipeline/${params.id}`)
}
