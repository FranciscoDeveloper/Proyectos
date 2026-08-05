# native-config — configuración nativa que NO se puede perder

`supplier-management/.gitignore` ignora `/android/` y `/ios/` porque son
proyectos **generados** por Capacitor (`npx cap add android` / `cap add ios`).

El problema: dentro de esos directorios generados hay **dos archivos editados a
mano** que Capacitor **no** vuelve a crear con nuestro contenido. Si alguien
clona el repo y ejecuta `cap add`, obtiene versiones limpias y reaparecen bugs
que ya estaban arreglados:

| Archivo | Qué se pierde si se regenera |
|---|---|
| `android/app/src/main/AndroidManifest.xml` | `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `POST_NOTIFICATIONS`. Sin ellos, **grabar la atención clínica falla en todos los Android** (Capacitor pide el permiso en runtime; Android deniega al instante un permiso no declarado en el manifiesto, así que `getUserMedia` rechaza con `NotAllowedError`). |
| `ios/App/App/Info.plist` | `NSMicrophoneUsageDescription`, `NSCameraUsageDescription`, `NSPhotoLibrary*UsageDescription`. Sin ellos, **iOS mata el proceso** al tocar micrófono o cámara (no es un error recuperable, la app se cierra), y App Review rechaza el binario. |

Este directorio guarda la **copia canónica** de ambos, sí versionada.

## Cómo usarlo

Después de cualquier `npx cap add android` / `npx cap add ios`, o al preparar el
proyecto en un equipo nuevo (por ejemplo el Mac donde se compila iOS):

```bash
cd supplier-management
cp native-config/android/AndroidManifest.xml android/app/src/main/AndroidManifest.xml
cp native-config/ios/Info.plist            ios/App/App/Info.plist
```

`npx cap sync` **no** pisa estos archivos, así que basta con restaurarlos una vez
por proyecto generado.

## Al revés: si editas el proyecto nativo

Si cambias permisos o textos de uso directamente en `android/` o `ios/`, copia el
resultado **de vuelta** aquí, o el cambio se pierde en el próximo clon:

```bash
cp android/app/src/main/AndroidManifest.xml native-config/android/AndroidManifest.xml
cp ios/App/App/Info.plist                   native-config/ios/Info.plist
```

Ver `MOBILE_STORE_PUBLISHING.md` (raíz del repo) para el contexto completo de
publicación.
