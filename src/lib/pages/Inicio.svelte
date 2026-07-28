<script>
  import { isInGrist } from '../grist'
</script>

<div class="page">
  <h1>AppCoop</h1>
  {#if isInGrist()}
    <p>Modo widget Grist detectado.</p>
    <p>Usá el menú para navegar.</p>
  {:else}
    <p>Esta demo está pensada para ejecutarse dentro de Grist como Custom Widget.</p>
    <p>Al abrirla desde un navegador, no tiene acceso a los datos del documento.</p>
    <div class="card">
      <p><strong>Cómo instalarla en un documento Grist</strong></p>
      <ol>
        <li>Abrí tu documento</li>
        <li><span class="mono">Add New</span> → <span class="mono">Add Widget to Page</span> → <span class="mono">Custom</span></li>
        <li>Pegá la URL publicada (GitHub Pages)</li>
        <li>Elegí <span class="mono">Access level</span>: <strong>Full document access</strong></li>
      </ol>
    </div>
  {/if}
</div>

<style>
  .page h1 {
    margin: 0 0 10px 0;
    font-size: 22px;
  }
  .page p {
    margin: 6px 0;
    opacity: 0.85;
  }
  .card {
    margin-top: 12px;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid rgba(128, 128, 128, 0.25);
    background: rgba(128, 128, 128, 0.08);
  }
  .card ol {
    margin: 8px 0 0 18px;
    padding: 0;
  }
  .card li {
    margin: 6px 0;
  }
  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.95em;
  }
</style>
