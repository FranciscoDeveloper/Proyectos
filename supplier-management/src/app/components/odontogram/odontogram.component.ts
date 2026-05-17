import {
  Component, Input, Output, EventEmitter,
  signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ─── Domain types ────────────────────────────────────────────────────────────

export type Surface = 'V' | 'L' | 'M' | 'D' | 'O' | 'I';
export type Convention = 'lesion' | 'preexistencia' | 'healthy' | 'other';

export interface ToothCondition {
  id: string;
  type: string;
  convention: Convention;
  surfaces: Surface[];
  notes?: string;
  isAnnulled?: boolean;
}

export interface OdontogramTooth {
  conditions: ToothCondition[];
}

export interface OdontogramData {
  version: number;
  createdAt: string;
  teeth: Record<string, OdontogramTooth>;
  notes?: string;
}

// ─── Condition catalog ────────────────────────────────────────────────────────

export interface ConditionDef {
  type: string;
  label: string;
  group: string;
  isSurface: boolean;      // true = applies to specific surfaces; false = whole tooth
  symbol?: string;         // overlay text for whole-tooth conditions
}

export const CONDITION_CATALOG: ConditionDef[] = [
  // Caries / decay
  { type: 'CARIES',              label: 'Caries',               group: 'Caries',         isSurface: true  },
  { type: 'CARIES_SECONDARY',    label: 'Caries Secundaria',    group: 'Caries',         isSurface: true  },

  // Restorations
  { type: 'REST_AMALGAMA',       label: 'Obturación Amalgama',  group: 'Obturaciones',   isSurface: true  },
  { type: 'REST_RESINA',         label: 'Obturación Resina',    group: 'Obturaciones',   isSurface: true  },
  { type: 'REST_IONOMERO',       label: 'Obturación Ionómero',  group: 'Obturaciones',   isSurface: true  },
  { type: 'REST_TEMPORAL',       label: 'Obturación Temporal',  group: 'Obturaciones',   isSurface: true  },
  { type: 'SELLANTE',            label: 'Sellante de Fisuras',  group: 'Obturaciones',   isSurface: true  },

  // Crowns
  { type: 'CORONA_CMC',          label: 'Corona Metal-Cerámica (CMC)', group: 'Coronas', isSurface: false, symbol: 'CMC' },
  { type: 'CORONA_CZ',           label: 'Corona Circonio (CZ)',        group: 'Coronas', isSurface: false, symbol: 'CZ'  },
  { type: 'CORONA_CJ',           label: 'Corona Jacket (CJ)',          group: 'Coronas', isSurface: false, symbol: 'CJ'  },
  { type: 'CORONA_CP',           label: 'Corona Provisional (CP)',     group: 'Coronas', isSurface: false, symbol: 'CP'  },
  { type: 'CORONA_CV',           label: 'Corona Veneer (CV)',          group: 'Coronas', isSurface: false, symbol: 'CV'  },
  { type: 'CORONA_PARCIAL',      label: 'Corona Parcial 3/4',         group: 'Coronas', isSurface: false, symbol: '3/4' },

  // Endodontic
  { type: 'ENDODONCIA',          label: 'Endodoncia',           group: 'Endodoncia',     isSurface: false, symbol: 'E'   },
  { type: 'LESION_PERIAPICAL',   label: 'Lesión Periapical',    group: 'Endodoncia',     isSurface: false, symbol: '○'   },
  { type: 'PERNO_MUNON',         label: 'Perno Muñón',          group: 'Endodoncia',     isSurface: false, symbol: 'PM'  },
  { type: 'RESTO_RADICULAR',     label: 'Resto Radicular',      group: 'Endodoncia',     isSurface: false, symbol: 'RR'  },

  // Fractures & wear
  { type: 'FRACTURA_CORONARIA',  label: 'Fractura Coronaria',   group: 'Traumatología',  isSurface: false, symbol: '/'   },
  { type: 'FRACTURA_RADICULAR',  label: 'Fractura Radicular',   group: 'Traumatología',  isSurface: false, symbol: '/r'  },
  { type: 'ATRICION',            label: 'Atrición',             group: 'Desgaste',       isSurface: true  },
  { type: 'ABRASION',            label: 'Abrasión',             group: 'Desgaste',       isSurface: true  },
  { type: 'EROSION',             label: 'Erosión',              group: 'Desgaste',       isSurface: true  },

  // Status
  { type: 'AUSENTE',             label: 'Ausente / Extraído',   group: 'Estado',         isSurface: false, symbol: 'X'   },
  { type: 'EXTRACCION',         label: 'Extracción Indicada',  group: 'Estado',         isSurface: false, symbol: 'X'   },
  { type: 'IMPLANTE',            label: 'Implante',             group: 'Estado',         isSurface: false, symbol: 'IMP' },
  { type: 'IMPLANTE_CORONA',     label: 'Implante + Corona',    group: 'Estado',         isSurface: false, symbol: 'IC'  },
  { type: 'IMPACTADO',           label: 'Diente Impactado',     group: 'Estado',         isSurface: false, symbol: '▩'   },
  { type: 'SEMIERUPCIONADO',     label: 'Semierupcionado',      group: 'Estado',         isSurface: false, symbol: '◫'   },
  { type: 'SUPERNUMERARIO',      label: 'Supernumerario',       group: 'Estado',         isSurface: false, symbol: 'S'   },
  { type: 'GIROVERSION',         label: 'Giroversión',          group: 'Estado',         isSurface: false, symbol: '↻'   },
  { type: 'DIASTEMA',            label: 'Diastema',             group: 'Estado',         isSurface: false, symbol: '⇔'   },
  { type: 'PUENTE',              label: 'Puente Fijo',          group: 'Prótesis',       isSurface: false, symbol: '⌐¬'  },
  { type: 'PROTESIS_PPR',        label: 'Prótesis Parcial Removible', group: 'Prótesis', isSurface: false, symbol: 'PPR' },
  { type: 'PROTESIS_TOTAL',      label: 'Prótesis Total',       group: 'Prótesis',       isSurface: false, symbol: 'PT'  },
  { type: 'DIENTE_SANO',         label: 'Diente Sano',          group: 'Estado',         isSurface: false, symbol: '✓'   },
];

// ─── Tooth layout data ────────────────────────────────────────────────────────

// Upper arch: viewer left = patient right (Q1: 18→11, Q2: 21→28)
export const UPPER_TEETH = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28'];
// Lower arch: same orientation (Q4: 48→41, Q3: 31→38)
export const LOWER_TEETH = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38'];

// Anterior teeth have INCISAL instead of OCCLUSAL
const ANTERIOR = new Set(['11','12','13','21','22','23','31','32','33','41','42','43',
  '51','52','53','61','62','63','71','72','73','81','82','83']);

// Quadrant 1 & 4: mesial is on the RIGHT side of the cell; Q2 & Q3: on the LEFT
const Q1_Q4 = new Set(['11','12','13','14','15','16','17','18','41','42','43','44','45','46','47','48']);

// ─── Color helpers ────────────────────────────────────────────────────────────

// convention → color
export const CONVENTION_COLOR: Record<Convention, string> = {
  lesion:       '#ef4444',   // red
  preexistencia:'#3b82f6',   // blue
  healthy:      '#10b981',   // green
  other:        '#8b5cf6',   // purple
};

// Absent/extracted is always black regardless of convention
const ABSENT_BLACK = new Set(['AUSENTE']);

function conditionColor(cond: ToothCondition): string {
  if (ABSENT_BLACK.has(cond.type)) return '#1f2937';
  return CONVENTION_COLOR[cond.convention] ?? '#6b7280';
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-odontogram',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './odontogram.component.html',
  styleUrl: './odontogram.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OdontogramComponent {

  @Input() set data(v: OdontogramData | null | undefined) {
    this._data.set(v ?? this.emptyData());
  }
  @Input() readonly = false;
  @Output() dataChange = new EventEmitter<OdontogramData>();

  readonly _data = signal<OdontogramData>(this.emptyData());

  // ── UI state ────────────────────────────────────────────────────────────────

  selectedTooth  = signal<string | null>(null);
  panelOpen      = signal(false);
  showLegend     = signal(false);

  // Add-condition form
  newConvention  = signal<Convention>('lesion');
  newType        = signal<string>('CARIES');
  newSurfaces    = signal<Set<Surface>>(new Set());
  newNotes       = signal('');

  // ── Derived ─────────────────────────────────────────────────────────────────

  readonly upperTeeth = UPPER_TEETH;
  readonly lowerTeeth = LOWER_TEETH;

  readonly conditionGroups = computed(() => {
    const groups = new Map<string, ConditionDef[]>();
    for (const c of CONDITION_CATALOG) {
      if (!groups.has(c.group)) groups.set(c.group, []);
      groups.get(c.group)!.push(c);
    }
    return Array.from(groups.entries()).map(([g, items]) => ({ group: g, items }));
  });

  readonly selectedToothData = computed<OdontogramTooth | null>(() => {
    const id = this.selectedTooth();
    if (!id) return null;
    return this._data().teeth[id] ?? { conditions: [] };
  });

  readonly selectedConditionDef = computed(() =>
    CONDITION_CATALOG.find(c => c.type === this.newType()) ?? null
  );

  // ── Public helpers for template ──────────────────────────────────────────────

  isAnterior(fdi: string): boolean { return ANTERIOR.has(fdi); }

  /** Surface label: 'O' or 'I' depending on tooth type */
  centerLabel(fdi: string): Surface { return this.isAnterior(fdi) ? 'I' : 'O'; }

  /** Mesial is on the left for Q1/Q4, right for Q2/Q3 */
  mesialOnRight(fdi: string): boolean { return Q1_Q4.has(fdi); }

  toothConditions(fdi: string): ToothCondition[] {
    return (this._data().teeth[fdi]?.conditions ?? []).filter(c => !c.isAnnulled);
  }

  /** Color to fill a given surface zone of a tooth */
  surfaceColor(fdi: string, surface: Surface): string {
    const conds = this.toothConditions(fdi);
    // Whole-tooth conditions take priority
    const whole = conds.find(c => {
      const def = CONDITION_CATALOG.find(d => d.type === c.type);
      return def && !def.isSurface;
    });
    if (whole) return conditionColor(whole);
    // Surface-specific
    const match = conds.find(c => c.surfaces.includes(surface));
    if (match) return conditionColor(match);
    return 'transparent';
  }

  /** Overlay symbol for whole-tooth conditions */
  toothSymbol(fdi: string): { symbol: string; color: string } | null {
    const conds = this.toothConditions(fdi);
    for (const c of conds) {
      const def = CONDITION_CATALOG.find(d => d.type === c.type);
      if (def && !def.isSurface && def.symbol) {
        return { symbol: def.symbol, color: conditionColor(c) };
      }
    }
    return null;
  }

  hasAnyCondition(fdi: string): boolean {
    return this.toothConditions(fdi).length > 0;
  }

  isSurfaceType(): boolean {
    return this.selectedConditionDef()?.isSurface ?? true;
  }

  surfaceSelected(s: Surface): boolean {
    return this.newSurfaces().has(s);
  }

  toggleSurface(s: Surface): void {
    this.newSurfaces.update(set => {
      const next = new Set(set);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  groupEntries() {
    return this.conditionGroups();
  }

  conventionLabel(c: Convention): string {
    return { lesion: 'Lesión', preexistencia: 'Preexistencia', healthy: 'Diente Sano', other: 'Otro' }[c];
  }

  conventionColor(c: Convention): string {
    return CONVENTION_COLOR[c];
  }

  allSurfaces(fdi: string): Surface[] {
    return this.isAnterior(fdi) ? ['V','L','M','D','I'] : ['V','L','M','D','O'];
  }

  // ── Interaction ──────────────────────────────────────────────────────────────

  selectTooth(fdi: string): void {
    if (this.readonly) return;
    this.selectedTooth.set(fdi);
    this.panelOpen.set(false);
    this.resetForm();
  }

  openDiagnosis(): void {
    this.panelOpen.set(true);
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.resetForm();
  }

  addCondition(): void {
    const fdi = this.selectedTooth();
    if (!fdi) return;
    const type = this.newType();
    const def = CONDITION_CATALOG.find(d => d.type === type);
    if (!def) return;

    const surfaces: Surface[] = def.isSurface
      ? Array.from(this.newSurfaces())
      : [];

    const condition: ToothCondition = {
      id: crypto.randomUUID(),
      type,
      convention: this.newConvention(),
      surfaces,
      notes: this.newNotes().trim() || undefined,
    };

    const current = this._data();
    const toothData = current.teeth[fdi] ?? { conditions: [] };
    const updated: OdontogramData = {
      ...current,
      teeth: {
        ...current.teeth,
        [fdi]: { conditions: [...toothData.conditions, condition] }
      }
    };
    this._data.set(updated);
    this.dataChange.emit(updated);
    this.resetForm();
    this.panelOpen.set(false);
  }

  annulCondition(fdi: string, conditionId: string): void {
    const current = this._data();
    const tooth = current.teeth[fdi];
    if (!tooth) return;
    const updated: OdontogramData = {
      ...current,
      teeth: {
        ...current.teeth,
        [fdi]: {
          conditions: tooth.conditions.map(c =>
            c.id === conditionId ? { ...c, isAnnulled: true } : c
          )
        }
      }
    };
    this._data.set(updated);
    this.dataChange.emit(updated);
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private resetForm(): void {
    this.newConvention.set('lesion');
    this.newType.set('CARIES');
    this.newSurfaces.set(new Set());
    this.newNotes.set('');
  }

  private emptyData(): OdontogramData {
    return { version: 1, createdAt: new Date().toISOString(), teeth: {} };
  }

  getConditionLabel(type: string): string {
    return CONDITION_CATALOG.find(c => c.type === type)?.label ?? type;
  }

  isSelected(fdi: string): boolean {
    return this.selectedTooth() === fdi;
  }
}
