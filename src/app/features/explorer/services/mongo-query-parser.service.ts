import { Injectable } from '@angular/core';
import {
  QueryExplanation,
  ClauseExplanation,
  OptimizationHint,
} from '@core/models';

// Import JSON5 for relaxed JSON parsing
import JSON5 from 'json5';

/**
 * Service to parse MongoDB queries and generate explanations and hints
 */
@Injectable({ providedIn: 'root' })
export class MongoQueryParserService {
  /**
   * Parse MongoDB query and generate plain language explanation
   */
  parseQuery(queryString: string): QueryExplanation {
    const clauses: ClauseExplanation[] = [];

    try {
      const query = JSON5.parse(queryString);

      // Check if it's an aggregation pipeline (array)
      if (Array.isArray(query)) {
        return this.parseAggregationPipeline(query);
      }

      // Parse find query (object)
      return this.parseFindQuery(query);
    } catch (err) {
      // If parsing fails, return a generic explanation
      return {
        summary: 'Unable to parse query',
        clauses: [{
          type: 'ERROR',
          description: 'Could not parse the query. Ensure it is valid JSON.',
        }],
      };
    }
  }

  /**
   * Parse a find query object
   */
  private parseFindQuery(query: Record<string, any>): QueryExplanation {
    const clauses: ClauseExplanation[] = [];
    const conditions: string[] = [];

    // Empty query = find all
    if (Object.keys(query).length === 0) {
      return {
        summary: 'Retrieves all documents from the collection.',
        clauses: [{
          type: 'FILTER',
          description: 'No filter (returns all documents)',
        }],
      };
    }

    // Check for top-level logical operators
    const andOp = query['$and'];
    if (andOp) {
      clauses.push({
        type: '$and',
        description: this.parseLogicalOperator('AND', andOp),
      });
      conditions.push(this.parseLogicalOperator('AND', andOp));
    }

    const orOp = query['$or'];
    if (orOp) {
      clauses.push({
        type: '$or',
        description: this.parseLogicalOperator('OR', orOp),
      });
      conditions.push(this.parseLogicalOperator('OR', orOp));
    }

    const norOp = query['$nor'];
    if (norOp) {
      clauses.push({
        type: '$nor',
        description: this.parseLogicalOperator('NOR', norOp),
      });
      conditions.push(this.parseLogicalOperator('NOR', norOp));
    }

    // Parse field conditions
    for (const [field, value] of Object.entries(query)) {
      if (field.startsWith('$')) continue; // Skip operators already handled

      const fieldCondition = this.parseFieldCondition(field, value);
      clauses.push({
        type: 'FIELD',
        description: fieldCondition,
        fields: [field],
      });
      conditions.push(fieldCondition);
    }

    const summary = conditions.length > 0
      ? `Finds documents where ${conditions.join(' AND ')}.`
      : 'Finds documents matching the specified criteria.';

    return { summary, clauses };
  }

  /**
   * Parse an aggregation pipeline
   */
  private parseAggregationPipeline(pipeline: any[]): QueryExplanation {
    const clauses: ClauseExplanation[] = [];

    if (pipeline.length === 0) {
      return {
        summary: 'Empty aggregation pipeline.',
        clauses: [],
      };
    }

    for (const stage of pipeline) {
      const stageName = Object.keys(stage)[0];
      const stageValue = stage[stageName];

      switch (stageName) {
        case '$match':
          clauses.push({
            type: '$match',
            description: `Filter: ${this.describeFilter(stageValue)}`,
          });
          break;

        case '$group':
          clauses.push({
            type: '$group',
            description: this.describeGroup(stageValue),
          });
          break;

        case '$project':
          clauses.push({
            type: '$project',
            description: this.describeProject(stageValue),
          });
          break;

        case '$sort':
          clauses.push({
            type: '$sort',
            description: this.describeSort(stageValue),
          });
          break;

        case '$limit':
          clauses.push({
            type: '$limit',
            description: `Limit to ${stageValue} documents`,
          });
          break;

        case '$skip':
          clauses.push({
            type: '$skip',
            description: `Skip first ${stageValue} documents`,
          });
          break;

        case '$unwind':
          const unwindPath = typeof stageValue === 'string' ? stageValue : stageValue.path;
          clauses.push({
            type: '$unwind',
            description: `Deconstruct array: ${unwindPath}`,
          });
          break;

        case '$lookup':
          clauses.push({
            type: '$lookup',
            description: `Join with ${stageValue.from} on ${stageValue.localField} = ${stageValue.foreignField}`,
          });
          break;

        case '$count':
          clauses.push({
            type: '$count',
            description: `Count documents as "${stageValue}"`,
          });
          break;

        case '$addFields':
        case '$set':
          const addedFields = Object.keys(stageValue).join(', ');
          clauses.push({
            type: stageName,
            description: `Add/set fields: ${addedFields}`,
          });
          break;

        default:
          clauses.push({
            type: stageName,
            description: `${stageName} stage`,
          });
      }
    }

    const stageNames = clauses.map(c => c.type).join(' → ');
    const summary = `Aggregation pipeline with ${pipeline.length} stage(s): ${stageNames}`;

    return { summary, clauses };
  }

