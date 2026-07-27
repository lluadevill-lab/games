# Rocket Lite — roadmap para evoluir com cara de jogo grande

> Objetivo seguro: fazer um jogo **inspirado** em futebol com carros, leve e gratuito. Evite nomes, logos, assets, mapas, sons e designs copiáveis de Rocket League para reduzir risco de copyright/trademark/trade dress.

## Fase 1 — feel de gameplay e visual leve

- Física de carro estável a 120 Hz.
- Rodas com eixo correto, curso de suspensão visual e modelo de mola/amortecedor por roda.
- Flips com impulso direcional claro e gravidade reduzida durante o dodge.
- Carros com silhuetas diferentes, cabine, aerofólio e adesivos low-poly.
- Próximos itens curtos:
  - garagem local para escolher carro/adesivo/explosão;
  - replay curto de gol;
  - câmera mais configurável;
  - áudio de motor por RPM/boost.

## Fase 2 — progressão offline justa

- Moedas ganhas por partida, gols, defesas, vitórias e torneios.
- Caixinhas compradas **somente com moeda do jogo** para evitar problemas de aposta/loot box paga.
- Inventário em `localStorage` no MVP; depois sincronizar em backend.
- Raridades cosméticas sem vantagem competitiva.

## Fase 3 — torneios

- MVP offline/local: chave de 4 ou 8 times com bots, semifinal/final e prêmio maior.
- Depois online: torneios privados por código de sala.
- Regras: melhor de 1 no começo, prorrogação por morte súbita, prêmio por posição.

## Fase 4 — online com amigos

GitHub Pages sozinho é site estático; para party online precisa um serviço de rede.

Arquitetura recomendada para PC fraco:

1. **Servidor autoritativo leve** em Node/Colyseus ou Cloudflare Durable Objects.
   - Simula o mundo a 120 Hz ou 60 Hz com substeps.
   - Clientes enviam só input: throttle, steer, jump, boost etc.
   - Servidor manda snapshots comprimidos.
2. **Salas/party**:
   - Criar sala gera código curto.
   - Amigos entram pelo código.
   - Host não precisa abrir porta.
3. **Predição no cliente**:
   - Cliente aplica input imediatamente.
   - Reconcilição quando chega snapshot do servidor.
4. **Bots no servidor**:
   - Se faltar jogador, servidor instancia bot.
5. **Fallback barato**:
   - WebRTC P2P com servidor de sinalização para salas privadas.
   - Menor custo, mas menos seguro contra trapaça.

## Fase 5 — polimento AAA mantendo leve

- Materiais e iluminação com níveis: baixo/médio/alto.
- Partículas configuráveis para gol, boost e demolição.
- Skins originais por tema: neon, rally, sci-fi, praia, bloco, retro.
- HUD responsivo e onboarding de manobras.
- Métricas: FPS, input delay, ping, perda de pacote.
