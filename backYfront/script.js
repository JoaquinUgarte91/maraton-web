// Función para inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  inicializarApp();
});

function inicializarApp() {
  // Inicializar el formulario
  const formulario = document.getElementById('formulario');
  if (formulario) {
    formulario.addEventListener('submit', manejarEnvioFormulario);
  }

  // Inicializar validación en tiempo real
  inicializarValidacionEnTiempoReal();

  // Inicializar botón de descarga de QR (si existe)
  const downloadBtn = document.getElementById('download-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', descargarQR);
  }
}

// Validación en tiempo real
function inicializarValidacionEnTiempoReal() {
  const campos = ['nombre', 'dni', 'email', 'carrera'];

  campos.forEach(campo => {
    const elemento = document.getElementById(campo);
    if (elemento) {
      elemento.addEventListener('blur', validarCampo);
      elemento.addEventListener('input', limpiarError);
    }
  });
}

function validarCampo(e) {
  const campo = e.target;
  const errorElement = document.getElementById(`${campo.id}-error`);

  // Limpiar error previo
  if (errorElement) {
    errorElement.style.display = 'none';
  }

  let valido = true;
  let mensaje = '';

  switch (campo.id) {
    case 'nombre':
      if (campo.value.trim().length < 3) {
        mensaje = 'El nombre debe tener al menos 3 caracteres';
        valido = false;
      }
      break;

    case 'dni':
      const dniRegex = /^\d{7,8}$/;
      if (!dniRegex.test(campo.value)) {
        mensaje = 'El DNI debe tener 7 u 8 dígitos';
        valido = false;
      }
      break;

    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(campo.value)) {
        mensaje = 'Por favor ingresa un email válido';
        valido = false;
      }
      break;

    case 'carrera':
      if (campo.value === '') {
        mensaje = 'Por favor selecciona una carrera';
        valido = false;
      }
      break;
  }

  if (!valido && errorElement) {
    errorElement.textContent = mensaje;
    errorElement.style.display = 'block';
    campo.classList.add('error');
  } else {
    campo.classList.remove('error');
  }

  return valido;
}

function limpiarError(e) {
  const campo = e.target;
  const errorElement = document.getElementById(`${campo.id}-error`);

  if (errorElement) {
    errorElement.style.display = 'none';
  }

  campo.classList.remove('error');
}

// Manejo del envío del formulario
function manejarEnvioFormulario(e) {
  e.preventDefault();

  // Validar todos los campos
  const camposValidos = ['nombre', 'dni', 'email', 'carrera']
    .map(campo => validarCampo({ target: document.getElementById(campo) }))
    .every(valido => valido);

  if (!camposValidos) {
    mostrarMensaje('Por favor corrige los errores en el formulario', 'error');
    return;
  }

  // Obtener los valores del formulario (normalizados)
  const nombre = document.getElementById('nombre').value.trim();
  const dni = document.getElementById('dni').value.replace(/\D+/g, ''); // solo dígitos
  const email = document.getElementById('email').value.trim();
  const carrera = document.getElementById('carrera').value.toUpperCase(); // "2K"/"5K"

  // Mostrar estado de carga
  mostrarCarga(true);

  // Enviar datos al servidor
  enviarDatosAlServidor({ nombre, dni, email, carrera });
}

async function enviarDatosAlServidor(datos) {
  const API_URL = '/api/procesar.php'; // ruta ABSOLUTA a tu endpoint PHP

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });

    const ct = res.headers.get('content-type') || '';
    const payload = ct.includes('application/json')
      ? await res.json()
      : { success: false, message: await res.text() }; // si hubiera HTML por error

    // Ocultar spinner
    mostrarCarga(false);

    if (!res.ok || !payload.success) {
      // Mensaje claro desde el backend (409 = DNI duplicado, etc.)
      const msg = payload.message || `Error ${res.status}: No se pudo registrar`;
      mostrarMensaje(msg, 'error');
      return;
    }

    // OK: generar QR con lo que devolvió la API
    const qrData = payload.qr_data
      || `ID: ${payload.inscripcion_id}\nNombre: ${datos.nombre}\nDNI: ${datos.dni}\nEmail: ${datos.email}\nCarrera: ${datos.carrera}`;

    generarQR(qrData);
    mostrarMensaje('¡Inscripción exitosa! Tu QR ha sido generado.', 'success');

    // Enviar el QR por email (PNG capturado del canvas)
    await enviarQrPorEmail({
      email: datos.email,
      nombre: datos.nombre,
      dni: datos.dni,
      carrera: datos.carrera,
      qrTexto: qrData
    });

    // (Opcional) limpiar formulario
    document.getElementById('formulario').reset();

  } catch (err) {
    mostrarCarga(false);
    mostrarMensaje(`Error de red: ${err.message}`, 'error');
  }
}

function mostrarCarga(mostrar) {
  const loadingElement = document.getElementById('loading');
  const submitBtn = document.getElementById('submit-btn');

  if (loadingElement) {
    loadingElement.classList.toggle('hidden', !mostrar);
  }

  if (submitBtn) {
    submitBtn.disabled = mostrar;
  }
}

