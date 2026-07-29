<script>
  import '../shared.css'

  const repoUrl = 'https://github.com/sosamilton/spa-cooperadora'
  const gristDocsUrl = 'https://support.getgrist.com/widget-custom/'
  const gristUrl = 'https://www.getgrist.com/'
  const appUrl = 'https://sosamilton.github.io/spa-cooperadora/'
  const licenseUrl = 'https://github.com/sosamilton/spa-cooperadora/blob/main/LICENSE'
</script>

<main class="wrap">
  <header class="hero">
    <div class="heroTop">
      <div class="badge">AppCoop · Provincia de Buenos Aires</div>
      <div class="heroLinks">
        <a class="link" href={repoUrl} target="_blank" rel="noreferrer">GitHub</a>
        <a class="link" href={gristUrl} target="_blank" rel="noreferrer">Grist</a>
      </div>
    </div>

    <div class="heroGrid">
      <div>
        <h1>Gestión de cooperadoras, bien de acá</h1>
        <p class="lead">
          Un sistema para cooperadoras escolares bonaerenses, pensado para la gestión diaria y construido sobre Grist:
          datos tuyos, exportables, auditables y fáciles de replicar.
        </p>
        <div class="cta">
          <a class="btn" href={appUrl} target="_blank" rel="noreferrer">Abrir AppCoop</a>
          <a class="btn secondary" href={repoUrl} target="_blank" rel="noreferrer">Ver repo / colaborar</a>
          <a class="btn secondary" href={gristDocsUrl} target="_blank" rel="noreferrer">Cómo instalar</a>
        </div>
        <div class="meta">
          Corre como Custom Widget dentro de Grist. En esta página pública ves el proyecto, documentación y roadmap.
        </div>
      </div>

      <div class="heroCard" role="region" aria-label="Resumen del sistema">
        <div class="kpis">
          <div class="kpi">
            <div class="kpiLabel">Backend</div>
            <div class="kpiValue">Grist</div>
          </div>
          <div class="kpi">
            <div class="kpiLabel">Datos</div>
            <div class="kpiValue">SQLite</div>
          </div>
          <div class="kpi">
            <div class="kpiLabel">Foco</div>
            <div class="kpiValue">MVP</div>
          </div>
        </div>

        <div class="heroList">
          <div class="heroItem">
            <div class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M7 7h10v10H7V7Z" stroke="currentColor" stroke-width="2" />
                <path d="M4 4h16v16H4V4Z" stroke="currentColor" stroke-width="2" opacity="0.5" />
              </svg>
            </div>
            <div>
              <div class="heroItemTitle">Soberanía de datos</div>
              <div class="heroItemSub">El documento es tuyo y exportable. Sin lock-in raro.</div>
            </div>
          </div>

          <div class="heroItem">
            <div class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3v18" stroke="currentColor" stroke-width="2" />
                <path d="M5 10l7-7 7 7" stroke="currentColor" stroke-width="2" />
                <path d="M5 14h14" stroke="currentColor" stroke-width="2" opacity="0.55" />
              </svg>
            </div>
            <div>
              <div class="heroItemTitle">Transparencia operativa</div>
              <div class="heroItemSub">Fórmulas, historial y registros auditables.</div>
            </div>
          </div>

          <div class="heroItem">
            <div class="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14" stroke="currentColor" stroke-width="2" />
                <path d="M12 5v14" stroke="currentColor" stroke-width="2" />
                <path d="M7 7l10 10" stroke="currentColor" stroke-width="2" opacity="0.35" />
              </svg>
            </div>
            <div>
              <div class="heroItemTitle">Colaborativo</div>
              <div class="heroItemSub">Pensado para comisiones, tesorería y comunidad.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>

  <section class="section">
    <div class="sectionHead">
      <h2>Qué podés hacer hoy</h2>
      <p class="sectionLead">Un MVP realista para cooperadoras: empezar simple, operar bien, mejorar iterando.</p>
    </div>

    <div class="grid">
      <article class="card">
        <div class="cardTop">
          <div class="icon soft" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16" stroke="currentColor" stroke-width="2" />
              <path d="M4 12h16" stroke="currentColor" stroke-width="2" />
              <path d="M4 17h10" stroke="currentColor" stroke-width="2" />
            </svg>
          </div>
          <div>
            <div class="cardTitle">Cooperadora</div>
            <div class="cardSub">Datos de escuela/cooperadora, ejercicio en curso y cargos base.</div>
          </div>
        </div>
        <ul class="bullets">
          <li>Configurar banco y kiosco/librería</li>
          <li>Crear/activar ejercicios</li>
          <li>Administrar cargos (incluye duración en meses)</li>
        </ul>
      </article>

      <article class="card">
        <div class="cardTop">
          <div class="icon soft" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="2" />
              <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" stroke="currentColor" stroke-width="2" />
            </svg>
          </div>
          <div>
            <div class="cardTitle">Socios</div>
            <div class="cardSub">Alta/edición con búsqueda rápida (sin fricción).</div>
          </div>
        </div>
        <ul class="bullets">
          <li>Buscar por apellido, DNI, CUIL, email, teléfono</li>
          <li>Alta rápida y edición</li>
          <li>Baja como acción explícita (no molesta en creación)</li>
        </ul>
      </article>

      <article class="card">
        <div class="cardTop">
          <div class="icon soft" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16" stroke="currentColor" stroke-width="2" />
              <path d="M4 12h16" stroke="currentColor" stroke-width="2" />
              <path d="M4 17h16" stroke="currentColor" stroke-width="2" />
              <path d="M7 9h4" stroke="currentColor" stroke-width="2" opacity="0.55" />
            </svg>
          </div>
          <div>
            <div class="cardTitle">Movimientos</div>
            <div class="cardSub">Formulario para registrar entradas, salidas y traspasos.</div>
          </div>
        </div>
        <ul class="bullets">
          <li>Rubro/subrubro (PIA) y cuentas</li>
          <li>Destino bancario cuando corresponde</li>
          <li>Asociar socio de forma opcional</li>
        </ul>
      </article>

      <article class="card">
        <div class="cardTop">
          <div class="icon soft" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M7 4h10v4H7V4Z" stroke="currentColor" stroke-width="2" />
              <path d="M5 10h14v10H5V10Z" stroke="currentColor" stroke-width="2" />
              <path d="M8 13h8" stroke="currentColor" stroke-width="2" opacity="0.55" />
              <path d="M8 16h6" stroke="currentColor" stroke-width="2" opacity="0.55" />
            </svg>
          </div>
          <div>
            <div class="cardTitle">Gobierno</div>
            <div class="cardSub">Comisión y asambleas vinculadas al ejercicio en curso.</div>
          </div>
        </div>
        <ul class="bullets">
          <li>Inicializar comisión desde cargos</li>
          <li>Registrar autoridades y vencimiento de mandato</li>
          <li>Crear/editar asambleas con resoluciones</li>
        </ul>
      </article>
    </div>
  </section>

  <section class="section">
    <div class="sectionHead">
      <h2>Cómo se instala (en 2 minutos)</h2>
      <p class="sectionLead">La app se integra a tu documento como una página más.</p>
    </div>

    <div class="steps">
      <div class="step">
        <div class="stepN">1</div>
        <div>
          <div class="stepTitle">Crear / copiar tu documento</div>
          <div class="stepSub">Idealmente una copia del template AppCoop, o un doc nuevo.</div>
        </div>
      </div>
      <div class="step">
        <div class="stepN">2</div>
        <div>
          <div class="stepTitle">Agregar widget</div>
          <div class="stepSub"><span class="mono">Add New</span> → <span class="mono">Add Widget to Page</span> → <span class="mono">Custom</span></div>
        </div>
      </div>
      <div class="step">
        <div class="stepN">3</div>
        <div>
          <div class="stepTitle">Pegar la URL</div>
          <div class="stepSub">Usá la URL de GitHub Pages de esta SPA.</div>
        </div>
      </div>
      <div class="step">
        <div class="stepN">4</div>
        <div>
          <div class="stepTitle">Dar permisos</div>
          <div class="stepSub"><span class="mono">Access level</span>: <strong>Full document access</strong></div>
        </div>
      </div>
      <div class="step">
        <div class="stepN">5</div>
        <div>
          <div class="stepTitle">Inicializar plantilla</div>
          <div class="stepSub">Desde “Inicio”, la app puede crear tablas y cargar datos base si faltan.</div>
        </div>
      </div>
    </div>

    <div class="callouts">
      <div class="callout">
        <div class="calloutTitle">Soberanía y replicación</div>
        <div class="calloutSub">
          Un documento Grist es un archivo SQLite: podés respaldar, exportar e integrar. Perfecto para organizaciones sin fines de lucro.
        </div>
      </div>
      <div class="callout">
        <div class="calloutTitle">Software libre como bandera</div>
        <div class="calloutSub">
          Este proyecto busca facilitar la transformación digital sin perder control: educación pública, gratuita y de calidad, con compromiso social.
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="sectionHead">
      <h2>Lo que viene</h2>
      <p class="sectionLead">Roadmap orientado a productividad: menos planillas, más trazabilidad.</p>
    </div>

    <div class="roadmap">
      <div class="roadItem">
        <div class="pill">Próximo</div>
        <div class="roadTitle">Personas unificadas</div>
        <div class="roadSub">Tabla <span class="mono">personas</span> para vincular socios, autoridades, docentes y directivos sin duplicar datos.</div>
      </div>
      <div class="roadItem">
        <div class="pill">Próximo</div>
        <div class="roadTitle">Adjuntos y actas</div>
        <div class="roadSub">Carga guiada de comprobantes, actas y archivos (con trazabilidad).</div>
      </div>
      <div class="roadItem">
        <div class="pill">Después</div>
        <div class="roadTitle">Cierres y reportes</div>
        <div class="roadSub">Cierres mensuales, saldos, exportables para PIA / nómina y controles.</div>
      </div>
      <div class="roadItem">
        <div class="pill">Después</div>
        <div class="roadTitle">Accesos y roles</div>
        <div class="roadSub">Reglas para tesorería, comisión, asesoría y lectura comunitaria.</div>
      </div>
    </div>
  </section>

  <footer class="foot">
    <div class="footLeft">
      <div class="footTitle">AppCoop</div>
      <div class="footSub">Gestión colaborativa para cooperadoras escolares bonaerenses. Software libre bajo licencia AGPL-3.0.</div>
    </div>
    <div class="footLinks">
      <a class="link" href={repoUrl} target="_blank" rel="noreferrer">Contribuir</a>
      <a class="link" href={licenseUrl} target="_blank" rel="noreferrer">Licencia</a>
      <a class="link" href={gristDocsUrl} target="_blank" rel="noreferrer">Custom Widgets</a>
    </div>
  </footer>
