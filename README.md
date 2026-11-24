# Çok oyunculu oyun şablonu (HTML5 + JavaScript)

*English below.*

Bu şablonla yaptığın oyun, Oyunido sitesinde **arkadaşlarla birlikte** oynanır: biri özel oda kurar, kodu arkadaşlarına verir, birlikte oynarlar. İstersen **tek başına bilgisayara karşı** da oynanır. Tek kişilik bir oyun yapıyorsan diğer şablonlardan birini kullan.

## Başlarken
1. Bu sayfada **Use this template → Create a new repository** de. Repoyu kendi hesabında **Private** olarak oluştur.
   **Repo adı kuralı (zorunlu):** `adın_soyadın-oyunun_adı`, örneğin `berfin_toprak-renk_savasi`. Ayrıntılar [AGENTS.md](AGENTS.md) 2.9'da.
2. Repo ayarlarından (**Settings → Collaborators**) asistanını collaborator olarak ekle.
3. `game.json` dosyasını doldur: `slug`, `title`, `author` (takma adın), `category`, `orientation`, istersen `age`, `audience`, `benefits`, `skills`. Ve **`multiplayer`** (aşağıda).
4. Oyununu `game/` klasöründe yaz. `game/main.js` örnek oyun (Renk Kapmaca); onu silip kendi oyununu yazabilirsin.

## Çok oyunculu: `game.json` → `multiplayer`
```json
"multiplayer": { "room": "relay", "modes": ["pvp", "pvc"], "formats": ["1v1", "2v2", "1v1v1"], "bots": true, "matchWaitSeconds": 20 }
```
- `modes`: `pvp` birbirinize karşı, `pve` birlikte oyuna karşı, `pvc` birlikte bilgisayara karşı.
- `formats`: takımlar. `"1v1"` (bire bir), `"2v2"`, … `"10v10"`, herkes kendi için `"1v1v1"`, ya da `pve` için `"coop4"` (4 kişi birlikte). Takım başına 1-10, toplam en fazla 20 oyuncu.
- `bots`: boş yerlere bilgisayar oyuncusu girsin mi. `pvc` için `true` olmalı. `pvc` ya da `pve` varsa oyun sayfasında **Tek başına oyna** düğmesi de çıkar.

**Nasıl çalışır?** Oyunculardan birinin oyunu **kurucu** (host) olur: kuralları o çalıştırır, her şeyi o hareket ettirir, kimin kazandığına o karar verir ve oyunun tüm durumunu diğerlerine gönderir. Diğer oyunlar gelen durumu çizer ve kendi dokunuşlarını kurucuya gönderir. Kurucu çıkarsa başka biri kurucu olur ve son durumdan devam eder. Odayı, takımları, "Hazırım"ı, tepkileri (serbest sohbet yok) ve "Tekrar oyna"yı site yapar; oyunun bunlarla uğraşmaz.

```js
OyunMP.onStart((match) => { ... });   // maç başladı: oyuncular, takımlar, ben kimim, kurucu muyum ("Tekrar oyna"da yine çalışır: her şeyi burada sıfırla)
OyunMP.isHost();
OyunMP.sendToHost(veri);              // kurucuya (dokunuşlar)
OyunMP.sendToAll(veri);               // herkese (kurucu oyunun durumunu gönderir)
OyunMP.onMessage((veri, kimden) => { ... });
OyunMP.onHostChange((kurucuMuyum) => { ... });
OyunMP.end([1, 2]);                   // sadece kurucu: takımların sırası (1 = birinci)
OyunMP.onEnd((sira) => { ... });
OyunMP.random();                      // herkeste aynı rastgele sayılar
```
Ayrıntılar ve kurallar [AGENTS.md](AGENTS.md) 5. bölümde; `game/main.js` hepsini kullanan çalışan bir örnek.

## Bilgisayarında denemek
```
npx serve game
```
- Adresi açınca **tek başına**, bilgisayar oyuncularına karşı oynarsın. Başka düzen için: `?format=2v2&mode=pvc`.
- **Birlikte denemek için** aynı tarayıcıda iki sekme aç: `?room=deneme&players=2`. İlk açılan sekme kurucudur. Maç bitince bu modda yeni maç kendiliğinden başlamaz: sekmeleri yenile.
- `?lang=en` ile İngilizceyi dene. Göndermeden önce: `node scripts/check.mjs`.

## Kurallar
- Her şey `game/` klasöründe; dışarıdan dosya yükleme. En fazla 60 MB. Dokunmatik ekranda oynanabilmeli. Uygunsuz içerik yok.
- `oyun-sdk.js` ve `oyun-mp.js` dosyalarını değiştirme.

## Teslim
Diğer şablonlardaki gibi: repoyu asistanına transfer et; `oyun-team`'e taşındıktan sonra `main`'e her push oyunu yayınlar. Her durum [AGENTS.md](AGENTS.md) 2. bölümde.

---

# Multiplayer game template (HTML5 + JavaScript)

Games made from this template are played on the Oyunido site **together with friends**: someone makes a private room, gives friends the code, and they play. With computer players they can also be played **alone**. For a single-player game, use one of the other templates.

**Getting started:** as with the other templates (private repo named `firstname_lastname-game_name`, TA as collaborator, fill in `game.json`, write the game in `game/`). This template also needs **`game.json` → `multiplayer`**: `modes` (`pvp`, `pve`, `pvc`), `formats` (`"1v1"` … `"10v10"`, free-for-all like `"1v1v1"`, or `"coop4"` for `pve`; 1-10 per team, at most 20 players) and `bots` (computer players in empty seats; required for `pvc`, and with `pvc` or `pve` the game page offers **Play alone**).

**How it works:** one player's game is the **host**: it runs the rules, moves everything, decides who won and sends the whole state to the others, which draw it and send their inputs to the host. If the host leaves, another player takes over from the last state. The site handles the room, teams, ready, reactions (no free chat) and play again. **`onStart` runs again on play again**, in the same page: reset everything there. API above and in section 5 of [AGENTS.md](AGENTS.md); `game/main.js` is a complete working example.

**Testing:** `npx serve game`. Opened directly you play alone against computer players (`?format=2v2&mode=pvc` for another format). To test together, open two tabs of the same browser with `?room=test&players=2`; the first tab is the host. After a match ends there, reload the tabs to play again (only the solo preview restarts by itself). Run `node scripts/check.mjs` before handing in. Don't edit `oyun-sdk.js` or `oyun-mp.js`.

**Handing in:** the same as the other templates, see section 2 of [AGENTS.md](AGENTS.md).
