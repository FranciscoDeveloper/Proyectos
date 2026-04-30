import { Component, ViewEncapsulation, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './docs.component.html',
  styleUrl: './docs.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class DocsComponent implements OnInit {
  activeSection = 'introduccion';

  sections = [
    { id: 'introduccion',  label: 'Introducción',          icon: '📖' },
    { id: 'acceso',        label: 'Acceso y Roles',         icon: '🔐' },
    { id: 'dashboard',     label: 'Dashboard',              icon: '📊' },
    { id: 'pacientes',     label: 'Pacientes',              icon: '🧑‍⚕️' },
    { id: 'citas',         label: 'Citas y Calendario',     icon: '📅' },
    { id: 'fichas',        label: 'Fichas Clínicas',        icon: '📋' },
    { id: 'proveedores',   label: 'Proveedores',            icon: '🤝' },
    { id: 'productos',     label: 'Inventario',             icon: '💊' },
    { id: 'pagos',         label: 'Pagos y Gastos',         icon: '💸' },
    { id: 'chat',          label: 'Chat Interno',           icon: '💬' },
    { id: 'reportes',      label: 'Reportes',               icon: '📈' },
    { id: 'reserva',       label: 'Reserva Online',         icon: '🌐' },
    { id: 'seguridad',     label: 'Seguridad',              icon: '🔒' },
  ];

  ngOnInit() {
    const hash = window.location.hash.replace('#', '');
    if (hash && this.sections.find(s => s.id === hash)) {
      this.activeSection = hash;
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }

  scrollTo(id: string) {
    this.activeSection = id;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
