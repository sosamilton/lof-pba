# Preguntas resueltas

1. **¿Los usuarios cambian frecuentemente entre sub-secciones?** Sí, especialmente en Cooperadora y Resumen. Por eso el scroll-fade es mejor que Select/Sheet (que requieren 2 taps).
2. **¿Hay preferencia estética?** El fade es sutil y se integra naturalmente. No cambia la estética de la app.
3. **¿Los botones de crear asamblea?** Se convierten en un solo botón con dropdown. Más limpio en mobile y desktop.
4. **¿El sub-tab de organismo (CD/CRC/Federación)?** Como son 3 items cortos, el fade no se activará (no hay overflow). No necesita tratamiento especial.
5. **¿Consistencia desktop/mobile?** Sí. El fade se desactiva en desktop con `md:scroll-fade-none`. Mismo componente, mismo comportamiento, solo cambia el indicador visual.
