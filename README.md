# Portfolio 3D — Ethan Tosic

Un salon en 3D : ton avatar joue à la console et le portfolio s'affiche sur la télé, façon menu de jeu.
Une **version simple** (`simple.html`), lisible partout et bien référencée, est générée à partir du même contenu.

```
/index.html          la scène 3D
/simple.html         la version simple et accessible (celle à envoyer aux recruteurs pressés)
/content.json        ← TOUT le texte du portfolio (le seul fichier à modifier au quotidien)
/js/main.js          chargement, caméra, intro, clavier/souris, qualité
/js/scene.js         le salon (meubles, lumières, ambiance) + ressources 3D
/js/avatar.js        l'avatar, sa pose assise (objet POSE) et la manette
/js/tvmenu.js        le menu animé affiché sur la télé
/js/sound.js         les sons d'interface (synthétisés, aucun fichier audio)
/js/effects.js       le rendu « cinéma » (vignettage, grain)
/js/eclairage.js     la lumière selon l'heure (réglages dans l'objet ECLAIRAGE)
/js/musique.js       les enceintes : lecteur et ambiances composées en direct (lo-fi, slow au saxo)
/js/content.js       lecture de content.json (partagé avec simple.html)
/js/icons.js         les icônes des sections
/assets/             ton avatar, le CV, les modèles 3D, textures, éclairage, images
```

---

## 1. Ton avatar

Pour l'instant, un **avatar réaliste** est assis à ta place (`assets/avatar.glb`) : un personnage de la bibliothèque
Microsoft Rocketbox (licence MIT, voir `assets/LICENCE-avatar.txt`), habillé d'un blazer gris, d'une chemise noire et d'un jean brut.
Pour mettre **ton** avatar, remplace simplement ce fichier : il sera posé sur le canapé, manette en main, animé.
(Si `avatar.glb` est absent, le mannequin blanc et noir `assets/mannequin.glb` prend sa place.)

1. Crée ton avatar à partir de tes photos sur **Avaturn** (avaturn.me) ou **MetaPerson** (metaperson.avatarsdk.com).
2. Exporte-le au format **GLB** (corps entier, avec squelette).
3. Renomme le fichier `avatar.glb` et place-le dans `assets/`.

