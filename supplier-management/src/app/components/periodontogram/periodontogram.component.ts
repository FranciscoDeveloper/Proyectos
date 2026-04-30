import {
  Component, Input, Output, EventEmitter,
  signal, computed, ChangeDetectionStrategy, OnChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ─── Domain types ─────────────────────────────────────────────────────────────

// 6 sites per tooth: [MV, V, DV, DL, L, ML]
export type SixValues<T> = [T, T, T, T, T, T];

export interface PerioToothData {
  probingDepth:   SixValues<number>;
  gingivalMargin: SixValues<number>;
  bleeding:       SixValues<boolean>;
  suppuration:    SixValues<boolean>;
  plaque:         SixValues<boolean>;
  furcation:      0 | 1 | 2 | 3;
  mobility:       0 | 1 | 2 | 3;
}

export interface PeriodontogramData {
  version: number;
  createdAt: string;
  teeth: Record<string, PerioToothData>;
  bopPercent?: number;
  plaquePercent?: number;
  notes?: string;
}

// ─── Tooth layout ─────────────────────────────────────────────────────────────

// Upper: Q1 (right→midline) + Q2 (midline→left) — patient perspective
const UPPER_TEETH = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28'];
// Lower: Q4 (right→midline) + Q3 (midline→left)
const LOWER_TEETH = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38'];

// Multi-rooted teeth (molars) — have furcation measurement
const MULTI_ROOTED = new Set(['16','17','18','26','27','28','36','37','38','46','47','48']);

// Site labels
const BUCCAL_SITES = ['MV','V','DV'] as const;
const LINGUAL_SITES = ['DL','L','ML'] as const;

// ─── Color thresholds for probing depth ───────────────────────────────────────

function pdColor(mm: number): string {
  if (mm <= 0) return '#9ca3af';
  if (mm <= 3) return '#10b981';   // green — healthy
  if (mm <= 5) return '#f59e0b';   // amber — watch
  return '#ef4444';                 // red — deep pocket
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyTooth(): PerioToothData {
  return {
    probingDepth:   [0, 0, 0, 0, 0, 0],
    gingivalMargin: [0, 0, 0, 0, 0, 0],
    bleeding:       [false, false, false, false, false, false],
    suppuration:    [false, false, false, false, false, false],
    plaque:         [false, false, false, false, false, false],
    furcation: 0,
    mobility:  0,
  };
}

function calcNic(pd: number, gm: number): number {
  return pd - gm;
}

function emptyData(): PeriodontogramData {
  return { version: 1, createdAt: new Date().toISOString(), teeth: {} };
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-periodontogram',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './periodontogram.component.html',
  styleUrl: './periodontogram.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PeriodontogramComponent implements OnChanges {

  @Input() set data(v: PeriodontogramData | null | undefined) {
    this._data.set(v ?? emptyData());
  }
  @Input() readonly = false;
  @Output() dataChange = new EventEmitter<PeriodontogramData>();

  readonly _data = signal<PeriodontogramData>(emptyData());

  // Which tooth is being edited
  editingTooth = signal<string | null>(null);

  // Ephemeral edit buffer for the selected tooth
  editBuffer = signal<PerioToothData>(emptyTooth());

  readonly upperTeeth = UPPER_TEETH;
  readonly lowerTeeth = LOWER_TEETH;
  readonly buccalSites = BUCCAL_SITES;
  readonly lingualSites = LINGUAL_SITES;

  ngOnChanges() { /* triggers Input set */ }

  // ── Computed indices ─────────────────────────────────────────────────────────

  readonly bopPercent = computed(() => {
    const teeth = this._data().teeth;
    let total = 0, bleeding = 0;
    for (const t of Object.values(teeth)) {
      for (const b of t.bleeding) { total++; if (b) bleeding++; }
    }
    return total === 0 ? 0 : Math.round(bleeding / total * 100);
  });

  readonly plaquePercent = computed(() => {
    const teeth = this._data().teeth;
    let total = 0, plaque = 0;
    for (const t of Object.values(teeth)) {
      for (const p of t.plaque) { total++; if (p) plaque++; }
    }
    return total === 0 ? 0 : Math.round(plaque / total * 100);
  });

  readonly meanPD = computed(() => {
    const teeth = Object.values(this._data().teeth);
    if (teeth.length === 0) return 0;
    let sum = 0, n = 0;
    for (const t of teeth) {
      for (const v of t.probingDepth) { sum += v; n++; }
    }
    return n === 0 ? 0 : (sum / n).toFixed(1);
  });

  // ── Public helpers for template ──────────────────────────────────────────────

  toothData(fdi: string): PerioToothData {
    return this._data().teeth[fdi] ?? emptyTooth();
  }

  isMultiRooted(fdi: string): boolean {
    return MULTI_ROOTED.has(fdi);
  }

  /** Probing depth for display: index 0-2 = buccal (MV,V,DV), 3-5 = lingual (DL,L,ML) */
  pd(fdi: string, i: number): number {
    return this.toothData(fdi).probingDepth[i] ?? 0;
  }

  gm(fdi: string, i: number): number {
    return this.toothData(fdi).gingivalMargin[i] ?? 0;
  }

  nic(fdi: string, i: number): number {
    return calcNic(this.pd(fdi, i), this.gm(fdi, i));
  }

  pdColorOf(mm: number): string { return pdColor(mm); }

  bleeding(fdi: string, i: number): boolean {
    return this.toothData(fdi).bleeding[i] ?? false;
  }

  suppuration(fdi: string, i: number): boolean {
    return this.toothData(fdi).suppuration[i] ?? false;
  }

  plaque(fdi: string, i: number): boolean {
    return this.toothData(fdi).plaque[i] ?? false;
  }

  furcation(fdi: string): number {
    return this.toothData(fdi).furcation;
  }

  mobility(fdi: string): number {
    return this.toothData(fdi).mobility;
  }

  hasDentalData(fdi: string): boolean {
    const t = this._data().teeth[fdi];
    if (!t) return false;
    return t.probingDepth.some(v => v > 0);
  }

  // ── SVG bar chart height (max 10mm = 40px) ───────────────────────────────────

  barHeight(mm: number): number {
    return Math.min(Math.max(mm, 0), 10) * 4;
  }

  // ── Interaction: select tooth to edit ────────────────────────────────────────

  selectTooth(fdi: string): void {
    if (this.readonly) return;
    const data = this.toothData(fdi);
    this.editBuffer.set({
      probingDepth:   [...data.probingDepth]   as SixValues<number>,
      gingivalMargin: [...data.gingivalMargin] as SixValues<number>,
      bleeding:       [...data.bleeding]       as SixValues<boolean>,
      suppuration:    [...data.suppuration]    as SixValues<boolean>,
      plaque:         [...data.plaque]         as SixValues<boolean>,
      furcation: data.furcation,
      mobility:  data.mobility,
    });
    this.editingTooth.set(fdi);
  }

  closeEdit(): void {
    this.editingTooth.set(null);
  }

  // ── Edit buffer setters ───────────────────────────────────────────────────────

  setPD(i: number, val: string): void {
    const n = Math.min(Math.max(parseInt(val, 10) || 0, 0), 15);
    this.editBuffer.update(b => {
      const pd = [...b.probingDepth] as SixValues<number>;
      pd[i] = n;
      return { ...b, probingDepth: pd };
    });
  }

  setGM(i: number, val: string): void {
    const n = Math.min(Math.max(parseInt(val, 10) || 0, -5), 10);
    this.editBuffer.update(b => {
      const gm = [...b.gingivalMargin] as SixValues<number>;
      gm[i] = n;
      return { ...b, gingivalMargin: gm };
    });
  }

  toggleBleeding(i: number): void {
    this.editBuffer.update(b => {
      const bl = [...b.bleeding] as SixValues<boolean>;
      bl[i] = !bl[i];
      return { ...b, bleeding: bl };
    });
  }

  toggleSuppuration(i: number): void {
    this.editBuffer.update(b => {
      const sup = [...b.suppuration] as SixValues<boolean>;
      sup[i] = !sup[i];
      return { ...b, suppuration: sup };
    });
  }

  togglePlaque(i: number): void {
    this.editBuffer.update(b => {
      const pl = [...b.plaque] as SixValues<boolean>;
      pl[i] = !pl[i];
      return { ...b, plaque: pl };
    });
  }

  setFurcation(v: number): void {
    this.editBuffer.update(b => ({ ...b, furcation: v as 0|1|2|3 }));
  }

  setMobility(v: number): void {
    this.editBuffer.update(b => ({ ...b, mobility: v as 0|1|2|3 }));
  }

  bufferPD(i: number): number    { return this.editBuffer().probingDepth[i]; }
  bufferGM(i: number): number    { return this.editBuffer().gingivalMargin[i]; }
  bufferNIC(i: number): number   { return calcNic(this.bufferPD(i), this.bufferGM(i)); }
  bufferBL(i: number): boolean   { return this.editBuffer().bleeding[i]; }
  bufferSUP(i: number): boolean  { return this.editBuffer().suppuration[i]; }
  bufferPL(i: number): boolean   { return this.editBuffer().plaque[i]; }
  bufferFUR(): number            { return this.editBuffer().furcation; }
  bufferMOB(): number            { return this.editBuffer().mobility; }

  saveEdit(): void {
    const fdi = this.editingTooth();
    if (!fdi) return;
    const current = this._data();
    const updated: PeriodontogramData = {
      ...current,
      teeth: { ...current.teeth, [fdi]: { ...this.editBuffer() } }
    };
    this._data.set(updated);
    this.dataChange.emit(updated);
    this.closeEdit();
  }

  nicColor(val: number): string {
    if (val <= 2) return '#10b981';
    if (val <= 4) return '#f59e0b';
    return '#ef4444';
  }

  furcLabel(v: number): string {
    return ['—', 'I', 'II', 'III'][v] ?? '—';
  }

  indices(): { label: string; value: string; color: string; desc: string }[] {
    const bop = this.bopPercent();
    const pi  = this.plaquePercent();
    return [
      {
        label: 'BOP %',
        value: bop + '%',
        color: bop < 10 ? '#10b981' : bop < 25 ? '#f59e0b' : '#ef4444',
        desc: bop < 10 ? 'Salud periodontal' : bop < 25 ? 'Gingivitis leve' : 'Gingivitis/periodontitis'
      },
      {
        label: 'Índice de Placa',
        value: pi + '%',
        color: pi < 20 ? '#10b981' : pi < 50 ? '#f59e0b' : '#ef4444',
        desc: pi < 20 ? 'Higiene adecuada' : pi < 50 ? 'Mejorar higiene' : 'Higiene deficiente'
      },
      {
        label: 'PS Promedio',
        value: this.meanPD() + ' mm',
        color: Number(this.meanPD()) <= 3 ? '#10b981' : Number(this.meanPD()) <= 5 ? '#f59e0b' : '#ef4444',
        desc: 'Profundidad de sondaje media'
      }
    ];
  }

  range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }
}
