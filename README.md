# Simulador de pruebas escritas · INMLCF 2026

Simulador web para practicar las pruebas escritas del **Proceso de Selección INMLCF 2026** (carrera especial del Instituto Nacional de Medicina Legal y Ciencias Forenses). Su estructura sigue el **Anexo Técnico de la Licitación INMLCF-LP-004-SG-2026** y retoma la forma de práctica de los simulacros de Misión Mérito: casos, hoja de respuestas, retroalimentación y justificación de la clave.

**Usarlo en línea:** https://fagarciafo.github.io/simulador-inmlcf/

## Qué hace

| Función | Detalle |
|---|---|
| Estructura del Anexo | Profesional y técnico: 145 ítems (90 funcionales y 55 comportamentales e integridad). Asistencial: 109 ítems (54 y 55). Se reparten por componente e indicador según las Tablas 7, 8 y 9. |
| Formato de ítem | Juicio situacional: un enunciado con el incidente crítico y tres opciones (A, B, C). |
| Calificación | Escala de 0,00 a 100,00 con dos decimales truncados. Funcionales es eliminatoria (mínimo 65,00). La ponderación es 65/35 para los grupos 1 y 2, y 50/30/20 para los grupos 3 y 4. |
| Modos | Prueba completa, solo funcionales, solo comportamentales, por componente, casos estilo Misión Mérito, práctica rápida y repaso de errores. |
| Retroalimentación | Al final, como en la prueba real, o inmediata. Incluye la justificación de la clave y de los distractores y el resultado por componente e indicador. |
| Documentos | Carga PDF, DOCX, TXT o MD. El texto se divide en fragmentos y cada uno se caracteriza: indicador sugerido, tipo de fragmento y normas citadas. A partir de ahí se generan ítems con Gemini o Claude (usando tu API key) o como borradores automáticos sin conexión. |
| Banco | 145 ítems originales para el nivel profesional y 3 casos estilo Misión Mérito. El banco personal se guarda en el navegador y se puede exportar e importar en JSON. |
| Historial | Registra los resultados de cada simulacro en el navegador. |

## Estructura del repositorio

```
index.html, app.js, styles.css   aplicación (sin servidor; funciona en GitHub Pages o abriendo index.html)
data/estructura.json             tablas del Anexo, indicadores (editables) y reglas de calificación
data/banco.json / banco.js       banco base compilado
fuentes/*.json                   ítems fuente por componente (edítalos aquí)
tools/build_banco.py             valida (3 opciones, clave, indicador) y compila el banco
lib/                             pdf.js y mammoth (lectura local de PDF y DOCX)
```

Para agregar o corregir ítems del banco base, edita `fuentes/` y ejecuta `python3 tools/build_banco.py`.

## Notas

- Los ítems son **originales** y sirven para estudiar. Los ítems reales del proceso son inéditos y reservados (Anexo Técnico, p. 52).
- Los indicadores de `data/estructura.json` son una propuesta. Los definitivos los fija la *Matriz de Estructura de Pruebas Escritas* y el diccionario de ejes temáticos del INMLCF; ajústalos cuando se publique la Guía de Orientación al Aspirante.
- La API key y los documentos que cargas se quedan en tu navegador. Solo se envían a la IA los fragmentos que tú selecciones.
