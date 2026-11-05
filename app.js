// =====================================================================
// app.js — Lógica del frontend de CaféPro
// Todo el comportamiento de la página vive en la clase GestorCafePro:
// inicio de sesión, registros de cosecha, precio del café, clima, fase
// lunar, calendario y noticias. Se comunica con el backend mediante fetch().
// =====================================================================

// ---------------------------------------------------------------------
// CONFIGURACIÓN DEL BACKEND
// ---------------------------------------------------------------------
const URL_BACKEND_NUBE = 'https://cafepro-backend.onrender.com'; // servidor en producción (Render)
const URL_BACKEND_LOCAL = 'http://localhost:3000';               // servidor en tu computador

// Si la página se abre desde el computador (localhost o un archivo local) se usa
// el backend local; si se abre desde internet (GitHub Pages) se usa el de la nube.
const ESTA_EN_LOCAL = ['localhost', '127.0.0.1', ''].includes(location.hostname);
const URL_BACKEND = ESTA_EN_LOCAL ? URL_BACKEND_LOCAL : URL_BACKEND_NUBE;

/**
 * Clase principal de la aplicación (Programación Orientada a Objetos).
 * Agrupa los datos del usuario y todos los métodos que dibujan y
 * actualizan la pantalla.
 */
class GestorCafePro {
    constructor() {
        // Direcciones del backend: baseUrl para la raíz y apiUrl para los endpoints /api.
        this.baseUrl = URL_BACKEND;
        this.apiUrl = `${URL_BACKEND}/api`;

        // Datos del usuario que inició sesión. Los registros se cargan desde MySQL.
        this.userData = {
            id: null,
            finca: "",
            agricultor: "",
            registros: []
        };

        // Precio de una CARGA (125 kg de pergamino seco). Empieza con un valor de
        // referencia y se reemplaza por el precio real que entrega el backend.
        this.precioReferenciaHoy = 2040000;
        this.precioCargado = false; // pasa a true cuando llega el primer precio real
        this.kilosPorCarga = 125;

        this.init();
    }

    /**
     * Arranca la aplicación: restaura la sesión, muestra fecha, hora, luna y
     * clima, activa los botones y pide al backend el precio y las noticias.
     */
    init() {
        this.verificarSesion();
        this.actualizarReloj();
        setInterval(() => this.actualizarReloj(), 1000); // el reloj se refresca cada segundo
        this.calcularFaseLunar();
        this.obtenerClimaDesdeAPI();
        this.asignarEventos();
        this.despertarServidor();
        this.actualizarPrecioRealTime();
        this.cargarNoticias();
    }

    /**
     * El servidor gratuito de Render se "duerme" tras 15 minutos sin visitas y
     * tarda cerca de un minuto en despertar. Al abrir la página se le envía una
     * petición silenciosa para que ya esté despierto cuando el usuario termine
     * de escribir sus datos.
     */
    async despertarServidor() {
        try {
            await fetch(`${this.baseUrl}/`);
        } catch (error) {
            console.warn('El servidor aún no responde (puede estar despertando):', error);
        }
    }

    // -----------------------------------------------------------------
    // EVENTOS
    // -----------------------------------------------------------------

