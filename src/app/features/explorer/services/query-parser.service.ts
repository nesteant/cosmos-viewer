import { Injectable } from '@angular/core';
import {
  QueryExplanation,
  ClauseExplanation,
  OptimizationHint,
} from '@core/models';

@Injectable({ providedIn: 'root' })
export class QueryParserService {
  /**
   * Parse SQL and generate plain language explanation
   */
  parseQuery(sql: string): QueryExplanation {
    const normalized = this.normalizeQuery(sql);
    const clauses: ClauseExplanation[] = [];

    // Parse SELECT clause
    const selectMatch = normalized.match(
      /SELECT\s+(TOP\s+(\d+)\s+)?(DISTINCT\s+)?(VALUE\s+)?(.+?)\s+FROM/i
    );
    if (selectMatch) {
      const top = selectMatch[2];
      const distinct = selectMatch[3];
      const value = selectMatch[4];
      const fields = selectMatch[5]?.trim();

      if (top) {
        clauses.push({
          type: 'TOP',
          description: `Limited to ${top} results`,
        });
      }

      let selectDesc = '';
      if (fields === '*') {
        selectDesc = 'All fields';
      } else if (value) {
        selectDesc = `Value: ${fields}`;
      } else {
        const fieldList = this.parseFieldList(fields);
        selectDesc = fieldList.length > 3
          ? `${fieldList.length} specific fields`
          : fieldList.join(', ');
      }

      if (distinct) {
        selectDesc = `Distinct ${selectDesc.toLowerCase()}`;
      }

      clauses.push({
        type: 'SELECT',
        description: selectDesc,
        fields: fields === '*' ? ['*'] : this.parseFieldList(fields),
      });
    }

    // Parse FROM clause
    const fromMatch = normalized.match(/FROM\s+(\w+)/i);
    if (fromMatch) {
      clauses.push({
        type: 'FROM',
        description: `Container alias: ${fromMatch[1]}`,
      });
    }

    // Parse JOIN clause
    const joinMatch = normalized.match(/JOIN\s+(\w+)\s+IN\s+(.+?)(?=WHERE|ORDER|GROUP|$)/i);
    if (joinMatch) {
      clauses.push({
        type: 'JOIN',
        description: `Join on ${joinMatch[2].trim()}`,
      });
    }

    // Parse WHERE clause
    const whereMatch = normalized.match(
      /WHERE\s+(.+?)(?=ORDER\s+BY|GROUP\s+BY|OFFSET|LIMIT|$)/i
    );
    if (whereMatch) {
      const conditions = this.parseWhereConditions(whereMatch[1]);
      clauses.push({
        type: 'WHERE',
        description: conditions,
      });
    }

    // Parse ORDER BY
    const orderMatch = normalized.match(/ORDER\s+BY\s+(.+?)(?=OFFSET|LIMIT|$)/i);
    if (orderMatch) {
      clauses.push({
        type: 'ORDER_BY',
        description: this.parseOrderBy(orderMatch[1]),
      });
    }

    // Parse GROUP BY
    const groupMatch = normalized.match(/GROUP\s+BY\s+(.+?)(?=HAVING|ORDER|OFFSET|LIMIT|$)/i);
    if (groupMatch) {
      clauses.push({
        type: 'GROUP_BY',
        description: `Grouped by ${groupMatch[1].trim()}`,
      });
    }

    // Parse OFFSET/LIMIT
    const offsetMatch = normalized.match(/OFFSET\s+(\d+)/i);
    const limitMatch = normalized.match(/LIMIT\s+(\d+)/i);
    if (offsetMatch || limitMatch) {
      const parts = [];
      if (offsetMatch) parts.push(`skip ${offsetMatch[1]}`);
      if (limitMatch) parts.push(`take ${limitMatch[1]}`);
      clauses.push({
        type: 'OFFSET',
        description: `Pagination: ${parts.join(', ')}`,
      });
    }

    return {
      summary: this.generateSummary(clauses, normalized),
      clauses,
    };
  }

