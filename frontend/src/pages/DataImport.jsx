import { useEffect, useState } from 'react'
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Sparkles,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { api } from '../api/client'
import { Card, CardHeader, Button, Badge } from '../components/ui'

const SAMPLE_TEXT = `Raj met Arjun at the warehouse in Mumbai. Raj's phone number is 9876543210. ` +
  `Raj transferred Rs 500000 to Account No. 400198237651 on 12/06/2026. Arjun is associated with Shanti Traders Pvt Ltd.`

export default function DataImport() {
  const [schema, setSchema] = useState(null)
  const [datasetType, setDatasetType] = useState('people')
  const [file, setFile] = useState(null)
  const [fileKind, setFileKind] = useState('csv')
  const [uploadResult, setUploadResult] = useState(null)
  const [uploading, setUploading] = useState(false)

  const [text, setText] = useState(SAMPLE_TEXT)
  const [extraction, setExtraction] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [committing, setCommitting] = useState(false)

  useEffect(() => {
    api.ingestSchema().then((res) => setSchema(res.data))
  }, [])

  async function handleUpload(e) {
    e.preventDefault()

    if (!file) return

    setUploading(true)
    setUploadResult(null)

    try {
      const res =
        fileKind === 'csv'
          ? await api.ingestCsv(datasetType, file)
          : await api.ingestJson(datasetType, file)

      setUploadResult(res.data)
    } catch (err) {
      setUploadResult({
        error:
          err?.response?.data?.detail ||
          'Upload failed',
      })
    } finally {
      setUploading(false)
    }
  }

  async function handleExtract() {
    setExtracting(true)
    setExtraction(null)

    try {
      const res = await api.ingestText(text, false)
      setExtraction(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setExtracting(false)
    }
  }

  async function handleCommit() {
    setCommitting(true)

    try {
      const res = await api.ingestText(text, true)
      setExtraction(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCommitting(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* ------------------------------------------------ */}
      {/* Page Header                                      */}
      {/* ------------------------------------------------ */}

      <div>
        <h1 className="text-xl font-bold text-[var(--text-bright)]">
          Data Import
        </h1>

        <p className="text-xs text-[var(--text-dim)] mt-1">
          Import structured datasets (CSV/JSON) or extract entities
          from unstructured investigative text.
        </p>
      </div>


      {/* ------------------------------------------------ */}
      {/* Structured Dataset Upload                       */}
      {/* ------------------------------------------------ */}

      <Card>

        <CardHeader
          title="Structured Dataset Upload"
          subtitle="People, call records, transactions, vehicles, locations, organizations"
          right={
            <UploadCloud
              size={16}
              className="text-[var(--text-dim)]"
            />
          }
        />

        <form
          onSubmit={handleUpload}
          className="p-4 space-y-4"
        >

          <div className="flex flex-wrap gap-3">

            {/* Dataset type */}

            <div>

              <label className="block text-xs text-[var(--text-dim)] mb-1">
                Dataset type
              </label>

              <select
                value={datasetType}
                onChange={(e) =>
                  setDatasetType(e.target.value)
                }
                className="bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)] outline-none"
              >
                {(schema?.supported_types || []).map(
                  (t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  )
                )}
              </select>

            </div>


            {/* File format */}

            <div>

              <label className="block text-xs text-[var(--text-dim)] mb-1">
                Format
              </label>

              <select
                value={fileKind}
                onChange={(e) =>
                  setFileKind(e.target.value)
                }
                className="bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)] outline-none"
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>

            </div>


            {/* File */}

            <div className="flex-1 min-w-[220px]">

              <label className="block text-xs text-[var(--text-dim)] mb-1">
                File
              </label>

              <input
                type="file"
                accept={
                  fileKind === 'csv'
                    ? '.csv'
                    : '.json'
                }
                onChange={(e) =>
                  setFile(
                    e.target.files?.[0] || null
                  )
                }
                className="w-full text-xs text-[var(--text-dim)] file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-[var(--accent)] file:text-white file:text-xs"
              />

            </div>

          </div>


          {/* Expected columns */}

          {schema && (
            <div className="text-[11px] text-[var(--text-dim)]">

              Expected columns for{' '}

              <span className="text-[var(--text-bright)]">
                {datasetType}
              </span>

              :{' '}

              {schema.columns[datasetType]?.join(', ')}

            </div>
          )}


          {/* Upload button */}

          <Button
            type="submit"
            disabled={!file || uploading}
          >

            {uploading ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : (
              <UploadCloud size={14} />
            )}

            {uploading
              ? 'Processing...'
              : 'Upload & ingest'}

          </Button>


          {/* ------------------------------------------------ */}
          {/* Upload Result                                    */}
          {/* ------------------------------------------------ */}

          {uploadResult && (

            uploadResult.error ? (

              <div className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 rounded-md px-3 py-2">
                {uploadResult.error}
              </div>

            ) : (

              <div className="space-y-3">

                {/* Normal ingestion result */}

                <div className="text-xs text-[var(--success)] bg-[var(--success)]/10 rounded-md px-3 py-2 flex items-center gap-2">

                  <CheckCircle2 size={14} />

                  Processed{' '}
                  {uploadResult.rows_processed ?? 0}{' '}
                  rows ·{' '}
                  {uploadResult.relationships_created ?? 0}{' '}
                  relationships created

                </div>


                {/* ------------------------------------------------ */}
                {/* Blockchain Confirmation                           */}
                {/* ------------------------------------------------ */}

                {(uploadResult.blockchain ||
                  uploadResult.block_index !== undefined ||
                  uploadResult.block_hash ||
                  uploadResult.content_hash) && (

                  <div className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-hover)] p-4">

                    <div className="flex items-center gap-2 mb-3">

                      <ShieldCheck
                        size={18}
                        className="text-[var(--success)]"
                      />

                      <div>

                        <div className="text-sm font-semibold text-[var(--text-bright)]">
                          Blockchain Recorded
                        </div>

                        <div className="text-[10px] text-[var(--text-dim)]">
                          Dataset integrity has been recorded in the
                          tamper-evident ledger.
                        </div>

                      </div>

                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                      {/* Block */}

                      <div className="bg-[var(--bg-app)] rounded-md p-3">

                        <div className="text-[10px] text-[var(--text-dim)]">
                          Block
                        </div>

                        <div className="text-sm font-semibold text-[var(--text-bright)] mt-1 mono">

                          #
                          {
                            uploadResult.blockchain?.block_index ??
                            uploadResult.block_index ??
                            '—'
                          }

                        </div>

                      </div>


                      {/* Content hash */}

                      <div className="bg-[var(--bg-app)] rounded-md p-3">

                        <div className="text-[10px] text-[var(--text-dim)]">
                          SHA-256 Content Hash
                        </div>

                        <div className="text-[10px] text-[var(--text-bright)] mt-1 mono break-all">

                          {
                            uploadResult.blockchain?.content_hash ??
                            uploadResult.content_hash ??
                            '—'
                          }

                        </div>

                      </div>


                      {/* Block hash */}

                      <div className="bg-[var(--bg-app)] rounded-md p-3">

                        <div className="text-[10px] text-[var(--text-dim)]">
                          Block Hash
                        </div>

                        <div className="text-[10px] text-[var(--text-bright)] mt-1 mono break-all">

                          {
                            uploadResult.blockchain?.block_hash ??
                            uploadResult.block_hash ??
                            '—'
                          }

                        </div>

                      </div>

                    </div>

                  </div>

                )}

              </div>

            )
          )}

        </form>

      </Card>


      {/* ------------------------------------------------ */}
      {/* AI Entity Extraction                             */}
      {/* ------------------------------------------------ */}

      <Card>

        <CardHeader
          title="AI Entity Extraction from Unstructured Text"
          subtitle="Rule/pattern-based NLP extraction with explainability"
          right={
            <Sparkles
              size={16}
              className="text-[var(--text-dim)]"
            />
          }
        />

        <div className="p-4 space-y-3">

          <textarea
            value={text}
            onChange={(e) =>
              setText(e.target.value)
            }
            rows={4}
            className="w-full bg-[var(--bg-app)] border border-[var(--border-light)] rounded-md px-3 py-2 text-sm text-[var(--text-bright)] outline-none focus:border-[var(--accent)]"
            placeholder="Paste investigative notes, reports, or free-text case details..."
          />


          <div className="flex gap-2">

            <Button
              variant="secondary"
              onClick={handleExtract}
              disabled={
                extracting ||
                !text.trim()
              }
            >

              {extracting ? (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <FileText size={14} />
              )}

              Preview extraction

            </Button>


            <Button
              onClick={handleCommit}
              disabled={
                committing ||
                !text.trim()
              }
            >

              {committing ? (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <CheckCircle2 size={14} />
              )}

              Extract & commit to graph

            </Button>

          </div>


          {/* Extraction results */}

          {extraction && (

            <div className="space-y-4 pt-2">

              {extraction.committed && (

                <div className="text-xs text-[var(--success)] bg-[var(--success)]/10 rounded-md px-3 py-2">

                  Committed{' '}
                  {extraction.entities_created}{' '}
                  entities and{' '}
                  {extraction.relationships_created}{' '}
                  relationships to the graph.

                </div>

              )}


              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                <ExtractGroup
                  label="People"
                  type="Person"
                  items={
                    extraction.extracted.people
                  }
                />

                <ExtractGroup
                  label="Organizations"
                  type="Organization"
                  items={
                    extraction.extracted.organizations
                  }
                />

                <ExtractGroup
                  label="Locations"
                  type="Location"
                  items={[
                    ...extraction.extracted.locations,
                    ...extraction.extracted.places,
                  ]}
                />

                <ExtractGroup
                  label="Phone Numbers"
                  type="Phone"
                  items={
                    extraction.extracted.phone_numbers
                  }
                />

                <ExtractGroup
                  label="Bank Accounts"
                  type="Account"
                  items={
                    extraction.extracted.bank_accounts
                  }
                />

                <ExtractGroup
                  label="Vehicles"
                  type="Vehicle"
                  items={
                    extraction.extracted.vehicles
                  }
                />

                <ExtractGroup
                  label="Dates"
                  type="Date"
                  items={
                    extraction.extracted.dates
                  }
                />

                <ExtractGroup
                  label="Transactions"
                  type="Account"
                  items={
                    extraction.extracted.transactions?.map(
                      (t) => t.raw
                    )
                  }
                />

              </div>


              {/* Relationships */}

              {extraction.relationships?.length > 0 && (

                <div>

                  <div className="text-xs font-semibold text-[var(--text-bright)] mb-2">
                    Inferred relationships
                  </div>

                  <div className="space-y-1.5">

                    {extraction.relationships.map(
                      (r, i) => (

                        <div
                          key={i}
                          className="text-xs text-[var(--text)] bg-[var(--bg-hover)] rounded-md px-3 py-2"
                        >

                          <span className="text-[var(--text-bright)]">
                            {r.source}
                          </span>

                          {' —'}
                          {r.type.replace(
                            /_/g,
                            ' '
                          )}
                          →{' '}

                          <span className="text-[var(--text-bright)]">
                            {r.target}
                          </span>

                          <div className="text-[var(--text-dim)] mt-0.5">
                            {r.explanation}
                          </div>

                        </div>

                      )
                    )}

                  </div>

                </div>

              )}


              {/* Explanations */}

              <div>

                <div className="text-xs font-semibold text-[var(--text-bright)] mb-2">
                  Why these were extracted
                </div>

                <ul className="space-y-1 text-[11px] text-[var(--text-dim)]">

                  {extraction.extracted.explanations?.map(
                    (ex, i) => (
                      <li key={i}>
                        ✓ {ex}
                      </li>
                    )
                  )}

                </ul>

              </div>

            </div>

          )}

        </div>

      </Card>

    </div>
  )
}


/* ======================================================= */
/* Extract Group                                           */
/* ======================================================= */

function ExtractGroup({
  label,
  type,
  items = [],
}) {

  return (

    <div className="bg-[var(--bg-app)] border border-[var(--border)] rounded-md p-3">

      <div className="flex items-center justify-between mb-2">

        <span className="text-[11px] font-semibold text-[var(--text-dim)]">
          {label}
        </span>

        <Badge>
          {items.length}
        </Badge>

      </div>


      {items.length === 0 ? (

        <div className="text-[11px] text-[var(--text-dim)]">
          None found
        </div>

      ) : (

        <div className="flex flex-wrap gap-1">

          {items
            .slice(0, 6)
            .map((it, i) => (

              <span
                key={i}
                className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text)] mono"
              >
                {it}
              </span>

            ))}

        </div>

      )}

    </div>

  )
}
