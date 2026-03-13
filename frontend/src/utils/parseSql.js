/**
 * Client-side SQL parser — converts CREATE TABLE statements into Schema-Genius nodes + edges.
 * Supports MySQL (backtick identifiers), PostgreSQL (double-quote), and SQLite.
 */

// ── Type normalisation ────────────────────────────────────────────────────────

const TYPE_MAP = {
  BIGINT: 'BIGINT', INT8: 'BIGINT', BIGSERIAL: 'BIGINT',
  INTEGER: 'INT', INT: 'INT', INT4: 'INT', SERIAL: 'INT', MEDIUMINT: 'INT', NUMBER: 'INT',
  SMALLINT: 'SMALLINT', INT2: 'SMALLINT', SMALLSERIAL: 'SMALLINT',
  TINYINT: 'TINYINT',
  VARCHAR: 'VARCHAR', 'CHARACTER VARYING': 'VARCHAR', NVARCHAR: 'VARCHAR',
  CHAR: 'CHAR', NCHAR: 'CHAR', 'CHARACTER': 'CHAR',
  TEXT: 'TEXT', TINYTEXT: 'TEXT', MEDIUMTEXT: 'TEXT', LONGTEXT: 'TEXT', CLOB: 'TEXT',
  BOOLEAN: 'BOOLEAN', BOOL: 'BOOLEAN',
  DECIMAL: 'DECIMAL', NUMERIC: 'DECIMAL', MONEY: 'DECIMAL',
  FLOAT: 'FLOAT', REAL: 'FLOAT', DOUBLE: 'FLOAT', 'DOUBLE PRECISION': 'FLOAT',
  TIMESTAMP: 'TIMESTAMP', DATETIME: 'TIMESTAMP', TIMESTAMPTZ: 'TIMESTAMP',
  DATE: 'DATE',
  TIME: 'TIME', TIMETZ: 'TIME',
  JSON: 'JSON', JSONB: 'JSON',
  UUID: 'VARCHAR', UNIQUEIDENTIFIER: 'VARCHAR',
  BLOB: 'TEXT', BINARY: 'TEXT', VARBINARY: 'TEXT', BYTEA: 'TEXT',
  ENUM: 'VARCHAR', SET: 'VARCHAR',
}

function normaliseType(raw) {
  const upper = raw.toUpperCase().replace(/\s*\([^)]*\)/, '').trim()
  return TYPE_MAP[upper] || upper
}

// ── Identifier unquoting ──────────────────────────────────────────────────────

