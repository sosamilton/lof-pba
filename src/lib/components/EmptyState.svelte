<script>
  let { title, sub = '', children } = $props()
</script>

<div class="empty">
  <div class="emptyTitle">{title}</div>
  {#if sub}
    <div class="emptySub">{sub}</div>
  {/if}
  {#if children}
    <div class="emptyActions">
      {@render children()}
    </div>
  {/if}
</div>
