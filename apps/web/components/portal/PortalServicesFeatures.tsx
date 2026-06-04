import type { PortalConfig } from '@/lib/portal/portal-config'
import { Sparkles, Wrench } from 'lucide-react'

type PortalServicesFeaturesProps = {
  config: PortalConfig
}

export function PortalServicesFeatures({ config }: PortalServicesFeaturesProps) {
  const hasServices = config.services.length > 0
  const hasFeatures = config.features.length > 0

  if (!hasServices && !hasFeatures) return null

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {hasServices ? (
        <section aria-labelledby="portal-services-heading">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-muted)] text-[var(--accent)]">
              <Wrench className="h-4 w-4" aria-hidden />
            </span>
            <h2
              id="portal-services-heading"
              className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]"
            >
              Your services
            </h2>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {config.services.map((service) => (
              <li
                key={service.id}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 transition-colors duration-120 ease hover:border-[var(--border-default)]"
              >
                <p className="font-medium text-[var(--text-primary)]">{service.title}</p>
                {service.description ? (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    {service.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasFeatures ? (
        <section aria-labelledby="portal-features-heading">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--success-muted)] text-[var(--success)]">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <h2
              id="portal-features-heading"
              className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]"
            >
              What&apos;s included
            </h2>
          </div>
          <ul className="space-y-3">
            {config.features.map((feature) => (
              <li
                key={feature.id}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3"
              >
                <p className="text-[13px] font-medium text-[var(--text-primary)]">{feature.title}</p>
                {feature.description ? (
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                    {feature.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
