# 📻 Foundry FM

**Foundry FM** est un lecteur YouTube intégré à **Foundry Virtual Tabletop V14**, pensé pour diffuser et synchroniser simplement la musique d'une partie directement dans Foundry.

Le **Game Master contrôle la diffusion globale**, tandis que chaque joueur dispose de son propre lecteur avec ses préférences de volume, de couleur, de position et d'affichage.

> Toute la musique de la table, sans jongler entre plusieurs applications.

## ✨ Version actuelle — 1.2.1

La version **1.2.1** consolide la gestion de la file d'attente et des playlists avec un contrôle piste par piste.

Elle ajoute notamment :

- l'ajout d'une piste individuelle d'une playlist à la fin de la file ;
- l'action **Lire ensuite** pour insérer une piste juste après le morceau en cours ;
- un accès plus direct à la liste des pistes de chaque playlist ;
- la possibilité d'ajouter plusieurs fois le même morceau à la file sans conflit ;
- la conservation du glisser-déposer et de tous les outils d'édition existants.

## 🎵 Fonctionnalités

- Lecture de vidéos YouTube directement dans Foundry VTT.
- Synchronisation de la lecture **MJ → joueurs**.
- Lecture, pause, arrêt, morceau précédent et suivant.
- Avance et retour de 10 secondes.
- Lecture en boucle.
- File d'attente persistante.
- Ajout d'une piste à la fin de la file ou juste après le morceau en cours.
- Playlists propres à chaque profil MJ.
- Réorganisation des playlists par glisser-déposer.
- Recherche YouTube intégrée optionnelle.
- Ajout direct de vidéos via URL YouTube.
- Volume individuel enregistré par utilisateur.
- Couleur du lecteur personnalisable par utilisateur.
- Lecteur déplaçable et minimisable.
- Lanceur flottant déplaçable.
- Masquage complet de l'interface sans interrompre l'audio.
- Position et état d'affichage mémorisés par utilisateur.
- Notes de musique animées pendant la lecture.

## 👑 Contrôles MJ

Le Game Master dispose de l'interface complète de Foundry FM.

Il peut :

- lancer, mettre en pause ou arrêter la diffusion ;
- passer au morceau précédent ou suivant ;
- avancer ou reculer de 10 secondes ;
- activer la lecture en boucle ;
- gérer la file d'attente ;
- ajouter une piste à la fin de la file ;
- utiliser **Lire ensuite** pour programmer le prochain morceau ;
- ajouter directement une URL YouTube ;
- rechercher une vidéo depuis Foundry ;
- créer et gérer ses playlists ;
- réorganiser les morceaux ;
- synchroniser la diffusion avec les joueurs connectés.

Le MJ reste le seul utilisateur à contrôler la diffusion globale.

## 👥 Interface joueur

Les joueurs disposent volontairement d'une interface plus légère.

Ils peuvent :

- voir le morceau actuellement diffusé ;
- régler leur propre volume ;
- personnaliser la couleur du lecteur ;
- déplacer l'interface ;
- minimiser le lecteur ;
- masquer complètement Foundry FM ;
- déplacer le lanceur flottant.

Les préférences d'un joueur n'affectent jamais celles des autres membres de la table.

## 🎶 Playlists

Chaque profil Game Master dispose de ses propres playlists.

Depuis l'éditeur, il est possible de :

- créer une playlist depuis la file d'attente ;
- renommer une playlist ;
- ajouter directement une vidéo YouTube ;
- retirer un morceau ;
- ajouter une piste individuelle à la file ;
- programmer une piste avec **Lire ensuite** ;
- ajouter la file actuelle à une playlist existante ;
- remplacer le contenu d'une playlist par la file actuelle ;
- charger une playlist dans la file d'attente ;
- ajouter une playlist à la suite de la file actuelle ;
- modifier manuellement l'ordre des morceaux.

### 🖱️ Glisser-déposer

Les morceaux peuvent être réorganisés directement par **glisser-déposer** dans l'éditeur d'une playlist :

1. Attrapez la poignée `⋮⋮` située à gauche du morceau.
2. Faites-le glisser vers sa nouvelle position.
3. Un indicateur affiche son futur emplacement.
4. Relâchez le morceau.

Le nouvel ordre est immédiatement sauvegardé dans la playlist du profil MJ.

Les boutons **Monter** et **Descendre** restent disponibles comme méthode alternative.

## 🎨 Personnalisation

Foundry FM mémorise individuellement les préférences de chaque utilisateur :

- volume ;
- couleur du lecteur ;
- position de la fenêtre ;
- position du lanceur flottant ;
- état minimisé ;
- affichage ou masquage du lecteur.

Chaque joueur peut ainsi organiser Foundry FM comme il le souhaite sans modifier l'expérience des autres utilisateurs.

## 🔎 Recherche YouTube

La lecture d'une **URL YouTube fonctionne sans clé API**.

Une clé **YouTube Data API v3** est uniquement nécessaire pour utiliser la recherche YouTube directement depuis Foundry FM.

Elle peut être renseignée dans les paramètres du module. Pour limiter son utilisation à votre serveur Foundry, il est recommandé de restreindre cette clé depuis Google Cloud.

## 🔊 Autoplay et navigateurs

