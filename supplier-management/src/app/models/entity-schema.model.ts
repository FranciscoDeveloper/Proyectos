export type FieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'select'
  | 'textarea'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'url'
  | 'tel'
  | 'range'
  | 'tags';

/** Determines which view component renders this entity's overview */
export type ModuleType = 'crud' | 'calendar';

export type FieldFormat = 'currency' | 'date' | 'stars' | 'percent' | 'none';
export type FilterType = 'search' | 'select';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldDefinition {
  name: string;
  type: FieldType;
  label: string;
  required?: boolean;
  showInList?: boolean;
  showInDetail?: boolean;
  /** Field used as primary display name (e.g. "name") */
  isTitle?: boolean;
  /** Field used as secondary identifier (e.g. "code", "id") */
  isSubtitle?: boolean;
  /** Render value as colored pill badge */
  isBadge?: boolean;
  options?: SelectOption[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  pattern?: string;
  patternMessage?: string;
  minLength?: number;
  maxLength?: number;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: FilterType;
  format?: FieldFormat;
  /** Maps option value -> hex color for badges */
  badgeColors?: Record<string, string>;
  /** Calendar: marks this field as the event start date/time */
  isCalendarStart?: boolean;
  /** Calendar: marks this field as the event end date/time */
  isCalendarEnd?: boolean;
}

export interface EntityMeta {
  /** Unique key used in routes and service stores, e.g. "suppliers" */
  key: string;
  singular: string;
  plural: string;
  /** Icon identifier: 'users' | 'package' | 'heart' | 'grid' | 'list' | 'calendar' */
  icon: string;
  description?: string;
  /**
   * Controls which view component renders this entity's overview.
   * 'crud' (default) → generic list/table. 'calendar' → month calendar.
   * The backend sets this; the frontend has no hardcoded knowledge of entity types.
   */
  moduleType?: ModuleType;
}

export interface EntitySchema {
  entity: EntityMeta;
  fields: FieldDefinition[];
}

/** Full payload returned by the "backend" for a given entity */
export interface EntityPayload {
  schema: EntitySchema;
  data: Record<string, any>[];
}
