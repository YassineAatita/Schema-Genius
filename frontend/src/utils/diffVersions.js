/**
 * diffVersions — compare two schema snapshots and return a structured diff.
 *
 * Each snapshot: { nodes: [...], edges: [...] }
 *   node:   { id, data: { name, columns: [{ name, type, nullable, pk, fk, unique, autoIncrement, default }] } }
 *   edge:   { id, source, target, data: { relationshipType, diagramType } }
 *
 * Returns:
 * {
 *   tables: {
 *     added:    [{ id, name, columns }]
 *     removed:  [{ id, name, columns }]
 *     modified: [{ id, name, oldName, nameChanged, colChanges }]
 *   },
 *   edges: {
 *     added:   [edge]
 *     removed: [edge]
 *   },
 *   totals: { added, removed, modified, edgesAdded, edgesRemoved, total }
 *   isEmpty: boolean
 * }
 *
 * Diffing is done by node.id (stable across saves) so renames are caught
 * as "modified" rather than removed+added.
 */
export function diffVersions(snapshotA, snapshotB) {
  const nodesA = snapshotA?.nodes || []
  const nodesB = snapshotB?.nodes || []
  const edgesA = snapshotA?.edges || []
  const edgesB = snapshotB?.edges || []

  const mapA = new Map(nodesA.map(n => [n.id, n]))
  const mapB = new Map(nodesB.map(n => [n.id, n]))

  // ── Table diff ────────────────────────────────────────────────────
  const added    = []
  const removed  = []
  const modified = []

  // Tables that appear in B but not A → Added
  for (const node of nodesB) {
    if (!mapA.has(node.id)) {
      added.push({
        id:      node.id,
        name:    node.data?.name || node.id,
        columns: node.data?.columns || [],
      })
    }
  }

  // Tables that appear in A but not B → Removed
  for (const node of nodesA) {
    if (!mapB.has(node.id)) {
      removed.push({
        id:      node.id,
        name:    node.data?.name || node.id,
        columns: node.data?.columns || [],
      })
    }
  }

  // Tables in both → check for modifications
  for (const nodeA of nodesA) {
    const nodeB = mapB.get(nodeA.id)
    if (!nodeB) continue   // removed — already handled

    const nameA = nodeA.data?.name || ''
    const nameB = nodeB.data?.name || ''
    const nameChanged = nameA !== nameB

    const colsA = nodeA.data?.columns || []
    const colsB = nodeB.data?.columns || []

    const colMapA = new Map(colsA.map(c => [c.name, c]))
    const colMapB = new Map(colsB.map(c => [c.name, c]))

    const colChanges = []

    // Added columns
    for (const col of colsB) {
      if (!colMapA.has(col.name)) {
        colChanges.push({ kind: 'added', col })
      }
    }

    // Removed columns
    for (const col of colsA) {
      if (!colMapB.has(col.name)) {
        colChanges.push({ kind: 'removed', col })
      }
    }

    // Changed columns (same name, different properties)
    for (const colB of colsB) {
      const colA = colMapA.get(colB.name)
      if (!colA) continue   // added — already handled

      const fieldDiffs = {}
      if (colA.type !== colB.type)
        fieldDiffs.type = { from: colA.type, to: colB.type }
      if (!!colA.nullable !== !!colB.nullable)
        fieldDiffs.nullable = { from: !!colA.nullable, to: !!colB.nullable }
      if (!!colA.pk !== !!colB.pk)
        fieldDiffs.pk = { from: !!colA.pk, to: !!colB.pk }
      if (!!colA.unique !== !!colB.unique)
        fieldDiffs.unique = { from: !!colA.unique, to: !!colB.unique }
      if (!!colA.autoIncrement !== !!colB.autoIncrement)
        fieldDiffs.autoIncrement = { from: !!colA.autoIncrement, to: !!colB.autoIncrement }
      if ((colA.default ?? null) !== (colB.default ?? null))
        fieldDiffs.default = { from: colA.default ?? null, to: colB.default ?? null }

      if (Object.keys(fieldDiffs).length > 0) {
        colChanges.push({ kind: 'changed', col: colB, fieldDiffs })
      }
    }

    if (nameChanged || colChanges.length > 0) {
      modified.push({
        id:          nodeA.id,
        name:        nameB,
        oldName:     nameA,
        nameChanged,
        colChanges,
      })
    }
  }

  // ── Edge diff ─────────────────────────────────────────────────────
  const edgeSetA = new Set(edgesA.map(e => e.id))
  const edgeSetB = new Set(edgesB.map(e => e.id))

  // Helper: resolve table name from node id
  const nameFromId = (nodeId) =>
    mapB.get(nodeId)?.data?.name || mapA.get(nodeId)?.data?.name || nodeId

  const edgesAdded = edgesB
    .filter(e => !edgeSetA.has(e.id))
    .map(e => ({
      ...e,
      _sourceName: nameFromId(e.source),
      _targetName: nameFromId(e.target),
    }))

  const edgesRemoved = edgesA
    .filter(e => !edgeSetB.has(e.id))
    .map(e => ({
      ...e,
      _sourceName: nameFromId(e.source),
      _targetName: nameFromId(e.target),
    }))

  // ── Summary ───────────────────────────────────────────────────────
  const totals = {
    added:        added.length,
    removed:      removed.length,
    modified:     modified.length,
    edgesAdded:   edgesAdded.length,
    edgesRemoved: edgesRemoved.length,
    get total() {
      return this.added + this.removed + this.modified + this.edgesAdded + this.edgesRemoved
    },
  }

  return {
    tables: { added, removed, modified },
    edges:  { added: edgesAdded, removed: edgesRemoved },
    totals,
    isEmpty: totals.total === 0,
  }
}
