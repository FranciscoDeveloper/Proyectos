import { Component, OnInit, OnDestroy, ViewEncapsulation, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

const SEO_TITLE = 'Dairi — Software clínico para Chile | Citas, fichas y pagos online';
const SEO_DESCRIPTION = 'Dairi es un software de gestión clínica en la nube para clínicas médicas y dentales en Chile: agenda de citas, fichas clínicas electrónicas de 9 especialidades, reserva online con pago vía Flow.cl, transcripción de consultas con IA y sincronización con Google Calendar. Plan Starter gratis para agenda de citas, planes pagos desde $6.990/mes con 30 días de prueba.';
const SEO_URL = 'https://dairi.cl/';
const SEO_IMAGE = 'https://dairi.cl/og-image.png';

const JSON_LD_SCRIPTS = [
  {
    id: 'ld-organization',
    content: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Dairi',
      legalName: 'Servicios Informáticos Dairi Francisco Riquelme E.I.R.L.',
      url: 'https://dairi.cl',
      logo: 'https://dairi.cl/favicon.ico',
      email: 'contacto@dairi.cl',
      address: { '@type': 'PostalAddress', addressLocality: 'Santiago', addressCountry: 'CL' },
      sameAs: []
    }
  },
  {
    id: 'ld-software',
    content: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Dairi',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Android, iOS',
      description: SEO_DESCRIPTION,
      url: SEO_URL,
      areaServed: 'CL',
      offers: [
        { '@type': 'Offer', name: 'Starter', price: '0', priceCurrency: 'CLP',
          priceSpecification: { '@type': 'UnitPriceSpecification', price: '0', priceCurrency: 'CLP', unitCode: 'MON' } },
        { '@type': 'Offer', name: 'Pro', price: '6990', priceCurrency: 'CLP',
          priceSpecification: { '@type': 'UnitPriceSpecification', price: '6990', priceCurrency: 'CLP', unitCode: 'MON' } },
        { '@type': 'Offer', name: 'Enterprise', description: 'Precio a medida, contactar ventas' }
      ],
      featureList: [
        'Plan gratis de agenda de citas para 1 profesional', 'Gestión de pacientes', 'Calendario de citas', 'Fichas clínicas especializadas (9 especialidades)',
        'Reserva online con pago vía Flow.cl', 'Transcripción de consultas con IA (Deepgram Nova-3)',
        'Nota SOAP generada por IA (Dairi IA)', 'Sincronización con Google Calendar y Google Meet',
        'Reportes clínicos y comisiones', 'Presupuestos con cobro online',
        'Chat interno con asistente IA Dairi', 'Privacidad por profesional aplicada en servidor',
        'App móvil Android e iOS', 'Dashboard con métricas en tiempo real'
      ],
      inLanguage: 'es-CL',
      availableOnDevice: 'Desktop, Mobile, Tablet',
      softwareVersion: '2.0'
    }
  }
];

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class LandingComponent implements OnInit, OnDestroy {
  private titleSvc = inject(Title);
  private metaSvc  = inject(Meta);
  private doc      = inject(DOCUMENT);
  private route    = inject(ActivatedRoute);

  /**
   * Set when the user arrives here right after deleting their account
   * (/app/cuenta navigates to `/?cuenta=eliminada`). Drives the acknowledgment
   * banner at the top of the template — a silent redirect after an irreversible
   * action reads like the action failed.
   */
  readonly accountDeleted =
    this.route.snapshot.queryParamMap.get('cuenta') === 'eliminada';

  activeView = 'dashboard';
  private rotateInterval?: ReturnType<typeof setInterval>;
  private readonly ROTATE_VIEWS = ['dashboard', 'citas', 'ficha'];
  private rotateIdx = 0;

  setActiveView(view: string): void {
    this.activeView = view;
    this.rotateIdx  = this.ROTATE_VIEWS.indexOf(view);
    if (this.rotateInterval) { clearInterval(this.rotateInterval); this.rotateInterval = undefined; }
  }

  ngOnInit(): void {
    this.titleSvc.setTitle(SEO_TITLE);

    this.metaSvc.updateTag({ name: 'description',        content: SEO_DESCRIPTION });
    this.metaSvc.updateTag({ name: 'robots',             content: 'index, follow' });

    this.metaSvc.updateTag({ property: 'og:type',        content: 'website' });
    this.metaSvc.updateTag({ property: 'og:locale',      content: 'es_CL' });
    this.metaSvc.updateTag({ property: 'og:site_name',   content: 'Dairi' });
    this.metaSvc.updateTag({ property: 'og:title',       content: SEO_TITLE });
    this.metaSvc.updateTag({ property: 'og:description', content: SEO_DESCRIPTION });
    this.metaSvc.updateTag({ property: 'og:url',         content: SEO_URL });
    this.metaSvc.updateTag({ property: 'og:image',       content: SEO_IMAGE });

    this.metaSvc.updateTag({ name: 'twitter:card',        content: 'summary_large_image' });
    this.metaSvc.updateTag({ name: 'twitter:title',       content: SEO_TITLE });
    this.metaSvc.updateTag({ name: 'twitter:description', content: SEO_DESCRIPTION });
    this.metaSvc.updateTag({ name: 'twitter:image',       content: SEO_IMAGE });

    this.rotateInterval = setInterval(() => {
      this.rotateIdx  = (this.rotateIdx + 1) % this.ROTATE_VIEWS.length;
      this.activeView = this.ROTATE_VIEWS[this.rotateIdx];
    }, 3200);

    for (const { id, content } of JSON_LD_SCRIPTS) {
      const existing = this.doc.getElementById(id);
      if (existing) existing.remove();
      const script = this.doc.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      script.text = JSON.stringify(content);
      this.doc.head.appendChild(script);
    }
  }

  ngOnDestroy(): void {
    if (this.rotateInterval) clearInterval(this.rotateInterval);
    for (const { id } of JSON_LD_SCRIPTS) {
      this.doc.getElementById(id)?.remove();
    }
  }
}
