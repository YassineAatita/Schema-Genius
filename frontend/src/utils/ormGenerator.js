// ── ORM / Model Code Generator ────────────────────────────────────────────────
// Reads the schema JSON (nodes + edges from the Zustand store) and produces
// ready-to-use model code for three frameworks:
//   • generateLaravel(nodes, edges) → { 'User.php': '...', 'Post.php': '...' }
//   • generateDjango(nodes, edges)  → string  (single models.py)
//   • generatePrisma(nodes, edges)  → string  (single schema.prisma)

// ── String utilities ──────────────────────────────────────────────────────────

/** 'blog_posts' → 'BlogPosts' */
function toPascalCase(str) {
  return String(str || '')
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
}

/** 'users' → 'User', 'blog_posts' → 'BlogPost', 'categories' → 'Category' */
function toSingularPascalCase(str) {
  const p = toPascalCase(str)
  if (p.endsWith('ies')) return p.slice(0, -3) + 'y'       // categories → Category
  if (p.endsWith('ses') || p.endsWith('xes') || p.endsWith('zes')) return p.slice(0, -2) // foxes → fox
  if (p.endsWith('ches') || p.endsWith('shes')) return p.slice(0, -2) // watches → watch
  if (p.endsWith('s') && !p.endsWith('ss')) return p.slice(0, -1)    // users → User
  return p
}

