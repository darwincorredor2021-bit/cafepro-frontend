# ☕ CaféPro Colombia

Aplicación web para la gestión integral de una unidad productiva cafetera: registro de cosechas, control de ganancias, precio estimado del café en tiempo real, clima, fase lunar, calendario agrícola y noticias del sector.

---

## 1. Descripción del Proyecto

**CaféPro** es una aplicación web pensada para el caficultor colombiano, diseñada para usarse cómodamente desde el celular.

**Objetivo:** centralizar en un solo lugar el control de la finca: cuánto café se cosecha, cuánto se vende, cuánto se gasta y cuánto se gana, junto con información útil para tomar decisiones.

**Problema que resuelve:** muchos pequeños productores llevan sus cuentas en cuadernos o de memoria, y no tienen a la mano una referencia clara del valor de su café. CaféPro permite:

- Registrar cada pase de cosecha y calcular automáticamente la ganancia.
- Consultar el valor estimado de una carga de 125 kg en pesos colombianos, calculado con datos reales del mercado.
- Ver el clima, la fase lunar, el calendario y las noticias del sector sin salir de la aplicación.
- Guardar los datos en la nube, de modo que se puedan consultar desde cualquier dispositivo.

---

## 2. Arquitectura y Estructura del Proyecto

El sistema sigue una arquitectura **cliente–servidor**:

- El **frontend** (HTML, CSS y JavaScript) es lo que ve el usuario y se comunica con el backend mediante peticiones HTTP (`fetch`).
- El **backend** es una **API REST** que recibe esas peticiones, procesa la lógica y consulta la base de datos MySQL.
- En el backend el flujo es: **ruta → controlador → base de datos**. Los controladores están escritos con **Programación Orientada a Objetos** (clases y herencia).

```text
cafepro/
├── README.md
├── cafepro-frontend/
│   ├── index.html                 # Estructura de la interfaz (pantallas)
│   ├── styles.css                 # Estilos propios (complementan a Bootstrap)
│   ├── app.js                     # Lógica del cliente: clase GestorCafePro
│   ├── fondo-colinas.svg          # Imagen de fondo
│   └── decor-rama.svg             # Decoración
└── cafepro-backend/
    ├── app.js                     # Punto de entrada: clase Servidor (Express)
    ├── config/
    │   └── db.js                  # Conexión a MySQL (clase Database)
    ├── controllers/
    │   ├── BaseController.js      # Clase padre: manejo común de errores
    │   ├── UsuarioController.js   # CRUD de usuarios y login
    │   ├── RegistroController.js  # CRUD de registros de cosecha
    │   ├── PrecioController.js    # Precio estimado de la carga de café
    │   └── NoticiasController.js  # Noticias del sector (RSS)
    ├── routes/
    │   ├── usuarios.routes.js
    │   ├── registros.routes.js
    │   ├── precio.routes.js
    │   └── noticias.routes.js
    ├── sql/
    │   └── schema.sql             # Creación de la base de datos y sus tablas
    ├── env.example                # Plantilla de variables de entorno
    ├── .gitignore
    ├── package.json
    └── package-lock.json
```

> En producción, `cafepro-frontend` y `cafepro-backend` son **dos repositorios independientes** de GitHub (ver sección 5).

---

## 3. Tecnologías y Herramientas Utilizadas

| Capa              | Tecnologías |
|-------------------|-------------|
| **Frontend**      | HTML5, CSS3, JavaScript (ES6+, POO), Bootstrap 5.3.8 |
| **Backend**       | Node.js, Express.js 5 |
| **Base de datos** | MySQL (`mysql2`) |
| **Entorno y control de versiones** | Git, GitHub, Visual Studio Code, Insomnia/Postman (pruebas de la API) |

**Librerías del backend:** `express`, `mysql2`, `bcryptjs` (cifrado de contraseñas), `cors`, `dotenv` (variables de entorno), `axios` (consultas a APIs externas), `rss-parser` (lectura de noticias) y `nodemon` (desarrollo).

**Servicios externos consumidos:**

