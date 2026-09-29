# Massa de dados de avaliações — ambiente de desenvolvimento

> Criada em 29/09/2026 · Responsável: Gabriel Vogado
> Código: `backend/src/main/java/br/com/saude_monitor/api/feedback/seed/`
> (`MassaAvaliacoesRunner`, `MassaAvaliacoesGerador`, `MassaAvaliacoesProperties`)

## Para que serve

Testar, sem visitas reais, a avaliação de hospitais, a visualização dos indicadores
(listagem, detalhe e `GET /hospitais/{id}/indicadores`), o histórico de avaliações do
usuário (E5-03) e o ranking por nota e por tempo (E4-05).

## O que é gerado

| Item | Quantidade (base de 341 estabelecimentos) | Observação |
|---|---|---|
| Usuários de teste | 30 | `massa.avaliacoes.01@radarsaude.invalid` … `.30@`, papel `USER`, e-mail confirmado, termos aceitos |
| Hospitais avaliados | 50 | Escolhidos alternando as categorias (hospital, UPA, UBS, policlínica, CAPS...) |
| Avaliações | ~850 | Nota 1–5, respostas coerentes com o formulário (RN-10), ~45% com comentário, ~15% anônimas (RN-13) |
| Visitas | ~890 | Uma por avaliação, `FINALIZADA`, datas nos últimos 85 dias; mais uma internação/observação (fora do tempo, RN-24) e uma visita `SEM_FEEDBACK` (RN-09) por hospital |
| Hospitais sem avaliação | ~291 | Aparecem no fim do ranking, com "indicadores indisponíveis" |

Cada hospital avaliado recebe um perfil, para o ranking ter diferenças claras:

| Perfil | Hospitais | Avaliações por hospital | Nota média esperada | Tempo de permanência |
|---|---|---|---|---|
| Excelente | 10 | 10–30 | ~4,6 | 25–70 min |
| Bom | 14 | 8–35 | ~3,8 | 50–130 min |
| Regular | 12 | 6–25 | ~3,0 | 100–260 min |
| Ruim | 8 | 6–20 | ~2,0 | 200–600 min |
| Poucas avaliações | 6 | 1–4 | — | — (abaixo do mínimo de 5, RN-15) |

Simulação com 341 hospitais: 44 hospitais com indicadores, médias de 1,7 a 4,9 e tempo
mediano de 44 a 484 min. Ao final da carga os agregados dos hospitais tocados são
recalculados na hora — o ranking já aparece no primeiro acesso.

## Travas: nunca roda em homologação ou produção

1. **Perfil Spring `dev`** (`@Profile("dev")`).
2. **`app.massa-avaliacoes.enabled=true`** (padrão `false`; variável `APP_MASSA_AVALIACOES_ENABLED`).
3. **Nome do banco:** precisa conter `dev` (ou `test`, o banco dos testes automatizados) e
   não pode conter `hom` nem `prod`. Fora disso a carga é recusada e registrada em log como
   erro, mesmo com as duas travas anteriores ligadas. O nome padrão local `saude_monitor`
   também é recusado — localmente, use `MONGO_DATABASE=saude_monitor_dev`.

O deploy (`cd-backend-google.yml`) só liga o perfil `dev` e a flag no serviço
`saude-monitor-backend-dev` (branch `develop`); homologação recebe perfil `hom` e flag
`false`, produção perfil `prod` e flag `false`. Uma falha na carga é registrada em log e
não impede a aplicação de subir.

## Idempotência e validade

Todo documento da massa tem `_id` começando com `massa-dev-`. É por esse prefixo que a
carga sabe se já rodou e o que apagar — nenhum dado real é tocado.

- **Massa completa com menos de 30 dias:** nada é gerado; o boot só recalcula os agregados
  dos hospitais da massa (os indicadores acompanham a janela de 90 dias) e aplica a senha.
  Cold starts do Cloud Run não duplicam nada.
- **Massa com mais de 30 dias:** é apagada e gerada de novo com datas atuais, antes de sair
  da janela de 90 dias dos indicadores (RN-14). Não precisa de intervenção.
- **Carga interrompida** (usuários ou visitas sem avaliações): o resto é apagado e a carga
  refeita.
- **`modo=recriar`** (`APP_MASSA_AVALIACOES_MODO=recriar`): força a regeração. Use numa
  execução local; **não** deixe no serviço do Cloud Run — lá cada cold start regeraria a
  massa, apagando o que os testadores fizeram com os usuários de teste.

## Senha dos usuários de teste

O serviço de dev é público, então o deploy **não** define senha: os usuários ficam com uma
senha aleatória, sem login possível — as avaliações, os indicadores e o ranking funcionam
do mesmo jeito. Para entrar com um usuário de teste e ver o histórico de avaliações,
defina `MASSA_AVALIACOES_SENHA` (senha forte, nunca a mesma de outro ambiente):

- **Local:** na linha de comando abaixo.
- **Cloud Run dev:** como variável ou secret do serviço `saude-monitor-backend-dev`
  (o deploy mescla as variáveis e mantém as que já existem).

A senha é reaplicada a cada boot, inclusive aos usuários que já existem. Tirar a variável
volta a bloquear o login no boot seguinte (senha aleatória nova), e as sessões antigas
desses usuários deixam de renovar.

## Como injetar

**Dev (Cloud Run):** automático no deploy da `develop` depois do merge. O log do serviço
mostra `[MassaAvaliacoes] Banco 'saude_monitor_dev': 30 usuários, ... avaliações em 50 hospitais`.

**Local, contra o Mongo do docker-compose** (em `backend/`):

```bash
SPRING_PROFILES_ACTIVE=dev APP_MASSA_AVALIACOES_ENABLED=true MONGO_DATABASE=saude_monitor_dev MASSA_AVALIACOES_SENHA='<senha forte>' ./gradlew bootRun
```

No Windows (PowerShell), em `backend\`:

```powershell
$env:SPRING_PROFILES_ACTIVE="dev"; $env:APP_MASSA_AVALIACOES_ENABLED="true"; $env:MONGO_DATABASE="saude_monitor_dev"; $env:MASSA_AVALIACOES_SENHA="<senha forte>"; .\gradlew.bat bootRun
```

**Local, contra o banco de dev no Atlas:** as mesmas variáveis mais
`MONGO_URI='<URI de saude_monitor_dev>'` (o nome do banco vem da URI). Acrescente
`APP_MASSA_AVALIACOES_MODO=recriar` para regerar a massa com datas atuais.

## Como remover

Primeiro desligue a flag (senão o próximo boot recria a massa). Depois, com `mongosh` no
banco de dev:

```js
const hospitais = db.feedbacks.distinct("hospitalId", { _id: /^massa-dev-/ });
db.feedbacks.deleteMany({ _id: /^massa-dev-/ });
db.visitas.deleteMany({ _id: /^massa-dev-/ });
db.users.deleteMany({ _id: /^massa-dev-/ });
db.agregados_hospitais.deleteMany({ hospitalId: { $in: hospitais } });
```

Sem o agregado, o hospital volta a "indicadores indisponíveis"; se ele tiver avaliação
real, o próximo feedback ou o job de 15 min recalcula.
