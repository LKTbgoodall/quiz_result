# Quiz Helper

Extension Chrome : un raccourci clavier capture l'onglet actif, l'envoie à Gemini et affiche la réponse en tout petit dans le coin de la page.

## Fonctionnement

1. **Alt+Shift+Q** capture l'onglet visible (aucun flash, aucun son).
2. La capture est envoyée à l'API Gemini, qui répond le plus court possible (`B`, un nombre, deux ou trois mots).
3. La réponse s'affiche en bas à droite, très transparente ; elle devient lisible au survol. **Échap** ou un clic la ferme.

Si le modèle est surchargé, l'extension réessaie puis passe à `gemini-flash-latest`, puis à `gemini-flash-lite-latest`.

## Installation

1. Créer une clé API gratuite sur [Google AI Studio](https://aistudio.google.com/apikey).
2. Ouvrir `chrome://extensions`, activer le **Mode développeur**.
3. **Charger l'extension non empaquetée** et choisir ce dossier.
4. Cliquer sur l'icône de l'extension, coller la clé, choisir le modèle, **Enregistrer**.

Le raccourci se change dans `chrome://extensions/shortcuts`.

## Fichiers

- `manifest.json` : configuration de l'extension et du raccourci.
- `background.js` : capture, appel à Gemini, affichage de la réponse.
- `popup.html` / `popup.js` : réglages (clé API, modèle) et dernière réponse.

La clé API est enregistrée uniquement dans le stockage local de Chrome, jamais dans les fichiers.
