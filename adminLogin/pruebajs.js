document.getElementById('login-form').addEventListener('submit', function(event) {
    event.preventDefault();

    // Obtener valores del formulario
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Simulamos un login con usuario y contraseña predefinidos
    const validUsername = "admin";
    const validPassword = "123456";

    // Validación simple
    if (username === validUsername && password === validPassword) {
        // Aquí puedes redirigir a otra página o hacer lo que sea necesario al iniciar sesión
        window.location.href = "../adminInicio/inicio.html";
    } else {
        document.getElementById('error-message').textContent = "Usuario o contraseña incorrectos";
    }
});
