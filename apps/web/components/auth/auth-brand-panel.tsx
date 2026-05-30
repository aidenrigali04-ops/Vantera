import { Sparkles } from 'lucide-react'
import { UiPreviewMock } from './ui-preview-mock'

const TRUST_LINES = [
  'Full client lifecycle in one place',
  'Built for service-based businesses',
  'Replace fragmented tools with one system',
] as const

/** Right column — brand reinforcement during signup (calm, enterprise, no gradients). */
export function AuthBrandPanel() {
  return (
    <div className="relative hidden h-full flex-col justify-center border-l border-stone-200 bg-stone-100/80 px-12 py-16 lg:flex">
      <div className="mx-auto w-full max-w-md space-y-8">
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-stone-900">
            Run Your Business From One System
          </h2>
          <p className="text-base leading-relaxed text-stone-600">
            Centralizes your revenue, operations, and client delivery into one structured workspace.
          </p>
        </div>

        <UiPreviewMock />

        <ul className="space-y-3">
          {TRUST_LINES.map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-sm text-stone-700">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
