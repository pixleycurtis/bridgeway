/** Turn an uploaded file into something the AI can read: PDFs/images as base64, spreadsheets/text as text. */
export async function readForAI(file: File): Promise<{ fileName: string; mime: string; base64: string | null; text: string | null }> {
  const name = file.name.toLowerCase();
  if (/\.(xlsx|xls)$/.test(name)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    const text = wb.SheetNames.map((s) => `# ${s}\n${XLSX.utils.sheet_to_csv(wb.Sheets[s]!)}`).join("\n\n");
    return { fileName: file.name, mime: "text/csv", base64: null, text: text.slice(0, 390_000) };
  }
  if (/\.(csv|txt|md)$/.test(name) || file.type.startsWith("text/")) {
    return { fileName: file.name, mime: "text/plain", base64: null, text: (await file.text()).slice(0, 390_000) };
  }
  if (/\.docx$/.test(name)) throw new Error("Save Word files as PDF first, then upload.");
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { fileName: file.name, mime: file.type || "application/pdf", base64: btoa(bin), text: null };
}

export const ACCEPT = ".pdf,.csv,.xlsx,.xls,.txt";
