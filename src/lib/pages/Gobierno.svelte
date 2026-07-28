<script>
  import { isInGrist } from '../grist'
</script>

<h1>Gobierno</h1>
{#if isInGrist()}
  <p>Próximo paso: registrar asambleas y comisión desde la SPA.</p>
{:else}
  <p>Esta pantalla solo funciona dentro de Grist.</p>
{/if}

<style>
  h1 {
    margin: 0 0 10px 0;
    font-size: 18px;
  }
  p {
    margin: 6px 0;
    opacity: 0.85;
  }
</style>

