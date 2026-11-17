"use client";

import { useMemo, useState, type ReactNode } from "react";
import { FileUp, Download } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { parseTable, rowsToRecords } from "@/lib/utils/csv";
import type { ActionResult } from "@/types/domain";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
export interface BulkColumn {
  key: string;
  label: string;
  aliases?: string[];
  required?: boolean;
}

/**
 * Paste rows from a spreadsheet or upload a CSV, check the parsed preview,
 * then send the rows to a server action as JSON.
 */
export function BulkImport({
  action,
  columns,
  sample,
  fileName,
  children,
  submitLabel = "Import",
}: {
  action: Action;
  columns: BulkColumn[];
  sample: string;
  fileName: string;
  children?: ReactNode;
  submitLabel?: string;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<string | null>(null);
  const records = useMemo(() => (text.trim() ? rowsToRecords(parseTable(text), columns) : []), [text, columns]);
  const missing = records.filter((r) => columns.some((c) => c.required && !r[c.key])).length;
  const template = `data:text/csv;charset=utf-8,${encodeURIComponent(sample)}`;

  async function onFile(f: File | undefined) {
    if (!f) return;
    setFile(f.name);
    setText(await f.text());
  }

  return (
    <ActionForm action={action}>
      <p className="text-[12.5px] text-dim">
        Columns: {columns.map((c) => (c.required ? <b key={c.key}>{c.label} </b> : <span key={c.key}>{c.label} </span>))}
        — bold ones are required. A header row is optional; without one, columns are read in this order.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn btn-ghost btn-sm cursor-pointer">
          <FileUp size={15} aria-hidden /> {file ? `Loaded ${file}` : "Upload CSV"}
          <input type="file" accept=".csv,.tsv,.txt,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <a href={template} download={fileName} className="btn btn-ghost btn-sm">
          <Download size={15} aria-hidden /> Template
        </a>
        {text && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setText(""); setFile(null); }}>
            Clear
          </button>
        )}
      </div>
      <label className="field">
        <span>…or paste rows (from Excel, Google Sheets or a CSV)</span>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setFile(null); }}
          placeholder={sample}
          rows={6}
          className="mono text-[12.5px]"
          spellCheck={false}
        />
      </label>
      {records.length > 0 && (
        <div className="rounded-[12px] border p-3" style={{ borderColor: "var(--line)" }}>
          <div className="mb-2 text-[12.5px] font-semibold">
            {records.length} row{records.length === 1 ? "" : "s"} ready
            {missing > 0 && <span className="text-bad"> · {missing} missing required values</span>}
          </div>
          <div className="tablewrap max-h-56 overflow-y-auto">
            <table className="data">
              <thead>
                <tr>
                  <th className="num">#</th>
                  {columns.map((c) => <th key={c.key}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    <td className="num text-faint">{i + 1}</td>
                    {columns.map((c) => (
                      <td key={c.key} className={c.required && !r[c.key] ? "text-bad" : undefined}>
                        {c.key === "password" && r[c.key] ? "••••" : r[c.key] || (c.required ? "missing" : "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {records.length > 50 && <p className="mt-2 text-[12px] text-faint">Showing the first 50.</p>}
        </div>
      )}
      <input type="hidden" name="rows" value={JSON.stringify(records)} />
      {children}
      <div>
        <SubmitButton disabled={records.length === 0 || missing > 0}>
          {records.length ? `${submitLabel} ${records.length}` : submitLabel}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
