import { Injectable } from '@angular/core';

export interface SpecialtyMatch {
  specialty:   string;
  description: string;
  emoji:       string;
  score:       number;
}

interface SpecialtyEntry {
  name:        string;
  description: string;
  emoji:       string;
  keywords:    string[];
}

const SPECIALTIES: SpecialtyEntry[] = [
  {
    name:        'Cardiología',
    emoji:       '❤️',
    description: 'especialista en corazón y sistema cardiovascular',
    keywords: [
      'corazon', 'dolor pecho', 'dolor en el pecho', 'opresion en el pecho', 'pecho',
      'palpitaciones', 'taquicardia', 'bradicardia', 'hipertension', 'presion alta',
      'presion baja', 'hipotension', 'infarto', 'angina', 'ahogo', 'falta de aire',
      'disnea', 'arritmia', 'soplo cardiaco', 'colesterol', 'trigliceridos',
      'aterosclerosis', 'trombosis', 'embolia', 'insuficiencia cardiaca',
      'ritmo cardiaco', 'latidos fuertes', 'latidos irregulares'
    ]
  },
  {
    name:        'Dermatología',
    emoji:       '🧴',
    description: 'especialista en piel, cabello y uñas',
    keywords: [
      'piel', 'acne', 'granos', 'sarpullido', 'ronchas', 'manchas en la piel',
      'manchas', 'urticaria', 'psoriasis', 'eczema', 'dermatitis', 'picazon',
      'comezon', 'rasquina', 'verrugas', 'lunar', 'herpes piel', 'hongos',
      'unas amarillas', 'alopecia', 'caida del cabello', 'caida de cabello',
      'rosacea', 'vitiligo', 'quiste', 'seborrea', 'erupcion', 'ampollas',
      'piel reseca', 'piel seca', 'caspa', 'sarpullido', 'piel escamosa'
    ]
  },
  {
    name:        'Neurología',
    emoji:       '🧠',
    description: 'especialista en cerebro y sistema nervioso',
    keywords: [
      'dolor de cabeza', 'dolor cabeza', 'jaqueca', 'migrana', 'mareo', 'vertigo',
      'convulsion', 'convulsiones', 'epilepsia', 'hormigueo', 'entumecimiento',
      'adormecimiento', 'temblor', 'temblores', 'perdida de memoria', 'olvidos',
      'alzheimer', 'parkinson', 'desmayo', 'desmayos', 'sincope', 'paralisis',
      'debilidad muscular', 'esclerosis', 'tic nervioso', 'cefalea', 'neuralgia',
      'mareos constantes', 'desequilibrio', 'confusion mental', 'perdida conciencia'
    ]
  },
  {
    name:        'Traumatología',
    emoji:       '🦴',
    description: 'especialista en huesos, articulaciones y lesiones',
    keywords: [
      'hueso', 'fractura', 'rodilla', 'cadera', 'columna', 'espalda',
      'dolor de espalda', 'lumbar', 'cervical', 'hombro', 'codo', 'muneca',
      'tobillo', 'articulacion', 'dolor articular', 'desgarro', 'luxacion',
      'tendon', 'ligamento', 'menisco', 'cartilago', 'contusion', 'golpe',
      'torcedura', 'esguince', 'cifosis', 'escoliosis', 'osteoporosis',
      'hernia de disco', 'ciatica', 'dolor en la rodilla', 'dolor en la cadera',
      'dolor en el hombro', 'dolor de rodilla', 'dolor de cadera'
    ]
  },
  {
    name:        'Ginecología',
    emoji:       '🌸',
    description: 'especialista en salud femenina',
    keywords: [
      'menstruacion', 'regla', 'periodo menstrual', 'ciclo menstrual', 'embarazo',
      'ovario', 'utero', 'vaginal', 'flujo vaginal', 'menopausia', 'anticonceptivos',
      'papanicolau', 'pap smear', 'mamografia', 'seno', 'mama', 'quiste ovarico',
      'fibromas', 'endometriosis', 'fertilidad', 'infertilidad', 'infeccion vaginal',
      'dolor menstrual', 'irregularidad menstrual', 'femenino', 'mujer'
    ]
  },
  {
    name:        'Psiquiatría',
    emoji:       '💭',
    description: 'especialista en salud mental',
    keywords: [
      'depresion', 'deprimido', 'deprimida', 'tristeza profunda', 'tristeza',
      'ansiedad', 'ansioso', 'ansiosa', 'panico', 'ataque de panico', 'estres',
      'estresado', 'angustia', 'insomnio', 'no puedo dormir', 'dormir mal',
      'bipolar', 'esquizofrenia', 'alucinaciones', 'pensamientos suicidas',
      'fobia', 'trastorno mental', 'llanto', 'lloro sin razon', 'irritabilidad',
      'agresividad', 'adiccion', 'alcoholismo', 'anorexia', 'bulimia', 'obsesion',
      'compulsion', 'salud mental', 'crisis emocional', 'nervios', 'nerviosismo',
      'trastorno de ansiedad', 'trastorno depresivo'
    ]
  },
  {
    name:        'Oftalmología',
    emoji:       '👁️',
    description: 'especialista en ojos y visión',
    keywords: [
      'ojo', 'ojos', 'vista', 'vision borrosa', 'ver mal', 'borroso',
      'nublado', 'glaucoma', 'cataratas', 'conjuntivitis', 'irritacion ocular',
      'lagrimeo', 'dolor de ojos', 'ojos rojos', 'orzuelo', 'miopia',
      'hipermetropia', 'astigmatismo', 'presbicia', 'fotofobia', 'sequedad ocular',
      'ojo rojo', 'vision doble', 'problemas de vision', 'problemas ojos'
    ]
  },
  {
    name:        'Otorrinolaringología',
    emoji:       '👂',
    description: 'especialista en oído, nariz y garganta',
    keywords: [
      'oido', 'oidos', 'audicion', 'nariz', 'garganta', 'sinusitis', 'amigdalas',
      'amigdalitis', 'ronquidos', 'apnea', 'zumbido en los oidos', 'tinnitus',
      'voz', 'disfonia', 'polipos nasales', 'rinitis', 'otitis', 'sordera',
      'tapon de cera', 'dolor de garganta', 'faringitis', 'laringitis', 'adenoides',
      'sangrado nasal', 'congestion nasal', 'moco', 'dolor en el oido',
      'infeccion de oido', 'no escucho bien', 'zumbido'
    ]
  },
  {
    name:        'Gastroenterología',
    emoji:       '🏥',
    description: 'especialista en sistema digestivo',
    keywords: [
      'estomago', 'barriga', 'abdomen', 'dolor abdominal', 'dolor de estomago',
      'diarrea', 'estrenimiento', 'reflujo', 'gastritis', 'ulcera', 'colon',
      'intestino', 'higado', 'hepatitis', 'nauseas', 'vomitos', 'acidez',
      'colitis', 'colon irritable', 'indigestion', 'gases', 'hinchazon abdominal',
      'hemorroides', 'sangre en heces', 'heces negras', 'pancreatitis',
      'vesicula', 'calculos biliares', 'ictericia', 'cirrosis', 'dispepsia',
      'flatulencias', 'mala digestion', 'dolor al comer'
    ]
  },
  {
    name:        'Urología',
    emoji:       '💧',
    description: 'especialista en vías urinarias',
    keywords: [
      'orina', 'orinar', 'rinon', 'rinones', 'vejiga', 'prostata',
      'infeccion urinaria', 'ardor al orinar', 'frecuencia urinaria',
      'calculos renales', 'piedras en el rinon', 'testiculo', 'incontinencia',
      'retencion de orina', 'sangre en la orina', 'cistitis', 'pielonefritis',
      'insuficiencia renal', 'ganas de orinar', 'no puedo orinar'
    ]
  },
  {
    name:        'Endocrinología',
    emoji:       '⚗️',
    description: 'especialista en hormonas y metabolismo',
    keywords: [
      'tiroides', 'hipotiroidismo', 'hipertiroidismo', 'diabetes', 'azucar alta',
      'azucar en la sangre', 'glucosa alta', 'insulina', 'hormona', 'hormonas',
      'sobrepeso', 'obesidad', 'metabolismo lento', 'cansancio extremo',
      'cortisol', 'bocio', 'tiroxina', 'ovario poliquistico',
      'resistencia a la insulina', 'sindrome metabolico', 'glucemia alta',
      'bajar de peso', 'subir de peso sin razon'
    ]
  },
  {
    name:        'Neumología',
    emoji:       '💨',
    description: 'especialista en pulmones y respiración',
    keywords: [
      'pulmon', 'pulmones', 'tos cronica', 'tos persistente', 'asma', 'bronquitis',
      'neumonia', 'dificultad para respirar', 'respirar mal', 'bronquio', 'esputo',
      'sibilancias', 'silbido al respirar', 'tuberculosis', 'enfisema', 'epoc',
      'fibrosis pulmonar', 'congestion pulmonar', 'me cuesta respirar',
      'falta de aire al caminar'
    ]
  },
  {
    name:        'Reumatología',
    emoji:       '🤲',
    description: 'especialista en enfermedades autoinmunes y articulaciones',
    keywords: [
      'reumatismo', 'artritis reumatoide', 'lupus', 'fibromialgia',
      'dolor articular cronico', 'rigidez matutina', 'rigidez al despertar',
      'inflamacion de articulaciones', 'gota', 'espondilitis',
      'dolor en multiples articulaciones', 'artritis', 'articulaciones inflamadas'
    ]
  },
  {
    name:        'Pediatría',
    emoji:       '👶',
    description: 'especialista en salud infantil',
    keywords: [
      'nino', 'nina', 'bebe', 'infante', 'hijo', 'hija', 'pediatra', 'menor',
      'recien nacido', 'lactante', 'infantil', 'desarrollo del nino', 'vacunas',
      'mi hijo', 'mi hija', 'mi bebe', 'el nino', 'la nina', 'nino enfermo',
      'nina enferma', 'bebe enfermo', 'fiebre en nino'
    ]
  },
  {
    name:        'Medicina General',
    emoji:       '🩺',
    description: 'médico general para consulta y atención primaria',
    keywords: [
      'chequeo medico', 'revision general', 'examenes generales', 'certificado medico',
      'medicina general', 'medico general', 'control medico', 'malestar general',
      'gripe', 'resfriado', 'catarro', 'fiebre', 'cansancio', 'fatiga general',
      'no se que tengo', 'control rutinario', 'examen preventivo'
    ]
  }
];

@Injectable({ providedIn: 'root' })
export class SymptomAnalyzerService {

  analyze(rawText: string): SpecialtyMatch | null {
    const text = this.normalize(rawText);
    const scores: { entry: SpecialtyEntry; score: number }[] = [];

    for (const entry of SPECIALTIES) {
      let score = 0;
      for (const kw of entry.keywords) {
        const normKw = this.normalize(kw);
        if (kw.includes(' ')) {
          // Multi-word phrase → higher weight
          if (text.includes(normKw)) score += 3;
        } else {
          // Single word: prefer word-boundary match
          const boundary = new RegExp(`\\b${this.escapeRegex(normKw)}\\b`);
          if (boundary.test(text)) score += 1;
          else if (text.includes(normKw)) score += 0.4;
        }
      }
      if (score > 0) scores.push({ entry, score });
    }

    if (scores.length === 0) return null;
    scores.sort((a, b) => b.score - a.score);
    const top = scores[0];
    return {
      specialty:   top.entry.name,
      description: top.entry.description,
      emoji:       top.entry.emoji,
      score:       top.score
    };
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
