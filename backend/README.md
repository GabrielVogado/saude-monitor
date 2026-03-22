# Backend - Auth Endpoint

Este backend agora possui um endpoint para receber o payload enviado pelo `LoginService` do frontend.

## Endpoint

- Metodo: `POST`
- URL: `/api/auth/login`
- Content-Type: `application/json`

### Payload esperado

```json
{
  "email": "usuario@teste.com",
  "password": "senha123",
  "rememberDevice": true
}
```

### Resposta de sucesso (200)

```json
{
  "success": true,
  "message": "login payload received",
  "email": "usuario@teste.com",
  "rememberDevice": true
}
```

### Resposta de validacao (400)

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

## Rodar testes

```powershell
cd D:\saude-monitor\backend
.\gradlew.bat test
```

## Rodar a aplicacao

```powershell
cd D:\saude-monitor\backend
.\gradlew.bat bootRun
```

## Testar endpoint manualmente

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/auth/login" -ContentType "application/json" -Body '{"email":"usuario@teste.com","password":"senha123","rememberDevice":true}'
```

