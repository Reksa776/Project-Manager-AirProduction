type ExcelValue = string | number | null | undefined;
export interface ExcelSheet {
  name: string;
  headers: string[];
  rows: ExcelValue[][];
}

function xml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function cell(value: ExcelValue, header = false): string {
  const numeric = typeof value === "number" && Number.isFinite(value);
  const text = value == null ? "" : String(value);
  return `<Cell${header ? ' ss:StyleID="Header"' : ""}><Data ss:Type="${numeric ? "Number" : "String"}">${xml(text)}</Data></Cell>`;
}

/** Creates an Excel-readable SpreadsheetML workbook without external packages. */
export function createExcelWorkbook(sheets: ExcelSheet[]): string {
  const worksheets = sheets.map((sheet) => {
    const rows = [sheet.headers, ...sheet.rows]
      .map((row, index) => `<Row>${row.map((value) => cell(value, index === 0)).join("")}</Row>`)
      .join("");
    return `<Worksheet ss:Name="${xml(sheet.name.slice(0, 31))}"><Table>${rows}</Table></Worksheet>`;
  }).join("");

  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/><Interior/></Style><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1A73E8" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style></Styles>${worksheets}</Workbook>`;
}

export function excelDownloadResponse(workbook: string, filename: string): Response {
  return new Response(workbook, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
