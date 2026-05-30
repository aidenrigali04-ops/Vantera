'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GitBranch, MessageSquare, Sparkles, Zap } from 'lucide-react'

export type SequenceNode = {
  id: string
  stepNumber: number
  nodeType: 'trigger' | 'action' | 'logic' | 'ai'
  label: string
  channel?: string
}

const NODE_ICONS = {
  trigger: Zap,
  action: MessageSquare,
  logic: GitBranch,
  ai: Sparkles,
} as const

type SequenceBuilderProps = {
  nodes: SequenceNode[]
  onAddNode?: () => void
  className?: string
}

export function SequenceBuilder({ nodes, onAddNode, className }: SequenceBuilderProps) {
  return (
    <div className={cn('rounded-xl border border-stone-200 bg-white p-4', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900">Sequence builder</h3>
        {onAddNode ? (
          <Button size="sm" variant="outline" onClick={onAddNode}>
            Add step
          </Button>
        ) : null}
      </div>
      <div className="space-y-0">
        {nodes.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-500">
            Add steps to build your outreach sequence.
          </p>
        ) : (
          nodes.map((node, index) => {
            const Icon = NODE_ICONS[node.nodeType]
            return (
              <div key={node.id} className="relative flex gap-3 pb-6 last:pb-0">
                {index < nodes.length - 1 ? (
                  <div className="absolute left-[15px] top-8 h-[calc(100%-8px)] w-px bg-stone-200" />
                ) : null}
                <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-50">
                  <Icon className="h-4 w-4 text-stone-600" />
                </span>
                <div className="min-w-0 flex-1 rounded-lg border border-stone-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-stone-500">Step {node.stepNumber}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {node.nodeType}
                    </Badge>
                    {node.channel ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {node.channel}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-medium text-stone-900">{node.label}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
