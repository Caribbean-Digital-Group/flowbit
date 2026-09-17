<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Youtube from '@tiptap/extension-youtube'
import { Placeholder } from '@tiptap/extensions'
import type { JSONContent } from '@tiptap/core'

/**
 * Editor de texto enriquecido (Tiptap) para posts y secciones de texto.
 *
 * mode = 'json': v-model es el documento Tiptap (posts).
 * mode = 'html': v-model es HTML (props de secciones). En ambos casos el HTML
 * definitivo se genera y sanea en servidor antes de guardarse.
 * Debe usarse dentro de <ClientOnly>.
 */
interface Props {
  mode?: 'json' | 'html'
  placeholder?: string
  companyId: string
  compact?: boolean
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'json',
  placeholder: 'Empieza a escribir…',
  compact: false,
  readonly: false
})

const modelValue = defineModel<JSONContent | string | null>({ default: null })
const emit = defineEmits<{ stats: [payload: { words: number; characters: number }] }>()

const pickerOpen = ref(false)
const linkDialog = ref(false)
const linkUrl = ref('')
const videoDialog = ref(false)
const videoUrl = ref('')

let lastEmitted = ''

const initialContent = (): JSONContent | string => {
  if (props.mode === 'html') return typeof modelValue.value === 'string' ? modelValue.value : ''
  return (modelValue.value && typeof modelValue.value === 'object') ? modelValue.value : { type: 'doc', content: [{ type: 'paragraph' }] }
}

