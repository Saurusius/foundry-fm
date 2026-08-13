# 📻 Foundry FM

**Foundry FM** est un lecteur YouTube intégré à **Foundry Virtual Tabletop V14** pensé pour diffuser facilement de la musique à une table de jeu.

Le MJ pilote la diffusion globale tandis que chaque joueur dispose d'un lecteur simplifié avec ses propres préférences de volume, de couleur, de position et d'affichage.

## Fonctionnalités

- Lecture YouTube intégrée à Foundry VTT.
- Synchronisation MJ → joueurs.
- Lecture, pause, arrêt, précédent, suivant et déplacement temporel.
- Lecture en boucle.
- File d'attente persistante.
- Playlists séparées par profil MJ.
- Édition des playlists :
  - renommage ;
  - ajout et retrait de morceaux ;
  - réorganisation ;
  - ajout ou remplacement depuis la file actuelle.
- Confirmations de sécurité avant les modifications importantes.
- Recherche YouTube optionnelle avec une clé YouTube Data API v3.
- Volume individuel enregistré par profil.
- Couleur de fond individuelle enregistrée par profil.
- Lecteur déplaçable et minimisable pour les MJ et les joueurs.
- Interface joueur volontairement simplifiée.
- Lanceur flottant déplaçable avec petite radio et notes animées pendant la lecture.
- La fenêtre peut être totalement masquée sans interrompre la musique.
- Position et état d'affichage mémorisés par profil.

## Compatibilité

- **Foundry VTT : 14+**
- Vérifié avec Foundry VTT 14.

## Installation par manifest

Dans Foundry VTT :

1. Ouvrez **Configuration et installation**.
2. Allez dans **Modules complémentaires**.
3. Cliquez sur **Installer un module**.
4. Collez le manifest suivant :

```text
https://raw.githubusercontent.com/Saurusius/foundry-fm/main/module.json
```

## Installation manuelle

Téléchargez le ZIP de la dernière Release GitHub et extrayez le dossier `foundry-fm` dans :

```text
FoundryVTT/Data/modules/
```

Puis relancez Foundry et activez **Foundry FM** dans votre monde.

## Recherche YouTube

La lecture d'une URL YouTube fonctionne sans clé API.

Pour utiliser la recherche intégrée, renseignez une **clé YouTube Data API v3** dans les paramètres du module. Il est recommandé de restreindre cette clé à votre domaine Foundry.

## Contrôles

### MJ

Le MJ dispose de l'interface complète : commandes de lecture, file d'attente, playlists, recherche et gestion de la diffusion.

### Joueurs

Les joueurs voient uniquement la musique en cours et disposent de leurs préférences locales :

- volume ;
- couleur ;
- déplacement ;
- minimisation ;
- affichage/masquage.

## Remarque sur l'autoplay

Selon les règles du navigateur, un joueur peut devoir cliquer une première fois sur **Activer le son** avant que l'audio puisse démarrer automatiquement.

## Licence

MIT — voir [LICENSE](LICENSE).

---

Développé pour Foundry VTT par **Saurusius**.
