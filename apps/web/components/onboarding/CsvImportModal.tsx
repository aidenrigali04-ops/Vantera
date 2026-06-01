'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DURATION, EASE_OUT } from '@/lib/motion'
import type { ImportEntity } from '@/lib/import/fields'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { AnimatePresence, motion } from 'framer-motion'
import { CsvImportTabPanel } from './CsvImportTabPanel'

const TABS: { id: ImportEntity; label: string }[] = [
  { id: 'clients', label: 'Clients' },
  { id: 'deals', label: 'Deals' },
  { id: 'leads', label: 'Leads' },
]

type Props = {
  accountId: string
}

export function CsvImportModal({ accountId }: Props) {
  const { csvImportOpen, setCsvImportOpen } = useOnboardingStore()

  return (
    <Dialog open={csvImportOpen} onOpenChange={setCsvImportOpen}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:rounded-xl">
        <AnimatePresence mode="wait">
          <motion.div
            key="csv-import"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: DURATION.modal, ease: EASE_OUT }}
            className="p-6"
          >
            <DialogHeader className="text-left">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Import your data
              </DialogTitle>
              <DialogDescription>
                Bring existing clients, deals, or leads into your workspace from a spreadsheet.
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="clients" className="mt-6">
              <TabsList className="grid w-full grid-cols-3">
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {TABS.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="mt-4">
                  <CsvImportTabPanel entity={tab.id} accountId={accountId} />
                </TabsContent>
              ))}
            </Tabs>

            <div className="mt-6 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setCsvImportOpen(false)}>
                Cancel
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
