import { gristReady, resolveTableId, applyUserActions, invalidateTablesCache, fetchRecords, addRecords } from '$core/grist/grist'
import { ensureSchema, initDemoData } from './initLof'
import { TABLE_PREFERRED_IDS, MODULES, fechasEjercicio } from '$core/utils/utils'
import { saveConfig } from '$app/pages/cooperadora/cooperadoraApi.js'
import { normalizeEmail, normalizeTelefonoForStorage, isValidCbuChecksum } from '$core/format/format'
import { currentYear } from './setupConstants'

/**
 * Lógica de instalación: crea tablas, registros iniciales y config.
 * Extraída de SetupStore.doInstall (~206 líneas de side effects).
 * @param {any} s - Instancia del store
 */
export async function doInstall(s) {
  s.installing = true
  s.error = ''
  try {
    // Invalidar cache de tablas para que ensureSchema vea el estado real de Grist.
    invalidateTablesCache()

    const schemaResult = await ensureSchema()
    const schemaErrors = schemaResult?.errors
    if (schemaErrors && schemaErrors.length > 0) {
      s.error = `Errores de schema: ${schemaErrors.join(', ')}`
      return
    }

    const tEscuela = await resolveTableId(TABLE_PREFERRED_IDS.escuela)
    if (tEscuela) {
      let existingEscuela = []
      try { existingEscuela = await fetchRecords(tEscuela) } catch { /* empty */ }
      if (existingEscuela.length === 0) {
        const cueDigits = s.schoolData.cue.replace(/\D/g, '')
        const cuitDigits = s.schoolData.cuit.replace(/\D/g, '')
        const telEscuelaStored = normalizeTelefonoForStorage(s.schoolData.telefono_escuela)
        const telStored = normalizeTelefonoForStorage(s.schoolData.telefono)
        // datos_validados = true solo si la escuela se encontró en el índice
        // oficial (CUE matcheado). Si se cargó manualmente (not_found), false.
        const escuelaValidada = s.cueState === 'found'
        try {
          await applyUserActions([['AddRecord', tEscuela, null, {
            escuela_nombre: s.schoolData.escuela_nombre || '',
            escuela_numero: s.schoolData.escuela_numero || '',
            cue: cueDigits || '',
            distrito: s.schoolData.distrito || '',
            cooperadora_nombre: s.schoolData.cooperadora_nombre || '',
            cuit: cuitDigits || '',
            domicilio: s.schoolData.domicilio || '',
            localidad: s.schoolData.localidad || '',
            email_cooperadora: normalizeEmail(s.schoolData.email) || '',
            telefono_cooperadora: telStored || '',
            email_escuela: s.schoolData.email_escuela || '',
            telefono_escuela: telEscuelaStored || '',
            datos_validados: escuelaValidada
          }]])
        } catch (recErr) {
          const msg = String(recErr?.message || recErr || '')
          if (msg.includes('KeyError')) {
            throw new Error(
              `No se pudo crear el registro de escuela porque faltan columnas en la tabla de Grist. ` +
              `Abrí el documento de Grist, andá a la tabla "escuela" y agregá manualmente las columnas ` +
              `que falten (ej: email_escuela, telefono_escuela). Detalle: ${msg}`
            )
          }
          throw recErr
        }
      }
    }

    const tBanco = await resolveTableId(TABLE_PREFERRED_IDS.datos_banco)
    if (tBanco) {
      let existingBanco = []
      try { existingBanco = await fetchRecords(tBanco) } catch { /* empty */ }
      if (existingBanco.length === 0) {
        const cbuDigits = s.banco.cbu.replace(/\D/g, '')
        const bancoValidado = Boolean(cbuDigits && isValidCbuChecksum(cbuDigits))
        await applyUserActions([['AddRecord', tBanco, null, {
          entidad: s.banco.entidad,
          tipo_cuenta: s.banco.tipo_cuenta,
          sucursal: s.banco.sucursal || '',
          cuenta_corriente: s.banco.cuenta_corriente || '',
          cbu: cbuDigits || '',
          vigente_desde: new Date().toISOString().slice(0, 10),
          banco_validado: bancoValidado
        }]])
      }
    }

    const tKiosco = await resolveTableId(TABLE_PREFERRED_IDS.kiosco_libreria)
    if (tKiosco) {
      let existingKiosco = []
      try { existingKiosco = await fetchRecords(tKiosco) } catch { /* empty */ }
      if (existingKiosco.length === 0) {
        await applyUserActions([['AddRecord', tKiosco, null, {
          posee: Boolean(s.kiosco.posee),
          modalidad: s.kiosco.posee ? (s.kiosco.modalidad || 'Propio') : null,
          contrato_desde: s.kiosco.posee && s.kiosco.modalidad === 'Licitado' ? (s.kiosco.contrato_desde || null) : null,
          contrato_hasta: s.kiosco.posee && s.kiosco.modalidad === 'Licitado' ? (s.kiosco.contrato_hasta || null) : null
        }]])
      }
    }

    /** @type {Record<string, boolean>} */
    const moduleFlags = {}
    for (const key of Object.keys(MODULES)) {
      moduleFlags[`modulo_${key}`] = Boolean(s.selectedModules[key])
    }

    await saveConfig({
      ...moduleFlags,
      // Solo cache de UI: lo que AppShell necesita al arranque sin cargar
      // la tabla escuela completa. Los datos operacionales viven en escuela.
      escuela_nombre: s.schoolData.escuela_nombre || '',
      cooperadora_nombre: s.schoolData.cooperadora_nombre || '',
      color_primario: s.schoolData.color_primario || '#16b378',
      cuenta_default_id: null,
      instalado: true,
      fecha_instalacion: new Date().toISOString(),
      // Versión del bundle que se instaló: permite comparar contra la versión
      // actual (horneada en el bundle que corre) y detectar si la app instalada
      // quedó desactualizada respecto del deploy más reciente.
      version_instalada: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
      sha_instalado: typeof __APP_SHA__ !== 'undefined' ? __APP_SHA__ : 'dev'
    })

    const needsEjercicio = s.selectedModules.gestion_integral || s.selectedModules.carga_consolidada
    const needsCargos = s.selectedModules.gestion_integral || s.selectedModules.carga_consolidada

    if (needsEjercicio) {
      const tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
      if (tEjercicios) {
        let existingEj = []
        try { existingEj = await fetchRecords(tEjercicios) } catch { /* empty */ }
        if (existingEj.length === 0) {
          const { fechaInicio, fechaFin } = fechasEjercicio(s.ejercicio)
          await applyUserActions([['AddRecord', tEjercicios, null, {
            anio_inicio: Number(s.ejercicio.anio_inicio) || currentYear,
            anio_fin: Number(s.ejercicio.anio_fin) || currentYear + 1,
            mes_inicio: s.ejercicio.mes_inicio || 'Mayo',
            fecha_inicio: fechaInicio || null,
            fecha_fin: fechaFin || null,
            saldo_inicial_banco: Number(s.ejercicio.saldo_inicial_banco) || 0,
            saldo_inicial_efectivo: Number(s.ejercicio.saldo_inicial_efectivo) || 0,
            saldo_inicial_caja_chica: Number(s.ejercicio.saldo_inicial_caja_chica) || 0,
            en_curso: true,
            observaciones: 'Ejercicio inicial'
          }]])
        }
      }
    }

    if (needsCargos) {
      const tCargos = await resolveTableId(TABLE_PREFERRED_IDS.cargos)
      if (tCargos) {
        let existingCargos = []
        try { existingCargos = await fetchRecords(tCargos) } catch { /* empty */ }
        if (existingCargos.length === 0 && s.cargos.length > 0) {
          const records = s.cargos.map((c) => ({
            organismo: c.organismo,
            nombre_cargo: c.nombre_cargo,
            orden: c.orden,
            duracion_meses: Number(c.duracion_meses) || 12,
            grupo_renovacion: c.grupo_renovacion || null,
            cargo_obligatorio: Boolean(c.cargo_obligatorio),
            nivel: c.nivel || null,
            activo: Boolean(c.activo)
          }))
          await addRecords(tCargos, records)
        }
      }
    }

    const seeds = []
    if (s.selectedModules.gestion_integral || s.selectedModules.carga_consolidada) {
      seeds.push({ tableId: await resolveTableId(TABLE_PREFERRED_IDS.cuentas), seedName: 'cuentas', batchSize: 50 })
    }
    if (needsEjercicio) {
      seeds.push({ tableId: await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia), seedName: 'rubros_pia', batchSize: 100 })
    }
    if (seeds.length > 0) {
      await initDemoData(seeds)
    }

    // Buscar la cuenta default ahora que los seeds ya cargaron las cuentas
    if (s.cuentaDefault) {
      try {
        const tCuentas = await resolveTableId(TABLE_PREFERRED_IDS.cuentas)
        if (tCuentas) {
          const cuentasRecs = await fetchRecords(tCuentas)
          const match = cuentasRecs.find((c) => String(c.nombre_cuenta) === s.cuentaDefault)
          if (match) {
            await saveConfig({ cuenta_default_id: match.id })
          }
        }
      } catch { /* empty */ }
    }

    // Solo dev: generar datos de prueba si el usuario lo solicitó.
    if (import.meta.env.DEV && s.cargarDatosPrueba) {
      s.datosPruebaProgress = 'Generando datos de prueba...'
      try {
        const { generarDatosPrueba } = await import('./generadorDemo')
        await generarDatosPrueba({
          cantPersonas: Number(s.datosPruebaConfig.cantPersonas) || 500,
          cantSocios: Number(s.datosPruebaConfig.cantSocios) || 400,
          cantMovimientos: Number(s.datosPruebaConfig.cantMovimientos) || 2000,
          batchSize: Number(s.datosPruebaConfig.batchSize) || 100,
          gestionIntegral: Boolean(s.selectedModules.gestion_integral),
          cargaConsolidada: Boolean(s.selectedModules.carga_consolidada),
          cantAsambleas: Number(s.datosPruebaConfig.cantAsambleas) || 1,
          cantEjercicios: Number(s.datosPruebaConfig.cantEjercicios) || 1,
          onProgress: (msg) => { s.datosPruebaProgress = msg },
        })
      } catch (e) {
        console.error('[demo] Error generando datos de prueba:', e)
        s.error = `Datos de prueba: ${e?.message || String(e)}`
      }
    }

    // Limpieza post-instalación: renombrar página del widget
    await cleanupDefaultTable()

    invalidateTablesCache()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    window.location.reload()
  } catch (e) {
    s.error = e?.message || String(e)
  } finally {
    s.installing = false
  }
}

/**
 * Renombra la página donde está el widget a "🤝 LOF-PBA".
 * Grist muestra como ícono de página el primer emoji del nombre.
 * Las páginas son registros en la metadata table _grist_Views.
 */
async function cleanupDefaultTable() {
  try {
    const views = await fetchRecords('_grist_Views', { columns: ['id', 'name'] })
    if (views.length > 0) {
      let target = views.find((v) => String(v.name) !== 'Table1')
      if (!target) target = views[0]
      const pageName = '🤝 LOF-PBA'
      if (String(target.name) !== pageName) {
        await applyUserActions([['UpdateRecord', '_grist_Views', target.id, { name: pageName }]])
      }
    }
  } catch (e) {
    console.warn('[cleanup] No se pudo renombrar la página:', e?.message || e)
  }
}
