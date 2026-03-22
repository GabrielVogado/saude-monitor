# saude-monitor — Backend

API REST em Spring Boot 4 com Java 25, responsavel por receber e persistir dados de autenticacao no MongoDB (Percona Server for MongoDB 7.0).

---

## Pre-requisitos

| Ferramenta | Versao minima |
|---|---|
| Java | 25 |
| Docker Desktop | 4.x |
| Docker Compose | v2 |

---

## Configuracao do ambiente

### 1. Variaveis de ambiente

Copie o arquivo de exemplo e ajuste as credenciais se necessario:

```powershell
cd D:\saude-monitor\backend
Copy-Item .env.example .env
```

Variaveis disponiveis em `.env`:

| Variavel | Padrao |
|---|---|
| `MONGO_HOST` | `localhost` |
| `MONGO_PORT` | `27017` |
| `MONGO_DATABASE` | `saude_monitor` |
| `MONGO_AUTH_DB` | `admin` |
| `MONGO_USER` | `saude_monitor_user` |
| `MONGO_PASSWORD` | `saude_monitor_pass` |

---

## Subindo o ambiente

### 2. Banco de dados (Percona MongoDB)

```powershell
cd D:\saude-monitor\backend
docker compose --env-file .env up -d
```

Validar que o banco esta pronto:

```powershell
docker exec saude-monitor-percona mongosh --quiet `
  -u saude_monitor_user -p saude_monitor_pass `
  --authenticationDatabase admin `
  --eval "db.runCommand({ ping: 1 }).ok"
# Esperado: 1
```

### 3. Aplicacao

Carrega as variaveis do `.env` e inicia o backend na porta `8080`:

```powershell
cd D:\saude-monitor\backend
Get-Content .env | ForEach-Object {
  if ($_ -match '^(?<k>[^#=]+)=(?<v>.*)$') {
    [System.Environment]::SetEnvironmentVariable($matches['k'], $matches['v'], 'Process')
  }
}
.\gradlew.bat bootRun
```

---

## Endpoints

### POST `/api/auth/login`

Recebe o payload de login, valida os campos e persiste na colecao `auth_logins`.

**Payload:**
```json
{
  "email": "usuario@teste.com",
  "password": "senha123",
  "rememberDevice": true
}
```

**Resposta 200 OK:**
```json
{
  "success": true,
  "message": "Login salvo com sucesso",
  "email": "usuario@teste.com",
  "rememberDevice": true
}
```

**Resposta 400 Bad Request** (campos invalidos):
```json
{
  "success": false,
  "message": "validation failed",
  "errors": {
    "email": "email is required",
    "password": "password is required"
  }
}
```

**Teste rapido:**
```powershell
$headers = @{"Content-Type"="application/json"}
$body    = '{"email":"usuario@teste.com","password":"senha123","rememberDevice":true}'
Invoke-WebRequest -Uri "http://localhost:8080/api/auth/login" `
  -Method POST -Headers $headers -Body $body -UseBasicParsing |
  Select-Object -ExpandProperty Content
```

---

## Testes automatizados

```powershell
cd D:\saude-monitor\backend
.\gradlew.bat test
```

---

## Parar o ambiente

```powershell
cd D:\saude-monitor\backend
docker compose down
```

Para remover tambem o volume de dados:

```powershell
docker compose down -v
```
