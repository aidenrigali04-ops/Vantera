import { redirect } from 'next/navigation'

export default function PipelineRootRedirect() {
  redirect('/admin/crm/pipeline')
}
