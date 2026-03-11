/**
 * Runs client-side validation on the schema.
 * Returns an array of issue objects:
 *   { type: 'error'|'warning', nodeId, tableName, message }
 */
export function validateSchema(nodes) {
  const issues = []

  // Build name → [nodeIds] map to detect duplicates
  const nameMap = {}
  nodes.forEach(node => {
    const name = node.data?.name?.trim().toLowerCase()
    if (name) {
      if (!nameMap[name]) nameMap[name] = []
      nameMap[name].push(node.id)
    }
  })

  nodes.forEach(node => {
    const { name, columns = [] } = node.data
    const trimmed = name?.trim()

    // ── Empty table name ──────────────────────────────────────────
    if (!trimmed) {
      issues.push({ type: 'error', nodeId: node.id, tableName: '(unnamed)', message: 'Table has an empty name' })
      return
    }

    // ── Duplicate table name ──────────────────────────────────────
    if (nameMap[trimmed.toLowerCase()]?.length > 1) {
      issues.push({ type: 'error', nodeId: node.id, tableName: trimmed, message: `Duplicate table name "${trimmed}"` })
    }

    // ── No columns ───────────────────────────────────────────────
    if (columns.length === 0) {
      issues.push({ type: 'warning', nodeId: node.id, tableName: trimmed, message: 'Table has no columns' })
      return
    }

    // ── No primary key ───────────────────────────────────────────
    if (!columns.some(c => c.pk)) {
      issues.push({ type: 'warning', nodeId: node.id, tableName: trimmed, message: 'No primary key defined' })
    }

    // ── Duplicate column names ────────────────────────────────────
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

    // ── Empty column names ────────────────────────────────────────
    if (columns.some(col => !col.name?.trim())) {
      issues.push({ type: 'warning', nodeId: node.id, tableName: trimmed, message: 'One or more columns have empty names' })
    }
  })

  return issues
}