  /**
   * Analyze query for optimization hints
   */
  analyzeForHints(sql: string, partitionKeyPath?: string): OptimizationHint[] {
    const hints: OptimizationHint[] = [];
    const normalized = sql.toUpperCase();
    const original = sql;

    // Check for SELECT *
    if (/SELECT\s+\*/i.test(original)) {
      hints.push({
        severity: 'info',
        category: 'projection',
        title: 'Using SELECT *',
        description:
          'Retrieving all fields increases RU cost and network transfer.',
        suggestion:
          'Specify only the fields you need: SELECT c.id, c.name, c.category',
      });
    }

    // Check for functions in WHERE that prevent index usage
    const indexPreventingFunctions = [
      { fn: 'LOWER', msg: 'LOWER() prevents index usage' },
      { fn: 'UPPER', msg: 'UPPER() prevents index usage' },
      { fn: 'TRIM', msg: 'TRIM() prevents index usage' },
      { fn: 'LTRIM', msg: 'LTRIM() prevents index usage' },
      { fn: 'RTRIM', msg: 'RTRIM() prevents index usage' },
      { fn: 'SUBSTRING', msg: 'SUBSTRING() prevents index usage' },
      { fn: 'CONCAT', msg: 'CONCAT() on filtered fields prevents index usage' },
    ];

    for (const { fn, msg } of indexPreventingFunctions) {
      if (new RegExp(`WHERE[^)]*${fn}\\s*\\(`, 'i').test(original)) {
        hints.push({
          severity: 'warning',
          category: 'function',
          title: msg,
          description: `Using ${fn}() on a field in WHERE clause causes a full container scan.`,
          suggestion:
            'Store pre-computed/normalized values or use a computed property.',
        });
      }
    }

    // Check for missing TOP/LIMIT
    if (
      !/TOP\s+\d+/i.test(normalized) &&
      !/LIMIT\s+\d+/i.test(normalized) &&
      !/OFFSET\s+\d+/i.test(normalized)
    ) {
      hints.push({
        severity: 'info',
        category: 'pagination',
        title: 'No result limit specified',
        description:
          'Query may return a large result set without pagination.',
        suggestion: 'Add TOP N or OFFSET/LIMIT for pagination to control RU cost.',
      });
    }

    // Check for NOT operator
    if (/WHERE[^(]*\bNOT\b/i.test(original)) {
      hints.push({
        severity: 'warning',
        category: 'filter',
        title: 'NOT operator in WHERE clause',
        description:
          'NOT conditions often require full scans as indexes cannot be used efficiently.',
        suggestion:
          'Consider restructuring the query to use positive conditions.',
      });
    }

    // Check for != or <> operators
    if (/WHERE[^(]*(?:!=|<>)/i.test(original)) {
      hints.push({
        severity: 'info',
        category: 'filter',
        title: 'Inequality operator in WHERE clause',
        description:
          'Inequality conditions (!=, <>) may not utilize indexes efficiently.',
        suggestion:
          'If possible, use equality conditions or restructure the data model.',
      });
    }

    // Check for LIKE with leading wildcard
    if (/LIKE\s+['"][%_]/i.test(original)) {
      hints.push({
        severity: 'warning',
        category: 'filter',
        title: 'LIKE with leading wildcard',
        description:
          'LIKE patterns starting with % or _ cannot use indexes and cause full scans.',
        suggestion:
          'Use STARTSWITH() for prefix matching or implement full-text search.',
      });
    }

    // Check for OR conditions
    const orCount = (original.match(/\bOR\b/gi) || []).length;
    if (orCount > 2) {
      hints.push({
        severity: 'info',
        category: 'filter',
        title: 'Multiple OR conditions',
        description:
          `Query has ${orCount} OR conditions which may result in multiple index scans.`,
        suggestion:
          'Consider using IN operator or restructuring into separate queries.',
      });
    }

    // Check for missing partition key filter
    if (partitionKeyPath) {
      const pkField = partitionKeyPath.replace(/^\//, '');
      const hasPartitionKeyFilter = new RegExp(
        `WHERE[^)]*\\b${pkField}\\s*=`,
        'i'
      ).test(original);

      if (!hasPartitionKeyFilter && /WHERE/i.test(original)) {
        hints.push({
          severity: 'warning',
          category: 'partition',
          title: 'Cross-partition query detected',
          description:
            `Query does not filter on partition key (${pkField}). This executes across all partitions.`,
          suggestion:
            `Add a filter on ${pkField} to target a single partition and reduce RU cost.`,
          affectedFields: [pkField],
        });
      }
    }

    // Check for ORDER BY without index hint
    if (/ORDER\s+BY/i.test(original) && !/WHERE/i.test(original)) {
      hints.push({
        severity: 'info',
        category: 'index',
        title: 'ORDER BY without filter',
        description:
          'Sorting without a WHERE clause requires scanning all documents.',
        suggestion:
          'Add a WHERE clause to reduce the dataset before sorting.',
      });
    }

    // Check for aggregate functions without GROUP BY
    const aggregates = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];
    const hasAggregate = aggregates.some((agg) =>
      new RegExp(`\\b${agg}\\s*\\(`, 'i').test(original)
    );
    if (hasAggregate && !/GROUP\s+BY/i.test(original)) {
      hints.push({
        severity: 'info',
        category: 'projection',
        title: 'Aggregate without GROUP BY',
        description:
          'Aggregate function operates on the entire result set.',
        suggestion:
          'This is fine for totals, but add GROUP BY if you need grouped aggregations.',
      });
    }

    return hints;
  }

  private normalizeQuery(sql: string): string {
    // Remove comments
    return sql
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseFieldList(fields: string): string[] {
    // Simple field list parsing, handles c.field, c.obj.nested
    const parts: string[] = [];
    let depth = 0;
    let current = '';

    for (const char of fields) {
      if (char === '(' || char === '[') depth++;
      else if (char === ')' || char === ']') depth--;
      else if (char === ',' && depth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    if (current.trim()) parts.push(current.trim());

    return parts.map((p) => p.replace(/^c\./, ''));
  }

  private parseWhereConditions(whereClause: string): string {
    // Simplify WHERE clause for display
    const conditions: string[] = [];
    const parts = whereClause.split(/\b(AND|OR)\b/i);

    for (let i = 0; i < parts.length; i += 2) {
      const condition = parts[i]?.trim();
      if (condition) {
        conditions.push(this.simplifyCondition(condition));
      }
    }

    if (conditions.length === 0) return whereClause.trim();
    if (conditions.length === 1) return conditions[0];
    return `${conditions.length} conditions`;
  }

  private simplifyCondition(condition: string): string {
    // Extract field and operation
    const match = condition.match(/c\.(\w+(?:\.\w+)*)\s*(=|!=|<>|>|<|>=|<=|LIKE)\s*(.+)/i);
    if (match) {
      const field = match[1];
      const op = match[2].toUpperCase();
      const value = match[3].trim();

      switch (op) {
        case '=':
          return `${field} equals ${value}`;
        case '!=':
        case '<>':
          return `${field} not equals ${value}`;
        case '>':
          return `${field} greater than ${value}`;
        case '<':
          return `${field} less than ${value}`;
        case '>=':
          return `${field} >= ${value}`;
        case '<=':
          return `${field} <= ${value}`;
        case 'LIKE':
          return `${field} matches pattern`;
        default:
          return condition;
      }
    }

    // Check for function-based conditions
    if (/ARRAY_CONTAINS/i.test(condition)) return 'Array contains check';
    if (/STARTSWITH/i.test(condition)) return 'Starts with check';
    if (/ENDSWITH/i.test(condition)) return 'Ends with check';
    if (/CONTAINS/i.test(condition)) return 'Contains check';
    if (/IS_DEFINED/i.test(condition)) return 'Field existence check';
    if (/IS_NULL/i.test(condition)) return 'Null check';

    return condition.length > 30 ? condition.substring(0, 30) + '...' : condition;
  }

  private parseOrderBy(orderClause: string): string {
    const parts = orderClause.split(',').map((p) => {
      const match = p.trim().match(/(.+?)\s*(ASC|DESC)?$/i);
      if (match) {
        const field = match[1].replace(/^c\./, '').trim();
        const dir = (match[2] || 'ASC').toUpperCase();
        return `${field} ${dir === 'DESC' ? 'descending' : 'ascending'}`;
      }
      return p.trim();
    });

    return parts.join(', ');
  }

  private generateSummary(
    clauses: ClauseExplanation[],
    query: string
  ): string {
    const parts: string[] = [];

    const selectClause = clauses.find((c) => c.type === 'SELECT');
    const topClause = clauses.find((c) => c.type === 'TOP');
    const whereClause = clauses.find((c) => c.type === 'WHERE');
    const orderClause = clauses.find((c) => c.type === 'ORDER_BY');
    const groupClause = clauses.find((c) => c.type === 'GROUP_BY');
    const offsetClause = clauses.find((c) => c.type === 'OFFSET');

    // Build summary
    parts.push('Retrieves');

    if (topClause) {
      parts.push(topClause.description.toLowerCase());
    }

    if (selectClause) {
      if (selectClause.fields?.includes('*')) {
        parts.push('all fields');
      } else {
        parts.push(selectClause.description.toLowerCase());
      }
    }

    parts.push('from documents');

    if (whereClause) {
      parts.push(`where ${whereClause.description.toLowerCase()}`);
    }

    if (groupClause) {
      parts.push(groupClause.description.toLowerCase());
    }

    if (orderClause) {
      parts.push(`ordered by ${orderClause.description.toLowerCase()}`);
    }

    if (offsetClause) {
      parts.push(`(${offsetClause.description.toLowerCase()})`);
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim() + '.';
  }
}
