# 📻 Foundry FM

**Foundry FM** est un lecteur YouTube intégré à **Foundry Virtual Tabletop V14**, conçu pour diffuser facilement de la musique synchronisée à toute une table de jeu.

Le **MJ contrôle la diffusion globale**, tandis que chaque joueur dispose d’un lecteur simplifié avec ses propres préférences de volume, de couleur, de position et d’affichage.

## ✨ Fonctionnalités

* Lecture YouTube directement dans Foundry VTT.
* Synchronisation de la lecture **MJ → joueurs**.
* Lecture, pause, arrêt, précédent et suivant.
* Avance et retour de 10 secondes.
* Lecture d’un morceau en boucle.
* File d’attente persistante.
* Playlists séparées pour chaque profil MJ.
* Recherche YouTube intégrée optionnelle.
* Volume individuel enregistré par profil.
* Couleur du lecteur personnalisable par profil.
* Lecteur déplaçable et minimisable.
* Lanceur flottant déplaçable.
* Notes de musique animées pendant la lecture.
* Masquage complet du lecteur sans interrompre l’audio.
* Position et état d’affichage mémorisés par profil.

## 🎵 Playlists

Chaque MJ dispose de ses propres playlists.

Il est possible de :

* créer une playlist depuis la file d’attente ;
* renommer une playlist ;
* ajouter une vidéo YouTube directement à une playlist ;
* retirer des morceaux ;
* ajouter la file actuelle à une playlist ;
* remplacer le contenu d’une playlist par la file actuelle ;
* charger une playlist dans la file d’attente ;
* ajouter une playlist à la suite de la file actuelle ;
* réorganiser manuellement les morceaux.

### 🖱️ Drag & Drop — v1.1.0

Depuis la version **1.1.0**, les morceaux d’une playlist peuvent être réorganisés directement par **glisser-déposer**.

Dans l’éditeur d’une playlist :

1. Attrapez la poignée `⋮⋮` située à gauche d’un morceau.
2. Faites glisser le morceau vers sa nouvelle position.
3. Une ligne indique où il sera placé.
4. Relâchez le morceau.

Le nouvel ordre est automatiquement sauvegardé dans la playlist du profil MJ.

Les boutons **Monter** et **Descendre** restent disponibles comme alternative au drag & drop.

## 👑 Contrôles MJ

Le MJ dispose de l’interface complète :

* lecture et pause ;
* arrêt ;
* morceau précédent / suivant ;
* déplacement de ±10 secondes ;
* boucle ;
* gestion de la file d’attente ;
* gestion complète des playlists ;
* recherche YouTube ;
* ajout d’URL YouTube ;
* gestion de la diffusion synchronisée.

## 👥 Interface joueur

Les joueurs disposent volontairement d’une interface simplifiée.

Ils peuvent :

* voir la musique actuellement diffusée ;
* régler leur propre volume ;
* personnaliser la couleur du lecteur ;
* déplacer le lecteur ;
* minimiser la fenêtre ;
* masquer ou afficher complètement Foundry FM.

Le MJ reste le seul à contrôler la diffusion globale.

## 🎨 Personnalisation

Les préférences suivantes sont enregistrées individuellement pour chaque profil :

* volume ;
* couleur du lecteur ;
* position de la fenêtre ;
* position du lanceur flottant ;
* état minimisé ;
* affichage ou masquage du lecteur.

Les préférences d’un joueur n’affectent donc pas celles des autres utilisateurs.

## 🔎 Recherche YouTube

La lecture d’une URL YouTube fonctionne **sans clé API**.

Pour utiliser la recherche YouTube directement depuis Foundry FM, une clé **YouTube Data API v3** est nécessaire.

Elle peut être renseignée dans les paramètres du module.

Il est recommandé de restreindre cette clé à votre domaine Foundry depuis Google Cloud.

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

Foundry FM utilise les Releases GitHub pour les mises à jour.

Le manifest stable est disponible via :

```text
https://github.com/Saurusius/foundry-fm/releases/latest/download/module.json
```

Lorsqu’une nouvelle version est publiée, Foundry peut automatiquement détecter et installer la mise à jour.

## 🧩 Compatibilité

* **Foundry Virtual Tabletop : V14+**
* Version vérifiée : **Foundry VTT 14**
* Version actuelle de Foundry FM : **1.1.0**

## 🔊 Autoplay

Les navigateurs modernes peuvent bloquer la lecture automatique d’audio.

Lors de sa première connexion, un joueur peut donc devoir cliquer une fois sur :

**Activer le son**

Après cette première interaction, Foundry FM pourra normalement suivre la diffusion synchronisée du MJ.

## 📜 Changelog

### 1.1.0 — Drag & Drop

* Réorganisation des morceaux par glisser-déposer.
* Nouvelle poignée de déplacement sur les morceaux.
* Indicateur visuel de position pendant le déplacement.
* Sauvegarde automatique du nouvel ordre.
* Conservation des boutons Monter / Descendre.
* Aucun changement du fonctionnement de la synchronisation YouTube.

### 1.0.0 — Première version publique

* Lecteur YouTube intégré.
* Synchronisation MJ → joueurs.
* File d’attente.
* Playlists par profil.
* Recherche YouTube.
* Personnalisation par utilisateur.
* Lanceur flottant.
* Minimisation et masquage.
* Lecture en boucle.

Le changelog complet est disponible dans [`CHANGELOG.md`](CHANGELOG.md).

## 📄 Licence

Foundry FM est distribué sous licence **MIT**.

Voir [`LICENSE`](LICENSE).

---

Développé pour **Foundry Virtual Tabletop** par **Saurusius**. 🎵
