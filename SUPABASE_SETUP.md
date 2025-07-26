# Configuración de Supabase

## Pasos para configurar Supabase:

### 1. Crear un proyecto en Supabase
1. Ve a [https://supabase.com](https://supabase.com)
2. Inicia sesión o crea una cuenta
3. Crea un nuevo proyecto
4. Anota el **Project ID** y la **URL del proyecto**

### 2. Obtener las credenciales
1. En tu proyecto de Supabase, ve a **Settings** > **API**
2. Copia la **Project URL** (algo como `https://your-project-id.supabase.co`)
3. Copia la **anon public** key

### 3. Configurar las variables de entorno
Crea un archivo `.env.local` en la raíz del proyecto con el siguiente contenido:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Ejecutar los scripts de base de datos
Una vez configurado Supabase, ejecuta los scripts SQL en el orden correcto:

```bash
# Ejecutar los scripts en orden
# 1. Crear tablas
# 2. Arreglar rankings de partidas
# 3. Crear tabla de partidas activas
# 4. Verificar la tabla de partidas activas
```

### 5. Reiniciar el servidor
Después de configurar las variables de entorno:

```bash
npm run dev
```

## Estructura de la base de datos
El proyecto incluye scripts SQL para crear las siguientes tablas:
- `players` - Jugadores
- `matches` - Partidas
- `match_players` - Relación entre partidas y jugadores
- `active_matches` - Partidas activas

## Notas importantes
- Las variables de entorno deben comenzar con `NEXT_PUBLIC_` para ser accesibles en el cliente
- El archivo `.env.local` no se sube al repositorio por seguridad
- Asegúrate de que las políticas de seguridad de Supabase permitan las operaciones necesarias 