# Controle TCL (Roku TV / Android TV / Google TV)

Controle remoto para TV TCL que funciona no navegador do celular (Wi-Fi).

## Como usar
Precisa do [Node.js](https://nodejs.org) 18+ num PC, notebook ou Raspberry ligado no **mesmo Wi-Fi da TV**.

```bash
cd tcl-remote
npm install
npm start
```

O terminal mostra um endereço como `http://192.168.0.10:3000`. Abra no celular
(no iPhone/Android: menu do navegador › "Adicionar à tela inicial" para virar um app).

Em **⚙ Configurar TV**: toque em *Procurar TV*, escolha a TV e *Conectar*.

### Android TV / Google TV (maioria das TCL 55" no Brasil)
Na primeira conexão a TV mostra um **código de 6 caracteres**; digite no app para parear.
O pareamento fica salvo em `config.json`.

### Roku TV (TCL vendidas nos EUA)
Na TV: Configurações › Sistema › Configurações avançadas › Controle por apps móveis › **Permissivo**.

### Como saber qual é a sua?
Se ao apertar Home aparece a tela roxa/verde do Roku → Roku TV. Se aparece Google TV/Android TV
(Play Store, Chromecast integrado) → Android/Google TV.

## Limitações
- TCL antiga, sem Wi-Fi ("não smart"), só aceita infravermelho: não dá para controlar por Wi-Fi.
  Seria preciso um emissor IR (ex.: ESP32 com LED IR, ou celular com IR).
- Ligar a TV pelo botão ⏻ só funciona se a TV mantiver a rede ativa em standby
  (no Android TV costuma ser preciso ligar "Ligar por rede/Wi-Fi" nas configurações).
- Não testado numa TV física; os protocolos (Roku ECP e Android TV Remote v2) são os mesmos do app oficial.

Teclado do computador também funciona: setas, Enter, Esc, +/-, M (mudo), PgUp/PgDn (canal).
