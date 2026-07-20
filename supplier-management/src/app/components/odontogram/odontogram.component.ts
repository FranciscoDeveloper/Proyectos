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
const Q1_Q4 = new Set([
  '11','12','13','14','15','16','17','18',
  '41','42','43','44','45','46','47','48',
  '51','52','53','54','55', // deciduous Q5 — same orientation as Q1
  '81','82','83','84','85', // deciduous Q8 — same orientation as Q4
]);

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
  showDeciduous  = signal(false);

  // Add-condition form
  newConvention  = signal<Convention>('lesion');
  newType        = signal<string>('CARIES');
  newSurfaces    = signal<Set<Surface>>(new Set());
  newNotes       = signal('');

  // ── Quadrant arrays (permanent) ──────────────────────────────────────────────
  readonly q1Teeth = ['18','17','16','15','14','13','12','11'];
  readonly q2Teeth = ['21','22','23','24','25','26','27','28'];
  readonly q3Teeth = ['31','32','33','34','35','36','37','38'];
  readonly q4Teeth = ['48','47','46','45','44','43','42','41'];

  // Deciduous (primary) dentition
  readonly q5Teeth = ['55','54','53','52','51']; // upper right
  readonly q6Teeth = ['61','62','63','64','65']; // upper left
  readonly q7Teeth = ['71','72','73','74','75']; // lower left
  readonly q8Teeth = ['85','84','83','82','81']; // lower right

  readonly upperQ1 = computed(() => this.showDeciduous() ? this.q5Teeth : this.q1Teeth);
  readonly upperQ2 = computed(() => this.showDeciduous() ? this.q6Teeth : this.q2Teeth);
  readonly lowerQ3 = computed(() => this.showDeciduous() ? this.q7Teeth : this.q3Teeth);
  readonly lowerQ4 = computed(() => this.showDeciduous() ? this.q8Teeth : this.q4Teeth);

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

  // ── Additional clinical helpers ───────────────────────────────────────────────

  isAbsent(fdi: string): boolean {
    return this.toothConditions(fdi).some(c => c.type === 'AUSENTE');
  }

  activeConditions(fdi: string): ToothCondition[] {
    return this.toothConditions(fdi);
  }

  toothName(fdi: string): string {
    const n2 = parseInt(fdi, 10) % 10;
    if (n2 === 1) return 'Incisivo Central';
    if (n2 === 2) return 'Incisivo Lateral';
    if (n2 === 3) return 'Canino';
    if (n2 === 4) return 'Primer Premolar';
    if (n2 === 5) return 'Segundo Premolar';
    if (n2 === 6) return 'Primer Molar';
    if (n2 === 7) return 'Segundo Molar';
    if (n2 === 8) return 'Molar del Juicio';
    return 'Diente';
  }

  /** Short anatomical type label */
  toothTypeLabel(fdi: string): string {
    const d = parseInt(fdi, 10) % 10;
    if (d === 1 || d === 2) return 'Inc';
    if (d === 3) return 'Can';
    if (d === 4 || d === 5) return 'Pre';
    if (d === 6 || d === 7) return 'Mol';
    if (d === 8) return 'Cor';
    return '';
  }

  /** Live preview of a surface while composing a new condition */
  previewSurface(surface: Surface): string {
    const fdi = this.selectedTooth();
    if (!fdi) return 'transparent';
    const def = this.selectedConditionDef();
    if (def && !def.isSurface) {
      return this.conventionColor(this.newConvention());
    }
    if (def?.isSurface && this.newSurfaces().has(surface)) {
      return this.conventionColor(this.newConvention());
    }
    return this.surfaceColor(fdi, surface);
  }

  quadrantLabel(fdi: string): string {
    const q = Math.floor(parseInt(fdi, 10) / 10);
    return `Q${q}`;
  }

  // ── Anatomical tooth shape SVGs ───────────────────────────────────────────────

  /** Unique prefix per instance — prevents SVG clipPath ID collisions */
  readonly clipPrefix = 'oc' + Math.random().toString(36).slice(2, 7);

  clipId(fdi: string): string { return `${this.clipPrefix}-${fdi}`; }

  /** SVG crown path (viewBox 0 0 36 44) — differs by tooth type */
  getToothCrownPath(fdi: string): string {
    const d = parseInt(fdi, 10) % 10;
    switch (d) {
      // Incisivo central — rectangular chisel, flat occlusal edge
      case 1: return 'M3,0 H33 Q36,0 36,3 V41 Q36,44 33,44 H3 Q0,44 0,41 V3 Q0,0 3,0 Z';
      // Incisivo lateral — same but slightly narrower
      case 2: return 'M4,1 H32 Q35,1 35,4 V41 Q35,44 32,44 H4 Q1,44 1,41 V4 Q1,1 4,1 Z';
      // Canino — pointed single cusp
      case 3: return 'M1,14 L18,0 L35,14 V41 Q35,44 31,44 H5 Q1,44 1,41 Z';
      // Primer Premolar — two cusps
      case 4: return 'M1,14 Q7,0 14,6 Q18,9 22,6 Q29,0 35,14 V41 Q35,44 31,44 H5 Q1,44 1,41 Z';
      // Segundo Premolar — two rounded cusps
      case 5: return 'M2,13 Q8,1 14,7 Q18,10 22,7 Q28,1 34,13 V41 Q34,44 30,44 H6 Q2,44 2,41 Z';
      // Primer Molar — tres cúspides, el más ancho
      case 6: return 'M0,14 Q5,1 10,6 Q14,10 18,6 Q22,10 26,6 Q31,1 36,14 V41 Q36,44 32,44 H4 Q0,44 0,41 Z';
      // Segundo Molar — tres cúspides
      case 7: return 'M1,13 Q6,1 11,6 Q15,10 18,6 Q21,10 25,6 Q30,1 35,13 V41 Q35,44 31,44 H5 Q1,44 1,41 Z';
      // Molar del Juicio — compacto, 2-3 cúspides
      case 8: return 'M4,12 Q9,1 15,7 Q18,10 21,7 Q27,1 32,12 V41 Q32,44 28,44 H8 Q4,44 4,41 Z';
      default: return 'M3,0 H33 Q36,0 36,3 V41 Q36,44 33,44 H3 Q0,44 0,41 V3 Q0,0 3,0 Z';
    }
  }

  conditionCount(fdi: string): number { return this.toothConditions(fdi).length; }

  /** Resumen estadístico para la barra de estado */
  readonly stats = computed(() => {
    let caries = 0, restorations = 0, absent = 0, endodontics = 0, crowns = 0;
    for (const tooth of Object.values(this._data().teeth)) {
      const active = tooth.conditions.filter(c => !c.isAnnulled);
      if (active.some(c => c.type === 'CARIES' || c.type === 'CARIES_SECONDARY')) caries++;
      if (active.some(c => c.type.startsWith('REST_') || c.type === 'SELLANTE')) restorations++;
      if (active.some(c => c.type === 'AUSENTE')) absent++;
      if (active.some(c => c.type === 'ENDODONCIA')) endodontics++;
      if (active.some(c => c.type.startsWith('CORONA_'))) crowns++;
    }
    return { caries, restorations, absent, endodontics, crowns };
  });

  /** Preselecciona condición y abre el modal de diagnóstico */
  quickDiagnosis(type: string): void {
    this.newType.set(type);
    this.panelOpen.set(true);
  }
}
