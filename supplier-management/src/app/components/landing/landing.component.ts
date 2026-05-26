import { Component, OnInit, OnDestroy, ViewEncapsulation, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

const SEO_TITLE = 'Dairi | Software de Gestión Clínica para Chile y Latinoamérica';
const SEO_DESCRIPTION = 'Dairi es el software de gestión clínica en la nube para Chile y Latinoamérica. Administra pacientes, citas, fichas clínicas, inventario y pagos en una sola plataforma. 14 días gratis.';
const SEO_URL = 'https://app.dairi.cl/';
const SEO_IMAGE = 'https://app.dairi.cl/og-image.png';

const JSON_LD_SCRIPTS = [
  {
    id: 'ld-organization',
    content: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Dairi',
      legalName: 'Servicios Informáticos Dairi Francisco Riquelme E.I.R.L.',
      url: 'https://app.dairi.cl',
      logo: 'https://app.dairi.cl/favicon.ico',
      email: 'admin@dairi.cl',
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
      operatingSystem: 'Web',
      description: SEO_DESCRIPTION,
      url: SEO_URL,
      offers: [
        { '@type': 'Offer', name: 'Starter', price: '9', priceCurrency: 'USD',
          priceSpecification: { '@type': 'UnitPriceSpecification', price: '9', priceCurrency: 'USD', unitCode: 'MON' } },
        { '@type': 'Offer', name: 'Pro', price: '18', priceCurrency: 'USD',
          priceSpecification: { '@type': 'UnitPriceSpecification', price: '18', priceCurrency: 'USD', unitCode: 'MON' } }
      ],
      featureList: [
        'Gestión de pacientes', 'Calendario de citas', 'Fichas clínicas especializadas',
        'Control de inventario', 'Gestión de proveedores', 'Control de pagos y gastos',
        'Dashboard con métricas', 'Boleta electrónica SII', 'Chat interno del equipo'
      ],
      inLanguage: 'es-CL',
      availableOnDevice: 'Desktop, Mobile, Tablet',
      softwareVersion: '1.0'
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
          name: '¿Qué es Dairi y para qué sirve?',
          acceptedAnswer: { '@type': 'Answer', text: 'Dairi es un software de gestión clínica en la nube diseñado para clínicas y consultorios en Latinoamérica. Centraliza la administración de pacientes, citas, fichas clínicas, inventario de productos, proveedores y pagos en una sola plataforma accesible desde cualquier dispositivo con internet.' }
        },
        {
          '@type': 'Question',
          name: '¿Cuánto cuesta Dairi?',
          acceptedAnswer: { '@type': 'Answer', text: 'Dairi tiene tres planes: Starter desde US$9/mes (hasta 5 usuarios), Pro desde US$18/mes (hasta 10 usuarios con inventario, pagos y boleta electrónica) y Enterprise con precio a consultar para organizaciones grandes. Todos los planes incluyen 14 días de prueba gratuita sin tarjeta de crédito.' }
        },
        {
          '@type': 'Question',
          name: '¿Dairi es seguro para almacenar fichas clínicas?',
          acceptedAnswer: { '@type': 'Answer', text: 'Sí. Dairi utiliza autenticación JWT, HTTPS forzado, cifrado AES-256 en base de datos y arquitectura serverless en AWS. Los datos clínicos están almacenados en servidores en la nube con backups automáticos y acceso restringido por roles.' }
        },
        {
          '@type': 'Question',
          name: '¿Cuánto tiempo toma implementar Dairi en mi clínica?',
          acceptedAnswer: { '@type': 'Answer', text: 'La implementación toma menos de 24 horas. Al ser una plataforma 100% en la nube, no requiere instalaciones ni servidores propios. El onboarding guiado te permite configurar tu clínica, agregar profesionales y comenzar a registrar pacientes el mismo día.' }
        },
        {
          '@type': 'Question',
          name: '¿Dairi emite boletas electrónicas con el SII?',
          acceptedAnswer: { '@type': 'Answer', text: 'Sí, el plan Pro incluye emisión de boletas electrónicas con timbre del SII y envío automático por email al paciente al finalizar la atención. Compatible con la normativa tributaria chilena vigente.' }
        },
        {
          '@type': 'Question',
          name: '¿Funciona Dairi para clínicas pequeñas o consultorios unipersonales?',
          acceptedAnswer: { '@type': 'Answer', text: 'Sí. El plan Starter está diseñado para consultorios y clínicas pequeñas con hasta 5 usuarios. Incluye gestión de pacientes, citas y fichas clínicas a un precio accesible. Puedes escalar al plan Pro en cualquier momento sin perder datos.' }
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
