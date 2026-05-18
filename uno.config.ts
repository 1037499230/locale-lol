import { defineConfig, presetUno, presetAttributify } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify()
  ],
  shortcuts: [
    ['btn', 'px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600'],
    ['center', 'flex items-center justify-center']
  ]
})