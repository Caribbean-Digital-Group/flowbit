Conduce una entrevista rigurosa sobre este plan: $ARGUMENTS

Tu objetivo es entender completamente cada aspecto del plan antes de que se escriba una sola línea de código.

---

## Cómo conducir la sesión

**Una sola pregunta por turno.** Espera la respuesta antes de avanzar. No hagas varias preguntas a la vez.

**Antes de preguntar, explora el código.** Revisa si ya existe una decisión tomada en:
- `CONTEXT.md` (glosario de dominio)
- `docs/adr/` (decisiones de arquitectura)
- Estructura del código existente

Si la respuesta ya está en el código o en los documentos, nómbrala y pregunta si sigue vigente en lugar de preguntar desde cero.

**Actualiza `CONTEXT.md` en tiempo real.** Cuando un término se aclare durante la conversación, agrégalo o corrígelo en `CONTEXT.md` de inmediato — no esperes al final.

**Usa escenarios concretos.** En lugar de preguntas abstractas, inventa casos límite específicos para exponer ambigüedades:
- "¿Qué pasa si un usuario hace X mientras Y está en estado Z?"
- "¿Cómo se comporta esto cuando hay dos empresas con el mismo nombre?"

---

## Estructura de la sesión

### Fase 1 — Exploración del contexto existente
1. Busca decisiones previas relevantes en `CONTEXT.md` y `docs/adr/`
2. Identifica código existente que pueda restringir o guiar el plan
3. Resume en 2-3 líneas qué restricciones ya están decididas

### Fase 2 — Entrevista progresiva
Para cada aspecto sin resolver, una pregunta a la vez:

- **Terminología**: ¿Cómo se llama X en este sistema? ¿Qué distingue A de B?
- **Límites**: ¿Dónde empieza y termina la responsabilidad de este componente?
- **Dependencias**: ¿Qué otros módulos o datos necesita? ¿Quién lo llama?
- **Casos límite**: ¿Qué pasa con valores nulos, concurrencia, permisos?
- **Reversibilidad**: ¿Qué partes de esta decisión serán difíciles de cambiar después?

### Fase 3 — Consolidación
Cuando el plan esté claro:
1. Resume los acuerdos alcanzados
2. Lista las decisiones que merecen un ADR (difíciles de revertir, sorprendentes, trade-offs reales)
3. Muestra los términos nuevos que se agregaron a `CONTEXT.md`
4. Propón los próximos pasos concretos

---

## Formato de `CONTEXT.md`

Si no existe, créalo. Estructura mínima:

```markdown
# Glosario de dominio — Flowbit

## Términos principales

**[Término]**: Definición en 1-2 oraciones. Qué es, no cómo funciona.
- Evitar: [sinónimos que no se deben usar]
```

Solo términos específicos del proyecto — no conceptos generales de programación.

---

## Formato de ADR (`docs/adr/NNNN-slug.md`)

```markdown
# NNNN — Título de la decisión

Contexto, decisión y razón en 1-3 oraciones. Un ADR puede ser un solo párrafo.
```

Solo crear un ADR si la decisión cumple los tres criterios:
1. Es difícil de revertir
2. Sorprendería a un desarrollador futuro sin explicación
3. Representa un trade-off real entre alternativas

---

Comienza explorando el codebase y los documentos existentes, luego inicia la primera pregunta.
