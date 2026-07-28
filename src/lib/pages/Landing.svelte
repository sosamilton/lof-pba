<script>
  const repoUrl = 'https://github.com/sosamilton/spa-cooperadora'
  const gristDocsUrl = 'https://support.getgrist.com/widget-custom/'
</script>

<div class="wrap">
  <header class="hero">
    <div class="badge">AppCoop · Provincia de Buenos Aires</div>
    <h1>Sistema de gestión para cooperadoras escolares</h1>
    <p class="lead">
      Una interfaz moderna tipo “mini-sistema” que usa Grist como backend para mantener soberanía de datos, facilitar
      replicación, auditoría e integración.
    </p>
    <div class="cta">
      <a class="btn" href={repoUrl} target="_blank" rel="noreferrer">Ver repo / contribuir</a>
      <a class="btn secondary" href={gristDocsUrl} target="_blank" rel="noreferrer">Qué es un Custom Widget</a>
    </div>
  </header>

  <section class="card">
    <h2>Cómo se usa</h2>
    <p>
      Esta SPA está pensada para correr <strong>dentro de un documento de Grist</strong> como Custom Widget (iframe).
      Cuando se abre en navegador “normal”, no tiene acceso a los datos del documento.
    </p>
  </section>

  <section class="card">
    <h2>Instalación en Grist</h2>
    <ol>
      <li>Abrí tu documento Grist (idealmente una copia del template AppCoop).</li>
      <li><span class="mono">Add New</span> → <span class="mono">Add Widget to Page</span> → <span class="mono">Custom</span></li>
      <li>Pegá la URL de GitHub Pages de esta app.</li>
      <li>Elegí <span class="mono">Access level</span>: <strong>Full document access</strong>.</li>
      <li>
        En la pantalla de inicio dentro de Grist, podés usar <strong>Inicializar plantilla AppCoop</strong> para crear
        tablas y cargar datos base (rubros PIA, cuentas, cargos, etc.) si faltan.
      </li>
    </ol>
  </section>

  <section class="card">
    <h2>Features actuales (demo)</h2>
    <ul>
      <li><strong>Setup</strong>: datos de escuela/cooperadora + banco + kiosco, ejercicios y cargos.</li>
      <li><strong>Socios</strong>: búsqueda por múltiples campos + alta/edición.</li>
      <li><strong>Movimientos</strong>: listado + filtros básicos.</li>
      <li><strong>Gobierno</strong>: placeholder para próxima iteración.</li>
    </ul>
  </section>

  <section class="card">
    <h2>Por qué Grist</h2>
    <ul>
      <li><strong>Soberanía y portabilidad</strong>: un documento Grist es un SQLite; fácil de respaldar y replicar.</li>
      <li><strong>Integración</strong>: API REST + exportables + automatización.</li>
      <li><strong>Transparencia</strong>: datos visibles, auditables, con reglas y fórmulas en el mismo lugar.</li>
    </ul>
  </section>

  <footer class="foot">
    <a href={repoUrl} target="_blank" rel="noreferrer">GitHub: sosamilton/spa-cooperadora</a>
  </footer>
</div>

<style>
  .wrap {
    max-width: 980px;
    margin: 0 auto;
    padding: 20px;
  }
  .hero {
    padding: 18px 18px 4px 18px;
    border-radius: 16px;
    border: 1px solid rgba(128, 128, 128, 0.22);
    background: rgba(128, 128, 128, 0.06);
  }
  .badge {
    display: inline-block;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid rgba(22, 179, 120, 0.35);
    background: rgba(22, 179, 120, 0.12);
    font-weight: 800;
    font-size: 12px;
    margin-bottom: 10px;
  }
  h1 {
    margin: 0 0 10px 0;
    font-size: 24px;
    line-height: 1.15;
  }
  .lead {
    margin: 0 0 14px 0;
    opacity: 0.9;
  }
  .cta {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .btn {
    display: inline-block;
    border: 0;
    border-radius: 10px;
    padding: 9px 12px;
    cursor: pointer;
    font-weight: 800;
    text-decoration: none;
    background: rgba(22, 179, 120, 0.9);
    color: #fff;
  }
  .btn.secondary {
    background: rgba(128, 128, 128, 0.18);
    color: inherit;
  }
  .card {
    margin-top: 14px;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid rgba(128, 128, 128, 0.22);
    background: rgba(128, 128, 128, 0.06);
  }
  h2 {
    margin: 0 0 10px 0;
    font-size: 16px;
  }
  p {
    margin: 8px 0;
    opacity: 0.9;
  }
  ul,
  ol {
    margin: 8px 0 0 18px;
    padding: 0;
  }
  li {
    margin: 6px 0;
    opacity: 0.92;
  }
  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.95em;
  }
  .foot {
    margin-top: 16px;
    opacity: 0.75;
    font-size: 13px;
  }
  .foot a {
    color: inherit;
  }
</style>

