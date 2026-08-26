export interface RuleNode {
  id: string
  assessment_year: number
  rule_version: number
  status: string
  category_key: string
  category_label?: string | null
  category_label_en?: string | null
  category_label_ms?: string | null
  limit_amount: number | null
  sub_cap_parent_id: string | null
  enforces_combined_cap: boolean
  source_reference?: string | null
  description?: string | null
  children: RuleNode[]
  depth: number
}

/**
 * Builds a hierarchical tree from a flat list of relief rules.
 * Handles roots (sub_cap_parent_id === null) and recursive child branches.
 */
export function buildRulesTree(rules: any[]): RuleNode[] {
  const nodeMap = new Map<string, RuleNode>()
  const rootNodes: RuleNode[] = []

  // Initialize nodes
  for (const r of rules) {
    const labelEn = r.category_label_en || r.category_label?.split('/')[1]?.trim() || r.category_label || r.category_key
    const labelMs = r.category_label_ms || r.category_label?.split('/')[0]?.trim() || ''

    const node: RuleNode = {
      id: r.id,
      assessment_year: r.assessment_year,
      rule_version: r.rule_version || 1,
      status: r.status,
      category_key: r.category_key,
      category_label: r.category_label,
      category_label_en: labelEn,
      category_label_ms: labelMs,
      limit_amount: r.limit_amount != null ? Number(r.limit_amount) : null,
      sub_cap_parent_id: r.sub_cap_parent_id,
      enforces_combined_cap: Boolean(r.enforces_combined_cap),
      source_reference: r.source_reference,
      description: r.description,
      children: [],
      depth: 0,
    }
    nodeMap.set(r.id, node)
  }

  // Link children to parents
  for (const node of nodeMap.values()) {
    if (node.sub_cap_parent_id && nodeMap.has(node.sub_cap_parent_id)) {
      const parent = nodeMap.get(node.sub_cap_parent_id)!
      parent.children.push(node)
    } else {
      rootNodes.push(node)
    }
  }

  // Set depth recursively
  function setDepth(nodes: RuleNode[], currentDepth: number) {
    for (const n of nodes) {
      n.depth = currentDepth
      if (n.children.length > 0) {
        setDepth(n.children, currentDepth + 1)
      }
    }
  }

  setDepth(rootNodes, 0)
  return rootNodes
}

/**
 * Flattens a tree into depth-first ordered list with indent indicators.
 */
export function flattenRulesTree(tree: RuleNode[]): RuleNode[] {
  const result: RuleNode[] = []

  function traverse(nodes: RuleNode[]) {
    for (const node of nodes) {
      result.push(node)
      if (node.children.length > 0) {
        traverse(node.children)
      }
    }
  }

  traverse(tree)
  return result
}
