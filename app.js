// ============================================================
// ⚠️ CONFIGURACIÓN: pega aquí la URL pública que te dé Render
// (sin barra al final y SIN "/api"). Ejemplo:
// const URL_BACKEND_NUBE = 'https://cafepro-backend-abcd.onrender.com';
// ============================================================
const URL_BACKEND_NUBE = 'https://cafepro-backend.onrender.com';
const URL_BACKEND_LOCAL = 'http://localhost:3000';

// Si abres la página desde tu computador (localhost o archivo) usa el backend local;
// si la abren desde internet (GitHub Pages) usa el backend de la nube.
const ESTA_EN_LOCAL = ['localhost', '127.0.0.1', ''].includes(location.hostname);
const URL_BACKEND = ESTA_EN_LOCAL ? URL_BACKEND_LOCAL : URL_BACKEND_NUBE;

// APLICACIÓN DEL PARADIGMA DE PROGRAMACIÓN ORIENTADA A OBJETOS (POO)
class GestorCafePro {
    constructor() {
        // Dirección del backend (Node.js + Express + MySQL)
        this.baseUrl = URL_BACKEND;
        this.apiUrl = `${URL_BACKEND}/api`;

        // Encapsulamiento de los datos del usuario
        this.userData = {
            id: null,
            finca: "",
            agricultor: "",
            registros: []
        };

        // El precio de referencia es el de una CARGA de 125 kg de pergamino seco
        this.precioReferenciaHoy = 1850000;
        this.kilosPorCarga = 125;

        // Inicializar la aplicación
        this.init();
    }

    init() {
        this.verificarSesion();
        this.actualizarReloj();
        setInterval(() => this.actualizarReloj(), 1000);
        this.calcularFaseLunar();
        this.obtenerClimaDesdeAPI(); // Consumo de API real (Requisito)
        this.asignarEventos();
        this.despertarServidor();
        this.actualizarPrecioRealTime();
    }

    // Render (plan gratis) duerme el servidor tras 15 min sin visitas y tarda
    // cerca de 1 minuto en despertar. Al abrir la página le "tocamos la puerta"
    // en silencio para que ya esté despierto cuando el usuario termine de escribir.
    async despertarServidor() {
        try {
            await fetch(`${this.baseUrl}/`);
        } catch (error) {
            console.warn('El servidor aún no responde (puede estar despertando):', error);
        }
    }

    // -------------------------------------------------------------
    // MANEJO DE EVENTOS (Blindado contra errores de DOM)
    // -------------------------------------------------------------
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

