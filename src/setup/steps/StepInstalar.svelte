<script>
  import * as Card from '$lib/components/ui/card'
  import { MODULES } from '../setupStore.svelte'

  let { store } = $props()
</script>

<Card.Root class="mb-4">
  <Card.Content class="pt-6">
    <h2 class="text-[17px] font-bold mb-1.5">Revisá y instalá</h2>
    <p class="text-[13px] text-muted-foreground mb-4">Se crearán las tablas necesarias y se guardará la configuración.</p>

    <div class="flex flex-col gap-3.5">
      <div class="p-3 rounded-lg border border-border bg-muted/5">
        <div class="font-extrabold text-[13px] mb-1.5">Módulos seleccionados</div>
        <ul class="m-0 pl-4.5 list-disc">
          {#each store.selectedModuleKeys as key}
            <li class="text-[13px] my-0.5">{MODULES[key].label}</li>
          {/each}
        </ul>
      </div>
      <div class="p-3 rounded-lg border border-border bg-muted/5">
        <div class="font-extrabold text-[13px] mb-1.5">Tablas a crear</div>
        <div class="text-xl font-black">{store.tableCount} tablas</div>
      </div>
      {#if store.schoolData.escuela_nombre || store.schoolData.cooperadora_nombre}
        <div class="p-3 rounded-lg border border-border bg-muted/5">
          <div class="font-extrabold text-[13px] mb-1.5">Escuela</div>
          <div class="text-[13px] text-muted-foreground">
            {store.schoolData.escuela_nombre || 'Sin nombre'}
            {#if store.schoolData.escuela_numero}· N° {store.schoolData.escuela_numero}{/if}
          </div>
          <div class="text-[13px] text-muted-foreground">{store.schoolData.cooperadora_nombre || ''}</div>
        </div>
      {/if}
      <div class="p-3 rounded-lg border border-border bg-muted/5">
        <div class="font-extrabold text-[13px] mb-1.5">Banco</div>
        <div class="text-[13px] text-muted-foreground">{store.banco.entidad} · {store.banco.tipo_cuenta}</div>
        {#if store.banco.cbu}
          <div class="text-[13px] text-muted-foreground">CBU: {store.banco.cbu}</div>
        {/if}
      </div>
      <div class="p-3 rounded-lg border border-border bg-muted/5">
        <div class="font-extrabold text-[13px] mb-1.5">Cuenta default</div>
        <div class="text-[13px] text-muted-foreground">{store.cuentaDefault}</div>
      </div>
      <div class="p-3 rounded-lg border border-border bg-muted/5">
        <div class="font-extrabold text-[13px] mb-1.5">Kiosco / librería</div>
        <div class="text-[13px] text-muted-foreground">
          {#if store.kiosco.posee}
            Sí · {store.kiosco.modalidad}
            {#if store.kiosco.modalidad === 'Licitado' && store.kiosco.contrato_desde}
              · {store.kiosco.contrato_desde} → {store.kiosco.contrato_hasta || 's/d'}
            {/if}
          {:else}
            No
          {/if}
        </div>
      </div>
      <div class="p-3 rounded-lg border border-border bg-muted/5">
        <div class="font-extrabold text-[13px] mb-1.5">Ejercicio</div>
        <div class="text-[13px] text-muted-foreground">{store.ejercicio.mes_inicio} {store.ejercicio.anio_inicio} → {store.ejercicio.anio_fin}</div>
      </div>
      <div class="p-3 rounded-lg border border-border bg-muted/5">
        <div class="font-extrabold text-[13px] mb-1.5">Cargos</div>
        <div class="text-[13px] text-muted-foreground">{store.cargos.length} cargo(s) configurado(s)</div>
        <div class="text-[13px] text-muted-foreground">Federación: {store.federacionAdherida ? 'adherida' : 'no adherida'}</div>
      </div>
    </div>

    {#if store.isDev}
      <div class="mt-4 p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/5">
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={store.cargarDatosPrueba}
            class="mt-0.5 size-4 accent-amber-600 shrink-0"
          />
            <div>
            <div class="font-bold text-[13px] text-amber-700 dark:text-amber-400">Cargar datos de prueba (dev)</div>
            <p class="text-[12px] text-muted-foreground mt-0.5 m-0">
              Genera {store.datosPruebaConfig.cantPersonas} personas, {store.datosPruebaConfig.cantSocios} socios, {store.datosPruebaConfig.cantMovimientos} movimientos, 1 asamblea AGO y
              autoridades de CD/CRC con Refs resueltas para probar performance de listados
              y filtros. Solo disponible en desarrollo.
            </p>
          </div>
        </label>
        {#if store.datosPruebaProgress}
          <div class="mt-2 text-[12px] text-amber-700 dark:text-amber-400">{store.datosPruebaProgress}</div>
        {/if}
      </div>
    {/if}

    {#if store.installing}
      <div class="flex items-center gap-3 mt-4 p-3.5 rounded-xl border border-primary/30 bg-primary/5">
        <div class="size-5 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin shrink-0"></div>
        <p class="text-sm m-0">Instalando tablas y configuración…</p>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
