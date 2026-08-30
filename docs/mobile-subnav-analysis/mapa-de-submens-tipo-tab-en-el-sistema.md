# Mapa de submenús tipo tab en el sistema

## Módulo: Cooperadora (Institucional)

- **Tabs principales (5):** Datos generales, Autoridades, Asesor institucional, Ejercicios, Estatuto
- **Íconos:** Sí (cada tab tiene ícono + texto)
- **Sub-tabs anidados:** Sí — Autoridades despliega CD / CRC / Federación
- **Archivo:** `src/app/pages/cooperadora/Cooperadora.svelte` (línea 195)
- **Severidad mobile:** Alta — 5 tabs con ícono + texto no caben en 375px

## Módulo: Configuración

- **Tabs principales (4):** General, Categorías y subcategorías, Sincronización, Intercambio
- **Íconos:** Sí
- **Sub-tabs anidados:** No
- **Archivo:** `src/app/pages/configuracion/Configuracion.svelte` (línea 43)
- **Severidad mobile:** Media — 4 tabs, "Categorías y subcategorías" es largo

## Módulo: Asambleas y autoridades

- **Tabs principales (3):** Asambleas y reuniones, Histórico, Hechos relevantes
- **Íconos:** Sí
- **Sub-tabs anidados:** Sí — Histórico despliega CD / CRC / Federación
- **Archivo:** `src/app/modules/gobierno/AsambleasAutoridades.svelte` (línea 62)
- **Severidad mobile:** Media — 3 tabs pero "Asambleas y reuniones" es largo
- **Issue adicional:** Botones de crear asamblea (Ordinaria/Autoridades, Extraordinaria, Reunión de CD) ocupan mucho espacio en mobile

## Módulo: Resumen de tesorería

- **Tabs principales (5):** Flujo de caja, Gastos e ingresos, Comparativa, Morosidad, Salud operativa
- **Íconos:** Sí
- **Sub-tabs anidados:** Sí — Flujo de caja despliega Mensual / Semanal
- **Archivo:** `src/app/modules/tesoreria/resumen/ResumenMensual.svelte` (línea 95)
- **Severidad mobile:** Alta — 5 tabs con ícono + texto

## Módulo: Cierre

- **Tabs principales (4):** PIA, Nómina, Memoria, Historial
- **Íconos:** Mixto (solo Memoria tiene ícono)
- **Sub-tabs anidados:** No
- **Archivo:** `src/app/modules/tesoreria/cierre/Cierre.svelte` (línea 151)
- **Severidad mobile:** Baja — 4 tabs cortos, probablemente caben

## Selector de organismo (anidado en varios módulos)

- **Tabs (3):** CD, CRC, Federación
- **Íconos:** No
- **Sub-tabs anidados:** No
- **Ubicaciones:** TabAutoridades, TabHistorico, TablaCargos, DialogHistorico
- **Severidad mobile:** Baja — 3 tabs muy cortos, caben sin scroll
