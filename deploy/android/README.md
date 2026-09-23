# Assinatura e versão do APK

Para um APK novo **instalar por cima** do anterior, sem desinstalar, o Android exige
duas coisas ao mesmo tempo:

1. **Mesma chave de assinatura** que a versão instalada.
2. **`versionCode` maior** que o da versão instalada.

Até 22/09/2026 nenhuma das duas valia: cada build do CI gerava uma chave nova (o
secret da chave nunca foi criado — artefatos `-ASSINATURA-EFEMERA`) e o `versionCode`
era `1` fixo. Por isso todo APK novo exigia desinstalar o anterior, perdendo login,
`dispositivoId` e feedback pendente.

## Pacote, nome e versão por ambiente

Decididos no build (`-Pambiente`, `-PappVersionName`, `-PappVersionCode`) — ver o topo
de `frontend/android/app/build.gradle`:

| Ambiente | Pacote | Nome no celular | versionName | versionCode |
|---|---|---|---|---|
| dev | `com.gabrielvogado.saudemonitor.dev` | Radar Saúde DEV | `X.Y.Z-dev.<run>` | número da execução do workflow |
| hom | `com.gabrielvogado.saudemonitor.hom` | Radar Saúde HML | `X.Y.Z-rc.N` | derivado da tag |
| prod | `com.gabrielvogado.saudemonitor` | Radar Saúde | `X.Y.Z` | derivado da tag |

Pacotes diferentes = apps diferentes: DEV e HML ficam instalados lado a lado.
`X.Y.Z` é o `expo.version` de `frontend/app.json`. Build local sem as propriedades
continua saindo como antes (pacote sem sufixo, `versionCode 1`).

## Criar a chave de release (uma vez só)

A chave é credencial: **quem gera e guarda é o dono do projeto**, e ela nunca entra no
repositório (`.gitignore` já ignora `*.keystore`).

No PowerShell, numa pasta fora do repositório:

```powershell
keytool -genkeypair -v -keystore radar-saude-release.keystore -alias radar-saude -keyalg RSA -keysize 4096 -validity 10000
```

O `keytool` pergunta a senha e os dados do certificado. O formato padrão (PKCS12) usa
**a mesma senha** para o arquivo e para a chave.

### Guardar uma cópia fora do GitHub

Um secret do GitHub não pode ser lido de volta. Se esta for a única cópia e ela se
perder, nenhuma versão futura atualiza as instaladas — todo testador desinstala de
novo. Guarde o `.keystore` e a senha num gerenciador de senhas ou num cofre.

### Cadastrar os secrets

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("radar-saude-release.keystore")) | gh secret set ANDROID_RELEASE_KEYSTORE_BASE64
gh secret set ANDROID_RELEASE_KEY_ALIAS --body "radar-saude"
gh secret set ANDROID_RELEASE_STORE_PASSWORD
gh secret set ANDROID_RELEASE_KEY_PASSWORD
```

Os dois últimos pedem o valor no terminal (a mesma senha, no formato PKCS12). Não use
`certutil -encode` para o base64: ele gera PEM com cabeçalhos, que o workflow rejeita.

## Primeira instalação depois da troca

Os APKs antigos foram assinados com outras chaves e usam o pacote sem sufixo. Depois
da chave de release, **desinstale uma última vez** o "Radar Saúde" antigo; dali em
diante DEV e HML atualizam por cima.
