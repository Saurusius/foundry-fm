# Changelog

Toutes les évolutions importantes de Foundry FM sont documentées ici.

## [1.2.1] - 2026-09-19

### Correctif — pistes unitaires depuis les playlists

- Corrige l’intégration de la fonctionnalité annoncée en 1.2.0 : le code enrichi avait été placé dans `dragdrop.mjs` à la racine alors que Foundry charge `scripts/dragdrop.mjs`.
- Ajoute dans l’interface active un accès direct à la liste des pistes de chaque playlist.
- Ajoute un bouton pour envoyer une piste individuelle à la fin de la file d’attente.
- Ajoute l’action « Lire ensuite » pour insérer une piste juste après le morceau en cours.
- Chaque insertion crée un identifiant de file propre, ce qui permet d’ajouter plusieurs fois le même morceau sans conflit.
- Aucun changement du moteur YouTube ni de la synchronisation MJ → joueurs.

## [1.2.0] - 2026-09-13

### File d’attente piste par piste

- Ajout d’un bouton permettant d’ajouter une piste individuelle d’une playlist à la fin de la file.
- Ajout d’une action « Lire ensuite » pour insérer une piste juste après le morceau en cours.
- Ajout d’un accès plus visible à la liste des pistes depuis chaque playlist.
- Les pistes ajoutées à la file reçoivent un identifiant propre afin de pouvoir ajouter plusieurs fois le même morceau sans conflit.
- Conservation du glisser-déposer et des outils d’édition existants des playlists.
- Aucun changement du moteur YouTube ni de la synchronisation MJ → joueurs.

## [1.1.0] - 2026-08-28

### Réorganisation des playlists

- Ajout du glisser-déposer dans l'éditeur de playlist.
- Ajout d'une poignée de déplacement sur chaque morceau.
- Ajout d'un indicateur visuel de position avant/après pendant le déplacement.
- Sauvegarde immédiate du nouvel ordre dans la playlist du profil MJ.
- Conservation des boutons Monter / Descendre existants comme alternative au drag & drop.
- Aucun changement du moteur YouTube, de la file d'attente ou de la synchronisation MJ → joueurs.

## [1.0.0] - 2026-08-13

### Première version publique

- Lecteur YouTube intégré à Foundry VTT V14.
- Synchronisation de lecture MJ → joueurs.
- File d'attente et commandes complètes côté MJ.
- Interface simplifiée côté joueur.
- Lecture en boucle.
- Playlists liées aux profils MJ.
- Édition et renommage des playlists.
- Safeguards avant les modifications importantes.
- Volume individuel par profil.
- Couleur de fond individuelle par profil.
- Minimisation et déplacement pour tous les profils.
- Recherche YouTube optionnelle via YouTube Data API v3.
- Lanceur flottant déplaçable.
- Notes de musique animées pendant la lecture.
- Masquage complet du lecteur sans interruption audio.
