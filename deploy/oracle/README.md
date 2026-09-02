# Backend na Oracle Cloud Always Free (E8-01)

> São Paulo · VM Ampere A1 (aarch64) · substitui o Render `plan: free`

## Por que sair do Render

Medição de 02/09/2026 contra `https://saude-monitor.onrender.com`:

| Cenário | Render `free` | Esperado na VM |
|---|---|---|
| Primeira abertura após ociosidade | **109,1 s / HTTP 503** | sem *spin-down* |
| `/actuator/health` quente | 2,5–3,2 s | dezenas de ms |
| `GET /hospitais?size=20` | 1,9–4,9 s | — |

As duas causas eram do plano: *spin-down* após ~15 min e fração de vCPU compartilhada. Uma VM Always Free fica ligada 24/7 e um OCPU Ampere é um core dedicado.

O MongoDB **não muda**: continua no Atlas, `AWS / sa-east-1 (São Paulo)` — mesma praça da VM.

## 1. Criar a VM (console OCI)

*Compute → Instances → Create instance*

| Campo | Valor |
|---|---|
| Image | Canonical Ubuntu 24.04 |
| Shape | `VM.Standard.A1.Flex` — **2 OCPU / 12 GB** |
| Boot volume | 50 GB |
| Public IPv4 | atribuir |
| SSH keys | subir a chave pública (`ssh-keygen -t ed25519`) |
| *Advanced → Management → User data* | conteúdo de [`cloud-init.yaml`](./cloud-init.yaml) |

O *shape* usa metade da cota Always Free (o teto é 4 OCPU / 24 GB), deixando margem para uma segunda VM de produção.

> Se aparecer **"Out of host capacity"**: é escassez de Ampere na região, não erro de configuração. Tente outro *availability domain* ou repita mais tarde.

## 2. Abrir as portas — nos dois firewalls

1. **VCN**: *Networking → Virtual Cloud Networks → sua VCN → Security Lists → Default* → *Add Ingress Rules*: `0.0.0.0/0` TCP **80** e TCP **443**.
2. **Dentro da VM**: já resolvido pelo `cloud-init.yaml`, que insere as regras no `iptables` e salva com `netfilter-persistent`.

Abrir só o primeiro é o erro mais comum na OCI, e o sintoma é *timeout* silencioso, sem log em lugar nenhum.

## 3. DNS e TLS

Aponte um registro `A` do domínio escolhido para o IP público da VM **antes** de subir o Caddy — o Let's Encrypt valida por HTTP e falha se o DNS ainda não resolver. Sem domínio próprio, um serviço gratuito (DuckDNS) funciona.

## 4. Configurar a VM

```bash
ssh ubuntu@<IP_PUBLICO>
cd /opt/saude-monitor
# copie .env.example para cá, preencha e proteja:
cp .env.example .env && nano .env && chmod 600 .env
docker compose pull && docker compose up -d
docker compose logs -f backend
```

`JWT_SECRET` de cada ambiente é próprio: `openssl rand -base64 48`.

> **O `.env` nunca vai para o repositório** — este repositório é público. Ele está no `.gitignore`.

## 5. Liberar a VM no Atlas

*Network Access → Add IP Address* → IP público da VM. Como agora existe IP fixo, dá para **remover o `0.0.0.0/0`** que o Render exigia por não ter endereço estável. É ganho de segurança direto.

## 6. Deploy automatizado

O workflow [`cd-backend-oracle.yml`](../../.github/workflows/cd-backend-oracle.yml) builda em runner ARM nativo e publica em `ghcr.io/gabrielvogado/saude-monitor-backend:<ambiente>-arm64`, tag separada da imagem x86 que o Render ainda consome. Secrets necessários:

| Secret | Conteúdo |
|---|---|
| `OCI_SSH_HOST` | IP público da VM |
| `OCI_SSH_USER` | `ubuntu` |
| `OCI_SSH_KEY` | chave **privada** correspondente à pública da VM |

O gatilho é manual (`workflow_dispatch`) de propósito. Só vira `push` quando a virada estiver validada.

Se o *package* GHCR estiver privado, a VM precisa autenticar uma vez:
`docker login ghcr.io -u <usuário> -p <PAT com read:packages>`. Torná-lo público evita isso.

## 7. Virada

1. Subir na Oracle e medir `/actuator/health` e `GET /hospitais?size=20` (comparar com a tabela acima).
2. Só então trocar a URL do app — hoje fixa em `frontend/app.json` (`apiBaseUrlAndroid`). Parametrizar por perfil de build é o **E8-16**, e vira pré-requisito: sem isso, mudar de host obriga a recompilar o app.
3. Desligar os serviços do Render e remover `render.yaml` + `cd-backend.yml` em PR próprio.

Enquanto (1) e (2) não estiverem feitos, **o Render continua sendo o ambiente ativo** — a mudança é reversível a qualquer momento.
