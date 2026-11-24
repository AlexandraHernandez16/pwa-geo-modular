// geo-helper.js - Módulo reutilizable de geolocalización en Vanilla JS.
// Encapsula navigator.geolocation (callbacks) dentro de Promesas.
// Se consume siempre con .then() y .catch().

/**
 * Traduce los códigos numéricos nativos (1, 2, 3) a mensajes claros.
 */
function traducirErrorGeolocalizacion(error) {
  switch (error && error.code) {
    case 1: // PERMISSION_DENIED
      return 'Permiso de ubicación denegado. Puedes ingresar tu zona manualmente.';
    case 2: // POSITION_UNAVAILABLE
      return 'No fue posible determinar tu ubicación (señal GPS o Wi-Fi no disponible).';
    case 3: // TIMEOUT
      return 'Se agotó el tiempo de espera intentando obtener las coordenadas.';
    default:
      return 'Ocurrió un error inesperado al consultar la ubicación.';
  }
}

/**
 * Lectura única de la posición actual.
 * Resuelve SIEMPRE con la misma estructura:
 *   { latitud, longitud, precisionMetros, timestamp }
 * Rechaza con un Error cuyo .message es legible y cuyo .codigo conserva
 * el código nativo (1, 2, 3) o 0 si no aplica (sin soporte / contexto inseguro).
 */
function obtenerUbicacionActual(opcionesPersonalizadas) {
  const opciones = Object.assign(
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000 // Acepta una lectura reciente de hasta 30 segundos
    },
    opcionesPersonalizadas
  );

  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      const sinSoporte = new Error('Este navegador no soporta la API de Geolocalización.');
      sinSoporte.codigo = 0;
      reject(sinSoporte);
      return;
    }

    if (window.isSecureContext === false) {
      const inseguro = new Error('La geolocalización requiere una conexión segura (HTTPS).');
      inseguro.codigo = 0;
      reject(inseguro);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        resolve({
          latitud: posicion.coords.latitude,
          longitud: posicion.coords.longitude,
          precisionMetros: Math.round(posicion.coords.accuracy),
          timestamp: posicion.timestamp
        });
      },
      (error) => {
        const traducido = new Error(traducirErrorGeolocalizacion(error));
        traducido.codigo = error && error.code ? error.code : 0;
        reject(traducido);
      },
      opciones
    );
  });
}

/**
 * Consulta la Permissions API para saber si el permiso ya fue otorgado o bloqueado.
 * Siempre resuelve con 'granted' | 'denied' | 'prompt' (nunca rechaza).
 * Safari antiguo (iOS < 16) no soporta 'geolocation' en permissions.query: devuelve 'prompt'.
 */
function consultarEstadoPermisoGeo() {
  if (!('permissions' in navigator) || !navigator.permissions.query) {
    return Promise.resolve('prompt');
  }

  return navigator.permissions.query({ name: 'geolocation' })
    .then((resultado) => resultado.state) // 'granted', 'denied' o 'prompt'
    .catch(() => 'prompt');
}

/**
 * Permite reaccionar cuando el usuario cambia el permiso desde los ajustes del
 * navegador mientras la app está abierta. Devuelve una promesa que resuelve
 * con una función para dejar de escuchar (o una función vacía si no hay soporte).
 */
function observarCambiosPermisoGeo(callback) {
  if (!('permissions' in navigator) || !navigator.permissions.query) {
    return Promise.resolve(function () {});
  }

  return navigator.permissions.query({ name: 'geolocation' })
    .then((resultado) => {
      const manejador = () => callback(resultado.state);
      resultado.addEventListener('change', manejador);
      return () => resultado.removeEventListener('change', manejador);
    })
    .catch(() => function () {});
}

/**
 * Clasifica la calidad de la señal según el margen de error (accuracy) en metros.
 *   < 30 m  -> GPS alta precisión
 *   >= 30 m -> ubicación aproximada (Wi-Fi / IP)
 */
function clasificarPrecisionUbicacion(precisionMetros) {
  if (precisionMetros < 30) {
    return { nivel: 'alta', etiqueta: 'Precisión GPS Alta' };
  }
  return { nivel: 'aproximada', etiqueta: 'Ubicación Aproximada (Wi-Fi / IP)' };
}