  /**
   * Parse a field condition
   */
  private parseFieldCondition(field: string, value: any): string {
    // Direct equality
    if (value === null) {
      return `${field} is null`;
    }

    if (typeof value !== 'object' || value instanceof Date) {
      return `${field} equals ${this.formatValue(value)}`;
    }

    // Operator-based condition
    const conditions: string[] = [];

    for (const [op, opValue] of Object.entries(value)) {
      switch (op) {
        case '$eq':
          conditions.push(`${field} equals ${this.formatValue(opValue)}`);
          break;
        case '$ne':
          conditions.push(`${field} is not ${this.formatValue(opValue)}`);
          break;
        case '$gt':
          conditions.push(`${field} > ${this.formatValue(opValue)}`);
          break;
        case '$gte':
          conditions.push(`${field} >= ${this.formatValue(opValue)}`);
          break;
        case '$lt':
          conditions.push(`${field} < ${this.formatValue(opValue)}`);
          break;
        case '$lte':
          conditions.push(`${field} <= ${this.formatValue(opValue)}`);
          break;
        case '$in':
          const inValues = (opValue as any[]).slice(0, 3).map(v => this.formatValue(v)).join(', ');
          const inMore = (opValue as any[]).length > 3 ? `, ... (${(opValue as any[]).length} total)` : '';
          conditions.push(`${field} in [${inValues}${inMore}]`);
          break;
        case '$nin':
          const ninValues = (opValue as any[]).slice(0, 3).map(v => this.formatValue(v)).join(', ');
          const ninMore = (opValue as any[]).length > 3 ? `, ... (${(opValue as any[]).length} total)` : '';
          conditions.push(`${field} not in [${ninValues}${ninMore}]`);
          break;
        case '$exists':
          conditions.push(`${field} ${opValue ? 'exists' : 'does not exist'}`);
          break;
        case '$type':
          conditions.push(`${field} is of type ${opValue}`);
          break;
        case '$regex':
          conditions.push(`${field} matches pattern ${this.formatValue(opValue)}`);
          break;
        case '$all':
          conditions.push(`${field} contains all of [${(opValue as any[]).map(v => this.formatValue(v)).join(', ')}]`);
          break;
        case '$size':
          conditions.push(`${field} has ${opValue} elements`);
          break;
        case '$elemMatch':
          conditions.push(`${field} has element matching criteria`);
          break;
        case '$not':
          conditions.push(`${field} does not match criteria`);
          break;
        default:
          conditions.push(`${field} ${op} ${this.formatValue(opValue)}`);
      }
    }

    return conditions.join(' AND ');
  }

  /**
   * Parse logical operator ($and, $or, $nor)
   */
  private parseLogicalOperator(op: string, conditions: any[]): string {
    const parts = conditions.map(cond => {
      const field = Object.keys(cond)[0];
      if (field.startsWith('$')) {
        return `(${this.parseLogicalOperator(field.substring(1).toUpperCase(), cond[field])})`;
      }
      return this.parseFieldCondition(field, cond[field]);
    });

    return parts.join(` ${op} `);
  }

