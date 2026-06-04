import { redirect } from 'next/navigation'

type Props = {
  params: { id: string }
}

export default function LegacyPipelineLeadRedirect({ params }: Props) {
  redirect(`/admin/crm/pipeline/${params.id}`)
}
