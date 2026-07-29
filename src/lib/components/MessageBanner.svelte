<script>
  let { error = '', notice = '' } = $props()
</script>

{#if error}
  <div class="msg error">{error}</div>
{/if}
{#if notice}
  <div class="msg notice">{notice}</div>
{/if}
