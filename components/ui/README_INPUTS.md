# Componentes de Fecha y Hora

## DateInput y TimeInput

Estos componentes proporcionan una experiencia mejorada para la entrada de fechas y horas en la aplicación, adaptándose automáticamente según el tipo de dispositivo.

### Características

- **Detección automática de dispositivo**: Identifica si el usuario está en móvil o desktop
- **Experiencia móvil**: Usa selectores nativos del sistema operativo
- **Experiencia desktop**: Permite escritura manual con formato automático
- **Validación integrada**: Valida automáticamente las fechas y horas ingresadas
- **Formato consistente**: Mantiene el formato ISO 8601 para fechas y HH:mm para horas

### DateInput

#### Comportamiento por dispositivo

**Móvil:**
- Muestra el selector nativo de fecha del sistema operativo
- Funciona con `type="date"` estándar

**Desktop:**
- Permite escritura manual en formato `dd/mm/yyyy`
- Auto-formatea mientras el usuario escribe
- Valida la fecha al perder el foco
- Los números se formatean automáticamente con "/"

#### Uso

```tsx
import { DateInput } from '@/components/ui';

<DateInput
  value={fecha} // Formato: "yyyy-mm-dd" (ISO 8601)
  onChange={(value) => setFecha(value)}
  className="w-full px-4 py-3 border rounded-lg"
  placeholder="dd/mm/yyyy"
  required
/>
```

#### Props

- `value` (string): Fecha en formato ISO 8601 (yyyy-mm-dd)
- `onChange` (function): Callback que recibe la fecha en formato ISO 8601
- `className` (string, opcional): Clases CSS personalizadas
- `placeholder` (string, opcional): Placeholder del input (default: "Ej: 25/12/2024")
- `required` (boolean, opcional): Si el campo es obligatorio
- `min` (string, opcional): Fecha mínima permitida
- `showHelper` (boolean, opcional): Muestra texto de ayuda debajo del campo (default: false)

### TimeInput

#### Comportamiento por dispositivo

**Móvil:**
- Muestra el selector nativo de hora del sistema operativo
- Funciona con `type="time"` estándar

**Desktop:**
- Permite escritura manual en formato `hh:mm` (24 horas)
- Auto-formatea mientras el usuario escribe
- Valida la hora al perder el foco (0-23 horas, 0-59 minutos)
- Los números se formatean automáticamente con ":"
- Muestra texto de ayuda: "Formato 24 horas (00:00 - 23:59). Ejemplo: 09:30, 16:50, 22:15"

#### Uso

```tsx
import { TimeInput } from '@/components/ui';

<TimeInput
  value={hora} // Formato: "HH:mm" (24 horas)
  onChange={(value) => setHora(value)}
  className="w-full px-4 py-3 border rounded-lg"
  placeholder="hh:mm"
  required
/>
```

#### Props

- `value` (string): Hora en formato HH:mm (24 horas)
- `onChange` (function): Callback que recibe la hora en formato HH:mm
- `className` (string, opcional): Clases CSS personalizadas
- `placeholder` (string, opcional): Placeholder del input (default: "Ej: 16:50")
- `required` (boolean, opcional): Si el campo es obligatorio
- `showHelper` (boolean, opcional): Muestra texto de ayuda con el formato (default: true)

### Ejemplos de uso

#### Formulario de reserva

```tsx
const [fecha, setFecha] = useState('2024-12-25');
const [hora, setHora] = useState('14:30');

<div className="grid grid-cols-2 gap-4">
  <div>
    <label>Fecha</label>
    <DateInput
      value={fecha}
      onChange={setFecha}
      className="w-full px-4 py-2 border rounded"
      required
    />
  </div>
  
  <div>
    <label>Hora</label>
    <TimeInput
      value={hora}
      onChange={setHora}
      className="w-full px-4 py-2 border rounded"
      required
      showHelper={true} // Muestra ayuda de formato 24 horas
    />
  </div>
</div>
```

### Notas técnicas

1. **Detección de móvil**: Usa User Agent y ancho de ventana para determinar el tipo de dispositivo
2. **Formato de entrada**: 
   - DateInput acepta solo números y auto-formatea con "/"
   - TimeInput acepta solo números y auto-formatea con ":"
3. **Validación**: 
   - Valida automáticamente al completar la entrada o al perder el foco
   - Solo actualiza el valor si la fecha/hora es válida
4. **Compatibilidad**: Los componentes mantienen compatibilidad con los selectores nativos en móviles para mejor UX

### Migración desde inputs nativos

**Antes:**
```tsx
<input
  type="date"
  value={fecha}
  onChange={(e) => setFecha(e.target.value)}
/>
```

**Después:**
```tsx
<DateInput
  value={fecha}
  onChange={(value) => setFecha(value)}
/>
```

La principal diferencia es que `onChange` recibe directamente el valor en lugar del evento.

