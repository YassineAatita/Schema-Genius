/**
 * Runs client-side validation on the schema.
 * Returns an array of issue objects:
 *   { type: 'error'|'warning', nodeId, tableName, message }
 *
 * @param {Array}  nodes  — React Flow node array from the store
 * @param {Array}  edges  — React Flow edge array from the store (for FK checks)
 */

// SQL reserved words that must not be used as table or column names
const SQL_RESERVED = new Set([
  'ADD','ALL','ALTER','AND','AS','ASC','BETWEEN','BY','CALL','CASE','CHECK',
  'COLUMN','CONSTRAINT','CREATE','CROSS','DATABASE','DEFAULT','DELETE','DESC',
  'DISTINCT','DROP','ELSE','END','EXISTS','FOREIGN','FROM','FULL','GRANT',
  'GROUP','HAVING','IGNORE','IN','INDEX','INNER','INSERT','INTO','IS','JOIN',
  'KEY','LEFT','LIKE','LIMIT','LOCK','MATCH','MERGE','NOT','NULL','ON','OR',
  'ORDER','OUTER','PRIMARY','PRIVILEGES','PROCEDURE','REFERENCES','RENAME',
  'REPLACE','REVOKE','RIGHT','ROLLBACK','ROW','SCHEMA','SELECT','SET',
  'SHOW','TABLE','TABLES','THEN','TO','TRIGGER','TRUNCATE','UNION','UNIQUE',
  'UPDATE','USE','VALUES','VIEW','WHEN','WHERE','WITH',
  // MySQL-specific
  'READ','WRITE','STATUS','OPEN','YEAR','MONTH','DAY','HOUR','MINUTE',
  'SECOND','TIME','DATE','TIMESTAMP','INT','TINYINT','SMALLINT','BIGINT',
  'FLOAT','DOUBLE','DECIMAL','CHAR','VARCHAR','TEXT','BLOB','ENUM','BOOLEAN',
  'BOOL','BIT','JSON','GEOMETRY','UNSIGNED','SIGNED','ZEROFILL','AUTO_INCREMENT',
])

export function validateSchema(nodes, edges = []) {
  const issues = []

  // ── Build lookup structures ──────────────────────────────────────────────────

  // name → [nodeIds] — for duplicate table detection
  const nameMap = {}
  nodes.forEach(node => {
    const name = node.data?.name?.trim().toLowerCase()
    if (name) {
      if (!nameMap[name]) nameMap[name] = []
      nameMap[name].push(node.id)
    }
  })

  // nodeId → Set(columnNames) — for FK target validation
  const nodeColumnMap = {}
  nodes.forEach(node => {
    nodeColumnMap[node.id] = new Set(
      (node.data?.columns || []).map(c => c.name?.trim().toLowerCase()).filter(Boolean)
    )
  })

  // nodeId → tableName — for edge FK messages
  const nodeNameMap = {}
  nodes.forEach(node => {
    nodeNameMap[node.id] = node.data?.name?.trim() || '(unnamed)'
  })

  // ── Per-table checks ─────────────────────────────────────────────────────────

  nodes.forEach(node => {
    const { name, columns = [] } = node.data
    const trimmed = name?.trim()

    // Empty table name
    if (!trimmed) {
      issues.push({ type: 'error', nodeId: node.id, tableName: '(unnamed)', message: 'Table has an empty name' })
      return
    }

    // Duplicate table name
    if (nameMap[trimmed.toLowerCase()]?.length > 1) {
      issues.push({ type: 'error', nodeId: node.id, tableName: trimmed, message: `Duplicate table name "${trimmed}"` })
    }

    // Reserved SQL keyword used as table name
    if (SQL_RESERVED.has(trimmed.toUpperCase())) {
      issues.push({ type: 'error', nodeId: node.id, tableName: trimmed, message: `"${trimmed}" is a reserved SQL keyword` })
    }

    // No columns — hard error (cannot export valid SQL)
    if (columns.length === 0) {
      issues.push({ type: 'error', nodeId: node.id, tableName: trimmed, message: 'Table has no columns' })
      return
    }

    // No primary key — hard error
    if (!columns.some(c => c.pk)) {
      issues.push({ type: 'error', nodeId: node.id, tableName: trimmed, message: 'No primary key defined' })
    }

    // Duplicate column names
    const colCount = {}
    columns.forEach(col => {
      const cn = col.name?.trim().toLowerCase()
      if (cn) colCount[cn] = (colCount[cn] || 0) + 1
    })
    Object.entries(colCount)
      .filter(([, count]) => count > 1)
      .forEach(([cn]) => {
        issues.push({ type: 'error', nodeId: node.id, tableName: trimmed, message: `Duplicate column name "${cn}"` })
      })

    // Empty column names
    if (columns.some(col => !col.name?.trim())) {
      issues.push({ type: 'warning', nodeId: node.id, tableName: trimmed, message: 'One or more columns have empty names' })
    }

    // Reserved keyword as column name
    columns.forEach(col => {
      const cn = col.name?.trim()
      if (cn && SQL_RESERVED.has(cn.toUpperCase())) {
        issues.push({
          type: 'warning', nodeId: node.id, tableName: trimmed,
          message: `Column "${cn}" is a reserved SQL keyword`,
        })
      }
    })
  })

  // ── Edge / FK orphan checks ──────────────────────────────────────────────────

  const nodeIds = new Set(nodes.map(n => n.id))

  edges.forEach(edge => {
    const srcExists = nodeIds.has(edge.source)
    const tgtExists = nodeIds.has(edge.target)

    if (!srcExists || !tgtExists) {
      // Dangling edge — both endpoints must exist (usually transient, but flag it)
      const srcName = nodeNameMap[edge.source] || edge.source
      const tgtName = nodeNameMap[edge.target] || edge.target
      issues.push({
        type: 'error',
        nodeId: edge.source,
        tableName: srcName,
        message: `Relation from "${srcName}" to "${tgtName}" references a missing table`,
      })
    }
  })

  return issues
}
