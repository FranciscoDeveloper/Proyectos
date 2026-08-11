import {
  Component, Input, Output, EventEmitter,
  signal, computed, ChangeDetectionStrategy, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

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
  @Input() patientName: string | null = null;
  @Output() dataChange = new EventEmitter<OdontogramData>();

  readonly _data = signal<OdontogramData>(this.emptyData());

  private http = inject(HttpClient);

  // ── UI state ────────────────────────────────────────────────────────────────

  selectedTooth      = signal<string | null>(null);
  panelOpen          = signal(false);
  showLegend         = signal(false);
  showDeciduous      = signal(false);
  showTreatmentPlan  = signal(false);
  aiNote             = signal<string | null>(null);
  aiNoteLoading      = signal(false);
  aiNoteError        = signal<string | null>(null);

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

  // ── Urgency & treatment plan ─────────────────────────────────────────────────

  /** Teeth with conditions that warrant immediate clinical attention. */
  readonly urgencies = computed<{ fdi: string; reason: string }[]>(() => {
    const result: { fdi: string; reason: string }[] = [];
    for (const [fdi, tooth] of Object.entries(this._data().teeth)) {
      const active = tooth.conditions.filter(c => !c.isAnnulled);
      if (active.some(c => c.type === 'EXTRACCION'))          result.push({ fdi, reason: 'Extracción indicada' });
      if (active.some(c => c.type === 'LESION_PERIAPICAL'))   result.push({ fdi, reason: 'Lesión periapical' });
      if (active.some(c => c.type === 'FRACTURA_CORONARIA'))  result.push({ fdi, reason: 'Fractura coronaria' });
      if (active.some(c => c.type === 'FRACTURA_RADICULAR'))  result.push({ fdi, reason: 'Fractura radicular' });
      const cariesCount = active.filter(c => c.type === 'CARIES' || c.type === 'CARIES_SECONDARY').length;
      if (cariesCount >= 3)                                    result.push({ fdi, reason: `${cariesCount} superficies con caries` });
    }
    return result.sort((a, b) => parseInt(a.fdi) - parseInt(b.fdi));
  });

  readonly hasUrgencies = computed(() => this.urgencies().length > 0);

  /** All teeth with active conditions, sorted by FDI number. */
  readonly treatmentPlan = computed<{ fdi: string; name: string; conditions: string[] }[]>(() =>
    Object.entries(this._data().teeth)
      .filter(([, t]) => t.conditions.some(c => !c.isAnnulled))
      .map(([fdi, t]) => ({
        fdi,
        name: this.toothName(fdi),
        conditions: t.conditions.filter(c => !c.isAnnulled).map(c => this.getConditionLabel(c.type)),
      }))
      .sort((a, b) => parseInt(a.fdi) - parseInt(b.fdi))
  );

  isUrgent(fdi: string): boolean {
    return this.urgencies().some(u => u.fdi === fdi);
  }

  // ── AI note generation ────────────────────────────────────────────────────────

  generateAiNote(): void {
    if (this.aiNoteLoading()) return;
    this.aiNoteLoading.set(true);
    this.aiNoteError.set(null);
    this.aiNote.set(null);

    this.http.post<{ note: string }>('/api/dental/ai-note', {
      odontogramData: this._data(),
      patientName: this.patientName ?? undefined,
    }).subscribe({
      next: ({ note }) => {
        this.aiNote.set(note);
        this.aiNoteLoading.set(false);
      },
      error: (err) => {
        this.aiNoteError.set(err?.error?.message ?? 'Error al generar análisis con IA.');
        this.aiNoteLoading.set(false);
      },
    });
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

  /** SVG crown path (viewBox 0 0 36 44) — anatomically improved Bezier curves per tooth type. */
  getToothCrownPath(fdi: string): string {
    const d = parseInt(fdi, 10) % 10;
    switch (d) {
      // Central incisor — wide chisel, convex labial, tapers at cervix
      case 1: return 'M2,0 C6,-0.5 30,-0.5 34,0 L34.5,34 C34.5,40 30,44 18,44 C6,44 1.5,40 1.5,34 Z';
      // Lateral incisor — narrower, slightly more rounded crown
      case 2: return 'M5,1 C9,0 27,0 31,1 L31.5,34 C31.5,40 27,44 18,44 C9,44 4.5,40 4.5,34 Z';
      // Canine — single long pointed cusp, pronounced ridge
      case 3: return 'M0,17 C1.5,6 9,0 18,0 C27,0 34.5,6 36,17 L33,40 C31.5,44 27,44 18,44 C9,44 4.5,44 3,40 Z';
      // First premolar — two distinct cusps separated by central groove
      case 4: return 'M0,16 C2,4 8,-1 13,5 C15.5,9 17,8.5 18,7.5 C19,8.5 20.5,9 23,5 C28,-1 34,4 36,16 L34.5,40 C33.5,44 28,44 18,44 C8,44 2.5,44 1.5,40 Z';
      // Second premolar — two rounder, more equal cusps
      case 5: return 'M1,15 C3,4 9,0 14,6 C16.5,10 17.5,9 18,8 C18.5,9 19.5,10 22,6 C27,0 33,4 35,15 L34,40 C33,44 27,44 18,44 C9,44 3,44 2,40 Z';
      // First molar — wide, three prominent cusps with cruciform groove
      case 6: return 'M0,17 C1,4 7,-1 12,5 C14.5,9 16.5,7.5 18,6.5 C19.5,7.5 21.5,9 24,5 C29,-1 35,4 36,17 L35.5,40 C34.5,44 29,44 18,44 C7,44 1.5,44 0.5,40 Z';
      // Second molar — similar to first, slightly smaller
      case 7: return 'M1,16 C3,4 8,-0.5 12.5,5.5 C15,9 17,8 18,7 C19,8 21,9 23.5,5.5 C28,-0.5 33,4 35,16 L34,40 C33,44 27,44 18,44 C9,44 3,44 2,40 Z';
      // Third molar — compact, irregular multi-cusp crown
      case 8: return 'M3,15 C6,4 10,0.5 14,6.5 C16,9.5 18,8 20,6.5 C24,0.5 28,4 33,15 L32,40 C31,43 27,44 18,44 C9,44 5,43 4,40 Z';
      default: return 'M2,0 C6,-0.5 30,-0.5 34,0 L34.5,34 C34.5,40 30,44 18,44 C6,44 1.5,40 1.5,34 Z';
    }
  }

  /** Anatomical groove line paths (clipped to crown) — adds developmental groove detail. */
  getToothGroovePaths(fdi: string): string[] {
    const d = parseInt(fdi, 10) % 10;
    switch (d) {
      case 4: return ['M18,13 L18,31'];                               // central groove
      case 5: return ['M18,13 L18,31'];
      case 6: return ['M18,13 L18,31', 'M11,22 L25,22'];             // cruciform grooves
      case 7: return ['M18,13 L18,31', 'M11.5,22 L24.5,22'];
      case 8: return ['M18,14 L18,30', 'M12,21 L24,21'];
      default: return [];
    }
  }

  /** Gradient ID for the per-tooth highlight gradient. */
  gradId(fdi: string): string { return `${this.clipPrefix}-grd-${fdi}`; }

  /** Root path for the detail panel (viewBox extends to y=70). */
  getToothRootPath(fdi: string): string {
    const d = parseInt(fdi, 10) % 10;
    switch (d) {
      case 1: return 'M11,44 C9,52 9,62 12,68 Q15.5,72 18,70 Q20.5,72 24,68 C27,62 27,52 25,44';
      case 2: return 'M12,44 C10,52 10,61 13,67 Q15.5,71 18,69 Q20.5,71 23,67 C26,61 26,52 24,44';
      case 3: return 'M10,44 C8,53 8,63 11,68 Q14.5,72 18,70 Q21.5,72 25,68 C28,63 28,53 26,44';
      case 4: return 'M10,44 L11,52 C10,61 13,67 18,69 C23,67 26,61 25,52 L26,44';
      case 5: return 'M11,44 L12,52 C11,60 14,66 18,68 C22,66 25,60 24,52 L25,44';
      case 6: return 'M8,44 L10,55 C9,64 13,69 18,68 C23,69 27,64 26,55 L28,44';
      case 7: return 'M9,44 L11,54 C10,63 14,68 18,67 C22,68 26,63 25,54 L27,44';
      case 8: return 'M10,44 L12,53 C11,61 14,66 18,65 C22,66 25,61 24,53 L26,44';
      default: return 'M11,44 C9,52 9,62 12,68 Q15.5,72 18,70 Q20.5,72 24,68 C27,62 27,52 25,44';
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
