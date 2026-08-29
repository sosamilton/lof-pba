<script>
  import { untrack } from 'svelte'
  import { useSidebar } from '$lib/components/ui/sidebar/context.svelte.js'
  import { router } from '$core/ui/router.svelte'

  /**
   * Cierra el sidebar mobile automáticamente al cambiar de ruta.
   *
   * Se renderiza dentro de <Sidebar.Provider> (que setea el contexto).
   * AppShell no puede usar useSidebar() directamente porque es el padre
   * del Provider, por eso este componente existe como hijo intermedio.
   */
  const sidebar = useSidebar()

  let lastRoute = untrack(() => router.current)

  $effect(() => {
    const route = router.current
    if (route !== lastRoute) {
      lastRoute = route
      if (sidebar.isMobile && sidebar.openMobile) {
        sidebar.setOpenMobile(false)
      }
    }
  })
</script>

<!-- Sin UI visible -->
