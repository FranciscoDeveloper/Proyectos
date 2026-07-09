import { Component, OnInit, OnDestroy, ViewEncapsulation, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

const SEO_TITLE = 'Dairi — Software clínico para Chile | Citas, fichas y pagos online';
const SEO_DESCRIPTION = 'Dairi es un software de gestión clínica en la nube para clínicas médicas y dentales en Chile: agenda de citas, fichas clínicas electrónicas de 9 especialidades, reserva online con pago vía Flow.cl, transcripción de consultas con IA y sincronización con Google Calendar. Desde US$3/mes. 30 días gratis.';
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
        { '@type': 'Offer', name: 'Starter', price: '3', priceCurrency: 'USD',
          priceSpecification: { '@type': 'UnitPriceSpecification', price: '3', priceCurrency: 'USD', unitCode: 'MON' } },
        { '@type': 'Offer', name: 'Pro', price: '12', priceCurrency: 'USD',
          priceSpecification: { '@type': 'UnitPriceSpecification', price: '12', priceCurrency: 'USD', unitCode: 'MON' } }
      ],
      featureList: [
        'Gestión de pacientes', 'Calendario de citas', 'Fichas clínicas especializadas (9 especialidades)',
        'Reserva online con pago vía Flow.cl', 'Transcripción de consultas con IA (Deepgram Nova-3)',
        'Nota SOAP generada por IA (Amazon Bedrock)', 'Sincronización con Google Calendar y Google Meet',
        'Reportes clínicos y comisiones', 'Presupuestos con cobro online',
        'Chat interno con asistente IA Dairi', 'Privacidad por profesional aplicada en servidor',
        'App móvil Android e iOS', 'Dashboard con métricas en tiempo real'
      ],
      inLanguage: 'es-CL',
      availableOnDevice: 'Desktop, Mobile, Tablet',
      softwareVersion: '2.0'
    }
  },
  {
    id: 'ld-faq',
    content: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: '¿Qué software clínico usar en Chile?',
          acceptedAnswer: { '@type': 'Answer', text: 'Dairi es un sistema de gestión clínica para Chile que incluye agenda de citas, fichas clínicas electrónicas de 9 especialidades, reserva de horas online con pago vía Flow.cl, transcripción de consultas con IA y reportes clínicos. Está diseñado para clínicas médicas, dentales y centros de especialidades, con precios desde US$3 al mes.' }
        },
        {
          '@type': 'Question',
          name: '¿Cuánto cuesta Dairi?',
          acceptedAnswer: { '@type': 'Answer', text: 'Dairi tiene tres planes: Starter desde US$3/mes (hasta 3 profesionales), Pro desde US$12/mes (hasta 20 profesionales, todas las especialidades) y Enterprise a precio a consultar. Todos los planes incluyen 30 días de prueba gratuita sin tarjeta de crédito.' }
        },
        {
          '@type': 'Question',
          name: '¿Cómo pagan los pacientes sus horas médicas online?',
          acceptedAnswer: { '@type': 'Answer', text: 'El paciente reserva su hora en el portal público de la clínica y paga en el mismo paso mediante Flow.cl, la pasarela de pagos chilena. El pago se verifica automáticamente y la cita queda confirmada en la agenda sin intervención manual.' }
        },
        {
          '@type': 'Question',
          name: '¿Se sincroniza la agenda médica con Google Calendar?',
          acceptedAnswer: { '@type': 'Answer', text: 'Sí. Las citas de Dairi se sincronizan con Google Calendar, y las videoconsultas generan automáticamente su enlace de Google Meet, disponible para el profesional y para el paciente.' }
        },
        {
          '@type': 'Question',
          name: '¿Dónde se almacenan los datos clínicos y son seguros?',
          acceptedAnswer: { '@type': 'Answer', text: 'Los datos se alojan en la nube de Amazon Web Services (Lambda, S3, RDS PostgreSQL, CloudFront) con arquitectura serverless HIPAA-ready. Dairi aplica cifrado Zero-Knowledge AES-256-GCM, autenticación JWT y aislamiento de datos por profesional aplicado en el servidor.' }
        },
        {
          '@type': 'Question',
          name: '¿Funciona Dairi para una clínica dental?',
          acceptedAnswer: { '@type': 'Answer', text: 'Sí. Dairi incluye ficha odontológica con odontograma interactivo y periodontograma, agenda dental por sillón, diagnóstico ICDAS/CIE, plan de tratamiento por sesión y presupuestos con envío por email y cobro online.' }
        }
      ]
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

  activeView = 'dashboard';

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
    for (const { id } of JSON_LD_SCRIPTS) {
      this.doc.getElementById(id)?.remove();
    }
  }
}