        // Delegación de eventos: un solo "oyente" atiende todos los botones de eliminar del historial
        const historial = document.getElementById('historial-finanzas');
        if (historial) {
            historial.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-eliminar]');
                if (btn) this.eliminarRegistro(btn.getAttribute('data-eliminar'));
            });
        }

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.currentTarget.getAttribute('data-tab');
                this.cambiarTab(tabId);
            });
        });
    }

    // -------------------------------------------------------------
    // CONSUMO DE API PÚBLICA (clima)
    // -------------------------------------------------------------
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

    // -------------------------------------------------------------
    // COMUNICACIÓN CON NUESTRO BACKEND (API REST)
    // -------------------------------------------------------------
    // Método central: todas las llamadas al backend pasan por aquí.
    // Devuelve { ok, status, datos } para que cada método decida qué hacer.
    // Si el servidor está apagado, fetch lanza un error que captura quien llama.
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
            // La respuesta no traía JSON; se deja el objeto vacío
        }
        return { ok: respuesta.ok, status: respuesta.status, datos };
    }

    // -------------------------------------------------------------
    // MÉTODOS DE FECHA Y TIEMPO
    // -------------------------------------------------------------
    actualizarReloj() {
        const h = new Date();
        const reloj = document.getElementById('reloj');
        const fechaH = document.getElementById('fecha-header');

        if (reloj) reloj.innerText = h.getHours().toString().padStart(2, '0') + ":" + h.getMinutes().toString().padStart(2, '0');

        const opciones = { weekday: 'short', day: 'numeric', month: 'short' };
        if (fechaH) fechaH.innerText = h.toLocaleDateString('es-CO', opciones).replace('.', '');
    }

    calcularFaseLunar() {
        const fecha = new Date();
        const lp = 2551443;
        const new_moon = new Date(1970, 0, 7, 20, 35, 0);
        const phase = ((fecha.getTime() - new_moon.getTime()) / 1000) % lp;
        const dia = Math.floor(phase / (24 * 3600)) + 1;

        let nom = "Luna Nueva"; let ico = "🌑";
        if (dia >= 8 && dia < 16) { nom = "Luna Llena"; ico = "🌕"; }

        const iconoLuna = document.getElementById('lunaIcono');
        const nombreLuna = document.getElementById('lunaNombre');

        if (iconoLuna) iconoLuna.innerText = ico;
        if (nombreLuna) nombreLuna.innerText = nom;
    }

    // MySQL entrega la fecha como "2026-11-01"; la mostramos como "01/11/2026"
    formatearFecha(fecha) {
        const [anio, mes, dia] = String(fecha).split('-');
        return dia ? `${dia}/${mes}/${anio}` : fecha;
    }

    // -------------------------------------------------------------
    // SESIÓN Y AUTENTICACIÓN (conectadas al backend)
    // -------------------------------------------------------------
    // Solo guardamos lo mínimo para recordar quién es el usuario.
    // La contraseña y los registros NUNCA se guardan en el navegador.
    guardarSesion() {
        try {
            const { id, finca, agricultor } = this.userData;
            localStorage.setItem('cafeProUser', JSON.stringify({ id, finca, agricultor }));
        } catch (e) {
            console.warn('No se pudo guardar en localStorage:', e);
        }
    }

    mostrarError(msg) {
        const el = document.getElementById('auth-error');
        if (el) el.textContent = msg;
    }

    verificarSesion() {
        try {
            const guardado = localStorage.getItem('cafeProUser');
            if (!guardado) return;

            const datos = JSON.parse(guardado);
            // Datos de la versión antigua (sin id del servidor): se descartan
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

    mostrarApp() {
        this.aplicarDatosUsuario();
        const auth = document.getElementById('auth-screen');
        if (auth) { auth.classList.remove('d-flex'); auth.classList.add('d-none'); }
        this.actualizarInterfazFinanciera();
        this.cargarRegistros(); // trae los registros desde MySQL
    }

    aplicarDatosUsuario() {
        const f = document.getElementById('header-finca');
        const p = document.getElementById('header-propietario');
        if (f) f.textContent = this.userData.finca || 'Mi Cafetal';
        if (p) p.textContent = this.userData.agricultor || 'Propietario';
    }

    // Un solo botón sirve para ingresar o crear la cuenta:
    //  1. Se intenta el LOGIN.
    //  2. Si responde 401 (no coincide), se intenta CREAR la cuenta.
    //  3. Si al crear responde 409, el cafetal ya existía: la contraseña era incorrecta.
    async completarRegistro(e) {
        e.preventDefault();
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

        const boton = e.submitter;
        const textoOriginal = boton ? boton.textContent : '';
        if (boton) {
            boton.disabled = true;
            boton.textContent = 'Conectando... (puede tardar hasta 1 min)';
        }

        try {
            let usuario;

            // Paso 1: intentar ingresar
            let resp = await this.peticionAPI('/usuarios/login', {
                method: 'POST',
                body: { nombre_cafetal: finca, password: clave }
            });

            if (resp.ok) {
                usuario = resp.datos.usuario;
            } else if (resp.status === 401) {
                // Paso 2: no pudo ingresar, se intenta crear la cuenta
                resp = await this.peticionAPI('/usuarios', {
                    method: 'POST',
                    body: { nombre_agricultor: agricultor, nombre_cafetal: finca, password: clave }
                });

                if (resp.ok) {
                    usuario = resp.datos.usuario;
                } else if (resp.status === 409) {
                    // Paso 3: el cafetal ya existe, entonces la contraseña no coincide
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
            if (boton) {
                boton.disabled = false;
                boton.textContent = textoOriginal;
            }
        }
    }

    cerrarSesion() {
        if (!confirm(`¿Deseas salir del cafetal ${this.userData.finca || ''}?`)) return;

        sessionStorage.removeItem('cafeProActiva');
        localStorage.removeItem('cafeProUser');
        // Los datos reales siguen en MySQL; aquí solo limpiamos la pantalla
        this.userData = { id: null, finca: "", agricultor: "", registros: [] };
        this.actualizarInterfazFinanciera();

        const auth = document.getElementById('auth-screen');
        if (auth) { auth.classList.remove('d-none'); auth.classList.add('d-flex'); }
        this.cambiarTab('inicio');
        document.getElementById('header-finca').textContent = 'MI CAFETAL';
        document.getElementById('header-propietario').textContent = 'Bienvenido';
    }

    // -------------------------------------------------------------
    // LÓGICA DE FINANZAS (CRUD contra la API)
    // -------------------------------------------------------------

    // READ: GET /api/registros?usuario_id=...
    async cargarRegistros() {
        if (!this.userData.id) return;

        try {
            const resp = await this.peticionAPI(`/registros?usuario_id=${this.userData.id}`);
            if (!resp.ok) throw new Error(resp.datos.mensaje || 'Error al cargar los registros');

            // Convertimos los nombres de MySQL (snake_case) a los que usa la interfaz
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

    // CREATE: POST /api/registros
    async registrarFinanzas(e) {
        e.preventDefault();

        const kilosSeco = parseFloat(document.getElementById('kilos-seco').value) || 0;
        const kilosCereza = parseFloat(document.getElementById('kilos-cereza').value) || 0;
        const precioManual = parseFloat(document.getElementById('precio-venta-manual').value) || 0;
        const egresos = parseFloat(document.getElementById('egresos-produccion').value) || 0;

        // El precio de venta es POR KILO. Si el usuario no lo escribe,
        // se calcula desde el precio de la carga (125 kg).
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

            await this.cargarRegistros();
            document.getElementById('form-finanzas').reset();
            alert("¡Registro guardado correctamente!");
        } catch (error) {
            console.error('Error al guardar el registro:', error);
            alert('No se pudo conectar con el servidor. Verifica que el backend esté encendido.');
        } finally {
            if (boton) boton.disabled = false;
        }
    }

    // DELETE: DELETE /api/registros/:id
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

    actualizarInterfazFinanciera() {
        if (!this.userData.registros) return;

        const total = this.userData.registros.reduce((acc, curr) => acc + (curr.ganancia || 0), 0);
        const totalDisplay = document.getElementById('ganancia-total-display');
        if (totalDisplay) totalDisplay.innerText = "$" + total.toLocaleString('es-CO');

        const list = document.getElementById('historial-finanzas');
        if (!list) return;

        list.innerHTML = '<h3 class="h6 fw-bold text-uppercase text-muted px-2 mt-3">Historial Detallado de Ganancias</h3>';

        // La API ya entrega los registros del más reciente al más antiguo
        this.userData.registros.forEach(r => {
            const item = document.createElement('div');
            item.className = "card shadow-sm border-0 p-3 small mb-2";

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

    // -------------------------------------------------------------
    // INTERFAZ DE NAVEGACIÓN SPA
    // -------------------------------------------------------------
    cambiarTab(id) {
        // 1. Ocultar TODAS las pestañas agregando 'd-none' y quitando 'active' y 'd-flex'
        document.querySelectorAll('.tab-content').forEach(t => {
            t.classList.remove('active', 'd-flex');
            t.classList.add('d-none');
        });

        // 2. Mostrar SOLO la pestaña seleccionada quitando 'd-none' y agregando 'active' y 'd-flex'
        const pantallaActiva = document.getElementById(id);
        if (pantallaActiva) {
            pantallaActiva.classList.remove('d-none');
            pantallaActiva.classList.add('active', 'd-flex');
        }

        // 3. Actualizar el estado visual de los botones inferiores
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('nav-active');
            if (btn.getAttribute('data-tab') === id) {
                btn.classList.add('nav-active');
            }
        });
    }

    // -------------------------------------------------------------
    // INTERFAZ CALENDARIO Y PRECIOS
    // -------------------------------------------------------------
    toggleCalendar() {
        const content = document.getElementById('cal-content');
        const icon = document.getElementById('cal-icon');
        const btn = document.getElementById('btn-toggle-calendar');

        if (!content || !icon || !btn) return;

        if (content.classList.contains('d-none')) {
            content.classList.remove('d-none');
            icon.classList.add('rotar-180');
            btn.setAttribute('aria-expanded', 'true');
            this.renderCalendar();
        } else {
            content.classList.add('d-none');
            icon.classList.remove('rotar-180');
            btn.setAttribute('aria-expanded', 'false');
        }
    }

    renderCalendar() {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const calMesActual = document.getElementById('cal-mes-actual');
        if (calMesActual) calMesActual.innerText = monthNames[month] + " " + year;

        const calDias = document.getElementById('cal-dias');
        if (!calDias) return;

        calDias.innerHTML = '';

        let offset = firstDay === 0 ? 6 : firstDay - 1;
        for (let i = 0; i < offset; i++) {
            calDias.innerHTML += '<div class="cal-col"></div>';
        }

        for (let i = 1; i <= daysInMonth; i++) {
            if (i === today.getDate()) {
                calDias.innerHTML += `<div class="cal-col mb-2"><div class="cal-dia bg-warning text-white rounded d-flex align-items-center justify-content-center mx-auto fw-bold shadow-sm">${i}</div></div>`;
            } else {
                calDias.innerHTML += `<div class="cal-col mb-2"><div class="cal-dia d-flex align-items-center justify-content-center mx-auto text-secondary">${i}</div></div>`;
            }
        }
    }

   async actualizarPrecioRealTime() {
        const icon = document.getElementById('syncIcon');
        const precioDisp = document.getElementById('precioDisplay');
        const avisoDisp = document.getElementById('precioAviso'); // <--- Elemento del aviso
        
        if (icon) icon.classList.add('girando');
        
        try {
            const urlAPI = 'https://cafepro-backend.onrender.com/api/precio';
            const respuesta = await fetch(urlAPI);
            const datos = await respuesta.json();
            
            if (datos && datos.precioCarga) {
                this.precioReferenciaHoy = datos.precioCarga;
                if (precioDisp) {
                    precioDisp.innerText = "$" + this.precioReferenciaHoy.toLocaleString('es-CO');
                }
                // Muestra la nota técnica entregada por el backend
                if (avisoDisp) {
                    avisoDisp.innerText = datos.aviso || 
                        "Estimación basada en la Bolsa de Nueva York y TRM del día (FR: 94). El precio oficial lo fija la FNC.";
                }
            }
        } catch (error) {
            console.error("Error consultando el precio en vivo:", error);
            if (avisoDisp) avisoDisp.innerText = "No se pudo actualizar el aviso de referencia.";
        } finally {
            if (icon) icon.classList.remove('girando');
        }
    }
}

// Iniciar app al cargar DOM
document.addEventListener('DOMContentLoaded', () => {
    new GestorCafePro();
});