</main>

<style>
  .wrap {
    max-width: 1040px;
    margin: 0 auto;
    padding: 22px 18px 28px 18px;
  }

  .hero {
    border-radius: 18px;
    border: 1px solid rgba(128, 128, 128, 0.22);
    background:
      radial-gradient(1200px 500px at 10% 0%, rgba(22, 179, 120, 0.18), transparent 55%),
      radial-gradient(900px 420px at 100% 10%, rgba(255, 196, 0, 0.08), transparent 55%),
      rgba(128, 128, 128, 0.06);
    padding: 16px 16px 14px 16px;
  }

  .heroTop {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .badge {
    display: inline-block;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid rgba(22, 179, 120, 0.35);
    background: rgba(22, 179, 120, 0.12);
    font-weight: 800;
    font-size: 12px;
  }

  .heroLinks {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  h1 {
    margin: 10px 0 10px 0;
    font-size: 30px;
    line-height: 1.15;
    letter-spacing: -0.015em;
  }
  .lead {
    margin: 0 0 14px 0;
    opacity: 0.92;
    font-size: 15px;
    line-height: 1.55;
  }
  .cta {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 0 0 8px 0;
  }
  .btn {
    display: inline-block;
    text-decoration: none;
    font-weight: 800;
  }

  .link {
    color: inherit;
    text-decoration: none;
    font-weight: 800;
    font-size: 13px;
    opacity: 0.85;
    border-bottom: 1px solid rgba(128, 128, 128, 0.25);
    padding-bottom: 2px;
  }
  .link:hover {
    opacity: 1;
    border-bottom-color: rgba(22, 179, 120, 0.45);
  }

  .meta {
    opacity: 0.75;
    font-size: 13px;
    margin-top: 10px;
  }

  .heroGrid {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 14px;
    align-items: start;
    margin-top: 6px;
  }

  .heroCard {
    border-radius: 16px;
    border: 1px solid rgba(128, 128, 128, 0.22);
    background: rgba(128, 128, 128, 0.06);
    padding: 14px;
  }

  .kpis {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    margin-bottom: 12px;
  }

  .kpi {
    border: 1px solid rgba(128, 128, 128, 0.18);
    border-radius: 14px;
    padding: 10px 10px;
    background: rgba(128, 128, 128, 0.04);
  }

  .kpiLabel {
    font-size: 12px;
    opacity: 0.75;
    font-weight: 700;
  }

  .kpiValue {
    font-weight: 900;
    margin-top: 2px;
    letter-spacing: -0.01em;
  }

  .heroList {
    display: grid;
    gap: 10px;
  }

  .heroItem {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .heroItemTitle {
    font-weight: 900;
    font-size: 13px;
  }

  .heroItemSub {
    opacity: 0.75;
    font-size: 13px;
    margin-top: 2px;
  }

  .section {
    margin-top: 18px;
  }

  .sectionHead {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }

  h2 {
    margin: 0;
    font-size: 18px;
    letter-spacing: -0.01em;
  }

  .sectionLead {
    margin: 0;
    opacity: 0.78;
    font-size: 13px;
    max-width: 60ch;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .card {
    border-radius: 16px;
    border: 1px solid rgba(128, 128, 128, 0.22);
    background: rgba(128, 128, 128, 0.06);
    padding: 14px;
  }

  .cardTop {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .cardTitle {
    font-weight: 900;
    font-size: 14px;
  }

  .cardSub {
    opacity: 0.75;
    font-size: 13px;
    margin-top: 2px;
  }

  .bullets {
    margin: 10px 0 0 18px;
    padding: 0;
  }

  .bullets li {
    margin: 6px 0;
    opacity: 0.9;
    font-size: 13px;
  }

  .steps {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .step {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    border-radius: 16px;
    border: 1px solid rgba(128, 128, 128, 0.22);
    background: rgba(128, 128, 128, 0.06);
    padding: 12px 12px;
  }

  .stepN {
    width: 28px;
    height: 28px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    border: 1px solid rgba(22, 179, 120, 0.35);
    background: rgba(22, 179, 120, 0.12);
    flex-shrink: 0;
  }

  .stepTitle {
    font-weight: 900;
    font-size: 13px;
  }

  .stepSub {
    opacity: 0.8;
    font-size: 13px;
    margin-top: 2px;
  }

  .callouts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 12px;
  }

  .callout {
    border-radius: 16px;
    border: 1px solid rgba(128, 128, 128, 0.22);
    background: rgba(128, 128, 128, 0.06);
    padding: 14px;
  }

  .calloutTitle {
    font-weight: 900;
    font-size: 14px;
  }

  .calloutSub {
    opacity: 0.82;
    font-size: 13px;
    margin-top: 6px;
    line-height: 1.5;
  }

  .roadmap {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .roadItem {
    border-radius: 16px;
    border: 1px solid rgba(128, 128, 128, 0.22);
    background: rgba(128, 128, 128, 0.06);
    padding: 14px;
  }

  .pill {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 999px;
    font-weight: 900;
    font-size: 12px;
    border: 1px solid rgba(128, 128, 128, 0.24);
    background: rgba(128, 128, 128, 0.06);
    opacity: 0.9;
  }

  .roadTitle {
    margin-top: 10px;
    font-weight: 900;
    font-size: 14px;
  }

  .roadSub {
    opacity: 0.8;
    font-size: 13px;
    margin-top: 6px;
    line-height: 1.5;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.95em;
  }

  .icon {
    width: 28px;
    height: 28px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid rgba(128, 128, 128, 0.2);
    background: rgba(128, 128, 128, 0.04);
  }

  .icon.soft {
    border: 1px solid rgba(22, 179, 120, 0.22);
    background: rgba(22, 179, 120, 0.12);
  }

  .icon svg {
    width: 18px;
    height: 18px;
    opacity: 0.9;
    color: var(--grist-theme-cursor, #16b378);
  }

  .foot {
    margin-top: 22px;
    padding-top: 14px;
    border-top: 1px solid rgba(128, 128, 128, 0.18);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
  }

  .footTitle {
    font-weight: 900;
    font-size: 14px;
  }

  .footSub {
    opacity: 0.75;
    font-size: 13px;
    margin-top: 2px;
    max-width: 70ch;
  }

  .footLinks {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  @media (max-width: 980px) {
    .heroGrid {
      grid-template-columns: 1fr;
    }
    .grid {
      grid-template-columns: 1fr;
    }
    .steps {
      grid-template-columns: 1fr;
    }
    .callouts {
      grid-template-columns: 1fr;
    }
    .roadmap {
      grid-template-columns: 1fr;
    }
    h1 {
      font-size: 26px;
    }
  }
</style>