  /**
   * Describe a filter object for $match
   */
  private describeFilter(filter: Record<string, any>): string {
    if (Object.keys(filter).length === 0) {
      return 'all documents';
    }

    const conditions: string[] = [];
    for (const [field, value] of Object.entries(filter)) {
      if (field.startsWith('$')) {
        if (field === '$and' || field === '$or' || field === '$nor') {
          conditions.push(this.parseLogicalOperator(field.substring(1).toUpperCase(), value));
        }
      } else {
        conditions.push(this.parseFieldCondition(field, value));
      }
    }

    return conditions.join(' AND ');
  }

  /**
   * Describe a $group stage
   */
  private describeGroup(group: Record<string, any>): string {
    const id = group['_id'];
    let groupBy = '';

    if (id === null) {
      groupBy = 'all documents (single group)';
    } else if (typeof id === 'string' && id.startsWith('$')) {
      groupBy = id.substring(1);
    } else if (typeof id === 'object') {
      groupBy = Object.keys(id).join(', ');
    } else {
      groupBy = String(id);
    }

    const accumulators = Object.keys(group).filter(k => k !== '_id');
    const accDesc = accumulators.length > 0 ? ` with ${accumulators.join(', ')}` : '';

    return `Group by ${groupBy}${accDesc}`;
  }

  /**
   * Describe a $project stage
   */
  private describeProject(project: Record<string, any>): string {
    const included: string[] = [];
    const excluded: string[] = [];

    for (const [field, value] of Object.entries(project)) {
      if (value === 1 || value === true) {
        included.push(field);
      } else if (value === 0 || value === false) {
        excluded.push(field);
      } else {
        included.push(field); // Computed field
      }
    }

    if (included.length > 0 && excluded.length === 0) {
      return `Include: ${included.join(', ')}`;
    } else if (excluded.length > 0 && included.length === 0) {
      return `Exclude: ${excluded.join(', ')}`;
    } else {
      return `Reshape: ${included.length} fields`;
    }
  }

  /**
   * Describe a $sort stage
   */
  private describeSort(sort: Record<string, number>): string {
    const parts = Object.entries(sort).map(([field, dir]) =>
      `${field} ${dir === 1 ? 'ascending' : 'descending'}`
    );
    return `Sort by ${parts.join(', ')}`;
  }