/** 'User' → 'user' */
function toLowerFirst(str) {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

/** 'users' → 'user' (singular camelCase) */
function toSingularCamel(str) {
  return toLowerFirst(toSingularPascalCase(str))
}

/** 'post' → 'posts', 'category' → 'categories' */
function toPluralCamel(str) {
  const base = toLowerFirst(toPascalCase(str))
  if (/[^aeiou]y$/i.test(base)) return base.slice(0, -1) + 'ies'
  if (/([sxz]|ch|sh)$/i.test(base)) return base + 'es'
  if (base.endsWith('s')) return base          // already plural-looking
  return base + 's'
}

/** 'user_id' → 'userId', 'created_at' → 'createdAt' */
function snakeToCamel(str) {
  return String(str || '').replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

/** De-duplicate relationship specs by (type + method) */
function dedupeRels(rels) {
  const seen = new Set()
  return rels.filter(r => {
    const key = `${r.type}:${r.method}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Safely get table nodes (nodes that have a .data.columns array) */
function tableNodes(nodes) {
  return (nodes || []).filter(n => Array.isArray(n.data?.columns))
}

// ═══════════════════════════════════════════════════════════════════════════════
// LARAVEL ELOQUENT
// ═══════════════════════════════════════════════════════════════════════════════

function laravelCast(col) {
  const t = (col.type || '').toUpperCase()
  if (t === 'BOOLEAN') return 'boolean'
  if (t === 'JSON') return 'array'
  if (['DATE', 'DATETIME', 'TIMESTAMP'].includes(t)) return 'datetime'
  return null
}

function buildLaravelModel(node, allNodes, allEdges) {
  const tableName = node.data?.name || 'unknown'
  const columns   = node.data?.columns || []
  const className = toSingularPascalCase(tableName)

  if (columns.length === 0) {
    return `<?php\n\n// Table "${tableName}" has no columns — skipped.\n`
  }

  const usedRelTypes = new Set()   // tracks which relation imports are needed
  const rels = []

  // ── From column-level fkRef (BelongsTo side) ──────────────────────────────
  columns.forEach(col => {
    if (!col.fk || !col.fkRef?.table || !col.fkRef?.column) return
    const refTable = col.fkRef.table
    const refNode  = allNodes.find(n => n.data?.name === refTable)
    const refClass = toSingularPascalCase(refTable)
    // If the referenced table no longer exists, add a comment method instead
    if (!refNode) {
      rels.push({ type: 'comment', text: `// FK to "${refTable}" not found on canvas — skipped.` })
      return
    }
    usedRelTypes.add('BelongsTo')
    rels.push({
      type: 'belongsTo', method: toSingularCamel(refTable),
      model: refClass, fk: col.name, pk: col.fkRef.column,
    })
  })

  // ── From edges ─────────────────────────────────────────────────────────────
  allEdges.forEach(edge => {
    const relType = (edge.data?.type || edge.data?.relationshipType || '1:N').toUpperCase()
    const isN2N   = relType === 'N:N' || relType === 'M:N'
    const is1to1  = relType === '1:1'

    if (edge.source === node.id) {
      const tgt = allNodes.find(n => n.id === edge.target)
      if (!tgt) return
      const tgtTable = tgt.data?.name
      const tgtClass = toSingularPascalCase(tgtTable)
      const fk = edge.data?.fkColumn || `${tableName}_id`
      const pk = edge.data?.sourceColumn || 'id'

      if (isN2N) {
        const pivot = [tableName, tgtTable].sort().join('_')
        usedRelTypes.add('BelongsToMany')
        rels.push({ type: 'belongsToMany', method: toPluralCamel(tgtTable), model: tgtClass, pivot })
      } else if (is1to1) {
        usedRelTypes.add('HasOne')
        rels.push({ type: 'hasOne', method: toSingularCamel(tgtTable), model: tgtClass, fk, pk })
      } else {
        usedRelTypes.add('HasMany')
        rels.push({ type: 'hasMany', method: toPluralCamel(tgtTable), model: tgtClass, fk, pk })
      }
    } else if (edge.target === node.id) {
      const src = allNodes.find(n => n.id === edge.source)
      if (!src) return
      const srcTable = src.data?.name
      const srcClass = toSingularPascalCase(srcTable)
      const fk = edge.data?.fkColumn || `${srcTable}_id`
      const pk = edge.data?.sourceColumn || 'id'

      if (isN2N) {
        const pivot = [tableName, srcTable].sort().join('_')
        usedRelTypes.add('BelongsToMany')
        rels.push({ type: 'belongsToMany', method: toPluralCamel(srcTable), model: srcClass, pivot })
      } else {
        // target side of 1:N or 1:1 — belongs to the source
        usedRelTypes.add('BelongsTo')
        rels.push({ type: 'belongsTo', method: toSingularCamel(srcTable), model: srcClass, fk, pk })
      }
    }
  })

  const uniqueRels = dedupeRels(rels)

  // ── Imports ────────────────────────────────────────────────────────────────
  const ns = 'Illuminate\\Database\\Eloquent\\Relations'
  const imports = ['Illuminate\\Database\\Eloquent\\Model']
  ;[...usedRelTypes].sort().forEach(r => imports.push(`${ns}\\${r}`))

  // ── fillable (all non-PK columns) ──────────────────────────────────────────
  const fillable = columns.filter(c => !c.pk).map(c => c.name)

  // ── casts ──────────────────────────────────────────────────────────────────
  const casts = columns
    .map(c => [c.name, laravelCast(c)])
    .filter(([, v]) => v !== null)

  // ── Assemble ───────────────────────────────────────────────────────────────
  const L = []
  L.push('<?php')
  L.push('')
  L.push('namespace App\\Models;')
  L.push('')
  imports.forEach(i => L.push(`use ${i};`))
  L.push('')
  L.push(`class ${className} extends Model`)
  L.push('{')
  L.push(`    protected $table = '${tableName}';`)
  L.push(`    protected $timestamps = true;`)
  L.push('')

  if (fillable.length > 0) {
    L.push('    protected $fillable = [')
    fillable.forEach(f => L.push(`        '${f}',`))
    L.push('    ];')
  } else {
    L.push('    protected $guarded = [];')
  }
  L.push('')

  if (casts.length > 0) {
    L.push('    protected $casts = [')
    casts.forEach(([col, c]) => L.push(`        '${col}' => '${c}',`))
    L.push('    ];')
    L.push('')
  }

  // Relationship methods
  uniqueRels.forEach(rel => {
    if (rel.type === 'comment') {
      L.push(`    ${rel.text}`)
      return
    }
    const returnType = rel.type === 'belongsTo'    ? 'BelongsTo'
                     : rel.type === 'hasOne'        ? 'HasOne'
                     : rel.type === 'hasMany'       ? 'HasMany'
                     : 'BelongsToMany'
    L.push(`    public function ${rel.method}(): ${returnType}`)
    L.push('    {')
    if (rel.type === 'belongsToMany') {
      L.push(`        return $this->belongsToMany(${rel.model}::class, '${rel.pivot}');`)
    } else {
      L.push(`        return $this->${rel.type}(${rel.model}::class, '${rel.fk}', '${rel.pk}');`)
    }
    L.push('    }')
    L.push('')
  })

  // Custom method stubs (from class diagram)
  const methods = node.data?.methods ?? []
  methods.forEach(m => {
    const vis = m.visibility === '-' ? 'private'
              : m.visibility === '#' ? 'protected'
              : 'public'
    L.push(`    ${vis} function ${m.name}(): void`)
    L.push('    {')
    L.push('        // TODO: implement')
    L.push('    }')
    L.push('')
  })

  L.push('}')
  return L.join('\n')
}

/**
 * Generate Laravel Eloquent model files.
 * @returns {Object} Map of filename → PHP source string, e.g. { 'User.php': '<?php ...' }
 */
export function generateLaravel(nodes, edges) {
  const tables = tableNodes(nodes)
  if (tables.length === 0) return {}
  const result = {}
  tables.forEach(node => {
    const className = toSingularPascalCase(node.data?.name || 'Unknown')
    result[`${className}.php`] = buildLaravelModel(node, tables, edges || [])
  })
  return result
}

// ═══════════════════════════════════════════════════════════════════════════════
// DJANGO
// ═══════════════════════════════════════════════════════════════════════════════

function djangoField(col) {
  const t      = (col.type || '').toUpperCase()
  const isPk   = col.pk ?? false
  const isAuto = col.autoIncrement ?? false
  const isNull = col.nullable ?? false
  const isUniq = col.unique && !isPk

  const extras = []
  if (isNull) extras.push('null=True', 'blank=True')
  if (isUniq) extras.push('unique=True')
  if (col.default !== null && col.default !== undefined && col.default !== '') {
    const d = String(col.default)
    const keywords = ['null', 'now()', 'current_timestamp', 'true', 'false']
    if (keywords.includes(d.toLowerCase())) {
      extras.push(`default=${d.toLowerCase() === 'null' ? 'None' : d}`)
    } else {
      extras.push(`default='${d}'`)
    }
  }

  // Auto-increment PK → Django auto-field
  if (isPk && isAuto) {
    if (t === 'BIGINT') return 'models.BigAutoField(primary_key=True)'
    if (t === 'SMALLINT') return 'models.SmallAutoField(primary_key=True)'
    return 'models.AutoField(primary_key=True)'
  }

  if (isPk) extras.unshift('primary_key=True')

  const wrap = (base, ...extra) => {
    const all = [...extra, ...extras]
    return all.length ? `${base}(${all.join(', ')})` : `${base}()`
  }

  switch (t) {
    case 'INT': case 'INTEGER':  return wrap('models.IntegerField')
    case 'BIGINT':               return wrap('models.BigIntegerField')
    case 'SMALLINT': case 'TINYINT': return wrap('models.SmallIntegerField')
    case 'DECIMAL':              return wrap('models.DecimalField', 'max_digits=10', 'decimal_places=2')
    case 'FLOAT': case 'DOUBLE': return wrap('models.FloatField')
    case 'VARCHAR':              return wrap('models.CharField', 'max_length=255')
    case 'CHAR':                 return wrap('models.CharField', 'max_length=1')
    case 'TEXT': case 'LONGTEXT': return wrap('models.TextField')
    case 'BOOLEAN':              return wrap('models.BooleanField')
    case 'DATE':                 return wrap('models.DateField')
    case 'TIME':                 return wrap('models.TimeField')
    case 'DATETIME': case 'TIMESTAMP': return wrap('models.DateTimeField')
    case 'BLOB': case 'MEDIUMBLOB': case 'LONGBLOB': return wrap('models.BinaryField')
    case 'JSON':                 return wrap('models.JSONField')
    case 'UUID':                 return wrap('models.UUIDField')
    case 'ENUM':                 return wrap('models.CharField', 'max_length=50')
    default:                     return wrap('models.CharField', 'max_length=255')
  }
}

/**
 * Generate a single Django models.py file.
 * @returns {string}
 */
export function generateDjango(nodes, edges) {
  const tables = tableNodes(nodes)
  if (tables.length === 0) return '# No tables found in schema.\n'

  const L = []
  L.push('from django.db import models')
  L.push('')
  L.push('')

  tables.forEach(node => {
    const tableName = node.data?.name || 'unknown'
    const columns   = node.data?.columns || []
    const className = toSingularPascalCase(tableName)

    L.push(`class ${className}(models.Model):`)

    if (columns.length === 0) {
      L.push(`    # No columns defined for table "${tableName}"`)
      L.push('    pass')
    } else {
      columns.forEach(col => {
        // FK columns: use ForeignKey and drop the _id suffix from field name
        if (col.fk && col.fkRef?.table && col.fkRef?.column) {
          const refClass = toSingularPascalCase(col.fkRef.table)
          const refNode  = tables.find(n => n.data?.name === col.fkRef.table)
          if (!refNode) {
            L.push(`    # FK to "${col.fkRef.table}" not found on canvas — using IntegerField`)
            L.push(`    ${col.name} = models.IntegerField(${col.nullable ? 'null=True, blank=True' : ''})`)
            return
          }
          const onDelete = (col.fkRef?.onDelete || 'CASCADE').toUpperCase()
          const djDelete = { 'CASCADE': 'models.CASCADE', 'SET NULL': 'models.SET_NULL',
            'RESTRICT': 'models.PROTECT', 'NO ACTION': 'models.PROTECT' }[onDelete] || 'models.CASCADE'
          const fieldName = col.name.endsWith('_id') ? col.name.slice(0, -3) : col.name
          const extras = [`on_delete=${djDelete}`]
          if (col.nullable) extras.push('null=True', 'blank=True')
          if (col.unique) extras.push('unique=True')
          extras.push(`db_column='${col.name}'`)
          L.push(`    ${fieldName} = models.ForeignKey('${refClass}', ${extras.join(', ')})`)
        } else {
          L.push(`    ${col.name} = ${djangoField(col)}`)
        }
      })

      // __str__
      const strCol = columns.find(c => !c.pk && ['VARCHAR','CHAR','TEXT'].includes((c.type||'').toUpperCase()))
      const pkCol  = columns.find(c => c.pk)
      let strField = strCol?.name || pkCol?.name || 'pk'
      // Adjust for FK field rename
      if (strField.endsWith('_id')) {
        const colDef = columns.find(c => c.name === strField)
        if (colDef?.fk) strField = strField.slice(0, -3)
      }

      L.push('')
      L.push('    def __str__(self):')
      L.push(`        return str(self.${strField})`)

      // Custom method stubs (from class diagram)
      const methods = node.data?.methods ?? []
      methods.forEach(m => {
        const prefix = m.visibility === '-' ? '__'
                     : m.visibility === '#' ? '_'
                     : ''
        L.push('')
        L.push(`    def ${prefix}${m.name}(self):`)
        L.push('        pass  # TODO: implement')
      })
    }

    L.push('')
    L.push('    class Meta:')
    L.push(`        db_table = '${tableName}'`)
    L.push('')
    L.push('')
  })

  return L.join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRISMA
// ═══════════════════════════════════════════════════════════════════════════════

function prismaType(col) {
  const t     = (col.type || '').toUpperCase()
  const isOpt = col.nullable ?? false

  const base = (() => {
    switch (t) {
      case 'INT': case 'INTEGER': case 'SMALLINT': case 'TINYINT': return 'Int'
      case 'BIGINT':     return 'BigInt'
      case 'DECIMAL':    return 'Decimal'
      case 'FLOAT': case 'DOUBLE': return 'Float'
      case 'VARCHAR': case 'CHAR': case 'TEXT': case 'LONGTEXT': case 'ENUM': return 'String'
      case 'BOOLEAN':    return 'Boolean'
      case 'DATE': case 'DATETIME': case 'TIMESTAMP': return 'DateTime'
      case 'TIME':       return 'String'   // no native Time in Prisma
      case 'BLOB': case 'MEDIUMBLOB': case 'LONGBLOB': return 'Bytes'
      case 'JSON':       return 'Json'
      case 'UUID':       return 'String'
      default:           return 'String'
    }
  })()

  const decorators = []
  if (col.pk)            decorators.push('@id')
  if (col.autoIncrement) decorators.push('@default(autoincrement())')
  else if (t === 'UUID') decorators.push('@default(uuid())')
  else if (base === 'DateTime' && (col.name === 'created_at' || col.name === 'updated_at')) {
    decorators.push('@default(now())')
  }
  if (col.unique && !col.pk) decorators.push('@unique')

  const optStr = isOpt ? '?' : ''
  return decorators.length
    ? `${base}${optStr}  ${decorators.join('  ')}`
    : `${base}${optStr}`
}

/**
 * Generate a single schema.prisma file.
 * @returns {string}
 */
export function generatePrisma(nodes, edges) {
  const tables = tableNodes(nodes)
  if (tables.length === 0) return '// No tables found in schema.\n'

  // Build a map: modelName → [{ fieldName, type }] for reverse relations
  // Populated by FK columns and N:N edges
  const reverseRels = {}   // { 'User': [{ field: 'posts', type: 'Post[]' }] }

  const addReverse = (onModel, field, type) => {
    if (!reverseRels[onModel]) reverseRels[onModel] = []
    if (!reverseRels[onModel].some(r => r.field === field)) {
      reverseRels[onModel].push({ field, type })
    }
  }

  // Pass 1: collect reverse relation stubs from FK columns
  tables.forEach(node => {
    const tableName  = node.data?.name || 'unknown'
    const className  = toSingularPascalCase(tableName)
    const columns    = node.data?.columns || []
    columns.forEach(col => {
      if (!col.fk || !col.fkRef?.table || !col.fkRef?.column) return
      const refClass = toSingularPascalCase(col.fkRef.table)
      // The referenced model gets a reverse field, e.g., User gets 'posts Post[]'
      addReverse(refClass, toPluralCamel(tableName), `${className}[]`)
    })
  })

  // Pass 1b: collect from N:N edges (implicit m2m — both sides get arrays)
  ;(edges || []).forEach(edge => {
    const relType = (edge.data?.type || edge.data?.relationshipType || '').toUpperCase()
    if (relType !== 'N:N' && relType !== 'M:N') return
    const src = tables.find(n => n.id === edge.source)
    const tgt = tables.find(n => n.id === edge.target)
    if (!src || !tgt) return
    const srcClass = toSingularPascalCase(src.data?.name)
    const tgtClass = toSingularPascalCase(tgt.data?.name)
    addReverse(srcClass, toPluralCamel(tgt.data?.name), `${tgtClass}[]`)
    addReverse(tgtClass, toPluralCamel(src.data?.name), `${srcClass}[]`)
  })

  const L = []

  // Header blocks
  L.push('datasource db {')
  L.push('  provider = "mysql"')
  L.push('  url      = env("DATABASE_URL")')
  L.push('}')
  L.push('')
  L.push('generator client {')
  L.push('  provider = "prisma-client-js"')
  L.push('}')
  L.push('')

  // Pass 2: generate each model block
  tables.forEach(node => {
    const tableName = node.data?.name || 'unknown'
    const columns   = node.data?.columns || []
    const className = toSingularPascalCase(tableName)

    L.push(`model ${className} {`)

    if (columns.length === 0) {
      L.push(`  // Table "${tableName}" has no columns`)
      L.push('}')
      L.push('')
      return
    }

    // Track FK relation-field names to avoid duplicating reverse stubs
    const emittedRelFields = new Set()

    columns.forEach(col => {
      const prismaName = snakeToCamel(col.name)

      if (col.fk && col.fkRef?.table && col.fkRef?.column) {
        // Scalar FK field
        const scalarTypeParts = prismaType({ ...col, fk: false, pk: false, unique: false }).split(/\s+/)
        const scalarBase = scalarTypeParts[0]
        const optStr     = col.nullable ? '?' : ''

        L.push(`  ${prismaName.padEnd(20)} ${scalarBase}${optStr}`)

        // Relation field
        const refNode  = tables.find(n => n.data?.name === col.fkRef.table)
        const refClass = toSingularPascalCase(col.fkRef.table)
        const relField = toSingularCamel(col.fkRef.table)
        const refColPrisma = snakeToCamel(col.fkRef.column)

        if (!refNode) {
          L.push(`  // Relation to "${col.fkRef.table}" not found on canvas`)
        } else {
          L.push(`  ${relField.padEnd(20)} ${refClass}${optStr}  @relation(fields: [${prismaName}], references: [${refColPrisma}])`)
          emittedRelFields.add(relField)
        }
      } else {
        L.push(`  ${prismaName.padEnd(20)} ${prismaType(col)}`)
      }
    })

    // Reverse relation stubs
    const revs = (reverseRels[className] || []).filter(r => !emittedRelFields.has(r.field))
    if (revs.length > 0) {
      L.push('')
      revs.forEach(r => {
        L.push(`  ${r.field.padEnd(20)} ${r.type}`)
      })
    }

    // Custom method stubs (comment block — Prisma has no method syntax)
    const methods = node.data?.methods ?? []
    if (methods.length > 0) {
      L.push('')
      L.push('  // Methods (from class diagram):')
      methods.forEach(m => {
        L.push(`  //   ${m.visibility} ${m.name}()`)
      })
    }

    L.push('')
    L.push(`  @@map("${tableName}")`)
    L.push('}')
    L.push('')
  })

  return L.join('\n')
}