Les navigateurs modernes peuvent bloquer la lecture automatique de contenu audio tant que l'utilisateur n'a pas interagi avec la page.

Lors de sa première connexion, un joueur peut donc devoir cliquer une fois sur **Activer le son**.

Après cette première interaction, Foundry FM peut normalement suivre automatiquement la diffusion synchronisée du MJ.

## 📦 Installation

### Installation par manifeste

Dans Foundry VTT :

1. Ouvrez **Configuration et installation**.
2. Allez dans **Modules complémentaires**.
3. Cliquez sur **Installer un module**.
4. Collez l'URL suivante :

```text
https://github.com/Saurusius/foundry-fm/releases/latest/download/module.json
```

Foundry utilisera automatiquement le ZIP correspondant à la version publiée.

### Installation manuelle

Téléchargez le ZIP de la dernière **Release GitHub** :

```text
foundry-fm-vX.Y.Z.zip
```

Puis extrayez son contenu dans :

```text
FoundryVTT/Data/modules/foundry-fm/
```

Le fichier `module.json` doit se trouver directement dans ce dossier.

Relancez ensuite Foundry VTT et activez **Foundry FM** dans votre monde.

## 🔄 Mises à jour

Foundry FM utilise les **Releases GitHub** pour distribuer ses versions stables.

Le manifeste stable est toujours disponible à cette adresse :

```text
https://github.com/Saurusius/foundry-fm/releases/latest/download/module.json
```

Lorsqu'une nouvelle version est publiée, Foundry peut ainsi détecter et installer automatiquement la mise à jour.

## 🌿 Développement et publication

Le dépôt utilise deux branches permanentes :

- **`dev`** — branche de développement et branche par défaut ;
- **`master`** — branche stable correspondant au code prêt à être publié.

Le cycle normal est :

```text
développement → dev → Promote dev to master → master → Publish Release
```

Trois workflows GitHub Actions encadrent ce processus :

### Dev checks

Déclenché automatiquement sur `dev`.

Il vérifie notamment :

- le format des messages de commit ;
- la validité de `module.json` ;
- la présence des fichiers déclarés par le manifeste ;
- la syntaxe des fichiers JavaScript / MJS ;
- la validité des fichiers JSON.

### Promote dev to master

Déclenché manuellement lorsqu'une version est prête.

Le workflow valide le module puis effectue uniquement un **fast-forward de `dev` vers `master`**. Si les deux branches ont divergé, la promotion est refusée automatiquement.

### Publish Release

Déclenché manuellement depuis la version stable.

Le workflow :

1. lit la version depuis `module.json` ;
2. valide le module ;
3. construit `foundry-fm-vX.Y.Z.zip` ;
4. joint également `module.json` à la release ;
5. crée le tag `vX.Y.Z` ;
6. publie la **GitHub Release** depuis `master`.

Le développement quotidien doit donc rester sur **`dev`**. La branche **`master`** n'est mise à jour que par promotion d'une version validée.

## 🧩 Compatibilité

- **Foundry Virtual Tabletop : V14+**
- Version minimum : **Foundry VTT 14**
- Version vérifiée : **Foundry VTT 14**
- Version actuelle de Foundry FM : **1.2.1**
- Interface : **Français**

## 📜 Changelog

### 1.2.1 — Correctifs de fiabilité

- Activation effective des actions piste par piste dans le fichier réellement chargé par Foundry.
- Correction de l’index de file lors des ajouts sans lecture immédiate.
- Correction du retrait du morceau courant et de la navigation Précédent/Suivant.
- Respect du volume par défaut sur un profil neuf.
- Synchronisation des seeks effectués directement dans le lecteur YouTube du MJ.
- Nettoyage des anciennes copies de fichiers à la racine du dépôt.

### 1.2.0 — File d'attente piste par piste

- Ajout d'une piste individuelle d'une playlist à la fin de la file.
- Nouvelle action **Lire ensuite**.
- Accès plus direct à la liste des pistes.
- Possibilité d'ajouter plusieurs fois le même morceau sans conflit.
- Conservation du glisser-déposer et des outils d'édition existants.

### 1.1.0 — Réorganisation des playlists

- Ajout du glisser-déposer dans l'éditeur de playlists.
- Nouvelle poignée de déplacement sur chaque morceau.
- Indicateur visuel de position pendant le déplacement.
- Sauvegarde immédiate du nouvel ordre.
- Conservation des boutons Monter / Descendre.

### 1.0.0 — Première version publique

- Lecteur YouTube intégré à Foundry VTT.
- Synchronisation MJ → joueurs.
- File d'attente.
- Contrôles complets côté MJ.
- Interface simplifiée côté joueur.
- Playlists par profil MJ.
- Recherche YouTube optionnelle.
- Volume individuel.
- Personnalisation du lecteur.
- Lanceur flottant.
- Minimisation et masquage.
- Lecture en boucle.
- Notes de musique animées.

Le changelog complet est disponible dans [`CHANGELOG.md`](CHANGELOG.md).

## 📄 Licence

Foundry FM est distribué sous licence **MIT**.

Voir [`LICENSE`](LICENSE).

---

Développé pour **Foundry Virtual Tabletop** par **Saurusius**. 🎵
