# FinanceHub Mobile - synchronisation Google Sheets

## 1. Installer le script Google

1. Ouvre le Google Sheet FinanceHub.
2. Clique sur `Extensions` puis `Apps Script`.
3. Colle le contenu de `google-apps-script/Code.gs`.
4. Remplace `CHANGE_MOI` par un code secret personnel.
5. Clique sur `Deploy` puis `New deployment`.
6. Choisis `Web app`.
7. Mets `Execute as` sur `Me`.
8. Mets `Who has access` sur `Anyone`.
9. Clique sur `Deploy` et copie l'URL qui finit par `/exec`.

Si le script existe deja, ne fais pas seulement `Save`.
Va dans `Deploy` > `Manage deployments`, clique sur le crayon, choisis `Version: New version`, puis `Deploy`.
C'est obligatoire sinon Google continue d'utiliser l'ancienne version et l'app affiche `Impossible de joindre le script Google`.

Depuis la V0.22, le script contient aussi un mode secours mobile:

- `ping`: verifie que le telephone atteint bien Google Apps Script.
- `pullRedirect`: ouvre Google puis revient dans l'app avec les donnees du Sheet.
- `pushRedirect`: envoie les donnees avec un formulaire Google puis revient dans l'app.

Ce mode contourne les blocages de type appel discret, iframe, no-cors ou appli installee.

## 2. Brancher l'app mobile

1. Ouvre l'app FinanceHub Mobile.
2. Va dans `Reglages`.
3. Colle l'URL du script Google.
4. Mets le meme code secret que dans Apps Script.
5. Clique sur `Enregistrer la synchro`.
6. Utilise `Envoyer au Sheet` ou `Recevoir du Sheet`.

Si le telephone affiche encore une erreur de connexion, utilise:

- `Tester le script` pour verifier que Google repond.
- `Recevoir secours` pour recevoir en passant par une page Google.
- `Envoyer secours` pour envoyer en passant par une page Google.

## Ce que la synchro ecrit dans le classeur

- `Mobile Sync`: sauvegarde technique de l'app.
- `Mobile - Heures`: copie lisible des heures saisies dans l'app.
- `Mobile - Acomptes`: copie lisible des acomptes.
- `Mobile - Depenses`: copie lisible des depenses.
- `Heures Adecco`: les heures saisies dans l'app sont ajoutees avec une marque `FinanceHub Mobile ID`.
- `Acomptes`: les acomptes saisis dans l'app sont ajoutes avec une marque `FinanceHub Mobile ID`.
- `Revenus`: les acomptes recus sont aussi ajoutes comme revenus.
- `Depenses variables`: les depenses saisies dans l'app sont ajoutees avec une marque `FinanceHub Mobile ID`.

Les lignes saisies a la main dans les onglets principaux ne sont pas supprimees.
La synchro remplace seulement les anciennes lignes qui portent la marque `FinanceHub Mobile ID`.

## Verification rapide

Ouvre l'URL `/exec` du script avec `?action=ping`.
Si le deploiement est bon, tu dois voir un texte qui contient `"ok":true`.
Tu peux aussi tester `/exec?action=pull&callback=test`.
Si le deploiement est bon, tu dois voir un texte qui commence par `test({`.
Si tu vois `Fonction de script introuvable : doGet`, il faut redeployer une nouvelle version.
