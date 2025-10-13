// Función para inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
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

// =========================
// Helpers: validación
// =========================
function inicializarValidacionEnTiempoReal() {
  const campos = ['nombre', 'dni', 'email', 'carrera'];
  campos.forEach((campo) => {
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

  if (errorElement) errorElement.style.display = 'none';

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
      if (!/^\d{7,8}$/.test(campo.value)) {
        mensaje = 'El DNI debe tener 7 u 8 dígitos';
        valido = false;
      }
      break;

    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campo.value)) {
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
  if (errorElement) errorElement.style.display = 'none';
  campo.classList.remove('error');
}

// =========================
// Envío formulario
// =========================
async function manejarEnvioFormulario(e) {
  e.preventDefault();

  // Validar todos los campos
  const camposValidos = ['nombre', 'dni', 'email', 'carrera']
    .map((campo) => validarCampo({ target: document.getElementById(campo) }))
    .every((valido) => valido);

  if (!camposValidos) {
    mostrarMensaje('Por favor corrige los errores en el formulario', 'error');
    return;
  }

  // Obtener valores normalizados
  const nombre = document.getElementById('nombre').value.trim();
  const dni = document.getElementById('dni').value.replace(/\D+/g, '');
  const email = document.getElementById('email').value.trim();
  const carrera = document.getElementById('carrera').value.toUpperCase();

  // Mostrar estado de carga
  mostrarCarga(true);

  // Enviar datos al servidor
  await enviarDatosAlServidor({ nombre, dni, email, carrera });
}

async function enviarDatosAlServidor(datos) {
  const API_URL = '/api/procesar.php';

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });

    const ct = res.headers.get('content-type') || '';
    const payload = ct.includes('application/json')
      ? await res.json()
      : { success: false, message: await res.text() };

    mostrarCarga(false);

    if (!res.ok || !payload.success) {
      const msg = payload.message || `Error ${res.status}: No se pudo registrar`;
      mostrarMensaje(msg, 'error');
      return;
    }

    // OK: generar QR con lo que devolvió la API
    const qrData =
      payload.qr_data ||
      `ID: ${payload.inscripcion_id}\nNombre: ${datos.nombre}\nDNI: ${datos.dni}\nEmail: ${datos.email}\nCarrera: ${datos.carrera}`;

    // Generar y esperar a que el canvas esté listo
    await generarQR(qrData);

    mostrarMensaje('¡Inscripción exitosa! Tu QR ha sido generado.', 'success');

    // Enviar el QR por email (PNG capturado del canvas, ya renderizado)
    enviarQrPorEmail({
      email: datos.email,
      nombre: datos.nombre,
      dni: datos.dni,
      carrera: datos.carrera,
      qrTexto: qrData,
    });

    // (Opcional) limpiar formulario
    document.getElementById('formulario').reset();
  } catch (err) {
    mostrarCarga(false);
    mostrarMensaje(`Error de red: ${err.message}`, 'error');
  }
}

// =========================
// Carga visual
// =========================
function mostrarCarga(mostrar) {
  const loadingElement = document.getElementById('loading');
  const submitBtn = document.getElementById('submit-btn');

  if (loadingElement) loadingElement.classList.toggle('hidden', !mostrar);
  if (submitBtn) submitBtn.disabled = mostrar;
}

// =========================
// QR helpers
// =========================

// Espera a que exista el <canvas> del QR y tenga dimensiones
function waitForQrCanvas(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function poll() {
      const canvas = document.querySelector('#qr canvas');
      if (canvas && canvas.width && canvas.height) return resolve(canvas);
      if (Date.now() - t0 > timeoutMs)
        return reject(new Error('QR canvas no apareció a tiempo'));
      requestAnimationFrame(poll);
    })();
  });
}

// Genera el QR y devuelve una promesa que se resuelve cuando el canvas está listo
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
    correctLevel: QRCode.CorrectLevel.H,
  });

  // Mostrar contenedor QR
  qrContainer.classList.remove('hidden');

  // Hacer scroll suave al QR
  qrContainer.scrollIntoView({ behavior: 'smooth' });

  // Esperar a que el canvas se pinte
  return waitForQrCanvas();
}

// Enviar el QR generado (canvas) por email al backend
async function enviarQrPorEmail({ email, nombre, dni, carrera, qrTexto }) {
  try {
    const canvas = await waitForQrCanvas(); // asegurarse que está listo
    const qrPngDataUrl = canvas.toDataURL('image/png'); // "data:image/png;base64,..."

    // ⚠️ Ajustá las claves si tu enviar_qr.php espera otras: p.ej. {to, name, qr_png_base64}
    const res = await fetch('/api/enviar_qr.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,          // o "to"
        nombre,         // o "name"
        dni,
        carrera,
        qr_png: qrPngDataUrl, // o "qr_png_base64"
        qr_texto: qrTexto,
      }),
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

// =========================
// Otros helpers
// =========================
function guardarInscripcion(datos) {
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

  const startDate = new Date(fechaEvento).toISOString().replace(/-|:|\.\d+/g, '');
  const endDate = new Date(new Date(fechaEvento).getTime() + 2 * 60 * 60 * 1000)
    .toISOString()
    .replace(/-|:|\.\d+/g, '');

  const googleCalendarUrl = `https://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(
    titulo
  )}&dates=${startDate}/${endDate}&details=${encodeURIComponent(detalles)}&location=${encodeURIComponent(
    ubicacion
  )}`;

  window.open(googleCalendarUrl, '_blank');
}

// Mensajes flotantes
function mostrarMensaje(mensaje, tipo = 'info') {
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

  let colorFondo;
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

  mensajeElement.style.backgroundColor = colorFondo;
  mensajeElement.style.color = '#ffffff';
  mensajeElement.textContent = mensaje;
  mensajeElement.style.display = 'block';
  mensajeElement.style.opacity = '1';

  setTimeout(() => {
    mensajeElement.style.opacity = '0';
    setTimeout(() => {
      mensajeElement.style.display = 'none';
    }, 300);
  }, 5000);
}

// Hacer funciones accesibles globalmente para los onclick en HTML
window.agregarACalendario = agregarACalendario;
