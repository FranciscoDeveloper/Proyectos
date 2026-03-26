import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SchemaService } from '../../services/schema.service';
import { GenericCrudService } from '../../services/generic-crud.service';

@Component({
  selector: 'app-clinical-record',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './clinical-record.component.html',
  styleUrl: './clinical-record.component.scss'
})
export class ClinicalRecordComponent {
  private route     = inject(ActivatedRoute);
  private schemaSvc = inject(SchemaService);
  private crudSvc   = inject(GenericCrudService);

  readonly entityKey = this.route.snapshot.paramMap.get('entityKey')!;
  readonly schema    = this.schemaSvc.getSchema(this.entityKey);

  private readonly titleField    = this.schema?.fields.find(f => f.isTitle)    ?? null;
  private readonly subtitleField = this.schema?.fields.find(f => f.isSubtitle) ?? null;
  private readonly statusField   = this.schema?.fields.find(f => f.isBadge && f.name === 'status') ?? null;
  private readonly bloodTypeField = this.schema?.fields.find(f => f.name === 'bloodType') ?? null;
  private readonly insuranceField = this.schema?.fields.find(f => f.name === 'insurance')  ?? null;
  private readonly doctorField    = this.schema?.fields.find(f => f.name === 'doctor')     ?? null;
  private readonly lastVisitField = this.schema?.fields.find(f => f.name === 'lastVisit')  ?? null;
  private readonly ageField       = this.schema?.fields.find(f => f.name === 'age')        ?? null;
  private readonly genderField    = this.schema?.fields.find(f => f.name === 'gender')     ?? null;
  private readonly alertField     = this.schema?.fields.find(f => f.isAlert && f.name === 'allergies') ?? null;

  readonly filterStatus = '';

  readonly records = computed(() => {
    const data = this.crudSvc.getAll(this.entityKey)();
    return data.map(item => {
      const statusVal  = this.statusField  ? item[this.statusField.name]  : null;
      const btVal      = this.bloodTypeField ? item[this.bloodTypeField.name] : null;
      const insVal     = this.insuranceField ? item[this.insuranceField.name] : null;
      const genderVal  = this.genderField  ? item[this.genderField.name]  : null;
      const allergies  = this.alertField   ? (item[this.alertField.name] ?? []) : [];

      return {
        id:           item['id'],
        title:        this.titleField    ? String(item[this.titleField.name]    ?? '') : `#${item['id']}`,
        subtitle:     this.subtitleField ? String(item[this.subtitleField.name] ?? '') : '',
        statusLabel:  this.statusField?.options?.find(o => o.value === statusVal)?.label ?? '',
        statusColor:  this.statusField?.badgeColors?.[statusVal] ?? '#6b7280',
        bloodType:    btVal ?? '',
        bloodTypeColor: this.bloodTypeField?.badgeColors?.[btVal] ?? '#6b7280',
        insurance:    this.insuranceField?.options?.find(o => o.value === insVal)?.label ?? '',
        insuranceColor: this.insuranceField?.badgeColors?.[insVal] ?? '#6b7280',
        doctor:       this.doctorField   ? String(item[this.doctorField.name]   ?? '') : '',
        lastVisit:    this.lastVisitField ? String(item[this.lastVisitField.name] ?? '') : '',
        age:          this.ageField      ? Number(item[this.ageField.name] ?? 0) : 0,
        gender:       this.genderField?.options?.find(o => o.value === genderVal)?.label ?? '',
        allergies:    Array.isArray(allergies) ? allergies as string[] : [],
        isCritical:   statusVal === 'critical'
      };
    });
  });

  readonly statusOptions = computed(() =>
    this.statusField?.options?.map(o => ({
      value: o.value,
      label: o.label,
      color: this.statusField!.badgeColors?.[o.value] ?? '#6b7280'
    })) ?? []
  );

  readonly stats = computed(() => {
    const recs = this.records();
    const total    = recs.length;
    const critical = recs.filter(r => r.isCritical).length;
    const active   = recs.filter(r => r.statusLabel === 'Activo').length;
    return { total, critical, active };
  });

  readonly activeFilter = signal('');

  readonly filteredRecords = computed(() => {
    const recs = this.records();
    const f = this.activeFilter().toLowerCase();
    if (!f) return recs;
    return recs.filter(r =>
      r.title.toLowerCase().includes(f) ||
      r.subtitle.toLowerCase().includes(f) ||
      r.doctor.toLowerCase().includes(f) ||
      r.statusLabel.toLowerCase().includes(f)
    );
  });

  setFilter(v: string) { this.activeFilter.set(v); }
  clearFilter() { this.activeFilter.set(''); }
}
