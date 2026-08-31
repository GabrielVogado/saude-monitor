# Spec — Revisão de Navegação: Home de Apresentação, Mapa como Aba e Check-in Manual na Lista de Hospitais

## Contexto

O usuário propôs uma remodelação da navegação do app React Native/Expo (`frontend/`). A tela Home é apenas apresentação; as funções de geolocalização e check-in manual devem migrar para a navegação primária, sem quebrar nenhuma funcionalidade existente.

## Itens

1. **Mapa como 4ª aba.** O "Ver mapa" sai de dentro da Home e vira uma aba própria na barra inferior (Início, Hospitais, Mapa, Perfil), referenciada por um ícone de mapa.
2. **Home como tela de apresentação.** Remove o card de visita ativa (`CSGeoStatusCard`), os estados de carregamento/erro e os acessos rápidos ("Check-in manual" e "Ver mapa"). Mantém apenas o conteúdo de apresentação (headline, descrição, tópicos e imagem).
3. **Check-in manual na lista de Hospitais.** Cada `CSHospitalCard` ganha um botão compacto de "Check-in" (minimalista), separado do corpo do card (que segue abrindo o detalhe).
4. **Temporizador + checkout no HospitalDetalhe (específico do check-in manual).** Ao fazer check-in manual em um card, o app redireciona para `HospitalDetalheScreen`, que exibe os dados do hospital, um temporizador hh:mm:ss do tempo de permanência e o botão "Não estou aqui" (checkout). Esse bloco **só aparece** quando há visita ativa de origem `MANUAL` do hospital em questão — jamais para visitas `GEOFENCE` ou de outro hospital, preservando o detalhe público atual.

## Regras invariantes

- **Não quebrar funcionalidades existentes.** Auto check-in/out por geofence, heartbeat e expiração por inatividade devem continuar funcionando. Por isso, a Home mantém a inicialização do geofencing e a reidratação silenciosa da visita ativa (sem UI).
- O detalhe público do hospital (mapa, indicadores, contato) permanece intacto.
- Modo anônimo (§3.3) preservado via `dispositivoId`.

## Critérios de aceite

- [ ] 4 abas na barra: Início, Hospitais, Mapa, Perfil; "Mapa" usa ícone de mapa.
- [ ] Home renderiza só apresentação (sem card de visita, sem acessos rápidos).
- [ ] `CSHospitalCard` exibe botão compacto de check-in por hospital.
- [ ] Check-in manual (origem MANUAL) redireciona para o `HospitalDetalhe` que mostra temporizador hh:mm:ss + botão "Não estou aqui".
- [ ] O temporizador/checkout só aparece com visita ativa `origem === "MANUAL"` do mesmo hospital.
- [ ] Geofence automático, heartbeat e reidratação seguem ativos.
- [ ] Suítes existentes verdes: `tsc --noEmit`, `jest` (incluindo `App.test.js` atualizado para 4 abas).
