# ============================================================
#  start-dev.ps1 — Inicializa o ambiente de desenvolvimento do
#  frontend saude-monitor SEM tela branca.
#
#  O que ele faz (na ordem correta):
#    1. Configura `adb reverse` (localhost:8081 -> host:8081),
#       evitando a corrupção de resposta do NAT 10.0.2.2 (causa da tela branca)
#    2. Inicia o Metro, se ainda não estiver rodando
#    3. Abre o app no emulador
#
#  Uso:
#    cd D:\saude-monitor\frontend
#    .\start-dev.ps1               # normal (cache quente)
#    .\start-dev.ps1 -ClearCache   # limpa o cache do Metro (após erro de bundle)
# ============================================================

param(
    [switch]$ClearCache
)

$AppPackage = "com.gabrielvogado.saudemonitor"
$Port = "8081"

function Test-PortListening {
    return [bool](netstat -ano | findstr ":$Port" | findstr "LISTENING")
}

# 1. Dispositivo / emulador ------------------------------------------------
Write-Host "==> Verificando dispositivo..." -ForegroundColor Cyan
$devices = adb devices 2>$null | Select-String "`tdevice$"
if (-not $devices) {
    Write-Host "    Nenhum emulador/dispositivo conectado." -ForegroundColor Yellow
    Write-Host "    Inicie o emulador Pixel_9_Pro e execute novamente." -ForegroundColor Yellow
    exit 1
}

# Aguarda o boot completar
$boot = ""
while ($boot -ne "1") {
    $boot = (adb shell getprop sys.boot_completed 2>$null).Trim()
    if ($boot -ne "1") { Start-Sleep -Seconds 2 }
}
Write-Host "    Dispositivo pronto." -ForegroundColor Green

# 2. adb reverse (fix tela branca) ----------------------------------------
Write-Host "==> Configurando adb reverse (fix tela branca)..." -ForegroundColor Cyan
adb reverse "tcp:$Port" "tcp:$Port"
Write-Host "    OK: localhost:$Port -> host:$Port" -ForegroundColor Green

# 3. Metro -----------------------------------------------------------------
Write-Host "==> Verificando Metro (porta $Port)..." -ForegroundColor Cyan
if (Test-PortListening) {
    Write-Host "    Metro já está rodando." -ForegroundColor Green
} else {
    Write-Host "    Iniciando Metro..." -ForegroundColor Cyan
    $expoArgs = "Set-Location '$PSScriptRoot'; npx expo start"
    if ($ClearCache) { $expoArgs += " --clear" }
    Start-Process powershell -ArgumentList "-NoExit","-Command",$expoArgs
    Write-Host "    Aguardando Metro subir..." -ForegroundColor Cyan
    while (-not (Test-PortListening)) { Start-Sleep -Seconds 2 }
    Write-Host "    Metro no ar." -ForegroundColor Green
}

# 4. Abrir o app -----------------------------------------------------------
Write-Host "==> Abrindo o app..." -ForegroundColor Cyan
adb shell am force-stop $AppPackage
Start-Sleep -Seconds 1
adb shell monkey -p $AppPackage -c android.intent.category.LAUNCHER 1 | Out-Null

Write-Host ""
Write-Host "OK! Ambiente pronto — o app deve abrir sem tela branca." -ForegroundColor Green
