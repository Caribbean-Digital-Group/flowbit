<script setup lang="ts">
/**
 * Enlace del sitio público: rutas relativas al sitio se convierten en
 * NuxtLink (conservando la vista previa); URLs externas y la tienda se
 * renderizan como <a>.
 */
interface Props {
  href: string
  external?: boolean
  newTab?: boolean
}

const props = withDefaults(defineProps<Props>(), { external: false, newTab: false })

const nav = useWebsiteNav()
const isExternal = computed(() => nav.isExternal(props.href, props.external) || props.href.startsWith('/stores/'))
const target = computed(() => (props.newTab ? '_blank' : undefined))
const rel = computed(() => (props.newTab || isExternal.value ? 'noopener' : undefined))
</script>

<template>
  <a v-if="isExternal" :href="href" :target="target" :rel="rel"><slot /></a>
  <NuxtLink v-else :to="nav.to(href)" :target="target"><slot /></NuxtLink>
</template>