function unquote(str) {
  return str.trim().replace(/^[`"']|[`"']$/g, '')
}

// ── Split a comma-separated list respecting nested parens ─────────────────────

function splitTopLevel(str) {
  const parts = []
  let depth = 0, current = ''
  for (const ch of str) {
    if (ch === '(') { depth++; current += ch }
    else if (ch === ')') { depth--; current += ch }
    else if (ch === ',' && depth === 0) { parts.push(current.trim()); current = '' }
    else { current += ch }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

// ── Extract CREATE TABLE blocks ───────────────────────────────────────────────

function extractTableBlocks(sql) {
  const blocks = []
  // Match CREATE TABLE optionally followed by IF NOT EXISTS, then the name
  const pattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"']?\w+[`"']?)\s*\(/gi
  let match

  while ((match = pattern.exec(sql)) !== null) {
    const name = unquote(match[1])
    const bodyStart = match.index + match[0].length - 1 // position of '('

    // Walk forward to find the matching ')'
    let depth = 0, i = bodyStart
    while (i < sql.length) {
      if (sql[i] === '(') depth++
      else if (sql[i] === ')') { depth--; if (depth === 0) break }
      i++
    }

    const body = sql.slice(bodyStart + 1, i)
    blocks.push({ name, body })
  }

  return blocks
}

// ── Parse a single column definition line ────────────────────────────────────

function parseColumn(line) {
  // Skip table-level constraints handled separately
  const up = line.toUpperCase().trimStart()
  if (
    up.startsWith('PRIMARY KEY') ||
    up.startsWith('UNIQUE') ||
    up.startsWith('INDEX') ||
    up.startsWith('KEY ') ||
    up.startsWith('CONSTRAINT') ||
    up.startsWith('FOREIGN KEY') ||
    up.startsWith('CHECK')
  ) return null

  // Column name
  const nameMatch = line.match(/^([`"']?\w+[`"']?)/)
  if (!nameMatch) return null
  const name = unquote(nameMatch[1])

  const rest = line.slice(nameMatch[0].length).trim()

  // Type — word + optional (...)
  const typeMatch = rest.match(/^(\w+(?:\s*\([^)]*\))?)/)
  if (!typeMatch) return null

  const rawType = typeMatch[1].trim()
  const afterType = rest.slice(typeMatch[0].length).toUpperCase()

  const isSerial = /\b(SERIAL|BIGSERIAL|SMALLSERIAL)\b/i.test(rawType)
  const autoIncrement = isSerial || /\bAUTO_?INCREMENT\b/.test(afterType)
  const nullable = !(/\bNOT\s+NULL\b/.test(afterType))
  const pk = /\bPRIMARY\s+KEY\b/.test(afterType)
  const unique = /\bUNIQUE\b/.test(afterType)

  // Inline REFERENCES
  const refMatch = rest.match(/\bREFERENCES\s+([`"']?\w+[`"']?)\s*\(([^)]+)\)/i)

  return {
    id:            `col_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name,
    type:          normaliseType(rawType),
    nullable:      pk ? false : nullable,
    pk,
    unique:        pk ? true : unique,
    autoIncrement,
    default:       null,
    fk:            !!refMatch,
    _refTable:     refMatch ? unquote(refMatch[1]) : null,
  }
}

// ── Parse a table body into columns + foreign-key metadata ───────────────────

function parseTableBody(body) {
  const lines   = splitTopLevel(body)
  const columns = []
  const fks     = []     // { sourceColumn, targetTable }
  const pkCols  = []     // column names declared in table-level PRIMARY KEY (...)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const up = trimmed.toUpperCase()

    // Table-level PRIMARY KEY
    if (up.startsWith('PRIMARY KEY')) {
      const m = trimmed.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i)
      if (m) m[1].split(',').forEach(c => pkCols.push(unquote(c)))
      continue
    }

    // FOREIGN KEY / CONSTRAINT ... FOREIGN KEY
    const fkPattern = /FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([`"']?\w+[`"']?)/i
    if (up.includes('FOREIGN KEY')) {
      const m = trimmed.match(fkPattern)
      if (m) {
        fks.push({
          sourceColumn: unquote(m[1].split(',')[0]),
          targetTable:  unquote(m[2]),
        })
        // Also mark the column as fk:true
        const colName = unquote(m[1].split(',')[0])
        const col = columns.find(c => c.name === colName)
        if (col) col.fk = true
      }
      continue
    }

    // Regular column
    const col = parseColumn(trimmed)
    if (col) {
      // Collect inline FK
      if (col._refTable) fks.push({ sourceColumn: col.name, targetTable: col._refTable })
      delete col._refTable
      columns.push(col)
    }
  }

  // Apply table-level PK declarations
  for (const colName of pkCols) {
    const col = columns.find(c => c.name === colName)
    if (col) { col.pk = true; col.nullable = false; col.unique = true }
  }

  return { columns, fks }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function parseSqlToSchema(sql) {
  // Strip single-line and block comments
  const cleaned = sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')

  const tableBlocks = extractTableBlocks(cleaned)
  if (tableBlocks.length === 0) return null   // nothing found

  const seed  = Date.now()
  const nodes = []
  const edges = []
  const nameToId = {}

  // Build nodes
  tableBlocks.forEach(({ name, body }, index) => {
    const { columns } = parseTableBody(body)
    const id = `table_${seed}_${index}`
    nameToId[name.toLowerCase()] = id

    // Ensure there's at least one column
    if (columns.length === 0) {
      columns.push({
        id: `col_${seed}_${index}_0`,
        name: 'id', type: 'BIGINT',
        nullable: false, pk: true, unique: true, autoIncrement: true, default: null, fk: false,
      })
    }

    nodes.push({
      id,
      type: 'tableNode',
      position: {
        x: 80 + (index % 3) * 360,
        y: 80 + Math.floor(index / 3) * 300,
      },
      data: { name, columns },
    })
  })

  // Build edges from foreign keys
  tableBlocks.forEach(({ name, body }, index) => {
    const { fks } = parseTableBody(body)
    const sourceId = nameToId[name.toLowerCase()]

    fks.forEach((fk, fi) => {
      const targetId = nameToId[fk.targetTable.toLowerCase()]
      if (!targetId || targetId === sourceId) return

      edges.push({
        id:     `edge_${seed}_${index}_${fi}`,
        source: sourceId,
        target: targetId,
        type:   'schema',
        data: {
          relationshipType: '1:M',
          sourceLabel: '',
          targetLabel: '',
          lineStyle:   'smoothstep',
          diagramType: 'association',
        },
      })
    })
  })

  return { nodes, edges }
}
