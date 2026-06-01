import { redirect } from 'next/navigation'

type Props = {
  params: { id: string }
}

export default function CrmClientDetailRedirect({ params }: Props) {
  redirect(`/admin/clients/${params.id}`)
}
