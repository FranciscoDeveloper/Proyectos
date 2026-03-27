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
  | 'tags'
  | 'object-list';

/** Determines which view component renders this entity's overview */
export type ModuleType = 'crud' | 'calendar' | 'clinical-record';

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
  isTitle?: boolean;
  isSubtitle?: boolean;
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
  badgeColors?: Record<string, string>;
  isCalendarStart?: boolean;
  isCalendarEnd?: boolean;
  section?: string;
  isVitalSign?: boolean;
  isAlert?: boolean;
  /**
   * When true, this field does not change between patient encounters.
   * In encounter mode the generic-form renders it read-only.
   */
  isStable?: boolean;
  /**
   * When true, the clinical-detail shows a "Imprimir Receta" button
   * next to this field's section, generating a printable prescription.
   */
  isPrescription?: boolean;
}

export interface EntityMeta {
  key: string;
  singular: string;
  plural: string;
  icon: string;
  description?: string;
  moduleType?: ModuleType;
  /**
   * Key of the clinical-record entity that this entity can link to for adding encounters.
   * When set, the generic-detail shows an "Agregar Antecedente" button.
   * e.g. appointments → 'clinical-records'
   */
  encounterEntity?: string;
  /**
   * Field in THIS entity that holds the patient name used to find the target record.
   * e.g. in appointments: 'patientName'
   */
  encounterMatchField?: string;
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
