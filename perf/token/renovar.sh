#!/bin/sh
# Mantem em /token/admin.jwt um access token valido do usuario ADMIN de teste, lido pelo
# Prometheus (credentials_file) para coletar /actuator/prometheus. O token vale 15 min;
# renova a cada 10. A senha nao aparece em log: so o resultado do login.
set -u
# `rememberDevice` e obrigatorio no corpo: o LoginRequest tem um boolean PRIMITIVO, e o
# Jackson 3 (Spring Boot 4) recusa primitivo ausente -- 400 "corpo malformado".

while true; do
  # Corpo pela entrada padrao (--data @-): com -d "...", a senha iria como argumento do curl
  # e apareceria na lista de processos do conteiner.
  RESPOSTA=$(printf '{"email":"%s","password":"%s","rememberDevice":false}' "$ADMIN_EMAIL" "$ADMIN_SENHA" \
    | curl -s --max-time 40 -X POST "$API_URL/api/v1/auth/login" -H 'Content-Type: application/json' --data @-)
  TOKEN=$(printf '%s' "$RESPOSTA" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')

  if [ -n "$TOKEN" ]; then
    if printf '%s' "$TOKEN" > /token/admin.jwt.tmp && mv /token/admin.jwt.tmp /token/admin.jwt; then
      echo "$(date -u +%H:%M:%S) token renovado"
      sleep 600
    else
      echo "$(date -u +%H:%M:%S) ERRO: nao consegui gravar /token/admin.jwt"
      sleep 20
    fi
  else
    # 503 do cold start do Cloud Run, ou credencial errada: tenta de novo em 20 s.
    echo "$(date -u +%H:%M:%S) login do ADMIN falhou: $(printf '%s' "$RESPOSTA" | head -c 160)"
    sleep 20
  fi
done