  /**
   * Format a value for display
   */
  private formatValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value.length > 20 ? value.substring(0, 20) + '...' : value}"`;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === 'object') return '{...}';
    return String(value);
  }

  /**
   * Analyze MongoDB query for optimization hints
   */
  analyzeForHints(queryString: string): OptimizationHint[] {
    const hints: OptimizationHint[] = [];

    try {
      const query = JSON5.parse(queryString);

      if (Array.isArray(query)) {
        this.analyzeAggregationHints(query, hints);
      } else {
        this.analyzeFindHints(query, hints);
      }
    } catch {
      // Can't analyze if we can't parse
    }

    return hints;
  }

  /**
   * Analyze find query for optimization hints
   */
  private analyzeFindHints(query: Record<string, any>, hints: OptimizationHint[]): void {
    // Empty query = full collection scan
    if (Object.keys(query).length === 0) {
      hints.push({
        severity: 'info',
        category: 'filter',
        title: 'No filter specified',
        description: 'Query will scan the entire collection.',
        suggestion: 'Add filters to reduce the number of documents scanned.',
      });
    }

    // Check for $regex without anchor
    this.checkRegexUsage(query, hints);

    // Check for $ne and $nin operators
    this.checkNegationOperators(query, hints);

    // Check for $or with many conditions
    this.checkOrConditions(query, hints);

    // Check for $where operator
    if (query['$where']) {
      hints.push({
        severity: 'warning',
        category: 'filter',
        title: '$where operator detected',
        description: '$where executes JavaScript and cannot use indexes.',
        suggestion: 'Replace with standard query operators if possible.',
      });
    }

    // Check for $text search
    if (query['$text']) {
      hints.push({
        severity: 'info',
        category: 'index',
        title: 'Text search query',
        description: 'Query uses text search. Ensure a text index exists on the searched fields.',
      });
    }
  }

  /**
   * Analyze aggregation pipeline for optimization hints
   */
  private analyzeAggregationHints(pipeline: any[], hints: OptimizationHint[]): void {
    // Check if $match is first stage
    if (pipeline.length > 0 && !pipeline[0].$match) {
      hints.push({
        severity: 'warning',
        category: 'filter',
        title: '$match should be first stage',
        description: 'Placing $match at the beginning of the pipeline allows MongoDB to use indexes and filter early.',
        suggestion: 'Move $match to the beginning of the pipeline if possible.',
      });
    }

    // Check for $match followed by $sort (good for index usage)
    let hasEarlyMatchSort = false;
    for (let i = 0; i < pipeline.length - 1; i++) {
      if (pipeline[i].$match && pipeline[i + 1].$sort) {
        hasEarlyMatchSort = true;
        break;
      }
    }

    // Check for $sort without $limit
    const hasSort = pipeline.some(s => s.$sort);
    const hasLimit = pipeline.some(s => s.$limit);
    if (hasSort && !hasLimit) {
      hints.push({
        severity: 'info',
        category: 'pagination',
        title: '$sort without $limit',
        description: 'Sorting without a limit processes all matching documents.',
        suggestion: 'Add $limit after $sort to reduce memory usage.',
      });
    }

    // Check for multiple $unwind stages
    const unwindCount = pipeline.filter(s => s.$unwind).length;
    if (unwindCount > 1) {
      hints.push({
        severity: 'info',
        category: 'projection',
        title: 'Multiple $unwind stages',
        description: `Pipeline has ${unwindCount} $unwind stages which can multiply document count.`,
        suggestion: 'Consider combining operations or filtering before unwinding.',
      });
    }

    // Check for $lookup without index hint
    const lookups = pipeline.filter(s => s.$lookup);
    if (lookups.length > 0) {
      hints.push({
        severity: 'info',
        category: 'index',
        title: '$lookup detected',
        description: 'Join operations benefit from indexes on the foreign field.',
        suggestion: 'Ensure an index exists on the foreignField in the joined collection.',
      });
    }
  }

  /**
   * Check for regex usage patterns
   */
  private checkRegexUsage(query: Record<string, any>, hints: OptimizationHint[]): void {
    const checkValue = (value: any, field: string) => {
      if (value && typeof value === 'object') {
        if (value.$regex) {
          const pattern = String(value.$regex);
          if (!pattern.startsWith('^')) {
            hints.push({
              severity: 'warning',
              category: 'index',
              title: `$regex without anchor on ${field}`,
              description: 'Regex patterns not starting with ^ cannot use indexes efficiently.',
              suggestion: 'Use ^pattern to anchor at the start if possible, or consider text indexes.',
            });
          }
        }
        // Recursively check nested objects
        for (const [k, v] of Object.entries(value)) {
          if (!k.startsWith('$')) {
            checkValue(v, k);
          }
        }
      }
    };

    for (const [field, value] of Object.entries(query)) {
      checkValue(value, field);
    }
  }

  /**
   * Check for negation operators
   */
  private checkNegationOperators(query: Record<string, any>, hints: OptimizationHint[]): void {
    const checkValue = (value: any, field: string) => {
      if (value && typeof value === 'object') {
        if (value.$ne !== undefined || value.$nin !== undefined) {
          hints.push({
            severity: 'info',
            category: 'filter',
            title: `Negation operator on ${field}`,
            description: '$ne and $nin operators may not use indexes efficiently.',
            suggestion: 'Consider restructuring the query to use positive conditions.',
          });
        }
        if (value.$not !== undefined) {
          hints.push({
            severity: 'info',
            category: 'filter',
            title: `$not operator on ${field}`,
            description: '$not operator may result in collection scans.',
          });
        }
      }
    };

    for (const [field, value] of Object.entries(query)) {
      if (!field.startsWith('$')) {
        checkValue(value, field);
      }
    }
  }

  /**
   * Check for $or with many conditions
   */
  private checkOrConditions(query: Record<string, any>, hints: OptimizationHint[]): void {
    const orConditions = query['$or'];
    if (orConditions && Array.isArray(orConditions)) {
      if (orConditions.length > 5) {
        hints.push({
          severity: 'info',
          category: 'filter',
          title: 'Large $or condition',
          description: `$or has ${orConditions.length} conditions. Each may require a separate index scan.`,
          suggestion: 'Consider using $in operator or restructuring the data model.',
        });
      }
    }
  }
}
