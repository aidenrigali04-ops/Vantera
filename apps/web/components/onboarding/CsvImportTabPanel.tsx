'use client'

import { importCsvRows } from '@/app/(admin)/admin/dashboard/import-actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  applyColumnMapping,
  parseCsv,
  rowsToObjects,
} from '@/lib/import/csv-parse'
import {
  autoMapColumns,
  entityImportLabel,
  IMPORT_FIELDS,
  persistOnboardingSuccessNotice,
  type ImportEntity,
} from '@/lib/import/fields'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Step = 'upload' | 'map' | 'preview'

type Props = {
  entity: ImportEntity
  accountId: string
}

const SKIP_VALUE = '__skip__'

export function CsvImportTabPanel({ entity, accountId }: Props) {
  const router = useRouter()
  const { setCsvImportOpen } = useOnboardingStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})

  const fields = IMPORT_FIELDS[entity]

  const mappedRows = useMemo(
    () => applyColumnMapping(rawRows, mapping),
    [rawRows, mapping],
  )

  const previewRows = mappedRows.slice(0, 5)
  const previewColumns = fields.filter((field) => mapping[field.key] && mapping[field.key] !== SKIP_VALUE)

  const requiredMissing = fields
    .filter((field) => field.required)
    .filter((field) => !mapping[field.key] || mapping[field.key] === SKIP_VALUE)

  const canProceedToPreview = requiredMissing.length === 0 && rawRows.length > 0
  const canImport = canProceedToPreview && step === 'preview'

  const reset = useCallback(() => {
    setStep('upload')
    setFileName(null)
    setHeaders([])
    setRawRows([])
    setMapping({})
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a .csv file')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const parsed = parseCsv(text)

      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        toast.error('That file looks empty — check your headers and rows')
        return
      }

      if (parsed.rows.length > 500) {
        toast.error('Import limited to 500 rows per file')
        return
      }

      const objects = rowsToObjects(parsed.headers, parsed.rows)
      const autoMapping = autoMapColumns(entity, parsed.headers)

      setFileName(file.name)
      setHeaders(parsed.headers)
      setRawRows(objects)
      setMapping(autoMapping)
      setStep('map')
    }
    reader.onerror = () => toast.error('Could not read that file')
    reader.readAsText(file)
  }

  function handleImport() {
    if (!canImport) return

    startTransition(async () => {
      const result = await importCsvRows(entity, mappedRows)

      if (!result.success) {
        toast.error(result.error)
        return
      }

      const { imported, skipped, errors } = result.data

      if (imported === 0) {
        toast.error(
          errors[0] ?? 'No rows were imported — check your column mapping and required fields',
        )
        return
      }

      const notice = { kind: 'import' as const, entity, count: imported }
      persistOnboardingSuccessNotice(accountId, notice)

      setCsvImportOpen(false)
      reset()

      if (skipped > 0 && errors.length > 0) {
        toast.warning(
          `${entityImportLabel(entity, imported)}. ${skipped} row${skipped === 1 ? '' : 's'} skipped.`,
        )
      } else {
        toast.success(entityImportLabel(entity, imported))
      }

      router.refresh()
    })
  }

  if (step === 'upload') {
    return (
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click()
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            event.currentTarget.classList.add('border-[var(--border-strong)]', 'bg-[var(--bg-overlay)]')
          }}
          onDragLeave={(event) => {
            event.currentTarget.classList.remove('border-[var(--border-strong)]', 'bg-[var(--bg-overlay)]')
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.currentTarget.classList.remove('border-[var(--border-strong)]', 'bg-[var(--bg-overlay)]')
            const file = event.dataTransfer.files?.[0]
            if (file) handleFile(file)
          }}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] px-6 py-10 text-center transition-colors"
        >
          <Upload className="mb-3 h-8 w-8 text-[var(--text-disabled)]" aria-hidden />
          <p className="text-sm font-medium text-[var(--text-primary)]">Upload CSV file</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-[var(--text-tertiary)]">
            Drag and drop a .csv file, or click to browse. Up to 500 rows per import.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-4 pointer-events-none">
            Choose file
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">
        <FileSpreadsheet className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
        <span className="truncate font-medium">{fileName}</span>
        <span className="text-[var(--text-disabled)]">·</span>
        <span>{rawRows.length} rows</span>
        <button
          type="button"
          className="ml-auto text-[var(--text-tertiary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
          onClick={reset}
        >
          Replace file
        </button>
      </div>

      {step === 'map' ? (
        <>
          <p className="text-xs text-[var(--text-tertiary)]">
            Match each Vantera field to a column in your file. Required fields are marked with *.
          </p>
          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {fields.map((field) => (
              <div key={field.key} className="grid grid-cols-[1fr_1.2fr] items-center gap-3">
                <Label className="text-xs text-[var(--text-secondary)]">
                  {field.label}
                  {field.required ? <span className="text-red-500"> *</span> : null}
                </Label>
                <Select
                  value={mapping[field.key] ?? SKIP_VALUE}
                  onValueChange={(value) =>
                    setMapping((prev) => ({
                      ...prev,
                      [field.key]: value,
                    }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SKIP_VALUE}>Skip</SelectItem>
                    {headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          {requiredMissing.length > 0 ? (
            <p className="text-xs text-amber-700">
              Map required fields: {requiredMissing.map((field) => field.label).join(', ')}
            </p>
          ) : null}
          <div className="flex justify-between gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canProceedToPreview}
              onClick={() => setStep('preview')}
            >
              Preview import
            </Button>
          </div>
        </>
      ) : null}

      {step === 'preview' ? (
        <>
          <p className="text-xs text-[var(--text-tertiary)]">
            First {previewRows.length} row{previewRows.length === 1 ? '' : 's'} after mapping — review
            before importing {rawRows.length} total.
          </p>
          <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-[var(--bg-subtle)] text-[var(--text-tertiary)]">
                <tr>
                  {previewColumns.map((field) => (
                    <th key={field.key} className="whitespace-nowrap px-3 py-2 font-medium">
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {previewRows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {previewColumns.map((field) => (
                      <td key={field.key} className="max-w-[10rem] truncate px-3 py-2 text-[var(--text-primary)]">
                        {row[field.key] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            Ready to import {rawRows.length} row{rawRows.length === 1 ? '' : 's'}
          </div>
          <div className="flex justify-between gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep('map')}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Edit mapping
            </Button>
            <Button type="button" size="sm" disabled={isPending} onClick={handleImport}>
              {isPending ? 'Importing…' : `Import ${rawRows.length} rows`}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
