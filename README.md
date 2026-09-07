# 📻 Foundry FM

**Foundry FM** est un lecteur YouTube intégré à **Foundry Virtual Tabletop V14**, conçu pour diffuser simplement de la musique synchronisée à toute une table de jeu.

Le **Game Master contrôle la diffusion globale**, tandis que chaque joueur dispose de son propre lecteur avec ses préférences de volume, de couleur, de position et d’affichage.

L’objectif : garder la musique de la partie directement dans Foundry, sans obliger toute la table à jongler entre plusieurs applications.

## ✨ Fonctionnalités

* Lecture de vidéos YouTube directement dans Foundry VTT.
* Synchronisation de la lecture **MJ → joueurs**.
* Lecture, pause, arrêt, morceau précédent et suivant.
* Avance et retour de 10 secondes.
* Lecture en boucle.
* File d’attente persistante.
* Playlists propres à chaque profil MJ.
* Réorganisation des playlists par glisser-déposer.
* Recherche YouTube intégrée optionnelle.
* Ajout direct de vidéos via URL YouTube.
* Volume individuel enregistré par utilisateur.
* Couleur du lecteur personnalisable par utilisateur.
* Lecteur déplaçable et minimisable.
* Lanceur flottant déplaçable.
* Masquage complet de l’interface sans interrompre l’audio.
* Position et état d’affichage mémorisés par utilisateur.
* Notes de musique animées pendant la lecture.

## 👑 Contrôles MJ

Le Game Master dispose de l’interface complète de Foundry FM.

Il peut :

* lancer ou mettre en pause la lecture ;
* arrêter la diffusion ;
* passer au morceau précédent ou suivant ;
* avancer ou reculer de 10 secondes ;
* activer la lecture en boucle ;
* gérer la file d’attente ;
* ajouter directement une URL YouTube ;
* rechercher une vidéo depuis Foundry ;
* créer et gérer ses playlists ;
* réorganiser les morceaux ;
* synchroniser la diffusion avec les joueurs connectés.

Le MJ reste le seul utilisateur à contrôler la diffusion globale.

## 👥 Interface joueur

Les joueurs disposent volontairement d’une interface plus légère.

Ils peuvent :

* voir le morceau actuellement diffusé ;
* régler leur propre volume ;
* personnaliser la couleur du lecteur ;
* déplacer l’interface ;
* minimiser le lecteur ;
* masquer complètement Foundry FM ;
* déplacer le lanceur flottant.

Les préférences d’un joueur n’affectent jamais celles des autres membres de la table.

## 🎵 Playlists

Chaque profil Game Master dispose de ses propres playlists.

Depuis l’éditeur, il est possible de :

* créer une playlist depuis la file d’attente ;
* renommer une playlist ;
* ajouter directement une vidéo YouTube ;
* retirer un morceau ;
* ajouter la file actuelle à une playlist existante ;
* remplacer le contenu d’une playlist par la file actuelle ;
* charger une playlist dans la file d’attente ;
* ajouter une playlist à la suite de la file actuelle ;
* modifier manuellement l’ordre des morceaux.

### 🖱️ Glisser-déposer

Depuis la version **1.1.0**, les morceaux peuvent être réorganisés directement par **glisser-déposer**.

Dans l’éditeur d’une playlist :

1. Attrapez la poignée `⋮⋮` située à gauche du morceau.
2. Faites-le glisser vers sa nouvelle position.
3. Un indicateur affiche son futur emplacement.
4. Relâchez le morceau.

Le nouvel ordre est immédiatement sauvegardé dans la playlist du profil MJ.

Les boutons **Monter** et **Descendre** restent disponibles comme méthode alternative.

## 🎨 Personnalisation

Foundry FM mémorise individuellement les préférences de chaque utilisateur.

Sont notamment enregistrés :

* le volume ;
* la couleur du lecteur ;
* la position de la fenêtre ;
* la position du lanceur flottant ;
* l’état minimisé ;
* l’affichage ou le masquage du lecteur.

Chaque joueur peut ainsi organiser Foundry FM comme il le souhaite sans modifier l’expérience des autres utilisateurs.

## 🔎 Recherche YouTube

La lecture d’une **URL YouTube fonctionne sans clé API**.

Une clé **YouTube Data API v3** est uniquement nécessaire pour utiliser la recherche YouTube directement depuis Foundry FM.

Elle peut être renseignée dans les paramètres du module.

Pour limiter son utilisation à votre serveur Foundry, il est recommandé de restreindre cette clé depuis Google Cloud.

## 🔊 Autoplay et navigateurs

Les navigateurs modernes peuvent bloquer la lecture automatique de contenu audio tant que l’utilisateur n’a pas interagi avec la page.

Lors de sa première connexion, un joueur peut donc devoir cliquer une fois sur :

**Activer le son**

Après cette première interaction, Foundry FM peut normalement suivre automatiquement la diffusion synchronisée du MJ.

## 📦 Installation

### Installation par manifest

Dans Foundry VTT :

1. Ouvrez **Configuration et installation**.
2. Allez dans **Modules complémentaires**.
3. Cliquez sur **Installer un module**.
4. Collez l’URL suivante :

```text
https://raw.githubusercontent.com/Saurusius/foundry-fm/main/module.json
```

Foundry téléchargera automatiquement la dernière version disponible.

### Installation manuelle

Téléchargez le ZIP de la dernière Release GitHub :

```text
foundry-fm-v1.1.0.zip
```

Extrayez son contenu dans :

```text
FoundryVTT/Data/modules/foundry-fm/
```

Puis relancez Foundry VTT et activez **Foundry FM** dans votre monde.

## 🔄 Mises à jour

Foundry FM utilise les Releases GitHub pour distribuer ses mises à jour.

Le manifest stable est disponible via :

```text
https://github.com/Saurusius/foundry-fm/releases/latest/download/module.json
```

Lorsqu’une nouvelle version est publiée, Foundry peut automatiquement détecter et installer la mise à jour.

## 🧩 Compatibilité

* **Foundry Virtual Tabletop : V14+**
* Version minimum : **Foundry VTT 14**
* Version vérifiée : **Foundry VTT 14**
* Version actuelle de Foundry FM : **1.1.0**
* Interface : **Français**

## 📜 Changelog

### 1.1.0 — Réorganisation des playlists

* Ajout du glisser-déposer dans l’éditeur de playlists.
* Nouvelle poignée de déplacement sur chaque morceau.
* Indicateur visuel de position pendant le déplacement.
* Sauvegarde immédiate du nouvel ordre.
* Conservation des boutons Monter / Descendre.
* Aucun changement du moteur YouTube ou de la synchronisation MJ → joueurs.

### 1.0.0 — Première version publique

* Lecteur YouTube intégré à Foundry VTT.
* Synchronisation MJ → joueurs.
* File d’attente.
* Contrôles complets côté MJ.
* Interface simplifiée côté joueur.
* Playlists par profil MJ.
* Recherche YouTube optionnelle.
* Volume individuel.
* Personnalisation du lecteur.
* Lanceur flottant.
* Minimisation et masquage.
* Lecture en boucle.
* Notes de musique animées.

Le changelog complet est disponible dans [`CHANGELOG.md`](CHANGELOG.md).

## 📄 Licence

Foundry FM est distribué sous licence **MIT**.

Voir [`LICENSE`](LICENSE).

---

Développé pour **Foundry Virtual Tabletop** par **Saurusius**. 🎵
