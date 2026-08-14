import { Component, OnInit, OnDestroy, ViewEncapsulation, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

/**
 * SEO/SEM de la landing.
 *
 * El title lidera con la frase que se compra en Google Ads y por la que compiten
 * los competidores chilenos del nicho ("software para psicólogos Chile"), sin
 * perder la cobertura multi-especialidad: hay clientes pagando fuera de psicología.
 *
 * Largos objetivo: title <= 65 caracteres, description 150-160. Si los estiras,
 * Google los trunca en el SERP y el anuncio pierde el gancho.
 */
const SEO_TITLE = 'Software para psicólogos en Chile | Ficha clínica — Dairi';
const SEO_DESCRIPTION = 'Software para psicólogos en Chile: ficha clínica psicológica, notas de proceso privadas, escalas PHQ-9 y GAD-7, agenda online y pago con tarjeta. Plan gratis y plan Pro desde $6.990 al mes. También medicina, odontología, kinesiología y 5 especialidades más.';
const SEO_URL = 'https://dairi.cl/';
const SEO_IMAGE = 'https://dairi.cl/og-image.png';
const SEO_IMAGE_ALT = 'Ficha clínica psicológica de Dairi mostrando la trayectoria de PHQ-9, las tareas intersesión y una nota de proceso privada';

/**
 * Preguntas frecuentes. Fuente única para la sección visible del template y para
 * el JSON-LD de FAQPage: Google descalifica el rich result si el schema declara
 * texto que no está en la página, así que no se pueden editar por separado.
 */
export interface FaqItem { q: string; a: string; }

const FAQ_ITEMS: FaqItem[] = [
  {
    q: '¿Sirve Dairi para un psicólogo que atiende solo, en consulta particular?',
    a: 'Sí. El plan Pro está pensado para eso: un profesional (hasta tres) con la ficha psicológica completa, agenda online, reserva y pago por parte del paciente, y videoconsulta. El plan Starter es gratis sin vencimiento si por ahora solo necesitas ordenar la agenda.'
  },
  {
    q: '¿Qué son las notas de proceso y en qué se diferencian de la ficha clínica?',
    a: 'La ficha clínica es el registro oficial del paciente y la comparten los profesionales que lo atienden. Las notas de proceso son tu cuaderno de trabajo: hipótesis, impresiones y lo que aún no corresponde registrar. En Dairi viven en un espacio aparte que solo puede leer quien las escribió, y quedan excluidas de todo lo que procesa la IA.'
  },
  {
    q: '¿Puedo aplicar PHQ-9 y GAD-7 dentro de la plataforma?',
    a: 'Sí. Se aplican ítem por ítem dentro de la ficha, Dairi calcula el puntaje, indica el rango de severidad y grafica la trayectoria de todas las aplicaciones anteriores. Son instrumentos de tamizaje: la interpretación clínica siempre la hace el profesional.'
  },
  {
    q: '¿Los informes que genera la IA se pueden presentar directamente?',
    a: 'No. Dairi genera un borrador a partir de la información de la ficha —para tribunal de familia, establecimiento educacional, licencia médica o avance terapéutico— y lo entrega rotulado como borrador. Debe ser revisado, corregido y firmado por el profesional antes de cualquier uso. Dairi no emite documentos clínicos ni opiniones profesionales.'
  },
  {
    q: '¿Cuánto cuesta y hay costos ocultos?',
    a: 'El plan Starter es gratis y no vence. El plan Pro cuesta $6.990 al mes e incluye ficha clínica, IA, cobro online y app móvil. El plan Enterprise se cotiza según el tamaño del centro. Lo único que se suma es una comisión sobre los cobros que proceses en línea: 4% en Starter, 3% en Pro y 1% en Enterprise. Si no cobras online, no la pagas.'
  },
  {
    q: '¿Dairi sirve para otras especialidades además de psicología?',
    a: 'Sí. Dairi tiene fichas específicas para nueve especialidades: psicología, medicina general, odontología, kinesiología, nutrición, fonoaudiología, terapia ocupacional, matronería y tecnología médica. En el plan Enterprise conviven varias en la misma cuenta.'
  },
  {
    q: '¿Qué pasa con la confidencialidad de los datos de mis pacientes?',
    a: 'Las fichas clínicas se guardan con cifrado AES-256-GCM y la clave la controlas tú, de modo que el equipo de Dairi no puede leer ese contenido. Todo el tráfico va por HTTPS y cada profesional accede solo a sus propios pacientes, con la restricción aplicada en el servidor. La arquitectura sigue los principios de la Ley N° 21.719 de Protección de Datos Personales.'
  },
  {
    q: '¿Cuánto demora empezar y necesito tarjeta de crédito?',
    a: 'Creas la cuenta con tu correo y entras de inmediato, sin tarjeta. Los planes pagos incluyen 30 días de prueba completa y puedes cancelar cuando quieras. También puedes cargar tus pacientes desde una planilla en vez de escribirlos uno por uno.'
  }
];

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
      audience: {
        '@type': 'Audience',
        audienceType: 'Psicólogos, psicoterapeutas y profesionales de la salud en Chile'
      },
      featureList: [
        'Ficha clínica psicológica', 'Notas de proceso privadas del terapeuta, separadas de la ficha oficial',
        'Escalas PHQ-9 y GAD-7 con puntuación automática y trayectoria en el tiempo',
        'Tareas intersesión con seguimiento de cumplimiento', 'Registro diario de ánimo del paciente',
        'Resumen previo a la sesión generado por IA (borrador sujeto a revisión profesional)',
        'Borradores de informe psicológico con IA: tribunal de familia, establecimiento educacional, licencia médica y avance terapéutico (requieren revisión y firma profesional)',
        'Plan gratis de agenda de citas para 1 profesional', 'Gestión de pacientes', 'Calendario de citas',
        'Fichas clínicas especializadas (9 especialidades)',
        'Reserva online con pago seguro con tarjeta', 'Transcripción de consultas con IA (Deepgram Nova-3)',
        'Sincronización con Google Calendar y Google Meet', 'Videoconsulta',
        'Reportes clínicos y comisiones', 'Presupuestos con cobro online',
        'Chat interno con asistente IA Dairi', 'Privacidad por profesional aplicada en servidor',
        'Cifrado AES-256-GCM de fichas clínicas',
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
      mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a }
      }))
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

  /** Fuente única de las FAQ: la sección visible y el JSON-LD de FAQPage salen de acá. */
  readonly faqItems = FAQ_ITEMS;

  /** Arranca en la ficha psicológica: es la oferta insignia y el destino de las
   *  campañas de búsqueda con intención "software psicólogos". */
  activeView = 'psico';
  private rotateInterval?: ReturnType<typeof setInterval>;
  private readonly ROTATE_VIEWS = ['psico', 'citas', 'ficha', 'dashboard'];
  private rotateIdx = 0;

  /** Canonical que traía index.html, para restaurarlo al salir de la landing. */
  private previousCanonical?: string;

  setActiveView(view: string): void {
    this.activeView = view;
    this.rotateIdx  = this.ROTATE_VIEWS.indexOf(view);
    if (this.rotateInterval) { clearInterval(this.rotateInterval); this.rotateInterval = undefined; }
  }

  ngOnInit(): void {
    this.titleSvc.setTitle(SEO_TITLE);

    this.metaSvc.updateTag({ name: 'description',        content: SEO_DESCRIPTION });
    this.metaSvc.updateTag({ name: 'robots',             content: 'index, follow, max-snippet:-1, max-image-preview:large' });
    this.metaSvc.updateTag({ name: 'keywords',           content: 'software para psicólogos Chile, ficha clínica psicológica, agenda online psicólogos, software gestión consulta psicológica, software clínico Chile, ficha clínica electrónica, PHQ-9, GAD-7, reserva de horas online, software para psicoterapia' });

    this.metaSvc.updateTag({ property: 'og:type',        content: 'website' });
    this.metaSvc.updateTag({ property: 'og:locale',      content: 'es_CL' });
    this.metaSvc.updateTag({ property: 'og:site_name',   content: 'Dairi' });
    this.metaSvc.updateTag({ property: 'og:title',       content: SEO_TITLE });
    this.metaSvc.updateTag({ property: 'og:description', content: SEO_DESCRIPTION });
    this.metaSvc.updateTag({ property: 'og:url',         content: SEO_URL });
    this.metaSvc.updateTag({ property: 'og:image',       content: SEO_IMAGE });
    this.metaSvc.updateTag({ property: 'og:image:alt',   content: SEO_IMAGE_ALT });
    this.metaSvc.updateTag({ property: 'og:image:width',  content: '1200' });
    this.metaSvc.updateTag({ property: 'og:image:height', content: '630' });

    this.metaSvc.updateTag({ name: 'twitter:card',        content: 'summary_large_image' });
    this.metaSvc.updateTag({ name: 'twitter:title',       content: SEO_TITLE });
    this.metaSvc.updateTag({ name: 'twitter:description', content: SEO_DESCRIPTION });
    this.metaSvc.updateTag({ name: 'twitter:image',       content: SEO_IMAGE });
    this.metaSvc.updateTag({ name: 'twitter:image:alt',   content: SEO_IMAGE_ALT });

    // Canonical. index.html trae uno apuntando a app.dairi.cl (el host de la
    // aplicación); dejarlo así en la landing le pide a Google que indexe otra URL
    // en vez de esta, que es la que reciben los anuncios. Se sobreescribe acá y
    // ngOnDestroy lo devuelve a su valor original al salir de la ruta.
    const canonical = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) {
      this.previousCanonical = canonical.href;
      canonical.href = SEO_URL;
    }

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
    if (this.previousCanonical !== undefined) {
      const canonical = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (canonical) canonical.href = this.previousCanonical;
      this.previousCanonical = undefined;
    }
  }
}