Le site reconnaît les squelettes Avaturn, MetaPerson, Mixamo, 3ds Max « Biped » et les anciens fichiers Ready Player Me
(le service Ready Player Me a fermé en janvier 2026).
S'il dépasse 25 Mo, compresse-le avant de l'envoyer sur GitHub (outil en ligne comme [gltf.report](https://gltf.report), compression Draco ou Meshopt : le site sait les lire).

---

## 2. Modifier le contenu (`content.json`)

Ouvre le fichier avec un éditeur de texte (VS Code, Bloc-notes, ou directement sur GitHub, voir plus bas).
Change seulement le texte **entre guillemets**.

### Les 3 règles du format JSON
- Le texte est toujours entre guillemets droits : `"comme ceci"`.
- Une **virgule entre deux éléments**, mais **jamais après le dernier** d'une liste.
- Les apostrophes ne posent aucun problème : `"l'IA"`. Pour des guillemets à l'intérieur d'un texte, utilise « … ».

Si tu fais une erreur, le site affiche un message qui indique la ligne à vérifier.
Tu peux aussi coller ton fichier sur [jsonlint.com](https://jsonlint.com) pour le vérifier.

### Ajouter un élément dans une section
```json
"elements": [
  { "texte": "Premier élément", "detail": "Une phrase de détail" },
  { "texte": "Nouvel élément", "detail": "Ce qui s'affiche dans l'aperçu" }
]
```
- `texte` : la ligne affichée (obligatoire)
- `detail` : la phrase d'aperçu (facultatif). Un élément qui a un `detail` s'ouvre en grand sur la télé.
- `lien` : une adresse ouverte au clic (`"https://…"` ou `"mailto:…"`)

### Ajouter une sous-page (texte long, image, lien)
```json
{
  "texte": "Serveur MCP · projet de groupe",
  "detail": "Résumé en une phrase",
  "page": {
    "titre": "Serveur MCP",
    "texte": ["Premier paragraphe…", "Deuxième paragraphe…"],
    "image": "assets/images/mcp.jpg",
    "lien": { "texte": "Voir sur GitHub", "url": "https://github.com/…" }
  }
}
```
Dépose les images dans `assets/images/` (JPG ou PNG, idéalement moins de 300 Ko, format paysage).

### Ajouter ou retirer une section
- **Ajouter** : copie un bloc complet de section (de `{` à `}`), colle-le à l'endroit voulu, change son `"id"` (sans espace ni accent), son `"label"` (nom de la vignette) et son contenu.
- **Retirer** : supprime le bloc, ou ajoute `"masquer": true` dans la section pour la cacher sans la perdre.
- Le menu de la télé et la version simple s'adaptent tout seuls. Au-delà de 6 sections, les vignettes défilent (réglable avec `"vignettesVisibles"` dans `"reglages"`).

### Le bouton d'une section
| `action`    | Effet                                    | Exemple |
|-------------|------------------------------------------|---------|
| `"cv"`      | ouvre `assets/cv.pdf`                    | `{ "texte": "Voir mon CV", "action": "cv" }` |
| `"email"`   | ouvre la messagerie vers ton adresse     | `{ "texte": "M'écrire", "action": "email" }` |
| `"lien"`    | ouvre une adresse dans un nouvel onglet  | `{ "texte": "LinkedIn", "action": "lien", "cible": "https://…" }` |
| `"section"` | va vers une autre section                | `{ "texte": "Me contacter", "action": "section", "cible": "contact" }` |

### Icônes, couleurs, photo, son
- `"icone"` : `user`, `route`, `school`, `briefcase`, `folder`, `star`, `file`, `mail`, `code`, `chart`, `trophy`, `heart`, `globe`, `link`, `book`, `gamepad`, `phone`, `bulb`.
- `"couleurs"` : deux couleurs pour le dégradé, par ex. `["#3d8bff", "#7c5cff"]` (choisis-les sur [coolors.co](https://coolors.co)). Le fond animé de la télé, le rétroéclairage du mur et la lumière de la manette prennent la couleur de la section affichée.
- `"photo"` (dans `profil`) : chemin d'une photo carrée, ex. `"assets/images/photo.jpg"`. Elle remplace tes initiales en haut du menu télé et de la version simple. Laisse `""` pour garder les initiales.
- `"son"` (dans `reglages`) : `true` = sons d'interface activés par défaut. Le visiteur peut toujours les couper (bouton haut-parleur ou touche **M**).
- `"liens"` : laisse `"github": ""` vide pour masquer le bouton GitHub. `"afficherTelephone": true` affiche ton numéro dans la version simple.

---

## 3. Tester sur ton ordinateur

Un double-clic sur `index.html` **ne suffit pas** : le navigateur bloque la lecture de `content.json` depuis le disque.
Deux solutions simples :

- **VS Code** : installe l'extension *Live Server*, fais un clic droit sur `index.html` → *Open with Live Server*.
- **Python** (s'il est installé) : dans un terminal ouvert dans le dossier du site, tape
  `python3 -m http.server 8000`, puis ouvre <http://localhost:8000>.

Il faut une connexion Internet (Three.js et la police sont chargés depuis un CDN).

---

## 4. Publier gratuitement sur GitHub Pages (pas à pas)

### Première publication
1. Crée un compte sur [github.com](https://github.com) (gratuit).
2. En haut à droite, clique sur **+** → **New repository**.
   - Nom : `portfolio` (ton site sera à `https://TON-PSEUDO.github.io/portfolio/`).
     Astuce : si tu nommes le dépôt exactement `TON-PSEUDO.github.io`, l'adresse sera `https://TON-PSEUDO.github.io/`.
   - Coche **Public**, puis **Create repository**.
3. Sur la page du dépôt, clique sur **uploading an existing file**.
4. Ouvre le dossier du site sur ton ordinateur, **sélectionne tout son contenu** (pas le dossier lui-même : `index.html`, `simple.html`, `content.json`, `README.md`, les dossiers `js` et `assets`) et glisse-le dans la page.
   Attends que tous les fichiers apparaissent dans la liste.
5. En bas, clique sur **Commit changes**.
6. Va dans **Settings** (onglet du dépôt) → **Pages** (menu de gauche).
   Sous *Build and deployment* : *Source* = **Deploy from a branch**, *Branch* = **main** et **/ (root)** → **Save**.
7. Attends 1 à 2 minutes, recharge la page : l'adresse de ton site s'affiche en haut (*Your site is live at…*).

> Limite : l'envoi par le site GitHub accepte des fichiers jusqu'à 25 Mo (voir la partie 1 pour compresser l'avatar).

### Mettre à jour le contenu ensuite
1. Sur GitHub, ouvre `content.json`, clique sur le **crayon** (Edit).
2. Modifie, puis **Commit changes**.
3. Le site se met à jour en 1 minute environ. S'il n'a pas changé : recharge avec **Ctrl + F5** (ou **Cmd + Maj + R** sur Mac).

Pour remplacer un fichier (CV, avatar, image) : ouvre le dossier sur GitHub → **Add file** → **Upload files** → glisse le nouveau fichier avec **le même nom** → **Commit changes**.

### Bel aperçu quand tu partages le lien (LinkedIn, WhatsApp…)
Une fois le site en ligne, ouvre `index.html` et `simple.html` sur GitHub (crayon) et remplace, dans la ligne `og:image`,
`assets/images/apercu.jpg` par l'adresse complète, par exemple
`https://TON-PSEUDO.github.io/portfolio/assets/images/apercu.jpg`. LinkedIn affichera alors l'image du salon sous ton lien.

---

## 5. Ajuster la pose de l'avatar

Tout est dans l'objet **`POSE`**, en haut de `js/avatar.js` (angles en degrés, distances en mètres).
Ajoute `?pose&intro=0` à l'adresse (ex. `http://localhost:8000/?pose&intro=0`) pour figer l'animation pendant tes réglages.

La hauteur d'assise et la distance au dossier sont **détectées automatiquement** sur le canapé.

| Réglage | Effet |
|---------|-------|
| `placement.x` | décale l'avatar vers la gauche ou la droite du canapé |
| `placement.assise` | monte/descend l'avatar sur le coussin (s'il s'enfonce ou flotte) |
| `placement.distanceDossier` | avance/recule l'avatar par rapport au dossier |
| `placement.hauteurBassin`, `placement.z` | valeurs fixes (en mètres) à la place de la détection automatique |
| `placement.tailleCible` | force une taille (ex. `1.78`) si l'avatar paraît trop grand ou petit |
| `bassin.bascule`, `dos.inclinaison` | avachi dans le canapé ↔ penché vers l'écran |
| `tete.inclinaison`, `tete.rotation` | direction du regard |
| `jambes.piedsAvant`, `piedsEcart`, `genouxEcart` | position des pieds et ouverture des genoux (cuisses et genoux suivent automatiquement) |
| `manette.avant`, `hauteur`, `inclinaison` | position et inclinaison de la manette (bras, mains et doigts viennent la saisir) |
| `coudes.ecart`, `coudes.arriere` | coudes plus ou moins écartés du corps |
| `prise.ecartPaume`, `versInterieur`, `versHaut`, `paumeHaut` | position des mains sur les poignées de la manette |
| `prise.doigts`, `prise.index`, `prise.pouce` | doigts plus ou moins refermés (index sur les gâchettes, pouces sur les joysticks) |
| `animation` | respiration, mouvements de tête, pouces, sursauts (mettre `0` ou `false` pour couper) |

Si ton fichier GLB contient des animations, un menu **Animation** apparaît en haut à droite pour les essayer.
Si l'avatar n'apparaît pas alors que `avatar.glb` est bien présent, ouvre la console du navigateur (F12) : la liste des os trouvés y est affichée.

---

## 6. Le décor 3D (déjà inclus)

Le salon : grande **baie vitrée** sur une forêt de sapins dans la brume, mur de la télé en **enduit** (béton ciré),
**panneau à tasseaux** en noyer avec trois étagères noires, **meuble TV suspendu** (façades anthracite, plateau en chêne,
niche avec ampli), **bandeau LED** au plafond, la **console** debout sur le meuble, la **lampe arc** en laiton,
un grand tapis, une table basse noire, un pouf et un fauteuil.
À gauche de la télé, un **tableau** dans un cadre en noyer, éclairé par une liseuse en laiton qui suit l'heure.

| Fichier | Contenu |
|---------|---------|
| `assets/models/canape.glb` | canapé en velours incurvé, recoloré en gris anthracite (remplace le canapé dessiné en code) |
| `assets/models/fauteuil.glb` | fauteuil en velours, recoloré en beige, près de la lampe |
| `assets/models/plante.glb` | plante en pot, à côté de la baie |
| `assets/images/tableau.jpg` | la toile du tableau (photo recadrée). Pour en changer : remplacer l'image, puis ajuster `rapport` (largeur ÷ hauteur) dans l'objet `TABLEAU` de `js/scene.js` |
| `assets/textures/parquet/` | parquet en chêne clair : `couleur.jpg`, `rugosite.jpg`, `normale.jpg` (relief) |
| `assets/textures/enduit/` | enduit du mur de la télé (couleur, brillance, relief) |
| `assets/textures/chene/` | chêne clair du plateau et de l'embrasure de la baie |
| `assets/textures/tapis/` | laine du tapis |
| `assets/textures/mur/`, `bois/`, `tissu/` | reliefs fins du plâtre, du bois et du tissu (`normale.jpg`) |
| `assets/hdri/salon.exr` | éclairage d'ambiance et reflets réalistes |
| `assets/images/apercu.jpg` | image du salon (version simple et partage du lien) |

Les couleurs des modèles se changent dans `"teintes"` (dans `OPTIONAL_ASSETS`, en haut de `js/scene.js`).
La forêt vue par la baie est dessinée en code et change avec l'heure (voir la partie 7).

Tout est **facultatif** : si un fichier manque, la version dessinée en code est utilisée.
Pour changer de décor, remplace un fichier en gardant son nom, ou modifie `OPTIONAL_ASSETS` en haut de `js/scene.js` :
`"remplace"` remplace un objet dessiné en code (`canape`, `plante` ou `lampe`), `"position": [x, z]` ajoute un objet,
`"rotation"` l'oriente (en degrés) et `"echelle"` règle sa taille (`1` = taille réelle, `"ajuster"` = taille de l'objet remplacé).
Ressources gratuites : [Poly Haven](https://polyhaven.com) (HDRI `.hdr`, textures, modèles), en version 1K pour rester léger.

> Des messages « 404 » dans la console du navigateur sont normaux : le site vérifie simplement si les fichiers facultatifs existent.

---

## 7. L'éclairage suit l'heure du visiteur

La lumière du salon suit l'heure de l'ordinateur ou du téléphone du visiteur (aucun service externe) :

| Heure | Ambiance |
|-------|----------|
| 21 h – 6 h | nuit : forêt sombre sous les étoiles, clair de lune bleuté par la baie, lampes et bandeau LED allumés, la lueur de la télé éclaire l'avatar |
| 6 h – 8 h | aube : ciel orange et rose, soleil rasant et chaud par la baie (taches de lumière sur le mur de la télé), les lampes s'éteignent peu à peu |
| 8 h – 18 h | jour : forêt dans la brume, soleil franc par la baie avec des ombres nettes, lampes éteintes (maximum à 12 h) |
| 18 h – 21 h | crépuscule : ciel orange puis violet, lumière dorée et basse sur le canapé, les lampes se rallument peu à peu |

- L'heure est relue chaque minute et tout change en douceur. L'écran de la télé reste lisible à toute heure.
- **Tester une heure** : ajoute `?heure=12`, `?heure=23` ou `?heure=7h30` à l'adresse (ex. `https://ethan-tosic.vercel.app/?heure=7h30`).
  `?cycle=60` fait défiler une journée entière en 60 secondes. Dans la console (F12) : `__portfolio.heure(19.5)`.
- **Tous les réglages** (horaires, couleurs, intensités, course du soleil) sont dans l'objet **`ECLAIRAGE`**, en haut de `js/eclairage.js`.

---

### Musique (l'enceinte)

Deux enceintes sur pied encadrent le meuble TV. Un clic sur l'une d'elles, ou sur le bouton ♪ en haut à droite, lance la musique.
Rien ne démarre tout seul. Un petit lecteur apparaît en bas à droite (titre, précédent / suivant, pause, volume).
La musique baisse quand on navigue dans la télé, et le bouton son la coupe.

- **Par défaut**, l'enceinte joue 4 ambiances composées en direct par le navigateur (aucun fichier, aucun droit à payer) :
  « Lo-fi du salon », « Pluie sur la forêt », « Fin de soirée » et « Saxo de minuit », un slow années 80 au saxophone
  (mélodie et grille originales, écrites dans `STATIONS` en haut de `js/musique.js`).
- **Pour mettre tes morceaux** : copie tes MP3 dans `assets/musique/`, puis liste-les dans `content.json` :

```json
"musique": {
  "volume": 0.6,
  "pistes": [
    { "titre": "Nom du morceau", "artiste": "Nom de l'artiste", "fichier": "assets/musique/morceau.mp3" }
  ]
}
```

  Dès qu'un morceau est listé, il remplace les ambiances composées en direct.
- ⚠️ Uniquement des morceaux **libres de droits** (bibliothèque audio YouTube, Pixabay Music, Free Music Archive en licence CC…).
  Si la licence demande de citer l'artiste, ajoute-le dans la partie « Crédits ».
- Préfère des MP3 légers (128 à 192 kbit/s) : quelques Mo par morceau.

---

## 8. Qualité, performance et accessibilité

- **3 niveaux de qualité** (`haute`, `moyenne`, `basse`) : ombres, occlusion ambiante, halo lumineux, rendu cinéma, poussière dans la lumière et résolution. Les téléphones démarrent en `moyenne` ; si les images par seconde chutent, la qualité baisse toute seule, puis la version simple est proposée.
- Paramètres utiles dans l'adresse : `?qualite=basse`, `?auto=0` (pas de baisse automatique), `?intro=0` (sans intro), `?pose` (animation figée), `?heure=12` (heure de l'éclairage).
- **Sans WebGL** (vieux appareil) : redirection automatique vers `simple.html`.
- **Clavier** : `Entrée` ouvre la télé · `← →` changent de section · `↑ ↓` parcourent le contenu · `Entrée` ouvre un élément · `Échap` revient en arrière · `M` coupe ou remet le son. L'intro se passe avec `Échap` ou le bouton *Passer*.
- Le contenu de la télé est lu par les lecteurs d'écran, le lien **Version simple** est toujours visible, et les animations sont réduites si le visiteur l'a demandé dans son système.
- Poids : environ 6 Mo hors avatar (décor 3D compris).

---

## 9. Référencement (Google, LinkedIn)

Le titre et la description affichés par Google et lors d'un partage de lien sont dans les balises `<title>` et `<meta name="description">` au début de `index.html` et `simple.html`. Ce sont les seules lignes de HTML que tu pourrais vouloir changer (par exemple si ta recherche d'alternance évolue).
`simple.html` est la page la mieux lue par les moteurs de recherche : c'est elle qu'il vaut mieux envoyer aux recruteurs pressés.

---

## 10. Dépannage

| Problème | Solution |
|----------|----------|
| Message « Erreur de saisie dans content.json » | regarde la ligne indiquée (et celle juste au-dessus) : virgule manquante ou en trop, guillemet oublié |
| « Impossible de lire content.json » en local | ne pas ouvrir le fichier par double-clic : voir la partie 3 |
| Le mannequin reste à la place de ton avatar | `assets/avatar.glb` absent ou mal nommé (les majuscules comptent sur GitHub) ; sinon regarde la console (F12) |
| L'avatar flotte ou s'enfonce dans le canapé | ajuste `POSE.placement.assise` |
| Mes changements n'apparaissent pas en ligne | attends 1 à 2 minutes puis recharge avec Ctrl + F5 |
| Le site est lent sur un vieil ordinateur | il baisse sa qualité seul ; sinon ajoute `?qualite=basse` ou utilise `simple.html` |
| Pas de son | clique une fois dans la page (les navigateurs l'exigent), vérifie le bouton haut-parleur |

---

## Crédits

- Canapé « Glam Velvet Sofa » © 2021 Wayfair LLC — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Plante « Diffuse Transmission Plant » © 2024 Darmstadt Graphics Group — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Fauteuil « Sheen Chair » © 2020 Wayfair LLC — CC0
- (modèles issus des [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets), optimisés pour le web)
- Éclairage HDRI : Poly Haven (CC0), via [pmndrs/assets](https://github.com/pmndrs/assets) ; reliefs de matières : pmndrs/assets (CC0)
- Avatar : bibliothèque [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) © 2020 Microsoft — licence MIT (tenue retouchée pour ce projet)
- Mannequin « X Bot » : Adobe Mixamo
- Parquet, enduit, chêne et tapis : textures générées pour ce projet · Moteur 3D : [Three.js](https://threejs.org)
