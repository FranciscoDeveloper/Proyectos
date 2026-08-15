import { Component, OnInit, OnDestroy, ViewEncapsulation, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

const SEO_TITLE = 'Dairi | Software para Psicólogos en Chile — Fichas, Agenda y IA';
const SEO_DESCRIPTION = 'Software clínico para psicólogos en Chile: dicta tu sesión y la IA escribe la nota SOAP en minutos. Agenda online, videoconsultas con Google Meet, previsiones FONASA e ISAPRE y cobros con Flow y Transbank. 30 días gratis.';
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
      operatingSystem: 'Web',
      description: SEO_DESCRIPTION,
      url: SEO_URL,
      offers: [
        { '@type': 'Offer', name: 'Starter', price: '3', priceCurrency: 'USD',
          priceSpecification: { '@type': 'UnitPriceSpecification', price: '3', priceCurrency: 'USD', unitCode: 'MON' } },
        { '@type': 'Offer', name: 'Pro', price: '12', priceCurrency: 'USD',
          priceSpecification: { '@type': 'UnitPriceSpecification', price: '12', priceCurrency: 'USD', unitCode: 'MON' } }
      ],
      featureList: [
        'Gestión de pacientes', 'Calendario de citas', 'Fichas clínicas especializadas',
        'Dictado de voz a nota clínica con IA', 'Videoconsultas integradas con Google Meet',
        'Agenda online para que los pacientes reserven solos', 'Control de pagos y comisiones',
        'Dashboard con métricas', 'Chat interno del equipo'
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
          acceptedAnswer: { '@type': 'Answer', text: 'Dairi es un software clínico en la nube pensado para psicólogos y profesionales de la salud en consulta particular. Centraliza fichas clínicas con nota SOAP, agenda online, videoconsultas, previsiones (FONASA, ISAPRE, Particular) y control de pagos en una sola plataforma. Su diferenciador es el dictado de voz: al terminar la sesión dictas y la IA redacta la nota clínica.' }
        },
        {
          '@type': 'Question',
          name: '¿Cuánto cuesta Dairi?',
          acceptedAnswer: { '@type': 'Answer', text: 'Dairi tiene tres planes: Starter desde US$3/mes (hasta 3 profesionales), Pro desde US$12/mes (hasta 20 profesionales, con fichas especializadas, videoconsultas, comisiones e informes) y Enterprise con precio a consultar para redes de clínicas. Todos los planes incluyen 30 días de prueba gratuita sin tarjeta de crédito.' }
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
          name: '¿Los psicólogos tienen que emitir boletas electrónicas?',
          acceptedAnswer: { '@type': 'Answer', text: 'Los psicólogos en consulta particular emiten sus boletas de honorarios directamente en sii.cl con su RUT, como lo hacen habitualmente. Dairi no emite documentos tributarios: no incluye integración con el SII. Lo que sí hace es registrar y llevar el control de los pagos recibidos por sesión, con su método de pago y previsión, para que puedas conciliar tus ingresos y ver tus reportes mensuales.' }
        },
        {
          '@type': 'Question',
          name: '¿Funciona para psicólogos que atienden por videoconsulta?',
          acceptedAnswer: { '@type': 'Answer', text: 'Sí. Al agendar una sesión online, Dairi genera automáticamente el enlace de Google Meet y lo sincroniza con tu calendario y con el del paciente. Al terminar la sesión dictas tu nota con voz y la IA la convierte en una nota SOAP lista para la ficha, sin cambiar de herramienta.' }
        },
        {
          '@type': 'Question',
          name: '¿Cuánto tiempo tarda registrar una nota de sesión?',
          acceptedAnswer: { '@type': 'Answer', text: 'Entre 2 y 3 minutos. En vez de escribir la nota a mano (lo que suele tomar 15 a 20 minutos por sesión), dictas lo ocurrido al terminar: Deepgram Nova-3 transcribe en español y la IA de Dairi estructura la nota SOAP en subjetivo, objetivo, análisis y plan. Tú revisas, ajustas y guardas.' }
        },
        {
          '@type': 'Question',
          name: '¿Funciona Dairi para psicólogos con consulta particular unipersonal?',
          acceptedAnswer: { '@type': 'Answer', text: 'Sí. El plan Starter está diseñado justamente para consultas particulares con hasta 3 profesionales. Incluye fichas de pacientes, agenda con reserva online, dictado de voz y control de pagos a un precio accesible. Puedes escalar al plan Pro en cualquier momento sin perder datos.' }
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
