<script setup lang="ts">
import QRCode from 'qrcode'

interface Props {
  pickingId: string
  pickingName: string
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 160
})

const config = useRuntimeConfig()
const svgContent = ref('')
const isReady = ref(false)

const scanUrl = computed(
  () => `${config.public.siteUrl}/admin/pickings/${props.pickingId}/scan`
)

onMounted(async () => {
  svgContent.value = await QRCode.toString(scanUrl.value, {
    type: 'svg',
    width: props.size,
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' }
  })
  isReady.value = true
})
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <div
      class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
      :style="{ width: `${size + 24}px`, height: `${size + 24}px` }"
    >
      <div
        v-if="isReady"
        class="w-full h-full"
        v-html="svgContent"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center"
        :style="{ width: `${size}px`, height: `${size}px` }"
      >
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    </div>
    <div class="text-center">
      <p class="text-xs font-semibold text-slate-700">{{ pickingName }}</p>
      <p class="text-xs text-slate-400">Escanea para abrir en dispositivo</p>
    </div>
  </div>
</template>
