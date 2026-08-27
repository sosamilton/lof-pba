// @ts-check
/**
 * Configuración ESLint para LOF — reglas laxas iniciales.
 *
 * Objetivo: detectar errores reales (imports no usados, variables no
 * declaradas, patrones legacy de Svelte) sin generar ruido masivo sobre
 * el código existente. No se aplica auto-fix retroactivo al código legacy;
 * los nuevos archivos y los que se tocan deben pasar lint.
 */
import js from '@eslint/js'
import sveltePlugin from 'eslint-plugin-svelte'
import globals from 'globals'

export default [
  // Ignorar directorios de build y configuración que no se debe lintear.
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src-tauri/**',
      'public/**',
      '*.config.js',
      '*.config.ts',
      'vite.config.*',
      'svelte.config.*',
      '.nexus/**',
      '.evo-archive-*/**',
    ],
  },
  js.configs.recommended,
  ...sveltePlugin.configs['flat/recommended'],
  {
    // Globales del navegador + Vite define + PouchDB.
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        // Vite define (horneado en build time)
        __APP_VERSION__: 'readonly',
        __APP_SHA__: 'readonly',
        // Vite env vars (inyectadas por .env)
        __VITE_COUCHDB_URL__: 'readonly',
        __VITE_COUCHDB_USER__: 'readonly',
        __VITE_COUCHDB_PASSWORD__: 'readonly',
        __VITE_SYNC_ENABLED__: 'readonly',
        // Grist Widget API (inyectada por el iframe padre)
        grist: 'readonly',
        // PouchDB expone PouchDB global en algunos contextos
        PouchDB: 'readonly',
      },
    },
    rules: {
      // Reglas base para todo el proyecto (JS y Svelte).
      // Detectar código muerto y errores silenciosos — alto valor.
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-undef': 'error',
      'no-unused-labels': 'warn',
      'no-unreachable': 'warn',
      'no-constant-condition': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-console': 'off',
      'no-debugger': 'error',

      // ESLint 10 introdujo reglas nuevas muy estrictas que no aportan
      // valor para adopción inicial — desactivar para no generar ruido.
      'preserve-caught-error': 'off',
      'no-useless-assignment': 'off',

      // Estilo: no forzar, solo advertencias leves.
      'no-var': 'warn',
      'prefer-const': 'warn',
      'eqeqeq': ['warn', 'smart'],

      // No activar reglas de formato — eso es trabajo de Prettier si se agrega.
      'semi': 'off',
      'quotes': 'off',
      'indent': 'off',
      'comma-dangle': 'off',
      'object-curly-spacing': 'off',
      'arrow-parens': 'off',
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        // svelte-eslint-parser necesita saber que usamos runes mode (Svelte 5).
        svelteConfig: {
          runes: true,
        },
      },
    },
    rules: {
      // Svelte 5: prohibir patrones legacy que el proyecto ya no usa.
      'svelte/no-at-html-tags': 'warn',
      'svelte/no-reactive-functions': 'off', // $derived.by usa funciones
      'svelte/no-reactive-literals': 'off', // $state(0) es literal válido
      // prefer-svelte-reactivity es demasiado estricta para adopción inicial:
      // marca cualquier variable no-$state como error, pero muchas variables
      // no necesitan reactividad (ej. handles, caches, configuración estática).
      'svelte/prefer-svelte-reactivity': 'off',
      'svelte/valid-compile': 'error',
      // No forzar keys en each blocks para adopción inicial — el proyecto
      // tiene muchos {#each} sin key en código legacy que funciona bien.
      // Activar esta regla requeriría un PR dedicado de migración.
      'svelte/require-each-key': 'off',
      // No forzar orden de atributos ni estilo de markup — es cosmético.
      'svelte/attributes-order': 'off',
      'svelte/html-self-closing': 'off',
      'svelte/indent': 'off',
      'svelte/max-attributes-per-line': 'off',
      'svelte/no-trailing-spaces': 'off',
    },
  },
  {
    // Tests: permitir describe/it/expect globales sin import.
    files: ['**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
  },
]
