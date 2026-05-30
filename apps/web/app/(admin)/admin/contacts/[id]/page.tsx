import { redirect } from 'next/navigation'

type Props = {
  params: { id: string }
}

export default function ContactDetailRedirectPage({ params }: Props) {
  redirect(`/admin/crm/clients/${params.id}`)
}
