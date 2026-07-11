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

## 2. Brancher l'app mobile

1. Ouvre l'app FinanceHub Mobile.
2. Va dans `Reglages`.
3. Colle l'URL du script Google.
4. Mets le meme code secret que dans Apps Script.
5. Clique sur `Enregistrer la synchro`.
6. Utilise `Envoyer au Sheet` ou `Recevoir du Sheet`.

## Ce que la synchro ecrit dans le classeur

- `Mobile Sync`: sauvegarde technique de l'app.
- `Mobile - Heures`: copie lisible des heures saisies dans l'app.
- `Mobile - Acomptes`: copie lisible des acomptes.
- `Mobile - Depenses`: copie lisible des depenses.

Les onglets deja existants ne sont pas ecrases.
