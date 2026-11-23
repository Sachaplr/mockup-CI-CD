# Sales Importer — mockup CI/CD

Petite application **PHP + JavaScript** dont le seul but est de servir de support pour démontrer une chaîne **CI/CD GitHub Actions** complète : lint, tests, build, tests navigateur, image Docker, déploiement.

**Parcours utilisateur :** créer un compte → se connecter → importer des ventes en **`.csv` ou `.xlsx`** (validation ligne par ligne) → voir les totaux → exporter en CSV → vider les données → se déconnecter.

## Contenu

| Élément | Technologie |
|---|---|
| Backend | PHP 8.2+ sans framework, SQLite, API JSON dans `src/` |
| Frontend | JavaScript natif (modules ES) dans `web/src/`, bundle esbuild, lecture XLSX avec SheetJS |
| Tests unitaires | JS : `node --test` (38) · PHP : PHPUnit (19) |
| Tests navigateur | Playwright : 3 scénarios qui jouent tout le parcours utilisateur |
| Conteneur | `Dockerfile` multi-étapes |

Fichiers d'exemple dans [`samples/`](samples/) : `sales.csv`, `sales.xlsx`, `sales-with-errors.csv` (1 ligne valide, 3 rejetées).

## Lancer en local

```bash
npm install && composer install
npm run build      # produit public/assets/app.js
npm run serve      # http://127.0.0.1:8080
```

```bash
npm run lint       # ESLint
npm test           # tests JS
vendor/bin/phpunit # tests PHP
npm run test:e2e   # tests navigateur (nécessite php et `npx playwright install chromium`)
npm run report     # génère le rapport visuel à partir des derniers résultats
```

## Les pipelines (`.github/workflows/`)

### `ci.yml` — à chaque push et Pull Request

```
lint ───────┐
js-tests ───┼─► build ─► e2e ─┐
php-tests ──┘                  │
security · docker · workflows ─┼─► report (rapport visuel)
                               └─► ci-passed
```

- **Matrices** : JS sur Node 20 et 22, PHP sur 8.2, 8.3 et 8.4, en parallèle.
- **Ordre logique** : les vérifications rapides passent avant les tests navigateur, plus lents.
- **Artefacts** : le bundle est construit une fois puis réutilisé ; traces, captures et vidéos Playwright conservées.
- **Cache** (npm, Composer, couches Docker) et **annulation** des runs devenus obsolètes sur une PR.
- **Contrôles** : audit des dépendances, lint des workflows (actionlint), build Docker + test de démarrage du conteneur.

### Rapport visuel (job `report`)

Une page unique, lisible en un coup d'œil, générée par [`scripts/ci-summary.mjs`](scripts/ci-summary.mjs) :

- **Où :** onglet **Actions → le run → Summary**, et commentaire automatique sur la Pull Request (mis à jour, jamais dupliqué).
- **Contenu :** schéma du pipeline coloré (vert / rouge / gris) avec le nombre de tests par étape, tableau des tests (noms des échecs), et le **parcours utilisateur étape par étape** avec durée et message d'erreur éventuel.
- **Artefact `playwright-report` :** rapport HTML interactif, traces et vidéo de chaque scénario.

### `cd.yml` — livraison

| Événement | Résultat |
|---|---|
| push sur `main` | build de l'image → publication sur GHCR → déploiement **staging** → test de santé |
| tag `v1.2.3` | idem, puis déploiement **production** → GitHub Release avec notes générées |

L'image est promue **par empreinte (digest)** : ce qui a été testé est exactement ce qui est livré. Les étapes de déploiement sont simulées (`echo`) ; à remplacer par `ssh`, `kubectl` ou la CLI de ta plateforme.

### `codeql.yml` et `dependabot.yml`

Analyse de sécurité du JavaScript et mises à jour hebdomadaires des dépendances (Actions, npm, Composer, Docker).

## Mise en route sur GitHub

1. Pousse le dépôt : la CI démarre toute seule.
2. **Settings → Environments** : crée `staging` et `production`.
3. Sur `production`, **Deployment branches and tags → Selected branches and tags** → ajoute une règle de type *Tag* avec le motif `v*.*.*`. Seuls les tags de version peuvent alors déployer en production.
4. Publier une version : `git tag v1.0.0 && git push --tags`.

## Limites d'un dépôt privé en plan gratuit (cas de ce dépôt)

Ce dépôt est privé et rattaché à l'école. Plusieurs fonctions GitHub sont alors **indisponibles ou limitées**, selon le plan du compte ou de l'organisation :

| Fonction | Situation | Conséquence ici |
|---|---|---|
| *Required reviewers* sur un environnement | Non disponible | **Pas d'approbation manuelle** avant la production : le déploiement part dès que le tag est poussé. Garde-fou de remplacement : la restriction aux tags `v*.*.*` (étape 3). |
| Protection de branche / *required status checks* | Généralement non disponible | Rien n'empêche techniquement de fusionner une PR en rouge. Le rapport visuel et `ci-passed` restent des **indicateurs**, pas un blocage. |
| CodeQL (code scanning) | Demande que le *code scanning* soit activé sur le dépôt (GitHub Advanced Security si privé) | **Désactivé par défaut** (job ignoré ⊘). Pour l'activer : variable de dépôt `ENABLE_CODEQL = true`. Toujours actif si le dépôt est public. |
| Minutes GitHub Actions | Quota mensuel limité | Les matrices (7 jobs de tests) consomment vite ; réduire les versions testées si besoin. |

Ces protections deviennent disponibles si le dépôt passe en **public** ou si le plan est payant (Pro / Team / Enterprise). Vérifier auprès de l'école ce que son organisation GitHub autorise.

## Scénarios de démonstration

- **Casser quelque chose sur une branche** (ex. faire accepter n'importe quel email à `validateEmail`) : tests unitaires et parcours navigateur passent au rouge, le commentaire de PR indique l'étape fautive.
- **Un vrai bug attrapé pendant la construction** : le code PHP utilisait `mb_strlen` sans déclarer `ext-mbstring`. PHPUnit passait sur l'image PHP complète, mais le test navigateur sur un PHP minimal a échoué (erreur 500). Correction : une ligne dans `composer.json`.
- **Publier une version** : pousser un tag et suivre staging → production → Release.
- **Modifier uniquement ce README** et montrer que la CI se relance quand même (puis ajouter `paths-ignore` pour l'éviter).

## Notes

- Les actions sont référencées par version majeure (`@v4`) ; les épingler sur un SHA de commit renforcerait la sécurité de la chaîne d'approvisionnement.
- Le serveur intégré de PHP et SQLite suffisent pour une démo, pas pour de la production.
- `xlsx` est installé depuis le CDN officiel de SheetJS : la version du registre npm est ancienne et porte des failles connues.