    /**
     * Conecta cada botón y formulario de la página con su método.
     * Cada elemento se comprueba antes (if) para que, si alguno no existe en el
     * HTML, el resto de la aplicación siga funcionando.
     */
    asignarEventos() {
        const formRegistro = document.getElementById('form-registro-inicial');
        if (formRegistro) formRegistro.addEventListener('submit', (e) => this.completarRegistro(e));

        const btnCerrar = document.getElementById('btn-cerrar-sesion');
        if (btnCerrar) btnCerrar.addEventListener('click', () => this.cerrarSesion());

        const btnToggleCal = document.getElementById('btn-toggle-calendar');
        if (btnToggleCal) btnToggleCal.addEventListener('click', () => this.toggleCalendar());

        const btnActualizarPre = document.getElementById('btn-actualizar-precio');
        if (btnActualizarPre) btnActualizarPre.addEventListener('click', () => this.actualizarPrecioRealTime());

        const formFinanzas = document.getElementById('form-finanzas');
        if (formFinanzas) formFinanzas.addEventListener('submit', (e) => this.registrarFinanzas(e));

        // Delegación de eventos: como los botones de eliminar se crean dinámicamente,
        // se escucha un solo clic en el historial y se detecta cuál botón fue presionado.
        const historial = document.getElementById('historial-finanzas');
        if (historial) {
            historial.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-eliminar]');
                if (btn) this.eliminarRegistro(btn.getAttribute('data-eliminar'));
            });
        }

        // Botones de la barra inferior: cada uno indica en data-tab qué pantalla mostrar.
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.currentTarget.getAttribute('data-tab');
                this.cambiarTab(tabId);
            });
        });
    }

    // -----------------------------------------------------------------
    // CLIMA (API pública Open-Meteo)
    // -----------------------------------------------------------------

    /**
     * Consulta el clima actual de Bogotá en Open-Meteo (servicio gratuito, sin
     * clave) y lo muestra en la tarjeta "Clima Local". Si falla, muestra "Sin conexión".
     */
    async obtenerClimaDesdeAPI() {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=4.6097&longitude=-74.0817&current_weather=true';
        try {
            const respuesta = await fetch(url);
            const datos = await respuesta.json();
            const clima = datos.current_weather;

            const tempEl = document.getElementById('clima-temperatura');
            const vientoEl = document.getElementById('clima-viento');
            const iconoEl = document.getElementById('clima-icono');

            if (tempEl) tempEl.innerText = `${clima.temperature}°C`;
            if (vientoEl) vientoEl.innerText = `Vel. ${clima.windspeed} km/h`;

            // El código del clima elige el ícono: 3 o menos = despejado/nubes, 51 o más = lluvia.
            let icono = "🌤️";
            if (clima.weathercode >= 51) icono = "🌧️";
            if (clima.weathercode <= 3) icono = "☀️";
            if (iconoEl) iconoEl.innerText = icono;

        } catch (error) {
            console.error("Error conectando a la API:", error);
            const tempEl = document.getElementById('clima-temperatura');
            if (tempEl) tempEl.innerText = "Sin conexión";
        }
    }

    // -----------------------------------------------------------------
    // COMUNICACIÓN CON EL BACKEND (API REST)
    // -----------------------------------------------------------------

    /**
     * Método central: todas las llamadas al backend pasan por aquí.
     * Convierte el cuerpo a JSON, envía la petición y lee la respuesta.
     * Si el servidor está apagado, fetch lanza un error que captura quien llama.
     *
     * @param {string} ruta      Ruta del endpoint, por ejemplo '/registros'.
     * @param {object} opciones  Opciones de fetch (method, body...).
     * @returns {Promise<{ok:boolean, status:number, datos:object}>}
     */
    async peticionAPI(ruta, opciones = {}) {
        const config = { headers: { 'Content-Type': 'application/json' }, ...opciones };
        if (config.body && typeof config.body !== 'string') {
            config.body = JSON.stringify(config.body);
        }

        const respuesta = await fetch(`${this.apiUrl}${ruta}`, config);

        let datos = {};
        try {
            datos = await respuesta.json();
        } catch (e) {
            // La respuesta no trae JSON: se deja el objeto vacío.
        }
        return { ok: respuesta.ok, status: respuesta.status, datos };
    }

    // -----------------------------------------------------------------
    // FECHA, HORA Y FASE LUNAR
    // -----------------------------------------------------------------

    /**
     * Muestra la fecha corta (ej. "lun, 2 nov") y la hora (ej. "15:24") en la cabecera.
     * Se ejecuta cada segundo desde init().
     */
    actualizarReloj() {
        const h = new Date();
        const reloj = document.getElementById('reloj');
        const fechaH = document.getElementById('fecha-header');

        if (reloj) reloj.innerText = h.getHours().toString().padStart(2, '0') + ":" + h.getMinutes().toString().padStart(2, '0');

        const opciones = { weekday: 'short', day: 'numeric', month: 'short' };
        if (fechaH) fechaH.innerText = h.toLocaleDateString('es-CO', opciones).replace('.', '');
    }

    /**
     * Calcula de forma aproximada la fase lunar de hoy. Cuenta los días
     * transcurridos desde una luna nueva conocida (7 de enero de 1970) dentro del
     * ciclo lunar de ~29,5 días. Es una versión simplificada: solo distingue
     * "Luna Nueva" y "Luna Llena".
     */
    calcularFaseLunar() {
        const fecha = new Date();
        const lp = 2551443; // duración del ciclo lunar en segundos
        const new_moon = new Date(1970, 0, 7, 20, 35, 0); // referencia: una luna nueva
        const phase = ((fecha.getTime() - new_moon.getTime()) / 1000) % lp;
        const dia = Math.floor(phase / (24 * 3600)) + 1; // día actual dentro del ciclo (1 a 30)

        let nom = "Luna Nueva"; let ico = "🌑";
        if (dia >= 8 && dia < 16) { nom = "Luna Llena"; ico = "🌕"; }

        const iconoLuna = document.getElementById('lunaIcono');
        const nombreLuna = document.getElementById('lunaNombre');

        if (iconoLuna) iconoLuna.innerText = ico;
        if (nombreLuna) nombreLuna.innerText = nom;
    }

    /**
     * MySQL entrega la fecha como "2026-11-01"; aquí se muestra como "01/11/2026".
     *
     * @param {string} fecha  Fecha en formato AAAA-MM-DD.
     * @returns {string}      Fecha en formato DD/MM/AAAA.
     */
    formatearFecha(fecha) {
        const [anio, mes, dia] = String(fecha).split('-');
        return dia ? `${dia}/${mes}/${anio}` : fecha;
    }

    // -----------------------------------------------------------------
    // SESIÓN Y AUTENTICACIÓN
    // -----------------------------------------------------------------

    /**
     * Guarda en el navegador solo lo mínimo para recordar quién es el usuario
     * (id, finca y nombre). La contraseña y los registros NUNCA se guardan aquí.
     */
    guardarSesion() {
        try {
            const { id, finca, agricultor } = this.userData;
            localStorage.setItem('cafeProUser', JSON.stringify({ id, finca, agricultor }));
        } catch (e) {
            console.warn('No se pudo guardar en localStorage:', e);
        }
    }

    /**
     * Muestra un mensaje de error debajo del formulario de ingreso.
     * Para borrar el mensaje se le pasa un texto vacío.
     *
     * @param {string} msg  Mensaje a mostrar.
     */
    mostrarError(msg) {
        const el = document.getElementById('auth-error');
        if (el) el.textContent = msg;
    }

    /**
     * Al abrir la página, restaura la sesión si el usuario ya había ingresado
     * en esta pestaña del navegador. Si los datos guardados son inválidos o de
     * una versión antigua (sin id), se descartan.
     */
    verificarSesion() {
        try {
            const guardado = localStorage.getItem('cafeProUser');
            if (!guardado) return;

            const datos = JSON.parse(guardado);
            if (!datos.id) {
                localStorage.removeItem('cafeProUser');
                return;
            }

            this.userData = {
                id: datos.id,
                finca: datos.finca || '',
                agricultor: datos.agricultor || '',
                registros: []
            };
            if (sessionStorage.getItem('cafeProActiva') === '1') this.mostrarApp();
        } catch (e) {
            console.warn('Datos antiguos inválidos, se reinician.', e);
            localStorage.removeItem('cafeProUser');
        }
    }

    /**
     * Oculta la pantalla de ingreso y muestra la aplicación con los datos del
     * usuario y sus registros de cosecha.
     */
    mostrarApp() {
        this.aplicarDatosUsuario();
        const auth = document.getElementById('auth-screen');
        if (auth) { auth.classList.remove('d-flex'); auth.classList.add('d-none'); }
        this.actualizarInterfazFinanciera();
        this.cargarRegistros();
    }

    /**
     * Escribe el nombre de la finca y del agricultor en la cabecera.
     */
    aplicarDatosUsuario() {
        const f = document.getElementById('header-finca');
        const p = document.getElementById('header-propietario');
        if (f) f.textContent = this.userData.finca || 'Mi Cafetal';
        if (p) p.textContent = this.userData.agricultor || 'Propietario';
    }

    /**
     * Procesa el formulario de ingreso. Un solo botón sirve para entrar o para
     * crear la cuenta:
     *   1. Se intenta el LOGIN.
     *   2. Si responde 401 (no coincide), se intenta CREAR la cuenta.
     *   3. Si al crear responde 409, el cafetal ya existía: la contraseña era incorrecta.
     *
     * @param {Event} e  Evento "submit" del formulario.
     */
    async completarRegistro(e) {
        e.preventDefault(); // evita que el formulario recargue la página
        this.mostrarError('');

        const agricultor = document.getElementById('reg-agricultor').value.trim();
        const finca = document.getElementById('reg-cafetal').value.trim();
        const clave = document.getElementById('reg-password').value;

        if (!agricultor || !finca || !clave) {
            this.mostrarError('Completa todos los campos.');
            return;
        }
        if (clave.length < 6) {
            this.mostrarError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        // Mientras se espera al servidor, el botón se desactiva y cambia su texto
        // para evitar que el usuario lo presione varias veces.
        const boton = e.submitter;
        const textoOriginal = boton ? boton.textContent : '';
        if (boton) {
            boton.disabled = true;
            boton.textContent = 'Conectando... (puede tardar hasta 1 min)';
        }

        try {
            let usuario;

            // Paso 1: intentar ingresar.
            let resp = await this.peticionAPI('/usuarios/login', {
                method: 'POST',
                body: { nombre_cafetal: finca, password: clave }
            });

            if (resp.ok) {
                usuario = resp.datos.usuario;
            } else if (resp.status === 401) {
                // Paso 2: no pudo ingresar; se intenta crear la cuenta.
                resp = await this.peticionAPI('/usuarios', {
                    method: 'POST',
                    body: { nombre_agricultor: agricultor, nombre_cafetal: finca, password: clave }
                });

                if (resp.ok) {
                    usuario = resp.datos.usuario;
                } else if (resp.status === 409) {
                    // Paso 3: el cafetal ya existe, así que la contraseña no coincide.
                    this.mostrarError('Cafetal o contraseña incorrectos.');
                    return;
                } else {
                    this.mostrarError(resp.datos.mensaje || 'No se pudo crear la cuenta.');
                    return;
                }
            } else {
                this.mostrarError(resp.datos.mensaje || 'Error del servidor.');
                return;
            }

            // Ingreso exitoso: se guardan los datos y se muestra la aplicación.
            this.userData = {
                id: usuario.id,
                finca: usuario.nombre_cafetal,
                agricultor: usuario.nombre_agricultor,
                registros: []
            };
            this.guardarSesion();
            sessionStorage.setItem('cafeProActiva', '1');
            document.getElementById('form-registro-inicial').reset();
            this.mostrarApp();

        } catch (error) {
            console.error('Error de conexión con el backend:', error);
            this.mostrarError('No se pudo conectar con el servidor. Espera unos segundos e inténtalo de nuevo (puede estar despertando).');
        } finally {
            // "finally" se ejecuta siempre: se restaura el botón haya salido bien o mal.
            if (boton) {
                boton.disabled = false;
                boton.textContent = textoOriginal;
            }
        }
    }

    /**
     * Cierra la sesión (previa confirmación): borra los datos del navegador,
     * limpia la pantalla y vuelve a mostrar el formulario de ingreso.
     * Los datos reales siguen guardados en MySQL.
     */
    cerrarSesion() {
        if (!confirm(`¿Deseas salir del cafetal ${this.userData.finca || ''}?`)) return;

        sessionStorage.removeItem('cafeProActiva');
        localStorage.removeItem('cafeProUser');
        this.userData = { id: null, finca: "", agricultor: "", registros: [] };
        this.actualizarInterfazFinanciera();

        const auth = document.getElementById('auth-screen');
        if (auth) { auth.classList.remove('d-none'); auth.classList.add('d-flex'); }
        this.cambiarTab('inicio');
        document.getElementById('header-finca').textContent = 'MI CAFETAL';
        document.getElementById('header-propietario').textContent = 'Bienvenido';
    }

    // -----------------------------------------------------------------
    // FINANZAS: REGISTROS DE COSECHA (CRUD contra la API)
    // -----------------------------------------------------------------

    /**
     * LEER: pide al backend los registros del usuario (GET /api/registros?usuario_id=...)
     * y actualiza el historial y el balance en pantalla.
     */
    async cargarRegistros() {
        if (!this.userData.id) return;

        try {
            const resp = await this.peticionAPI(`/registros?usuario_id=${this.userData.id}`);
            if (!resp.ok) throw new Error(resp.datos.mensaje || 'Error al cargar los registros');

            // Se convierten los nombres de las columnas de MySQL (con guion bajo)
            // a los nombres que usa la interfaz.
            this.userData.registros = resp.datos.map(r => ({
                id: r.id,
                fecha: this.formatearFecha(r.fecha),
                ganancia: r.ganancia,
                kilosSeco: r.kilos_seco,
                kilosCereza: r.kilos_cereza,
                precioVenta: r.precio_venta,
                egresos: r.egresos
            }));
        } catch (error) {
            console.error('No se pudieron cargar los registros:', error);
            this.userData.registros = [];
            alert('No se pudieron cargar tus registros. Verifica que el backend esté encendido.');
        }

        this.actualizarInterfazFinanciera();
    }

    /**
     * CREAR: guarda un nuevo registro de cosecha (POST /api/registros).
     * El precio de venta es POR KILO; si el usuario no lo escribe, se calcula
     * dividiendo el precio de la carga entre sus 125 kg. La ganancia la calcula el servidor.
     *
     * @param {Event} e  Evento "submit" del formulario de finanzas.
     */
    async registrarFinanzas(e) {
        e.preventDefault();

        const kilosSeco = parseFloat(document.getElementById('kilos-seco').value) || 0;
        const kilosCereza = parseFloat(document.getElementById('kilos-cereza').value) || 0;
        const precioManual = parseFloat(document.getElementById('precio-venta-manual').value) || 0;
        const egresos = parseFloat(document.getElementById('egresos-produccion').value) || 0;

        const precioKilo = precioManual > 0
            ? precioManual
            : Math.round(this.precioReferenciaHoy / this.kilosPorCarga);

        const boton = e.submitter;
        if (boton) boton.disabled = true;

        try {
            const resp = await this.peticionAPI('/registros', {
                method: 'POST',
                body: {
                    usuario_id: this.userData.id,
                    kilos_seco: kilosSeco,
                    kilos_cereza: kilosCereza,
                    precio_venta: precioKilo,
                    egresos: egresos
                }
            });

            if (!resp.ok) {
                alert(resp.datos.mensaje || 'No se pudo guardar el registro.');
                return;
            }

            await this.cargarRegistros(); // se vuelve a leer la lista para incluir el nuevo registro
            document.getElementById('form-finanzas').reset();
            alert("¡Registro guardado correctamente!");
        } catch (error) {
            console.error('Error al guardar el registro:', error);
            alert('No se pudo conectar con el servidor. Verifica que el backend esté encendido.');
        } finally {
            if (boton) boton.disabled = false;
        }
    }

    /**
     * ELIMINAR: borra un registro (DELETE /api/registros/:id), previa confirmación.
     *
     * @param {string|number} id  Identificador del registro a eliminar.
     */
    async eliminarRegistro(id) {
        if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return;

        try {
            const resp = await this.peticionAPI(`/registros/${id}`, { method: 'DELETE' });
            if (!resp.ok) {
                alert(resp.datos.mensaje || 'No se pudo eliminar el registro.');
                return;
            }
            await this.cargarRegistros();
        } catch (error) {
            console.error('Error al eliminar el registro:', error);
            alert('No se pudo conectar con el servidor. Verifica que el backend esté encendido.');
        }
    }

    /**
     * Dibuja el balance de temporada (suma de las ganancias) y la lista de
     * registros en la pantalla de Finanzas.
     */
    actualizarInterfazFinanciera() {
        if (!this.userData.registros) return;

        const total = this.userData.registros.reduce((acc, curr) => acc + (curr.ganancia || 0), 0);
        const totalDisplay = document.getElementById('ganancia-total-display');
        if (totalDisplay) totalDisplay.innerText = "$" + total.toLocaleString('es-CO');

        const list = document.getElementById('historial-finanzas');
        if (!list) return;

        list.innerHTML = '<h3 class="h6 fw-bold text-uppercase text-muted px-2 mt-3">Historial Detallado de Ganancias</h3>';

        // La API ya entrega los registros del más reciente al más antiguo.
        this.userData.registros.forEach(r => {
            const item = document.createElement('div');
            item.className = "card shadow-sm border-0 p-3 small mb-2";

            // Verde si hubo ganancia, rojo si hubo pérdida.
            const colorGanancia = r.ganancia >= 0 ? 'text-success' : 'text-danger';
            const textoCereza = r.kilosCereza > 0 ? ` | ${r.kilosCereza} Kg (Cereza)` : '';

            item.innerHTML = `
                <div class="d-flex justify-content-between align-items-center border-bottom pb-1">
                    <p class="fw-bold text-dark mb-0">${r.fecha}</p>
                    <div class="d-flex align-items-center gap-2">
                        <p class="${colorGanancia} fw-bold mb-0">$${(r.ganancia || 0).toLocaleString('es-CO')}</p>
                        <button type="button" class="btn btn-outline-danger btn-sm py-0 px-2 texto-2xs" data-eliminar="${r.id}" aria-label="Eliminar registro del ${r.fecha}">🗑️</button>
                    </div>
                </div>
                <div class="d-flex justify-content-between text-muted text-uppercase texto-3xs mt-2">
                    <span>Kilos procesados:</span>
                    <span class="fw-bold text-dark">${r.kilosSeco} Kg (Seco)${textoCereza}</span>
                </div>
                <div class="d-flex justify-content-between text-muted text-uppercase texto-3xs">
                    <span>Precio de venta (por kilo):</span>
                    <span class="fw-bold text-dark">$${(r.precioVenta || 0).toLocaleString('es-CO')}</span>
                </div>
                <div class="d-flex justify-content-between text-muted text-uppercase texto-3xs">
                    <span>Egresos:</span>
                    <span class="fw-bold text-danger">-$${(r.egresos || 0).toLocaleString('es-CO')}</span>
                </div>
            `;
            list.appendChild(item);
        });
    }

    // -----------------------------------------------------------------
    // NAVEGACIÓN ENTRE PANTALLAS
    // -----------------------------------------------------------------

    /**
     * Muestra una pantalla (Inicio, Finanzas o Noticias) y oculta las demás.
     * También marca como activo el botón correspondiente de la barra inferior.
     *
     * @param {string} id  Identificador de la pantalla: 'inicio', 'calculadora' o 'noticias'.
     */
    cambiarTab(id) {
        // 1. Se ocultan todas las pantallas.
        document.querySelectorAll('.tab-content').forEach(t => {
            t.classList.remove('active', 'd-flex');
            t.classList.add('d-none');
        });

        // 2. Se muestra solo la pantalla elegida.
        const pantallaActiva = document.getElementById(id);
        if (pantallaActiva) {
            pantallaActiva.classList.remove('d-none');
            pantallaActiva.classList.add('active', 'd-flex');
        }

        // 3. Se resalta el botón de la barra inferior que corresponde.
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('nav-active');
            if (btn.getAttribute('data-tab') === id) {
                btn.classList.add('nav-active');
            }
        });
    }

    // -----------------------------------------------------------------
    // CALENDARIO AGRÍCOLA
    // -----------------------------------------------------------------

    /**
     * Abre o cierra el calendario. Al abrirlo lo dibuja con el mes actual
     * y gira la flecha del botón.
     */
    toggleCalendar() {
        const content = document.getElementById('cal-content');
        const icon = document.getElementById('cal-icon');
        const btn = document.getElementById('btn-toggle-calendar');

        if (!content || !icon || !btn) return;

        if (content.classList.contains('d-none')) {
            content.classList.remove('d-none');
            icon.classList.add('rotar-180');
            btn.setAttribute('aria-expanded', 'true'); // informa a lectores de pantalla que está abierto
            this.renderCalendar();
        } else {
            content.classList.add('d-none');
            icon.classList.remove('rotar-180');
            btn.setAttribute('aria-expanded', 'false');
        }
    }

    /**
     * Dibuja los días del mes actual y resalta el día de hoy.
     * La semana empieza en lunes, por eso se calcula cuántos espacios en blanco
     * hay antes del día 1.
     */
    renderCalendar() {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1).getDay();           // día de la semana del 1 (0 = domingo)
        const daysInMonth = new Date(year, month + 1, 0).getDate();   // cuántos días tiene el mes

        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const calMesActual = document.getElementById('cal-mes-actual');
        if (calMesActual) calMesActual.innerText = monthNames[month] + " " + year;

        const calDias = document.getElementById('cal-dias');
        if (!calDias) return;

        calDias.innerHTML = '';

        // Espacios vacíos antes del día 1 (con la semana empezando en lunes).
        let offset = firstDay === 0 ? 6 : firstDay - 1;
        for (let i = 0; i < offset; i++) {
            calDias.innerHTML += '<div class="cal-col"></div>';
        }

        // Un cuadro por cada día; el de hoy va resaltado en amarillo.
        for (let i = 1; i <= daysInMonth; i++) {
            if (i === today.getDate()) {
                calDias.innerHTML += `<div class="cal-col mb-2"><div class="cal-dia bg-warning text-white rounded d-flex align-items-center justify-content-center mx-auto fw-bold shadow-sm">${i}</div></div>`;
            } else {
                calDias.innerHTML += `<div class="cal-col mb-2"><div class="cal-dia d-flex align-items-center justify-content-center mx-auto text-secondary">${i}</div></div>`;
            }
        }
    }

    // -----------------------------------------------------------------
    // PRECIO DEL CAFÉ
    // -----------------------------------------------------------------

    /**
     * Pide al backend el precio estimado de la carga (GET /api/precio) y lo
     * muestra en la tarjeta de precio, junto con la fuente de los datos
     * (bolsa de Nueva York, TRM y hora). Si el servidor no responde, muestra
     * el último precio conocido para que la pantalla nunca quede vacía.
     */
    async cargarPrecioReal() {
        const precioDisp = document.getElementById('precioDisplay');
        const aviso = document.getElementById('precioAviso');
        const icon = document.getElementById('syncIcon');
        if (!precioDisp) return;

        // Mientras consulta: ícono girando y mensaje de espera.
        if (icon) icon.classList.add('girando');
        if (aviso) aviso.textContent = 'Consultando el mercado... (la primera vez puede tardar hasta 1 minuto)';
        if (!this.precioCargado) precioDisp.textContent = 'Cargando...';

        try {
            const respuesta = await fetch(`${this.apiUrl}/precio`);
            if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}`);
            const d = await respuesta.json();
            if (!d || typeof d.precioCarga !== 'number') throw new Error('Respuesta sin precio válido');

            // 1. Se guarda el precio: también se usa como valor por defecto en Finanzas.
            this.precioReferenciaHoy = d.precioCarga;
            this.precioCargado = true;

            // 2. Precio grande en pantalla, con formato colombiano (puntos de miles).
            precioDisp.textContent = '$' + d.precioCarga.toLocaleString('es-CO');

            // 3. Línea pequeña con el origen de los datos.
            let texto;
            if (d.detalle && d.detalle.bolsa && d.detalle.trm) {
                const bolsa = d.detalle.bolsa.centavosPorLibra.toLocaleString('es-CO');
                const trm = d.detalle.trm.valor.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const hora = new Date(d.actualizado).toLocaleString('es-CO', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                });
                texto = `Estimado · Bolsa NY ${bolsa} ¢/lb · TRM $${trm} · ${hora}`;
                if (d.esRespaldo) {
                    texto += ' · ⚠ incluye valores de respaldo (no se pudo consultar el mercado en vivo)';
                }
            } else {
                texto = d.aviso || 'Valor estimado a partir de la bolsa de Nueva York y la TRM.';
            }
            if (aviso) aviso.textContent = texto;

        } catch (error) {
            console.error('No se pudo obtener el precio real:', error);
            precioDisp.textContent = '$' + this.precioReferenciaHoy.toLocaleString('es-CO');
            if (aviso) aviso.textContent = 'Sin conexión con el servidor. Mostrando un precio de referencia.';
        } finally {
            if (icon) icon.classList.remove('girando');
        }
    }

    /**
     * Lo ejecutan init() y el botón de las flechas circulares. El backend
     * guarda la respuesta 15 minutos, así que presionar el botón varias veces
     * no sobrecarga las APIs externas.
     */
    actualizarPrecioRealTime() {
        return this.cargarPrecioReal();
    }

    // -----------------------------------------------------------------
    // NOTICIAS
    // -----------------------------------------------------------------

    /**
     * Convierte un texto externo en texto seguro para insertarlo con innerHTML.
     * Los titulares vienen de internet (RSS de terceros): si trajeran etiquetas
     * HTML o código, no deben ejecutarse en la página.
     *
     * @param {*} texto  Texto a limpiar.
     * @returns {string} Texto con los caracteres especiales convertidos.
     */
    escaparHTML(texto) {
        return String(texto ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Valida un enlace: solo permite http o https. Bloquea direcciones peligrosas
     * como "javascript:" y devuelve "#" cuando el enlace no es válido.
     *
     * @param {string} url  Enlace de la noticia.
     * @returns {string}    Enlace seguro listo para usar en un atributo href.
     */
    enlaceSeguro(url) {
        try {
            const u = new URL(url);
            return (u.protocol === 'https:' || u.protocol === 'http:') ? this.escaparHTML(u.href) : '#';
        } catch (e) {
            return '#';
        }
    }

    /**
     * Pide las noticias al backend (GET /api/noticias) y las dibuja como
     * tarjetas en la pantalla de Noticias. Si no hay noticias o falla la
     * consulta, muestra un mensaje explicativo.
     */
    async cargarNoticias() {
        const contenedor = document.getElementById('contenedor-noticias');
        if (!contenedor) return;

        try {
            const resp = await this.peticionAPI('/noticias');

            if (resp.ok && resp.datos.noticias && resp.datos.noticias.length > 0) {
                contenedor.innerHTML = resp.datos.noticias.map(item => `
                    <div class="card shadow-sm border-0 mb-3">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="badge bg-success text-uppercase">${this.escaparHTML(item.fuente)}</span>
                                <span class="text-muted texto-3xs">${this.escaparHTML(item.fecha)}</span>
                            </div>
                            <h5 class="h6 fw-bold text-dark mb-2">${this.escaparHTML(item.titulo)}</h5>
                            <a href="${this.enlaceSeguro(item.enlace)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-success btn-sm texto-2xs mt-1">
                                Leer noticia completa ➔
                            </a>
                        </div>
                    </div>
                `).join('');
            } else {
                contenedor.innerHTML = '<p class="text-center text-muted my-4">No hay noticias disponibles en este momento.</p>';
            }
        } catch (error) {
            console.error('Error al cargar noticias:', error);
            contenedor.innerHTML = '<p class="text-center text-muted my-4">No se pudieron sincronizar las noticias en vivo.</p>';
        }
    }
}

// Se inicia la aplicación cuando el navegador terminó de cargar el HTML.
document.addEventListener('DOMContentLoaded', () => {
    new GestorCafePro();
});
