# Frontend Android — Subida do Emulador sem Gargalo

Projeto: `D:\saude-monitor` (Clinical Sanctuary v2.0). Frontend React Native Expo SDK 55 / RN 0.83.2 / MapLibre.

## Configuração já aplicada (não regredir)

### `frontend/android/gradle.properties` (chaves de desempenho)
```properties
reactNativeArchitectures=x86_64     # emulador Pixel_9_Pro é x86_64 — compilar 1 ABI, não 4
org.gradle.caching=true             # reusa saída de tarefas entre builds
org.gradle.workers.max=2            # limita workers p/ não estourar RAM (swap)
```
> Para device físico ARM, trocar para `arm64-v8a`. Para release completo, voltar a lista das 4 ABIs.

### `MainApplication.kt` (fix de rede — essencial)
```kotlin
prefs.edit().putString("debug_http_host", "127.0.0.1:8081").apply()
```
Motivo (diagnosticado):
- `localhost` **não resolve** neste emulador Android 16 (DNS falha → "Unable to resolve host").
- `10.0.2.2` (NAT) conecta mas **corrompe respostas chunked** → `ProtocolException: Expected leading [0-9a-fA-F]` → tela branca.
- `127.0.0.1` + `adb reverse` é a combinação correta (loopback IPv4 roteado pelo reverse, sem NAT corrompido).

### ⚠️ NÃO rodar `expo prebuild --clean`
Ele regenera a pasta `android/` e **apaga** os ajustes do `gradle.properties` e do `MainApplication.kt` (que não estão no template do Expo).

## Procedimento diário

### 1. Liberar RAM (evita swap/travamento)
```powershell
docker compose down        # backend (MongoDB+Spring) usa ~3,6 GB via vmmem
# fechar UMA das IDEs (WebStorm OU IntelliJ)
```
Máquina: 24 GB RAM, mas Docker + 2 IDEs + emulador deixam só ~4 GB livres → build trava por swap.

### 2. Subir o ambiente
```powershell
cd D:\saude-monitor\frontend
.\start-dev.ps1            # adb reverse + Metro + abre o app (na ordem certa)
# .\start-dev.ps1 -ClearCache   # após erro de bundle
```

### 3. Build nativo (SÓ quando mudou Kotlin/nativo)
```powershell
cd D:\saude-monitor\frontend\android
.\gradlew.bat :app:installDebug --console=plain
```
Tempos esperados: mudança JS = 0s (hot reload Metro); build quente = ~2–3 min; build frio = ~10 min (HDD+CPU limitam).

## Troubleshooting

| Sintoma | Causa | Correção |
|---|---|---|
| `Unable to load script` + "Unable to resolve host localhost" | `debug_http_host` = `localhost` | usar `127.0.0.1:8081` |
| `ProtocolException` / tela branca | usando `10.0.2.2` (NAT corrompe chunked) | `127.0.0.1` + `adb reverse` |
| App não conecta, mas `adb shell toybox nc -z` conecta | rede do emulador corrompida | `adb reboot` (reiniciar emulador) |
| `SafeAreaContextPackage` não encontrado no build | cache do Gradle envenenado (Kotlin vazio) | apagar `~/.gradle/caches/build-cache-1` + `node_modules/*/android/build` |
| Build lento/travado | 4 ABIs + RAM + sem cache | ver `gradle.properties` acima + liberar RAM |

## Verificação de sucesso (logcat)
```
isMetroRunning(): Async result = true
loadJSBundleFromMetro(): Creating BundleLoader
ReactNativeJS: Running "main" with {"rootTag":1,...}   ← app rodando
```
Sem `ProtocolException` nem `Unable to load script`.
