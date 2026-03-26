import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { SchemaService } from '../../services/schema.service';
import { GenericCrudService } from '../../services/generic-crud.service';
import { EntitySchema, FieldDefinition } from '../../models/entity-schema.model';

@Component({
  selector: 'app-generic-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './generic-form.component.html',
  styleUrl: './generic-form.component.scss'
})
export class GenericFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private schemaService = inject(SchemaService);
  private crudService = inject(GenericCrudService);

  schema = signal<EntitySchema | null>(null);
  entityKey = signal('');
  isEdit = signal(false);
  recordId = signal<number | null>(null);
  saving = signal(false);
  saved = signal(false);
  form!: FormGroup;

  editableFields = computed(() =>
    this.schema()?.fields.filter(f => f.type !== 'tags' || true) ?? []
  );

  ngOnInit() {
    const key = this.route.snapshot.paramMap.get('entityKey') ?? '';
    const idParam = this.route.snapshot.paramMap.get('id');

    this.entityKey.set(key);
    this.schema.set(this.schemaService.getSchema(key));
    this.crudService.initStore(key);

    if (idParam) {
      this.isEdit.set(true);
      this.recordId.set(+idParam);
    }

    this.buildForm();

    if (this.isEdit() && this.recordId() !== null) {
      const record = this.crudService.getById(key, this.recordId()!);
      if (record) {
        const patchValue: Record<string, any> = {};
        this.schema()!.fields.forEach(f => {
          if (f.type === 'tags' && Array.isArray(record[f.name])) {
            patchValue[f.name] = record[f.name].join(', ');
          } else {
            patchValue[f.name] = record[f.name] ?? '';
          }
        });
        this.form.patchValue(patchValue);
      }
    }
  }

  private buildForm() {
    const group: Record<string, any> = {};
    const fields = this.schema()?.fields ?? [];

    fields.forEach(f => {
      const validators = [];
      if (f.required) validators.push(Validators.required);
      if (f.type === 'email') validators.push(Validators.email);
      if (f.pattern) validators.push(Validators.pattern(f.pattern));
      if (f.minLength) validators.push(Validators.minLength(f.minLength));
      if (f.maxLength) validators.push(Validators.maxLength(f.maxLength));
      if (f.min !== undefined && f.type === 'number') validators.push(Validators.min(f.min));
      if (f.max !== undefined && f.type === 'number') validators.push(Validators.max(f.max));

      let defaultVal: any = '';
      if (f.type === 'number') defaultVal = f.min ?? 0;
      if (f.type === 'range') defaultVal = f.min ?? 0;
      if (f.type === 'boolean') defaultVal = false;
      if (f.options && f.options.length > 0) defaultVal = f.options[0].value;

      group[f.name] = [defaultVal, validators];
    });

    this.form = this.fb.group(group);
  }

  ctrl(name: string): AbstractControl {
    return this.form.get(name)!;
  }

  isInvalid(name: string): boolean {
    const ctrl = this.form.get(name);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  getError(name: string, field: FieldDefinition): string {
    const ctrl = this.form.get(name);
    if (!ctrl?.errors) return '';
    if (ctrl.errors['required']) return `${field.label} es obligatorio.`;
    if (ctrl.errors['email']) return 'El email no es válido.';
    if (ctrl.errors['pattern']) return field.patternMessage ?? 'El formato no es válido.';
    if (ctrl.errors['minlength']) return `Mínimo ${field.minLength} caracteres.`;
    if (ctrl.errors['maxlength']) return `Máximo ${field.maxLength} caracteres.`;
    if (ctrl.errors['min']) return `El valor mínimo es ${field.min}.`;
    if (ctrl.errors['max']) return `El valor máximo es ${field.max}.`;
    return '';
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.saving.set(true);
    const raw = this.form.getRawValue();
    const processed: Record<string, any> = {};

    this.schema()!.fields.forEach(f => {
      if (f.type === 'tags') {
        const val = raw[f.name] ?? '';
        processed[f.name] = val
          ? String(val).split(',').map((t: string) => t.trim()).filter(Boolean)
          : [];
      } else if (f.type === 'number' || f.type === 'range') {
        processed[f.name] = Number(raw[f.name]);
      } else {
        processed[f.name] = raw[f.name];
      }
    });

    setTimeout(() => {
      if (this.isEdit() && this.recordId() !== null) {
        this.crudService.update(this.entityKey(), this.recordId()!, processed);
      } else {
        this.crudService.create(this.entityKey(), processed);
      }
      this.saving.set(false);
      this.saved.set(true);
      setTimeout(() => this.router.navigate(['/entity', this.entityKey()]), 800);
    }, 400);
  }

  cancel() {
    this.router.navigate(['/entity', this.entityKey()]);
  }

  getInputType(field: FieldDefinition): string {
    if (field.type === 'tags') return 'text';
    if (field.type === 'datetime') return 'datetime-local';
    return field.type as string;
  }
}
