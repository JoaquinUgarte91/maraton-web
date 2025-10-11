document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  if (!form) { console.error('No se encontró #login-form'); return; }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value; // password no se trimmea normalmente

    // Credenciales de prueba (cambiá por las reales si hace falta)
    const validUsername = 'admin';
    const validPassword = '123456';

    if (username === validUsername && password === validPassword) {
      // Ruta ABSOLUTA al panel
      location.assign(`${location.origin}/maraton/adminInicio/inicio.html`);
    } else {
      document.getElementById('error-message').textContent =
        'Usuario o contraseña incorrectos';
    }
  });
});