| Servicio | Uso |
|---|---|
| Open-Meteo | Clima de Bogotá |
| datos.gov.co | TRM oficial (pesos por dólar) |
| Yahoo Finance | Precio del café en la bolsa de Nueva York |
| ExchangeRate-API | Tasa de cambio alterna si falla la TRM oficial |
| Google Noticias (RSS) | Noticias del sector cafetero |

---

## 4. Guía de Instalación y Configuración Local

**Requisitos:** [Node.js](https://nodejs.org) 18 o superior, [MySQL Server](https://dev.mysql.com/downloads/) encendido, Git y un navegador moderno.

### 4.1 Clonar el repositorio

```bash
git clone https://github.com/darwincorredor2021-bit/cafepro-backend.git
git clone https://github.com/darwincorredor2021-bit/cafepro-frontend.git
```

### 4.2 Crear la base de datos

Ejecuta `cafepro-backend/sql/schema.sql` en MySQL Workbench (**File → Open SQL Script** y luego el rayo ⚡) o desde la terminal:

```bash
mysql -u root -p < cafepro-backend/sql/schema.sql
```

Esto crea la base `cafepro_db` con las tablas `usuarios` y `registros_cosecha`.

### 4.3 Configurar las variables de entorno

Dentro de `cafepro-backend`, crea el archivo `.env` a partir de la plantilla:

```bash
# Windows
copy env.example .env
# macOS / Linux
cp env.example .env
```

Abre `.env` y escribe tu contraseña de MySQL en `DB_PASSWORD`. El archivo `.env` no se sube a GitHub (está en `.gitignore`).

### 4.4 Instalar dependencias y ejecutar el servidor

```bash
cd cafepro-backend
npm install
npm start          # o: node app.js   (con recarga automática: npm run dev)
```

Salida esperada:

```text
✅ Conectado a MySQL
🚀 Servidor corriendo en http://localhost:3000
```

Comprobación rápida: abre `http://localhost:3000` y debe responder `{"mensaje":"API de CaféPro funcionando ☕"}`.

### 4.5 Abrir el frontend

Abre `cafepro-frontend/index.html` con la extensión **Live Server** de VS Code (o directamente en el navegador). Cuando la página se abre desde `localhost`, usa automáticamente el backend local; si se abre desde internet, usa el backend de producción.

---

## 5. Despliegue en la Nube / Producción

El proyecto está publicado con servicios gratuitos, cada pieza en su plataforma:

| Pieza | Plataforma | Dirección |
|-------|------------|-----------|
| Base de datos MySQL | **Aiven** (plan gratuito) | Conexión cifrada (SSL) |
| Backend (API) | **Render** (Web Service gratuito) | `https://cafepro-backend.onrender.com` |
| Frontend | **GitHub Pages** | `https://darwincorredor2021-bit.github.io/cafepro-frontend/` |

**Base de datos (Aiven).** Se creó un servicio MySQL gratuito, se conectó desde MySQL Workbench con SSL y se ejecutó `schema.sql` para crear las tablas.

**Backend (Render).** El repositorio `cafepro-backend` se conecta a Render como *Web Service* con:

- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Variables de entorno** (se escriben en el panel de Render; el `.env` nunca se sube):

| Variable | Valor |
|----------|-------|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | Datos de conexión entregados por Aiven |
| `DB_NAME` | `cafepro_db` |
| `DB_SSL` | `true` |
| `BOLSA_RESPALDO`, `TRM_RESPALDO` | Opcionales: valores de respaldo del precio |

Cada `git push` al repositorio vuelve a desplegar el backend automáticamente.

**Frontend (GitHub Pages).** En el repositorio `cafepro-frontend`: **Settings → Pages → Deploy from a branch → `main` / `(root)`**. GitHub publica el sitio y entrega el enlace público.

> **Plan gratuito:** Render duerme el servidor tras 15 minutos sin visitas, por lo que la primera carga puede tardar hasta un minuto. Por eso el frontend "despierta" el servidor al abrirse y muestra un aviso mientras espera. Aiven puede apagar el servicio de base de datos si pasa mucho tiempo sin actividad; se vuelve a encender desde su consola.

---

## 6. Módulos y Funcionalidades Principales

URL base de la API: `/api` (en local: `http://localhost:3000/api`).

### 6.1 Autenticación y gestión de usuarios

Cada agricultor se identifica por el **nombre de su cafetal** y una contraseña. En la pantalla de ingreso un solo botón sirve para entrar o crear la cuenta: primero intenta el login y, si el cafetal no existe, lo registra.

- Las contraseñas se guardan cifradas con **bcrypt**; la API nunca devuelve el hash.
- Los datos de usuario se validan en el servidor y los errores se traducen a códigos HTTP claros.

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/usuarios/login` | Iniciar sesión |
| POST | `/usuarios` | Crear usuario |
| GET | `/usuarios` | Listar usuarios |
| GET | `/usuarios/:id` | Obtener un usuario |
| PUT | `/usuarios/:id` | Actualizar un usuario |
| DELETE | `/usuarios/:id` | Eliminar un usuario (y sus registros) |

### 6.2 Registro y control de cosechas

El agricultor registra cada pase de cosecha con sus kilos secos, kilos cereza, precio de venta por kilo y egresos. El servidor calcula la ganancia:

```text
ganancia = kilos_seco × precio_venta − egresos
```

La pantalla **Finanzas** muestra el balance de temporada (suma de ganancias) y el historial detallado, donde cada registro se puede eliminar. Si no se escribe el precio por kilo, se usa el precio estimado de la carga dividido entre 125 kg.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/registros?usuario_id=1` | Listar los registros de un agricultor |
| GET | `/registros/:id` | Obtener un registro |
| POST | `/registros` | Crear un registro |
| PUT | `/registros/:id` | Actualizar un registro |
| DELETE | `/registros/:id` | Eliminar un registro |

**Modelo de datos:** `usuarios` (1) ──── (N) `registros_cosecha`, relacionadas por `usuario_id` con `ON DELETE CASCADE`.

### 6.3 Gestión de precios del café

`GET /api/precio` entrega un **precio estimado** de la carga de 125 kg de café pergamino seco, en pesos colombianos, calculado con:

1. **TRM oficial** (datos.gov.co), con una fuente alterna de tasas de cambio.
2. **Precio de la bolsa de Nueva York** (contrato "C", en centavos de dólar por libra).
3. **Factor de rendimiento 94**: con 94 kg de pergamino se obtienen 70 kg de café excelso (125 kg ≈ 93,09 kg).
4. **Diferencial** del café colombiano sobre la bolsa (27 ¢/lb, calibrado con precios publicados por la FNC).

```text
precio_carga = (125 × 70 ÷ 94) × 2,20462 × ((bolsa + diferencial) ÷ 100) × TRM
```

Si una fuente externa falla se usan **valores de respaldo** y la interfaz lo avisa. Las respuestas se guardan en **caché** 15 minutos para no saturar las APIs gratuitas.

> Es una **estimación** a partir de datos de mercado; el precio oficial de compra lo publica la Federación Nacional de Cafeteros.

### 6.4 Módulo de noticias

`GET /api/noticias` lee el feed RSS de Google Noticias con la búsqueda "café Colombia" y entrega las 6 noticias más recientes (título, fuente, fecha y enlace). El frontend las muestra como tarjetas; el texto externo se **escapa** y solo se permiten enlaces `http`/`https`, para evitar la inyección de código desde fuentes de terceros.

### 6.5 Panel de inicio

La pantalla de inicio reúne el precio del día, un calendario agrícola desplegable, la fase lunar y el clima actual de Bogotá (Open-Meteo).

---

## 7. Consideraciones

- **Seguridad de la API:** las rutas aún no usan tokens (JWT), por lo que cualquiera que conozca la URL podría consultarlas. Como mejora futura se propone autenticación con JWT para que cada agricultor solo acceda a sus propios datos.
- **Precio estimado:** el diferencial y el factor de rendimiento son aproximaciones; pueden ajustarse en `PrecioController.js`.

**Autor:** Darwin Corredor Loaiza.
