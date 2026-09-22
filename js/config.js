/* =============================================================
   CONFIGURACIÓN GENERAL — LL Print 3D
   ============================================================= */
window.CONFIG = {
  marca: "LL Print 3D",

  // WhatsApp de contacto (solo números, con código de país)
  whatsapp: "5491138411979",
  telefonoVisible: "+54 9 11 3841-1979",

  // Los pedidos personalizados (con la imagen adjunta) llegan a este correo vía FormSubmit.
  // La primera vez FormSubmit manda un mail de activación: hay que confirmarlo.
  // Después de activarlo, FormSubmit te da un código (ej: "a1b2c3d4...") que podés
  // poner acá en lugar del email para que no quede visible en la página.
  emailPedidos: "leoagustin.2005@gmail.com",

  // Instagram (opcional). Ej: "llprint3d". Dejalo "" para ocultarlo.
  instagram: "",

  // Repositorio de GitHub donde está publicada la página (lo usa el panel admin.html).
  // Si la página está en https://USUARIO.github.io/REPOSITORIO/ se detecta sola
  // y podés dejar esto vacío. Completalo solo si usás un dominio propio.
  github: {
    usuario: "",
    repositorio: "",
    rama: ""          // vacío = la rama principal del repositorio
  }
};
