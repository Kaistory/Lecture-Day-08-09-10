// VIEW — render nội dung CSV thành bảng (parser xử lý dấu phẩy trong ngoặc kép).
export function parseCsv(text) {
  const rows = []
  let row = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.length > 1 || (r[0] && r[0].trim()))
}

// Tô màu các giá trị tín hiệu (yes/no) cho cột contains/forbidden.
function cellClass(header, value) {
  const h = (header || '').toLowerCase(), v = (value || '').trim().toLowerCase()
  if (h.includes('forbidden')) return v === 'yes' ? 'badge fail' : v === 'no' ? 'badge ok' : ''
  if (h.includes('contains') || h.includes('expected')) return v === 'yes' ? 'badge ok' : v === 'no' ? 'badge fail' : ''
  return ''
}

export default function CsvTable({ text }) {
  const rows = parseCsv(text || '')
  if (!rows.length) return <div className="muted">— file rỗng —</div>
  const [head, ...body] = rows
  return (
    <div style={{ overflow: 'auto' }}>
      <table className="tbl">
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri}>
              {head.map((h, ci) => {
                const cls = cellClass(h, r[ci])
                return <td key={ci} title={r[ci]} style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cls ? <span className={cls}>{r[ci]}</span> : r[ci]}
                </td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
