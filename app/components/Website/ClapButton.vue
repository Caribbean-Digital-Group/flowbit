<script setup lang="ts">
import { storeToRefs } from 'pinia'

interface Props {
  postSlug: string
  count: number
}

const props = defineProps<Props>()
const emit = defineEmits<{ update: [count: number] }>()

const websiteStore = useWebsiteStore()
const { slug } = storeToRefs(websiteStore)
const { react } = useWebsite()

const STORAGE_PREFIX = 'flowbit:website-claps:'
const myCount = ref(0)
const pop = ref(false)
let pending = 0
let timer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  try {
    myCount.value = Number(window.localStorage.getItem(`${STORAGE_PREFIX}${slug.value}:${props.postSlug}`) ?? 0)
  } catch {
    myCount.value = 0
  }
})

const flush = async () => {
  const visitorId = getWebsiteVisitorId()
  if (!slug.value || !visitorId || pending <= 0) return
  const increment = pending
  pending = 0
  const result = await react(slug.value, props.postSlug, visitorId, increment)
  if (result) {
    myCount.value = result.my_count
    emit('update', result.clap_count)
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${slug.value}:${props.postSlug}`, String(result.my_count))
    } catch {
      // modo privado
    }
  }
}

const clap = () => {
  if (myCount.value + pending >= 50) return
  pending += 1
  pop.value = false
  void nextTick(() => { pop.value = true })
  emit('update', props.count + 1)
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void flush(), 600)
}
</script>

<template>
  <button
    type="button"
    :class="['ws-clap inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold transition-colors', pop ? 'ws-clap--pop' : '']"
    :style="{ borderColor: 'var(--sf-border)', color: myCount > 0 ? 'var(--sf-primary-readable)' : 'var(--sf-text-muted)', backgroundColor: myCount > 0 ? 'var(--sf-primary-soft)' : 'transparent' }"
    :aria-label="`Aplaudir (${count})`"
    @click="clap"
    @animationend="pop = false"
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M7 11.5V14a6 6 0 0012 0v-4.5a1.5 1.5 0 00-3 0V12M13 9.5V5.5a1.5 1.5 0 00-3 0V12M10 7.5V4.5a1.5 1.5 0 00-3 0v7M7 11.5V9a1.5 1.5 0 00-3 0v5.5" /></svg>
    <span>{{ count }}</span>
    <span v-if="myCount > 0" class="text-xs opacity-70">+{{ myCount }}</span>
  </button>
</template>