function generarQR(datos) {
  const qrContainer = document.getElementById('qr-container');
  const qrElement = document.getElementById('qr');

  // Limpiar contenedor QR previo
  qrElement.innerHTML = '';

  // Generar nuevo QR
  new QRCode(qrElement, {
    text: datos,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });

  // Mostrar contenedor QR
  qrContainer.classList.remove('hidden');

  // Hacer scroll suave al QR
  qrContainer.scrollIntoView({ behavior: 'smooth' });
}

// Enviar el QR generado (canvas) por email al backend
async function enviarQrPorEmail({ email, nombre, dni, carrera, qrTexto }) {
  try {
    // Asegurar que el canvas ya esté renderizado
    await new Promise(r => requestAnimationFrame(r));

    const canvas = document.querySelector('#qr canvas');
    if (!canvas) {
      console.warn('No se encontró el canvas del QR.');
      return;
    }

    const qrPngDataUrl = canvas.toDataURL('image/png'); // "data:image/png;base64,..."

    const res = await fetch('/api/enviar_qr.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        name: nombre,
        dni,
        carrera,
        qr_png_base64: qrPngDataUrl,
        // te dejo también el texto por si algún día querés usarlo en el cuerpo
        qr_texto: qrTexto
      })
    });

    const ct = res.headers.get('content-type') || '';
    const payload = ct.includes('application/json')
      ? await res.json()
      : { success: false, message: await res.text() };

    if (!res.ok || !payload.success) {
      console.warn('No se pudo enviar el email con el QR:', payload.message || res.status);
    } else {
      console.log('Email con QR enviado a', email);
    }
  } catch (err) {
    console.warn('Error al enviar email QR:', err);
  }
}

function guardarInscripcion(datos) {
  // En un entorno real, esto se guardaría en la base de datos
  // Por ahora usamos localStorage para persistencia
  let inscripciones = JSON.parse(localStorage.getItem('inscripciones_maraton')) || [];
  inscripciones.push(datos);
  localStorage.setItem('inscripciones_maraton', JSON.stringify(inscripciones));
}

function descargarQR() {
  const canvas = document.querySelector('#qr canvas');
  if (!canvas) {
    mostrarMensaje('No hay QR para descargar', 'error');
    return;
  }

  try {
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = 'qr_maraton_ituzaingo.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error al descargar QR:', error);
    mostrarMensaje('Error al descargar el QR', 'error');
  }
}

// Función para agregar evento al calendario
function agregarACalendario() {
  const fechaEvento = '2023-11-12T09:00:00';
  const titulo = 'Maratón Ituzaingó';
  const ubicacion = 'Plaza Central de Ituzaingó';
  const detalles = '¡No te pierdas la Maratón Anual de Ituzaingó! Inscripciones abiertas.';

  // Formato para Google Calendar
  const startDate = new Date(fechaEvento).toISOString().replace(/-|:|\.\d+/g, '');
  const endDate = new Date(new Date(fechaEvento).getTime() + 2 * 60 * 60 * 1000).toISOString().replace(/-|:|\.\d+/g, '');

  const googleCalendarUrl = `https://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(titulo)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(detalles)}&location=${encodeURIComponent(ubicacion)}`;

  window.open(googleCalendarUrl, '_blank');
}

// Función para mostrar mensajes de estado
function mostrarMensaje(mensaje, tipo = 'info') {
  // Crear elemento de mensaje si no existe
  let mensajeElement = document.getElementById('mensaje-global');

  if (!mensajeElement) {
    mensajeElement = document.createElement('div');
    mensajeElement.id = 'mensaje-global';
    mensajeElement.style.position = 'fixed';
    mensajeElement.style.top = '20px';
    mensajeElement.style.right = '20px';
    mensajeElement.style.padding = '15px 20px';
    mensajeElement.style.borderRadius = '5px';
    mensajeElement.style.zIndex = '1000';
    mensajeElement.style.maxWidth = '300px';
    mensajeElement.style.transition = 'opacity 0.3s ease';
    document.body.appendChild(mensajeElement);
  }

  // Establecer color según tipo
  let colorFondo, colorTexto;
  switch (tipo) {
    case 'success':
      colorFondo = '#4caf50';
      break;
    case 'error':
      colorFondo = '#f44336';
      break;
    case 'warning':
      colorFondo = '#ff9800';
      break;
    default:
      colorFondo = '#2196f3';
  }
  colorTexto = '#ffffff';

  mensajeElement.style.backgroundColor = colorFondo;
  mensajeElement.style.color = colorTexto;
  mensajeElement.textContent = mensaje;
  mensajeElement.style.display = 'block';
  mensajeElement.style.opacity = '1';

  // Ocultar después de 5 segundos
  setTimeout(() => {
    mensajeElement.style.opacity = '0';
    setTimeout(() => {
      mensajeElement.style.display = 'none';
    }, 300);
  }, 5000);
}

// Hacer funciones accesibles globalmente para los onclick en HTML
window.agregarACalendario = agregarACalendario;
