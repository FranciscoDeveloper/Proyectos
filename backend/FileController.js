const nodemailerClient = require('./Nodemailer');
const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Validar que sea un archivo Excel
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'), false);
    }
  }
});

// Directorio para almacenar PDFs generados
const pdfDir = 'generated-pdfs/';
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

// Función para leer el archivo Excel
function readExcelFile(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    const result = {};
    
    // Iterar sobre todas las hojas del archivo
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(worksheet, { 
        header: 1, // Usar índices numéricos como headers
        defval: '' // Valor por defecto para celdas vacías
      });
      
      result[sheetName] = {
        data: jsonData,
        range: worksheet['!ref'] || 'A1:A1'
      };
    });
    
    return result;
  } catch (error) {
    throw new Error(`Error al leer el archivo Excel: ${error.message}`);
  }
}



function buscarEnExcel(filePath, pestana, filaExcel, columnExcel) {
  const workbook = xlsx.readFile(filePath);
  // pestana es 1-based, igual que en C#
  const sheetNames = workbook.SheetNames;
  const sheetName = sheetNames[pestana];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return null;

  // columnExcel es 1-based, convertir a letra de columna
  const letraColumna = xlsx.utils.encode_col(columnExcel - 1);
  const cellAddress = `${letraColumna}${filaExcel}`;
  const cell = worksheet[cellAddress];
  return cell?.v?.toString() ?? null;
}

function vlookup(rutaExcel, pestana, word, columnExcel) {
  const workbook = xlsx.readFile(rutaExcel);
  // Obtener el nombre de la hoja por índice (pestana es 1-based en C#, 0-based en JS)
  const sheetNames = workbook.SheetNames;
  const sheetName = sheetNames[pestana];
  console.info(`Buscando en la hoja: ${sheetName}`);
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return null;

  // Recorrer desde la fila 5 hasta la 188
  for (let fila = 5; fila <= 188; fila++) {
    // Columna 2 es la columna B en Excel (A=1, B=2)
    const celdaBusqueda = worksheet[`B${fila}`];
    const valorBusqueda = celdaBusqueda?.v?.toString();
    if (valorBusqueda === word) {
      // columnExcel es 1-based (como en C#), convertir a letra de columna
      const letraColumna = xlsx.utils.encode_col(columnExcel - 1);
      const celdaResultado = worksheet[`${letraColumna}${fila}`];
      return celdaResultado?.v?.toString() ?? null;
    }
  }
  return null;
}

// Endpoint para procesar archivo Excel y generar PDF
app.post('/api/process-excel', upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No se proporcionó archivo Excel' 
      });
    }
    
    const filePath = req.file.path;
    const fileName = req.file.filename;
    console.info(`Archivo recibido: ${fileName}` + ` (${req.file.size} bytes)`);
    console.info(`Ruta del archivo: ${filePath}`);
    // Leer el archivo Excel
    const excelData = buscarEnExcel(req.file.path,7,16,2)
    const result = vlookup(req.file.path, 6, excelData, 7);
    // Generar nombre único para el PDF    
    const pdfFileName = `report-${Date.now()}.pdf`;
    const pdfPath = path.join(pdfDir, pdfFileName);
    console.info(`Generando PDF: ${result}`);
    // Generar PDF
    await replaceTextInPDF('result.pdf', pdfPath, 'Euro', result);
    
    // Limpiar archivo Excel temporal
    fs.unlinkSync(filePath);
    
    // Respuesta con información del procesamiento
    res.json({
      success: true,
      message: 'Archivo Excel procesado correctamente',
      pdfFileName: pdfFileName,
      downloadUrl: `/api/download/${pdfFileName}`
    });
    
  } catch (error) {
    console.error('Error procesando archivo:', error);
    
    // Limpiar archivo si existe
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'Error procesando el archivo Excel',
      details: error.message
    });
  }
});

// Endpoint para descargar PDF generado
app.get('/api/download/:fileName', (req, res) => {
  try {
    const fileName = req.params.fileName;
    const filePath = path.join(pdfDir, fileName);
    
    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Archivo no encontrado'
      });
    }
    
    // Verificar que es un archivo PDF
    if (!fileName.endsWith('.pdf')) {
      return res.status(400).json({
        error: 'Archivo no válido'
      });
    }
    //attachment es en vez de inline es para forzar la descarga del archivo
    // Configurar headers para descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    
    // Enviar archivo
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error descargando archivo:', error);
    res.status(500).json({
      error: 'Error al descargar el archivo',
      details: error.message
    });
  }
});

// Endpoint para listar archivos PDF disponibles
app.get('/api/files', (req, res) => {
  try {
    const files = fs.readdirSync(pdfDir)
      .filter(file => file.endsWith('.pdf'))
      .map(file => {
        const filePath = path.join(pdfDir, file);
        const stats = fs.statSync(filePath);
        return {
          fileName: file,
          downloadUrl: `/api/download/${file}`,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    res.json({
      success: true,
      files: files,
      total: files.length
    });
    
  } catch (error) {
    console.error('Error listando archivos:', error);
    res.status(500).json({
      error: 'Error al listar archivos',
      details: error.message
    });
  }
});

// Endpoint de salud del servidor
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

async function replaceTextInPDF(inputPath, outputPath, searchText, replaceText) {
  // Leer el PDF original
  const existingPdfBytes = fs.readFileSync(inputPath);

  // Cargar el PDF
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  // Fuente para escribir el texto nuevo
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Iterar sobre todas las páginas
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();

    // Extraer el contenido de la página como texto (no es perfecto, pero sirve para buscar)
    const textContent = await page.getTextContent?.();
    // pdf-lib no tiene getTextContent, así que debes saber la posición aproximada del texto "Euro"
    // Aquí un ejemplo de cómo tapar y escribir encima en una posición fija (ajusta según tu PDF):

    // Ejemplo: tapar y escribir en la posición (x, y)
    // Si sabes que "Euro" está en (100, 200):
    const x = 208;
    const y = 532;

    // Tapar el texto original con un rectángulo blanco
    page.drawRectangle({
      x,
      y,
      width: 66,
      height: 11,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    });

    // Escribir el texto nuevo encima
    page.drawText(replaceText, {
      x,
      y,
      size: 11,
      font,
      color: rgb(0, 0.53, 0.71)
    });
  }

  // Guardar el PDF modificado
  const pdfBytes = await pdfDoc.save();
const fs2 = require('fs-extra');
await fs2.outputFile(outputPath, pdfBytes);
console.log('PDF guardado correctamente');
}

// Ejemplo de uso:
// await replaceTextInPDF('result.pdf', 'result_modificado.pdf', 'Euro', 'Dólar');
// Middleware para manejo de errores
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Archivo demasiado grande'
      });
    }
  }
  
  console.error('Error no manejado:', error);
  res.status(500).json({
    error: 'Error interno del servidor'
  });
});




// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
  console.log(`Endpoints disponibles:`);
  console.log(`- POST /api/process-excel - Procesar archivo Excel`);
  console.log(`- GET /api/download/:fileName - Descargar PDF`);
  console.log(`- GET /api/files - Listar archivos PDF`);
  console.log(`- GET /api/health - Estado del servidor`);
});

module.exports = app;