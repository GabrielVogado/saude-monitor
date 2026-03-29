# saude-monitor

Guia rapido para subir o backend (Spring Boot + MongoDB via Docker) e o frontend (React Native com Expo).

## Pre-requisitos

- Docker Desktop (com Docker Compose v2)
- Node.js 18+ e npm
- Conta Expo (recomendada; obrigatoria para Expo Go com recursos online, EAS Build/Submit e compartilhamento facilitado)
- (Opcional) Java 25, somente se for rodar backend sem Docker

## 1) Subir o backend

No projeto, o backend e o banco sobem pelo `docker compose` da pasta `backend`.

```powershell
Set-Location "D:\saude-monitor\backend"
Copy-Item .env.example .env -ErrorAction SilentlyContinue
docker compose --env-file .env up -d --build
```

Verifique se esta de pe:

```powershell
Set-Location "D:\saude-monitor\backend"
docker compose ps
```

Ver logs do backend:

```powershell
Set-Location "D:\saude-monitor\backend"
docker compose logs -f backend
```

Teste rapido da API:

```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"usuario@teste.com","password":"senha123","rememberDevice":true}'
```

## 2) Subir o frontend

Abra outro terminal para o frontend:

```powershell
Set-Location "D:\saude-monitor\frontend"
npm install
npx expo login
npx expo run:android
```

> Se nao tiver conta, crie em https://expo.dev/signup e depois rode `npx expo login`.

Se quiser apenas abrir o Metro/Expo sem build nativo:

```powershell
Set-Location "D:\saude-monitor\frontend"
npm run start
```

Atalhos comuns do Expo (quando rodar `npm run start`):

- `a` abre Android (emulador)
- `w` abre Web
- app Expo Go no celular tambem pode ser usado

### Enderecos exibidos no terminal do Expo

Quando o frontend sobe com sucesso, o Expo normalmente mostra:

- `Metro: http://localhost:8081`
- `Web: http://localhost:8081`

Isso esta correto. A porta `8081` e do bundler/dev server do frontend.

Ja a API do backend roda em outra porta:

- Backend: `http://localhost:8080`

Resumo rapido:

- `8081` = frontend (Expo/Metro)
- `8080` = backend (Spring Boot)

## Com Conta Expo: `npx expo run:android`

Use esta secao se voce sobe o frontend com build nativo Android.

Pre-requisitos recomendados:

- Android Studio instalado (SDK + Platform Tools)
- Variaveis `ANDROID_HOME` e `PATH` configuradas
- Um emulador Android criado no AVD Manager **ou** celular com depuracao USB ativa
- Conta autenticada no Expo CLI (`npx expo login`) para fluxos com Expo Go e servicos EAS

Comandos uteis:

```powershell
Set-Location "D:\saude-monitor\frontend"
npx expo run:android
```

Se ocorrer erro de cache/build no Android:

```powershell
Set-Location "D:\saude-monitor\frontend"
npx expo prebuild --clean
npx expo run:android
```

## Sem Expo: sem conta Expo

Voce consegue desenvolver localmente sem conta Expo em parte dos fluxos.

Funciona sem conta:

- `npx expo run:android` para build e execucao local no emulador/dispositivo
- `npm run start` para abrir o Metro bundler local

Nao funciona (ou fica limitado) sem conta:

- Login no Expo CLI (`npx expo login`)
- Recursos online do Expo Go que dependem da conta
- Servicos EAS (`eas build`, `eas submit`, updates remotos)

Fluxo minimo sem conta:

```powershell
Set-Location "D:\saude-monitor\frontend"
npm install
npx expo run:android
```

## Configuracao da URL da API no frontend

As URLs ficam em `frontend/app.json` (chave `expo.extra`) e sao consumidas por `frontend/src/config/api.js`.

Padrao atual:

- Web: `http://localhost:8080`
- Android emulator: `http://10.0.2.2:8080`
- iOS: `http://localhost:8080`

Se mudar porta/host do backend, ajuste esses campos e reinicie o Expo.

## Parar ambiente

Parar backend e banco:

```powershell
Set-Location "D:\saude-monitor\backend"
docker compose down
```

(Se quiser apagar volume de dados do Mongo)

```powershell
Set-Location "D:\saude-monitor\backend"
docker compose down -v
```

## Troubleshooting rapido

- `HTTP 404` em endpoint novo: o container pode estar com imagem antiga. Rode:

```powershell
Set-Location "D:\saude-monitor\backend"
docker compose up -d --build backend
```

- `Network request failed` no app: normalmente URL/porta incorreta para a plataforma (ex.: Android emulator deve usar `10.0.2.2`).






