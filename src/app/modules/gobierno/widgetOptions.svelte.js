import { getWidgetOptions, setWidgetOption } from '$core/grist/grist.js'

/**
 * Persistencia de widget options: tab activo y organismo seleccionado.
 * Se persisten en Grist via setWidgetOption para sobrevivir recargas.
 *
 * @returns {{
 *   tab: string, organismo: string,
 *   setTab: (t: string) => Promise<void>,
 *   setOrganismo: (o: string) => Promise<void>,
 *   initFromOptions: () => Promise<void>,
 * }}
 */
export function createWidgetOptions() {
  let tab = $state('asambleas')
  let organismo = $state('CD')

  const setTab = async (t) => {
    tab = t
    await setWidgetOption('gobiernoTab', t)
  }

  const setOrganismo = async (o) => {
    organismo = o
    await setWidgetOption('gobiernoOrganismo', o)
  }

  const initFromOptions = async () => {
    const opts = await getWidgetOptions()
    if (opts?.gobiernoTab) tab = opts.gobiernoTab
    if (opts?.gobiernoOrganismo) organismo = opts.gobiernoOrganismo
  }

  return {
    get tab() { return tab },
    get organismo() { return organismo },
    setTab,
    setOrganismo,
    initFromOptions,
  }
}
