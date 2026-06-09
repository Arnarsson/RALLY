# Attribution

RALLY uses third-party data and images. Credits and licences below must be kept.

## Archive match photos — Wikimedia Commons

`source/scripts/fetch-archive.mjs` only selects **commercially-usable** licences
(CC BY, CC BY-SA, CC0, public domain — never NonCommercial or NoDerivs). Each
selected image stores its `credit`, `license`, and `source` URL in
`fixtures.json`, and the app renders the credit on the match screen, satisfying
the CC BY attribution requirement.

Example (the opening match):
- *First game of the 2010 FIFA World Cup, South Africa vs Mexico* — by
  **Shine 2010** (Flickr), **CC BY 2.0**.
  https://commons.wikimedia.org/wiki/File:First_game_of_the_2010_FIFA_World_Cup,_South_Africa_vs_Mexico.jpg

When publishing, generate a full credits list from `fixtures.json`:

```bash
node -e "const f=require('./source/src/data/fixtures.json');f.fixtures.filter(x=>x.archive).forEach(x=>console.log(x.team_a+' v '+x.team_b+': '+x.archive.credit+' — '+x.archive.source))"
```

## Football data
- Schedule / live: football-data.org (`WC`) and API-Football (api-sports.io) —
  see their terms; both require an API key and attribution per their plans.
- Danish TV schedule: DR / TV 2 published World Cup programme guide.

## Fonts
- Archivo Black, Instrument Serif, Inter — Google Fonts (open licences). The board
  references licensed faces (New Order, PP Editorial New, Suisse Int'l) for
  production — licence those before shipping commercially.

## Trademarks
Not affiliated with or endorsed by FIFA. No FIFA / "World Cup" marks or logos are
used in the RALLY brand.
