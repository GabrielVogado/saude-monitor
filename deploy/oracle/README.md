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

> **Status em 02/09/2026:** a região São Paulo está **sem capacidade Always Free** (tanto `VM.Standard.A1.Flex`
> quanto `VM.Standard.E2.1.Micro`). Trocar de região não resolve: recursos Always Free só existem na região *home*
> da conta, que é imutável. Enquanto a capacidade não libera, o `keep-alive-backend.yml` mantém o Render acordado
> e elimina o *cold start*. Os artefatos abaixo ficam prontos para o momento em que a VM puder ser criada.

O MongoDB **não muda**: continua no Atlas, `AWS / sa-east-1 (São Paulo)` — mesma praça da VM.

## 1. Criar a VM (console OCI)

*Compute → Instances → Create instance*

| Campo | Valor |
|---|---|
| Image | Canonical Ubuntu 24.04 |
| Shape | `VM.Standard.A1.Flex` — **2 OCPU / 12 GB** |
| Boot volume | padrão (46,6 GB) — não marcar *custom size*, que abre os controles de VPU e permite sair da cota gratuita |
| Public IPv4 | atribuir |
| SSH keys | subir a chave pública (`ssh-keygen -t ed25519`) |
| *Advanced → Management → User data* | conteúdo de [`cloud-init.yaml`](./cloud-init.yaml) — o campo espera o **conteúdo**, não o caminho |
| *Advanced → Availability* | *Use live migration if possible* + **Restore instance lifecycle state** habilitado |
| *Advanced → Launch options* | **Paravirtualized networking** — SR-IOV não suporta live migration |
| Placement | **On-demand capacity** (a única elegível ao Always Free) |
| Rede | VCN nova + **subnet pública**; IP público atribuído automaticamente |
| Boot volume | marcar *Use in-transit encryption*; **não** usar chave própria, que exigiria um Vault (cobrado por versão de chave) |
| Security | *Shielded instance* e *Confidential computing* desabilitados |

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

## 6. Deploy automatizado — ⚠️ REMOVIDO EM 03/09/2026

> O workflow `cd-backend-oracle.yml` **não existe mais**. Foi removido por não ter
> executado uma única vez desde a criação: fazia deploy por SSH numa VM que nunca
> chegou a ser criada — São Paulo está sem capacidade Always Free, e a migração está
> parada por decisão do PO em 02/09/2026.
>
> Os artefatos de infraestrutura desta pasta (`docker-compose.yml`, `Caddyfile`, e as
> instruções das seções 1 a 5) **foram mantidos**: descrevem o provisionamento da VM,
> que continua válido se a migração for retomada. O que se perdeu foi só a automação
> de entrega, que é barata de reescrever e cara de manter apontando para o nada.
>
> A descrição abaixo fica como registro do que a esteira fazia.

O workflow buildava em runner ARM nativo e publicava em `ghcr.io/gabrielvogado/saude-monitor-backend:<ambiente>-arm64`, tag separada da imagem x86 que o Render consome. Secrets que ele exigia:

| Secret | Conteúdo |
|---|---|
| `OCI_SSH_HOST` | IP público da VM |
| `OCI_SSH_USER` | `ubuntu` |
| `OCI_SSH_KEY` | chave **privada** correspondente à pública da VM |

O gatilho era manual (`workflow_dispatch`) de propósito; só viraria `push` depois da virada validada.

Se o *package* GHCR estiver privado, a VM precisa autenticar uma vez:
`docker login ghcr.io -u <usuário> -p <PAT com read:packages>`. Torná-lo público evita isso.

## 7. Virada

1. Subir na Oracle e medir `/actuator/health` e `GET /hospitais?size=20` (comparar com a tabela acima).
2. Só então trocar a URL do app — hoje fixa em `frontend/app.json` (`apiBaseUrlAndroid`). Parametrizar por perfil de build é o **E8-16**, e vira pré-requisito: sem isso, mudar de host obriga a recompilar o app.
3. Desligar os serviços do Render e remover `render.yaml` + `cd-backend.yml` em PR próprio.

Enquanto (1) e (2) não estiverem feitos, **o Render continua sendo o ambiente ativo** — a mudança é reversível a qualquer momento.
