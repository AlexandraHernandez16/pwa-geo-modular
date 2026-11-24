// app.js - Lógica de UI, patrón de pre-permiso y consumo de geo-helper.js
// (Vanilla JS: la asincronía se maneja solo con Promesas, .then() y .catch()).

(function () {
  'use strict';

  const CLAVE_REPORTES = 'geo-pwa-reportes';

  const $ = (id) => document.getElementById(id);
  const el = {
    estadoRed: $('estadoRed'),
    form: $('formReporte'),
    titulo: $('titulo'),
    descripcion: $('descripcion'),
    btnAdjuntar: $('btnAdjuntar'),
    chipPermiso: $('chipPermiso'),
    prePermiso: $('tarjetaPrePermiso'),
    btnConfirmar: $('btnConfirmarGeo'),
    btnCancelar: $('btnCancelarGeo'),
    cargando: $('cargandoGeo'),
    textoCargando: $('textoCargando'),
    error: $('errorGeo'),
    ayudaDenegado: $('ayudaDenegado'),
    pasosReactivar: $('pasosReactivar'),
    selectorManual: $('selectorManual'),
    selectZona: $('selectZona'),
    inputDireccion: $('inputDireccion'),
    btnGuardarZona: $('btnGuardarZona'),
    resultado: $('resultadoUbicacion'),
    badge: $('badgePrecision'),
    datos: $('datosUbicacion'),
    enlaceMapa: $('enlaceMapa'),
    btnQuitar: $('btnQuitarUbicacion'),
    mensajeForm: $('mensajeForm'),
    lista: $('listaReportes'),
    listaVacia: $('listaVacia'),
    btnLimpiar: $('btnLimpiar')
  };

  // Ubicación adjunta al reporte en edición: coordenadas reales o zona manual.
  let ubicacionAdjunta = null;

  /* ------------------------------------------------------------------ */
  /* Utilidades de plataforma                                            */
  /* ------------------------------------------------------------------ */

  function esIOS() {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function esAndroid() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function esPwaInstalada() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }

  /* ------------------------------------------------------------------ */
  /* Mostrar / ocultar estados                                           */
  /* ------------------------------------------------------------------ */

  function ocultar() {
    for (let i = 0; i < arguments.length; i++) {
      arguments[i].hidden = true;
    }
  }

  function mostrar(nodo) {
    nodo.hidden = false;
  }

  function limpiarEstadosGeo() {
    ocultar(el.prePermiso, el.cargando, el.error, el.ayudaDenegado, el.selectorManual);
  }

  function mostrarCargando(texto) {
    limpiarEstadosGeo();
    el.textoCargando.textContent = texto;
    mostrar(el.cargando);
    el.btnAdjuntar.disabled = true;
    el.btnConfirmar.disabled = true;
  }

  function ocultarCargando() {
    ocultar(el.cargando);
    el.btnAdjuntar.disabled = false;
    el.btnConfirmar.disabled = false;
  }

  function mostrarMensajeError(texto) {
    el.error.textContent = texto;
    mostrar(el.error);
  }

  function habilitarSelectorManualZona() {
    mostrar(el.selectorManual);
  }

  /* ------------------------------------------------------------------ */
  /* Instrucciones para reactivar un permiso bloqueado                   */
  /* ------------------------------------------------------------------ */

  function pasosParaReactivarPermiso() {
    if (esIOS()) {
      if (esPwaInstalada()) {
        return [
          'Abre Ajustes del iPhone > Privacidad y seguridad > Servicios de localización.',
          'Busca esta app (o "Sitios web de Safari") y elige "Al usar la app" o "Preguntar".',
          'Nota: en iOS la app instalada y Safari guardan permisos por separado.'
        ];
      }
      return [
        'En Safari toca el botón "aA" junto a la dirección > Ajustes del sitio web > Ubicación y elige "Preguntar" o "Permitir".',
        'Si sigue bloqueado: Ajustes > Privacidad y seguridad > Servicios de localización > Sitios web de Safari > "Al usar la app".',
        'Recarga la página y vuelve a pulsar "Adjuntar mi ubicación".'
      ];
    }

    if (esAndroid()) {
      if (esPwaInstalada()) {
        return [
          'Mantén presionado el ícono de la app > Información de la app > Permisos > Ubicación.',
          'Elige "Permitir solo mientras se usa la app" y activa "Usar ubicación precisa" si lo deseas.',
          'Vuelve a la app y pulsa "Adjuntar mi ubicación".'
        ];
      }
      return [
        'Toca el ícono junto a la dirección (candado o ajustes) > Permisos > Ubicación > Permitir.',
        'O bien: Chrome > Ajustes > Configuración de sitios > Ubicación, y quita el bloqueo de este sitio.',
        'Recarga la página y vuelve a pulsar "Adjuntar mi ubicación".'
      ];
    }

    return [
      'Haz clic en el ícono junto a la dirección (candado o ajustes) > Permisos > Ubicación > Permitir.',
      'Recarga la página y vuelve a pulsar "Adjuntar mi ubicación".'
    ];
  }

  function mostrarPermisoDenegado() {
    limpiarEstadosGeo();
    el.pasosReactivar.textContent = '';
    pasosParaReactivarPermiso().forEach((paso) => {
      const li = document.createElement('li');
      li.textContent = paso;
      el.pasosReactivar.appendChild(li);
    });
    mostrar(el.ayudaDenegado);
    habilitarSelectorManualZona(); // Plan B inmediato
  }

  /* ------------------------------------------------------------------ */
  /* Chip del estado del permiso (informativo, no dispara el diálogo)    */
  /* ------------------------------------------------------------------ */

  function pintarChipPermiso(estado) {
    const textos = {
      granted: 'Permiso concedido',
      denied: 'Permiso bloqueado',
      prompt: 'Permiso pendiente'
    };
    el.chipPermiso.textContent = textos[estado] || '';
    el.chipPermiso.className = 'chip chip-' + (
      estado === 'granted' ? 'ok' : estado === 'denied' ? 'error' : 'neutro'
    );
    el.chipPermiso.hidden = !textos[estado];
  }

  /* ------------------------------------------------------------------ */
  /* Presentación de la ubicación                                        */
  /* ------------------------------------------------------------------ */

  function agregarDato(dl, etiqueta, valor) {
    const dt = document.createElement('dt');
    dt.textContent = etiqueta;
    const dd = document.createElement('dd');
    dd.textContent = valor;
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function formatearFecha(ms) {
    return new Date(ms).toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'medium'
    });
  }

  function renderizarResultadoUbicacion(ubicacion) {
    el.datos.textContent = '';

    if (ubicacion.origen === 'manual') {
      el.badge.textContent = 'Zona manual';
      el.badge.className = 'badge badge-manual';
      agregarDato(el.datos, 'Zona', ubicacion.zona);
      if (ubicacion.direccion) {
        agregarDato(el.datos, 'Referencia', ubicacion.direccion);
      }
      el.enlaceMapa.hidden = true;
    } else {
      const calidad = clasificarPrecisionUbicacion(ubicacion.precisionMetros);
      el.badge.textContent = calidad.etiqueta;
      el.badge.className = 'badge badge-' + calidad.nivel;

      agregarDato(el.datos, 'Latitud', ubicacion.latitud.toFixed(6));
      agregarDato(el.datos, 'Longitud', ubicacion.longitud.toFixed(6));
      agregarDato(el.datos, 'Precisión', '± ' + ubicacion.precisionMetros + ' m');
      agregarDato(el.datos, 'Fecha de lectura', formatearFecha(ubicacion.timestamp));

      // Enlace universal: abre Google Maps en Android y el mapa del sistema/web en iOS.
      el.enlaceMapa.href = 'https://www.google.com/maps?q=' +
        encodeURIComponent(ubicacion.latitud + ',' + ubicacion.longitud);
      el.enlaceMapa.hidden = false;
    }

    mostrar(el.resultado);
  }

  /* ------------------------------------------------------------------ */
  /* Lectura real de la ubicación (consumo del helper)                   */
  /* ------------------------------------------------------------------ */

  function leerUbicacion() {
    mostrarCargando('Obteniendo coordenadas...');

    return obtenerUbicacionActual({ enableHighAccuracy: true, timeout: 8000 })
      .catch((error) => {
        // Equipos sin GPS: con alta precisión suelen agotar el tiempo (TIMEOUT).
        // Se reintenta una vez con baja precisión (Wi-Fi / red) antes de rendirse.
        if (error.codigo === 3) {
          mostrarCargando('Buscando una señal aproximada...');
          return obtenerUbicacionActual({
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 60000
          });
        }
        return Promise.reject(error);
      })
      .then((ubicacion) => {
        ocultarCargando();
        limpiarEstadosGeo();
        ubicacionAdjunta = Object.assign({ origen: 'gps' }, ubicacion);
        renderizarResultadoUbicacion(ubicacionAdjunta);
        pintarChipPermiso('granted');
      })
      .catch((error) => {
        console.warn('[Geo] Fallback activado:', error.message);
        ocultarCargando();
        limpiarEstadosGeo();

        if (error.codigo === 1) {
          pintarChipPermiso('denied');
          mostrarMensajeError(error.message);
          mostrarPermisoDenegado();
        } else {
          mostrarMensajeError(error.message);
          habilitarSelectorManualZona(); // Plan B sin bloquear al usuario
        }
      });
  }

  /* ------------------------------------------------------------------ */
  /* Flujo de pre-permiso: nace de un clic directo del usuario (iOS)     */
  /* ------------------------------------------------------------------ */

  function alPulsarAdjuntar() {
    limpiarEstadosGeo();

    return consultarEstadoPermisoGeo().then((estado) => {
      pintarChipPermiso(estado);

      if (estado === 'granted') {
        return leerUbicacion();
      }
      if (estado === 'denied') {
        mostrarPermisoDenegado();
        return null;
      }
      // 'prompt': primero explicar el motivo; la lectura real la dispara el botón de confirmar.
      mostrar(el.prePermiso);
      el.btnConfirmar.focus();
      return null;
    });
  }

  function alConfirmarPrePermiso() {
    ocultar(el.prePermiso);
    // Se llama sincrónicamente dentro del clic: requisito de Safari en iPhone.
    leerUbicacion();
  }

  function alCancelarPrePermiso() {
    ocultar(el.prePermiso);
    habilitarSelectorManualZona();
  }

  /* ------------------------------------------------------------------ */
  /* Zona manual                                                         */
  /* ------------------------------------------------------------------ */

  function guardarZonaManual() {
    const zona = el.selectZona.value;
    if (!zona) {
      mostrarMensajeError('Selecciona una zona para continuar.');
      el.selectZona.focus();
      return;
    }
    ocultar(el.error);
    ubicacionAdjunta = {
      origen: 'manual',
      zona: zona,
      direccion: el.inputDireccion.value.trim(),
      timestamp: Date.now()
    };
    limpiarEstadosGeo();
    renderizarResultadoUbicacion(ubicacionAdjunta);
  }

  function quitarUbicacion() {
    ubicacionAdjunta = null;
    ocultar(el.resultado);
  }

  /* ------------------------------------------------------------------ */
  /* Reportes (almacenamiento local)                                     */
  /* ------------------------------------------------------------------ */

  function leerReportes() {
    try {
      const crudo = localStorage.getItem(CLAVE_REPORTES);
      const datos = crudo ? JSON.parse(crudo) : [];
      return Array.isArray(datos) ? datos : [];
    } catch (e) {
      return [];
    }
  }

  function escribirReportes(reportes) {
    try {
      localStorage.setItem(CLAVE_REPORTES, JSON.stringify(reportes));
      return true;
    } catch (e) {
      return false;
    }
  }

  function describirUbicacion(u) {
    if (!u) return 'Sin ubicación';
    if (u.origen === 'manual') {
      return 'Zona: ' + u.zona + (u.direccion ? ' (' + u.direccion + ')' : '');
    }
    const calidad = clasificarPrecisionUbicacion(u.precisionMetros);
    return u.latitud.toFixed(5) + ', ' + u.longitud.toFixed(5) +
      ' · ± ' + u.precisionMetros + ' m · ' + calidad.etiqueta;
  }

  function renderizarReportes() {
    const reportes = leerReportes();
    el.lista.textContent = '';

    reportes.slice().reverse().forEach((r) => {
      const li = document.createElement('li');
      li.className = 'item';

      const t = document.createElement('strong');
      t.textContent = r.titulo;
      const d = document.createElement('p');
      d.textContent = r.descripcion;
      const u = document.createElement('p');
      u.className = 'nota';
      u.textContent = '📍 ' + describirUbicacion(r.ubicacion);
      const f = document.createElement('p');
      f.className = 'nota';
      f.textContent = formatearFecha(r.creado);

      li.appendChild(t);
      li.appendChild(d);
      li.appendChild(u);
      li.appendChild(f);
      el.lista.appendChild(li);
    });

    el.listaVacia.hidden = reportes.length > 0;
    el.btnLimpiar.hidden = reportes.length === 0;
  }

  function enviarReporteConUbicacion(datosFormulario) {
    // Ejemplo de reutilización (Fragmento C): el reporte lleva la ubicación ya obtenida.
    const paqueteCompleto = Object.assign({}, datosFormulario, {
      ubicacion: ubicacionAdjunta,
      creado: Date.now()
    });
    const reportes = leerReportes();
    reportes.push(paqueteCompleto);
    return escribirReportes(reportes);
  }

  function alEnviarFormulario(evento) {
    evento.preventDefault();
    const titulo = el.titulo.value.trim();
    const descripcion = el.descripcion.value.trim();

    if (!titulo || !descripcion) {
      el.mensajeForm.textContent = 'Completa el título y la descripción.';
      return;
    }

    const guardado = enviarReporteConUbicacion({ titulo: titulo, descripcion: descripcion });
    if (!guardado) {
      el.mensajeForm.textContent = 'No se pudo guardar el reporte en este dispositivo.';
      return;
    }

    el.form.reset();
    quitarUbicacion();
    limpiarEstadosGeo();
    el.mensajeForm.textContent = 'Reporte guardado.';
    renderizarReportes();
  }

  /* ------------------------------------------------------------------ */
  /* Red y Service Worker                                                */
  /* ------------------------------------------------------------------ */

  function actualizarEstadoRed() {
    const enLinea = navigator.onLine;
    el.estadoRed.textContent = enLinea ? 'En línea' : 'Sin conexión';
    el.estadoRed.className = 'chip ' + (enLinea ? 'chip-ok' : 'chip-error');
  }

  function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((registro) => console.log('[SW] Registrado, alcance:', registro.scope))
        .catch((error) => console.warn('[SW] Error al registrar:', error));
    });
  }

  /* ------------------------------------------------------------------ */
  /* Inicio                                                              */
  /* ------------------------------------------------------------------ */

  function iniciar() {
    el.btnAdjuntar.addEventListener('click', alPulsarAdjuntar);
    el.btnConfirmar.addEventListener('click', alConfirmarPrePermiso);
    el.btnCancelar.addEventListener('click', alCancelarPrePermiso);
    el.btnGuardarZona.addEventListener('click', guardarZonaManual);
    el.btnQuitar.addEventListener('click', quitarUbicacion);
    el.form.addEventListener('submit', alEnviarFormulario);
    el.btnLimpiar.addEventListener('click', () => {
      escribirReportes([]);
      renderizarReportes();
    });

    window.addEventListener('online', actualizarEstadoRed);
    window.addEventListener('offline', actualizarEstadoRed);
    actualizarEstadoRed();

    // Solo consulta el estado del permiso (no abre ningún diálogo ni lee coordenadas).
    consultarEstadoPermisoGeo().then(pintarChipPermiso);
    observarCambiosPermisoGeo((estado) => {
      pintarChipPermiso(estado);
      if (estado === 'granted') ocultar(el.ayudaDenegado);
    });

    renderizarReportes();
    registrarServiceWorker();
  }

  iniciar();
})();
