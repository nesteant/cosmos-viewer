import { Injectable, inject } from '@angular/core';
import { CosmosDocument, ContainerInfo } from '@core/models';
import { NotificationService } from '@core/services';

@Injectable({ providedIn: 'root' })
export class ImportExportService {
  private notificationService = inject(NotificationService);

  exportToJson(documents: CosmosDocument[], filename: string): void {
    const content = JSON.stringify(documents, null, 2);
    this.downloadFile(content, `${filename}.json`, 'application/json');
    this.notificationService.success(`Exported ${documents.length} documents to JSON`);
  }

  exportToCsv(documents: CosmosDocument[], filename: string): void {
    if (documents.length === 0) {
      this.notificationService.warn('No documents to export');
      return;
    }

    // Collect all unique keys from all documents
    const allKeys = new Set<string>();
    documents.forEach((doc) => {
      this.collectKeys(doc, '', allKeys);
    });

    const headers = Array.from(allKeys).sort();
    const rows: string[][] = [];

    // Add header row
    rows.push(headers);

    // Add data rows
    documents.forEach((doc) => {
      const row = headers.map((key) => {
        const value = this.getNestedValue(doc, key);
        return this.formatCsvValue(value);
      });
      rows.push(row);
    });

    const csvContent = rows.map((row) => row.join(',')).join('\n');
    this.downloadFile(csvContent, `${filename}.csv`, 'text/csv');
    this.notificationService.success(`Exported ${documents.length} documents to CSV`);
  }

  async importFromJson(file: File): Promise<CosmosDocument[]> {
    const content = await this.readFile(file);
    try {
      const data = JSON.parse(content);
      const documents = Array.isArray(data) ? data : [data];

      // Validate documents have id
      const valid = documents.filter((doc) => doc && typeof doc.id === 'string');
      if (valid.length < documents.length) {
        this.notificationService.warn(
          `${documents.length - valid.length} documents skipped (missing id)`
        );
      }

      return valid;
    } catch (e) {
      this.notificationService.error('Invalid JSON file');
      throw e;
    }
  }

  async importFromCsv(
    file: File,
    container: ContainerInfo
  ): Promise<CosmosDocument[]> {
    const content = await this.readFile(file);
    const lines = content.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      this.notificationService.error('CSV file must have headers and at least one row');
      return [];
    }

    const headers = this.parseCsvLine(lines[0]);
    const documents: CosmosDocument[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const doc: any = {};

      headers.forEach((header, index) => {
        const value = values[index] ?? '';
        this.setNestedValue(doc, header, this.parseCsvValue(value));
      });

      // Ensure id exists
      if (!doc.id) {
        doc.id = this.generateId();
      }

      documents.push(doc as CosmosDocument);
    }

    return documents;
  }

  private collectKeys(obj: any, prefix: string, keys: Set<string>): void {
    if (obj === null || obj === undefined) return;

    Object.keys(obj).forEach((key) => {
      // Skip system properties for CSV
      if (key.startsWith('_')) return;

      const fullKey = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        this.collectKeys(value, fullKey, keys);
      } else {
        keys.add(fullKey);
      }
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  private formatCsvValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);

    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma or newline
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }

    result.push(current.trim());
    return result;
  }

  private parseCsvValue(value: string): any {
    if (value === '') return null;
    if (value === 'true') return true;
    if (value === 'false') return false;

    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') return num;

    // Try parsing as JSON for objects/arrays
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    return value;
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
