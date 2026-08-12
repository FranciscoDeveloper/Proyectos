import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScaleFormComponent } from '../scale-form/scale-form.component';
import {
  PsychService, ScaleTemplate, TrajectorySeries, ScaleResult
} from '../../../services/psych.service';

/** Una serie ya proyectada a coordenadas del SVG. */
interface PlottedSeries {
  code: string;
  name: string;
  color: string;
  path: string;
  points: { x: number; y: number; score: number; severity: string; date: string }[];
  last: { score: number; severity: string; date: string } | null;
  delta: number | null;
}

/**
 * Medición basada en resultados (MBC): aplica PHQ-9 / GAD-7 y dibuja la trayectoria
 * de puntajes de la ficha.
 *
 * El gráfico es SVG escrito a mano en lugar de una librería de charts. Son dos o tres
 * series de una decena de puntos cada una; traer Chart.js o similar significaría sumar
 * cientos de KB al bundle de una app que ya se sirve por CloudFront para dibujar unas
 * polilíneas. Todo el trabajo está en `plotted`, que proyecta puntajes a coordenadas.
 */
@Component({
  selector: 'app-mbc-trajectory',
  imports: [CommonModule, ScaleFormComponent],
  templateUrl: './mbc-trajectory.component.html',
  styleUrl: './mbc-trajectory.component.scss'
})
export class MbcTrajectoryComponent implements OnInit {
  @Input({ required: true }) recordId!: number;

  private psych = inject(PsychService);

  readonly templates = signal<ScaleTemplate[]>([]);
  readonly series    = signal<TrajectorySeries[]>([]);
  readonly loading   = signal(true);
  readonly error     = signal<string | null>(null);

  /** Template abierto en el modal, o null cuando está cerrado. */
  readonly activeTemplate = signal<ScaleTemplate | null>(null);

  // ── Geometría del SVG ──────────────────────────────────────────────────────
  readonly W = 640;
  readonly H = 240;
  private readonly PAD_L = 34;
  private readonly PAD_R = 14;
  private readonly PAD_T = 14;
  private readonly PAD_B = 28;

  private readonly PALETTE = ['#8b5cf6', '#0891b2', '#f59e0b', '#ec4899', '#10b981'];

  ngOnInit(): void {
    this.psych.getTemplates('psych-records').subscribe({
      next: t => this.templates.set(t),
      error: () => this.error.set('No se pudo cargar el catálogo de escalas.')
    });
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.psych.getTrajectory(this.recordId).subscribe({
      next: s => { this.series.set(s); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('No se pudo cargar la trayectoria.'); }
    });
  }

  /**
   * Techo del eje Y. Se toma del propio catálogo (el máximo del último rango de
   * severidad: 27 para PHQ-9, 21 para GAD-7) para que dos aplicaciones de la misma
   * escala sean comparables entre fichas, en vez de reescalar según los datos.
   */
  readonly yMax = computed(() => {
    const byCode = new Map(this.templates().map(t => [
      t.code,
      Math.max(...(t.scoring?.ranges ?? []).map(r => r.max), 0)
    ]));
    const present = this.series().map(s => byCode.get(s.code) ?? 0);
    const dataMax = Math.max(0, ...this.series().flatMap(s => s.points.map(p => p.score)));
    return Math.max(...present, dataMax, 10);
  });

  readonly hasData = computed(() => this.series().some(s => s.points.length > 0));

  /** Proyecta cada serie a coordenadas del viewBox. */
  readonly plotted = computed<PlottedSeries[]>(() => {
    const series = this.series();
    if (!series.length) return [];

    const yMax = this.yMax();
    const plotW = this.W - this.PAD_L - this.PAD_R;
    const plotH = this.H - this.PAD_T - this.PAD_B;

    // Escala temporal común a todas las series, para que dos escalas aplicadas el
    // mismo día caigan en la misma vertical. Si todas las mediciones comparten fecha
    // (o hay una sola), se reparte por índice para no dividir por cero.
    const times = series.flatMap(s => s.points.map(p => new Date(p.date).getTime()));
    const tMin  = Math.min(...times);
    const tMax  = Math.max(...times);
    const span  = tMax - tMin;

    return series.map((s, si) => {
      const pts = s.points.map((p, i) => {
        const t = new Date(p.date).getTime();
        const fx = span > 0
          ? (t - tMin) / span
          : (s.points.length > 1 ? i / (s.points.length - 1) : 0.5);
        return {
          x: this.PAD_L + fx * plotW,
          y: this.PAD_T + (1 - Math.min(p.score, yMax) / yMax) * plotH,
          score: p.score,
          severity: p.severity,
          date: p.date
        };
      });

      const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      const last  = s.points.length ? s.points[s.points.length - 1] : null;
      const first = s.points.length ? s.points[0] : null;

      return {
        code: s.code,
        name: s.name,
        color: this.PALETTE[si % this.PALETTE.length],
        path,
        points: pts,
        last: last ? { score: last.score, severity: last.severity, date: last.date } : null,
        delta: last && first && s.points.length > 1 ? last.score - first.score : null
      };
    });
  });

  /** Líneas horizontales de referencia (0, 1/4, 1/2, 3/4, techo). */
  readonly gridLines = computed(() => {
    const yMax = this.yMax();
    const plotH = this.H - this.PAD_T - this.PAD_B;
    return [0, 0.25, 0.5, 0.75, 1].map(f => ({
      y: this.PAD_T + (1 - f) * plotH,
      label: Math.round(yMax * f),
      x1: this.PAD_L,
      x2: this.W - this.PAD_R
    }));
  });

  openScale(template: ScaleTemplate): void {
    this.activeTemplate.set(template);
  }

  onCompleted(_result: ScaleResult): void {
    // La trayectoria se recarga de inmediato para que el punto nuevo aparezca
    // detrás del modal de resultado.
    this.reload();
  }

  onClosed(): void {
    this.activeTemplate.set(null);
  }

  severityColor(severity: string): string {
    switch (severity) {
      case 'ninguna':
      case 'minima':         return '#10b981';
      case 'leve':           return '#3b82f6';
      case 'moderada':       return '#f59e0b';
      case 'moderada-grave': return '#f97316';
      case 'grave':          return '#ef4444';
      default:               return '#6b7280';
    }
  }

  /** Un puntaje que baja es mejoría en ambas escalas; de ahí el signo invertido. */
  deltaLabel(delta: number): string {
    if (delta === 0) return 'sin cambio';
    return delta < 0 ? `${delta} (mejora)` : `+${delta} (empeora)`;
  }

  deltaColor(delta: number): string {
    if (delta === 0) return '#6b7280';
    return delta < 0 ? '#10b981' : '#ef4444';
  }
}
