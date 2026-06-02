'use client'

import type { VentoraCampaignGroup, VentoraCampaignRow } from '@/lib/dashboard/ventora-types'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  CornerDownRight,
  GripVertical,
  Mail,
  Share2,
  MoreHorizontal,
  Pencil,
} from 'lucide-react'
import Link from 'next/link'
import { Fragment, useState } from 'react'

type Props = {
  groups: VentoraCampaignGroup[]
}

function ChannelIcons({ channels }: { channels: VentoraCampaignRow['channels'] }) {
  return (
    <div className="flex items-center gap-1.5">
      {channels.includes('linkedin') ? (
        <Share2
          size={15}
          className="text-[#0A66C2]"
          strokeWidth={1.75}
          aria-label="LinkedIn"
        />
      ) : null}
      {channels.includes('email') ? (
        <Mail size={15} className="text-[var(--text-secondary)]" strokeWidth={1.75} aria-label="Email" />
      ) : null}
    </div>
  )
}

export function VentoraCampaignsTable({ groups }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  return (
    <motion.section variants={fadeUp} initial="hidden" animate="visible">
      <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Campaigns</h2>

      <div className="card-surface overflow-hidden">
        {groups.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--text-secondary)]">
            No outreach campaigns yet. Launch a campaign to track conversion here.
          </p>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)]/50">
                <th className="w-10 px-3 py-3" scope="col" />
                <th className="px-3 py-3 font-medium text-[var(--text-secondary)]" scope="col">
                  Campaigns
                </th>
                <th className="px-3 py-3 font-medium text-[var(--text-secondary)]" scope="col">
                  Type
                </th>
                <th className="px-3 py-3 font-medium text-[var(--text-secondary)]" scope="col">
                  Scheduled
                </th>
                <th className="px-3 py-3 font-medium text-[var(--text-secondary)]" scope="col">
                  Status
                </th>
                <th className="px-3 py-3 font-medium text-[var(--text-secondary)]" scope="col">
                  Conversion Rate
                </th>
                <th className="w-10 px-3 py-3" scope="col" />
              </tr>
            </thead>
            <motion.tbody variants={staggerContainer} initial="hidden" animate="visible">
              {groups.map((group) => {
                const isCollapsed = collapsed[group.id] ?? false
                return (
                  <Fragment key={group.id}>
                    <motion.tr
                      layout
                      variants={fadeUp}
                      className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]"
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${group.name}`}
                          className="h-3.5 w-3.5 rounded border-[var(--border-strong)] accent-[var(--accent)]"
                        />
                      </td>
                      <td colSpan={4} className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                            aria-expanded={!isCollapsed}
                            className="icon-btn h-7 w-7"
                            onClick={() =>
                              setCollapsed((prev) => ({ ...prev, [group.id]: !isCollapsed }))
                            }
                          >
                            <ChevronDown
                              size={14}
                              className={cn(
                                'transition-transform duration-150',
                                isCollapsed && '-rotate-90',
                              )}
                              aria-hidden
                            />
                          </button>
                          <GripVertical size={14} className="text-[var(--text-tertiary)]" aria-hidden />
                          <span className="font-medium text-[var(--text-primary)]">{group.name}</span>
                          <span className="rounded-md bg-[var(--bg-overlay)] px-1.5 py-0.5 text-xs font-medium tabular-nums text-[var(--text-secondary)]">
                            {group.count}
                          </span>
                          <button
                            type="button"
                            aria-label={`Edit ${group.name}`}
                            className="icon-btn ml-1 h-7 w-7"
                          >
                            <Pencil size={13} strokeWidth={1.75} aria-hidden />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3" />
                      <td className="px-3 py-3">
                        <button type="button" aria-label="Group options" className="icon-btn">
                          <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
                        </button>
                      </td>
                    </motion.tr>

                    <AnimatePresence initial={false}>
                      {!isCollapsed
                        ? group.rows.map((row) => (
                            <motion.tr
                              key={row.id}
                              layout
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                              className="group border-b border-[var(--border-subtle)] transition-colors last:border-0 hover:bg-[var(--bg-overlay)]/40"
                            >
                              <td className="px-3 py-3">
                                <input
                                  type="checkbox"
                                  defaultChecked={row.checked}
                                  aria-label={`Select ${row.name}`}
                                  className="h-3.5 w-3.5 rounded border-[var(--border-strong)] accent-[var(--accent)]"
                                />
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2 pl-4">
                                  <GripVertical
                                    size={14}
                                    className="text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100"
                                    aria-hidden
                                  />
                                  {row.nested ? (
                                    <CornerDownRight
                                      size={14}
                                      className="text-[var(--text-tertiary)]"
                                      aria-hidden
                                    />
                                  ) : null}
                                  <Link
                                    href={row.href}
                                    className="font-medium text-[var(--text-primary)] hover:underline"
                                  >
                                    {row.name}
                                  </Link>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <ChannelIcons channels={row.channels} />
                              </td>
                              <td className="tabular-nums text-[var(--text-secondary)] px-3 py-3">
                                {row.scheduled}
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className={cn(
                                    'status-pill',
                                    row.status === 'active' ? 'status-active' : 'status-paused',
                                  )}
                                >
                                  {row.status === 'active' ? 'Active' : 'Paused'}
                                </span>
                              </td>
                              <td className="px-3 py-3 font-medium tabular-nums text-[var(--text-primary)]">
                                {row.conversionRate}%
                              </td>
                              <td className="px-3 py-3">
                                <button
                                  type="button"
                                  aria-label={`Options for ${row.name}`}
                                  className="icon-btn opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                                >
                                  <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
                                </button>
                              </td>
                            </motion.tr>
                          ))
                        : null}
                    </AnimatePresence>
                  </Fragment>
                )
              })}
            </motion.tbody>
          </table>
        </div>
        )}
      </div>
    </motion.section>
  )
}