const editor = useEditor({
  content: initialContent(),
  editable: !props.readonly,
  extensions: [
    StarterKit.configure({
      heading: { levels: props.compact ? [2, 3] : [1, 2, 3, 4] },
      link: { openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto', 'tel'] }
    }),
    Image.configure({ inline: false, allowBase64: false }),
    Youtube.configure({ nocookie: true }),
    Placeholder.configure({ placeholder: props.placeholder })
  ],
  editorProps: {
    attributes: { class: 'ws-prose ws-prose--compact focus:outline-none' }
  },
  onUpdate: ({ editor: instance }) => {
    if (props.mode === 'html') {
      const html = instance.isEmpty ? '' : instance.getHTML()
      lastEmitted = html
      modelValue.value = html
    } else {
      const json = instance.getJSON()
      lastEmitted = JSON.stringify(json)
      modelValue.value = json
    }
    const text = instance.getText()
    emit('stats', { words: text.trim() ? text.trim().split(/\s+/).length : 0, characters: text.length })
  }
})

watch(modelValue, (value) => {
  const instance = editor.value
  if (!instance) return
  const serialized = props.mode === 'html' ? String(value ?? '') : JSON.stringify(value ?? {})
  if (serialized === lastEmitted) return
  lastEmitted = serialized
  instance.commands.setContent(props.mode === 'html' ? String(value ?? '') : (value as JSONContent) ?? { type: 'doc', content: [] }, { emitUpdate: false })
})

watch(() => props.readonly, (value) => editor.value?.setEditable(!value))

const openLinkDialog = () => {
  linkUrl.value = editor.value?.getAttributes('link').href ?? ''
  linkDialog.value = true
}

const applyLink = () => {
  const url = linkUrl.value.trim()
  if (!url) {
    editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
  } else {
    editor.value?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }
  linkDialog.value = false
}

const insertImage = (payload: { url: string; alt: string }) => {
  editor.value?.chain().focus().setImage({ src: payload.url, alt: payload.alt }).run()
}

const applyVideo = () => {
  const url = videoUrl.value.trim()
  if (url) editor.value?.chain().focus().setYoutubeVideo({ src: url }).run()
  videoUrl.value = ''
  videoDialog.value = false
}

const isActive = (name: string, attrs?: Record<string, unknown>) => editor.value?.isActive(name, attrs) ?? false

interface ToolbarButton {
  id: string
  label: string
  icon: string
  action: () => void
  active?: () => boolean
  hidden?: boolean
}

const toolbar = computed<ToolbarButton[]>(() => [
  { id: 'bold', label: 'Negrita', icon: 'M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z', action: () => editor.value?.chain().focus().toggleBold().run(), active: () => isActive('bold') },
  { id: 'italic', label: 'Cursiva', icon: 'M14 5h5M5 19h5M15 5l-6 14', action: () => editor.value?.chain().focus().toggleItalic().run(), active: () => isActive('italic') },
  { id: 'underline', label: 'Subrayado', icon: 'M7 4v6a5 5 0 0010 0V4M5 20h14', action: () => editor.value?.chain().focus().toggleUnderline().run(), active: () => isActive('underline') },
  { id: 'strike', label: 'Tachado', icon: 'M5 12h14M16 7a4 4 0 00-8 0M8 17a4 4 0 008 0', action: () => editor.value?.chain().focus().toggleStrike().run(), active: () => isActive('strike') },
  { id: 'h2', label: 'Título', icon: 'M4 6v12M4 12h8M12 6v12M17 18v-8l-2 1.5', action: () => editor.value?.chain().focus().toggleHeading({ level: 2 }).run(), active: () => isActive('heading', { level: 2 }) },
  { id: 'h3', label: 'Subtítulo', icon: 'M4 6v12M4 12h8M12 6v12M16 10h4l-2.5 3a2 2 0 11-1.5 3.5', action: () => editor.value?.chain().focus().toggleHeading({ level: 3 }).run(), active: () => isActive('heading', { level: 3 }) },
  { id: 'bullet', label: 'Lista', icon: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01', action: () => editor.value?.chain().focus().toggleBulletList().run(), active: () => isActive('bulletList') },
  { id: 'ordered', label: 'Lista numerada', icon: 'M10 6h10M10 12h10M10 18h10M4 5l1-1v4M4 11.5c1-1 2 0 1 1l-1 1.5h2M4 17h1.5a1 1 0 010 2H5m.5 0a1 1 0 010 2H4', action: () => editor.value?.chain().focus().toggleOrderedList().run(), active: () => isActive('orderedList') },
  { id: 'quote', label: 'Cita', icon: 'M7 8h4v4H7zM13 8h4v4h-4zM7 12c0 2-1 3-3 3M13 12c0 2-1 3-3 3', action: () => editor.value?.chain().focus().toggleBlockquote().run(), active: () => isActive('blockquote') },
  { id: 'code', label: 'Bloque de código', icon: 'M8 8l-4 4 4 4m8-8l4 4-4 4', action: () => editor.value?.chain().focus().toggleCodeBlock().run(), active: () => isActive('codeBlock'), hidden: props.compact },
  { id: 'link', label: 'Enlace', icon: 'M13.8 10.2a4 4 0 010 5.6l-2.8 2.8a4 4 0 01-5.6-5.6l1.4-1.4m3.4-1.4a4 4 0 010-5.6l2.8-2.8a4 4 0 015.6 5.6l-1.4 1.4', action: openLinkDialog, active: () => isActive('link') },
  { id: 'image', label: 'Imagen', icon: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01', action: () => { pickerOpen.value = true } },
  { id: 'video', label: 'Video de YouTube', icon: 'M4 6h16v12H4zM10 9l5 3-5 3V9z', action: () => { videoDialog.value = true }, hidden: props.compact },
  { id: 'hr', label: 'Separador', icon: 'M4 12h16', action: () => editor.value?.chain().focus().setHorizontalRule().run() },
  { id: 'undo', label: 'Deshacer', icon: 'M9 14l-4-4 4-4M5 10h9a5 5 0 010 10h-3', action: () => editor.value?.chain().focus().undo().run() },
  { id: 'redo', label: 'Rehacer', icon: 'M15 14l4-4-4-4M19 10h-9a5 5 0 000 10h3', action: () => editor.value?.chain().focus().redo().run() }
])

onBeforeUnmount(() => editor.value?.destroy())
</script>

<template>
  <div :class="['ws-editor rounded-2xl border border-slate-200 bg-white overflow-hidden', readonly ? 'opacity-80' : '']">
    <div v-if="!readonly" class="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
      <template v-for="button in toolbar" :key="button.id">
        <button
          v-if="!button.hidden"
          type="button"
          :class="['p-2 rounded-lg transition-colors', button.active?.() ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900']"
          :title="button.label"
          :aria-label="button.label"
          @click="button.action()"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="button.icon" /></svg>
        </button>
      </template>
    </div>

    <EditorContent :editor="editor" :class="compact ? '[&_.tiptap]:min-h-[10rem]' : ''" />

    <div v-if="linkDialog" class="border-t border-slate-100 bg-slate-50 px-4 py-3 flex flex-col sm:flex-row gap-2 sm:items-end">
      <FormInput v-model="linkUrl" label="URL del enlace" type="url" placeholder="https://…" size="sm" class="flex-1" @keydown.enter.prevent="applyLink" />
      <div class="flex gap-2">
        <BtnApp label="Aplicar" size="sm" @click="applyLink" />
        <BtnApp label="Cancelar" size="sm" variant="ghost" @click="linkDialog = false" />
      </div>
    </div>

    <div v-if="videoDialog" class="border-t border-slate-100 bg-slate-50 px-4 py-3 flex flex-col sm:flex-row gap-2 sm:items-end">
      <FormInput v-model="videoUrl" label="URL de YouTube" type="url" placeholder="https://www.youtube.com/watch?v=…" size="sm" class="flex-1" @keydown.enter.prevent="applyVideo" />
      <div class="flex gap-2">
        <BtnApp label="Insertar" size="sm" @click="applyVideo" />
        <BtnApp label="Cancelar" size="sm" variant="ghost" @click="videoDialog = false" />
      </div>
    </div>

    <WebsiteMediaPicker v-model:open="pickerOpen" :company-id="companyId" folder="blog" @select="insertImage" />
  </div>
</template>
