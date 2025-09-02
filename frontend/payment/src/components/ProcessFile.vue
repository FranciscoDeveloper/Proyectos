<script setup>
import { ref } from 'vue';
import axios from 'axios';
defineProps({
  msg: {
    type: String,
    required: true,
  },
});

const archivo = ref(null);
const mensaje = ref("");
const pdfFile = ref("");
// Datos de usuario simulados (podrías pasarlos como props o desde un store)
const usuario = ref({
  nombre: "Luis Abugoch",
  correo: "luis@ejemplo.com"
});

async function enviarArchivo() {
}

function logout() {
    // Aquí podrías implementar la lógica de cierre de sesión
    console.log("Cerrando sesión...");
    // Redirigir a la página de inicio o login
    window.location.href = '/login'; // Cambia esto según tu ruta de login
}

async function handleFileChange(event) {
    const file = event.target.files[0];
    
    if (!file) {
        mensaje.value = "";
        return;
    }

    // Validar tipo de archivo
    if (!file.name.endsWith('.xls') && !file.name.endsWith('.xlsx')) {
        mensaje.value = "Por favor, selecciona un archivo Excel (.xls o .xlsx)";
        return;
    }


    archivo.value = file;
    
    // Validaciones opcionales
    if (file.size > 10 * 1024 * 1024) { // 10MB
        mensaje.value = "El archivo es demasiado grande (máximo 10MB)";
        return;
    }

    const formData = new FormData();
    formData.append('excelFile', file);
    

    try {
        mensaje.value = `Iniciando subida: ${file.name}...`;
        
        const response = await axios.post('http://127.0.0.1:3000/api/process-excel', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            },
            timeout: 30000, // 30 segundos timeout
            onUploadProgress: (progressEvent) => {
                const porcentaje = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                mensaje.value = `Subiendo ${file.name}: ${porcentaje}%`;
            }
        });

        mensaje.value = ` Archivo subido exitosamente: ${file.name}`;
        console.log('Respuesta del servidor:', response.data);
        pdfFile.value = response.data.downloadUrl; // Asumiendo que el servidor devuelve la URL del PDF generado
        
    } catch (error) {
        console.error('Error al subir archivo:', error);
        
        if (axios.isCancel(error)) {
            mensaje.value = 'Subida cancelada';
        } else if (error.code === 'ECONNABORTED') {
            mensaje.value = 'Tiempo de espera agotado - El archivo es muy grande o la conexión es lenta';
        } else if (error.response) {
            // El servidor respondió con un código de error
            const status = error.response.status;
            const serverMessage = error.response.data?.message || 'Error desconocido';
            
            switch (status) {
                case 400:
                    mensaje.value = ` Archivo inválido: ${serverMessage}`;
                    break;
                case 413:
                    mensaje.value = ' El archivo es demasiado grande para el servidor';
                    break;
                case 415:
                    mensaje.value = ' Tipo de archivo no soportado';
                    break;
                case 500:
                    mensaje.value = ' Error interno del servidor';
                    break;
                default:
                    mensaje.value = ` Error del servidor: ${status} - ${serverMessage}`;
            }
        } else if (error.request) {
            mensaje.value = ' Error de conexión - Verifica tu conexión a internet';
        } else {
            mensaje.value = ` Error: ${error.message}`;
        }
        
    }
}


</script>

<template>
  <div class="app-container">
    <!-- Menú superior -->
    <header class="navbar">
      <div class="brand">Mundolab</div>
      <div class="brand"><router-link to="/custodias">Custodias</router-link></div>
      
      <div class="usuario">
        <span>{{ usuario.nombre }}</span>
        <a @click="logout" >cerrar sesion</a>
      </div>
    </header>

    <!-- Área principal -->
    <main class="subida-container">
      <h1 class="titulo">{{ msg }}</h1>

      <div class="subida-box">
        <input type="file" id="excel" accept=".xls,.xlsx" @change="handleFileChange" />
        <a v-show="pdfFile!==''" :href="'http://localhost:3000' + pdfFile"  target="_blank">Ver Pdf Generado!</a>

        <button @click="enviarArchivo"> Enviar archivo</button> <p>a pepe@gmail.com</p>
      </div>
      <p class="mensaje">{{ mensaje }}</p>
    </main>
  </div>

</template>

<style scoped>
.app-container {
  font-family: 'Segoe UI', sans-serif;
  background-color: #f4f6f8;
  min-height: 100vh;
  min-width: 180vh;
}

/* NAVBAR SUPERIOR */
.navbar {
  background-color: #004080;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
}

.brand {
  font-size: 1.3rem;
  font-weight: bold;
}

.usuario {
  text-align: right;
}

.usuario span {
  display: block;
  font-weight: 600;
}

.usuario small {
  font-size: 0.85rem;
  color: #dcdcdc;
}

/* CONTENIDO PRINCIPAL */
.subida-container {
  max-width: 600px;
  margin: 3rem auto;
  padding: 2rem;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
  text-align: center;
}

.titulo {
  font-size: 2rem;
  color: #2c3e50;
  margin-bottom: 2rem;
}

.subida-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

input[type='file'] {
  font-size: 1rem;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  background-color: white;
  width: 100%;
}

button {
  padding: 0.6rem 1.5rem;
  background-color: #2e86de;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
}

button:hover {
  background-color: #1b4f72;
}

.mensaje {
  margin-top: 1rem;
  color: #34495e;
  font-weight: 500;
}
</style>
