const nodemailer = require('nodemailer');
// Configuración del transporte SMTP (ajusta según tu proveedor)
const transporter = nodemailer.createTransport({
  host: 'smtp.tie.com', // Ejemplo: smtp.gmail.com, smtp.office365.com, etc.
  port: 587, // 465 para SSL, 587 para TLS
  secure: false, // true para 465, false para otros puertos
  auth: {
    user: 'luis.abugoch@mundolab.cl',
    pass: '91919191' // Tu contraseña o token de aplicación
  }
});

// Opciones del correo
const mailOptions = {
  from: 'luis.abugoch@mundolab.cl',
  to: 'riquelme.ortiz@gmail.com',
  subject: 'Correo con adjunto',
  text: 'Este correo contiene un archivo adjunto.'
  // html: '<b>Este correo contiene un archivo adjunto.</b>',
  /*,attachments: [
    {
      filename: 'archivo.txt',
      path: './ruta/al/archivo.txt' // Ruta local al archivo
    },
    // Puedes agregar más adjuntos aquí
    // {
    //   filename: 'imagen.png',
    //   path: './ruta/a/imagen.png'
    // }
  ]*/
};

// Enviar el correo
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    return console.error('Error enviando correo:', error);
  }
  console.log('Correo enviado:', info.response);
});