# ORKA Groupe 9 — Kadastra

Outil de détection et de contestation des anomalies de taxe foncière. Tu importes ton parc immobilier (Excel ou CSV), l'outil le compare aux données fiscales simulées, identifie les écarts, et t'aide à construire un dossier de réclamation.

---

## Lancer le projet

Node 24 requis. Si tu as `nvm` : `nvm use 24`.

```bash
npm install
npm run dev
```

Ça démarre deux processus en parallèle : l'API Express sur `:3001` et le front Vite sur `:5173`. Ouvre [http://localhost:5173](http://localhost:5173).

Tous les appels `/api/*` du front passent par le proxy Vite — pas besoin de toucher aux ports ou aux CORS en dev.

### Scripts disponibles

| Commande | Ce que ça fait |
|---|---|
| `npm run dev` | API + front en parallèle (usage normal) |
| `npm run server` | API seule sur `:3001` |
| `npm run client` | Front seul sur `:5173` |
| `npm run typecheck` | Vérifie les types front ET serveur |
| `npm run lint` | oxlint |
| `npm run build` | Build de prod du front |

---

## Comment ça marche

### Le flux utilisateur

L'outil est structuré en 3 étapes matérialisées par un stepper en haut de page :

**Étape 0 — Collecte**
1. Tu glisses-déposes (ou sélectionnes) un fichier `.xlsx`, `.xls` ou `.csv`.
2. Le serveur lit le fichier, extrait les en-têtes et 5 lignes de preview, et propose un mapping automatique des colonnes vers les 25 champs Kadastra.
3. Tu confirmes ou corriges le mapping dans l'interface — les champs obligatoires sont marqués d'un `*`.

**Étape 1 — Résultat et réclamation**
4. Le serveur valide les données, construit le parc, génère les fiches fiscales simulées, et lance le rapprochement Fisc/ERP.
5. Tu vois ton parc dans un tableau groupé par immeuble/adresse. 4 onglets : Restitution (ton parc), Appariés (biens matchés avec ou sans écart), ERP uniquement (biens absents du fisc), Fisc uniquement (biens taxés absents de ton fichier).
6. Les biens ERP-seul et Fisc-seul doivent tous être résolus (Conserver ou Exclure) avant de pouvoir passer à l'étape suivante — c'est le verrou.
7. Tu peux cliquer "En savoir plus" sur un bien pour ouvrir le formulaire d'édition en 5 étapes. Tu peux appliquer les modifications à un seul bien, à tous, ou à une sélection.

**Étape 2 — Décision**
8. Une fois tous les cas résolus, tu génères le rapport d'anomalies. L'outil trie les écarts par enjeu financier décroissant ("l'euro d'abord").
9. Pour chaque bien avec anomalie tu vois : type, surface, étage, dégrèvement estimé (vert = économie, orange = surcoût), et des boutons pour qualifier l'anomalie (Confirmée / Justifiée / En attente).
10. Tu filtres par type de bien, zone géographique ou recherche libre.
11. Une fois tes anomalies confirmées, tu finalises la réclamation.

---

## Architecture

```
.
├── src/                    # Front React (Vite + Tailwind 4)
│   ├── main.tsx            # Point d'entrée React
│   ├── App.tsx             # Machine d'état centrale (vue active, données globales)
│   ├── types.ts            # Schéma des 25 champs + type Apartment
│   ├── format.ts           # formatEuros, display
│   ├── api/
│   │   ├── contracts.ts    # Types partagés front/serveur (0 dépendance runtime)
│   │   └── client.ts       # Wrappers fetch vers l'API Express
│   ├── lib/
│   │   └── entity.ts       # Logique de regroupement en entités (immeuble / adresse)
│   └── components/
│       ├── AppShell.tsx    # Layout global (sidebar, header, stepper)
│       ├── ImportZone.tsx  # Drag-and-drop + sélection de fichier
│       ├── MappingStep.tsx # Éditeur de mapping (étape 0)
│       ├── ParcDashboard.tsx  # Parc + rapprochement Fisc/ERP (étape 1)
│       ├── BiensTable.tsx  # Tableau générique avec filtres, pagination, arbre
│       ├── AnomaliesPage.tsx  # Rapport d'anomalies + qualification (étape 2)
│       └── ConfigureForm.tsx  # Formulaire d'édition d'un bien (5 étapes)
│
└── server/                 # API Express (Node 24 + tsx watch)
    ├── index.ts            # Routes et middleware
    ├── store.ts            # Stockage en mémoire (TTL 30 min, max 50 entrées)
    └── core/
        ├── parse.ts        # Lecture Excel/CSV → {headers, rows}
        ├── mapping.ts      # Matching automatique colonnes ↔ champs (exact / alias / flou)
        ├── validate.ts     # Validation 2 niveaux (anomalies bloquantes / warnings)
        ├── fiscal.ts       # Données fiscales simulées (hash FNV-1a déterministe)
        └── reconcile.ts    # Rapprochement ERP/Fisc + génération des anomalies
```

---

## Fichiers clés à comprendre

### `src/types.ts`

C'est la source de vérité unique. Le tableau `FIELDS` décrit les 25 champs Kadastra — chacun a une clé interne (`key`), un libellé Excel officiel (`excel`), un libellé UI (`label`), un groupe de formulaire, un type, et une liste d'alias. Ce même tableau sert au parsing, au mapping automatique, au tableau de biens et au formulaire d'édition. `Apartment = Record<ApartmentKey, CellValue>` est le seul type de données métier.

### `src/api/contracts.ts`

Tous les types d'API (requêtes et réponses) partagés entre le front et le serveur. Ce fichier n'importe aucune dépendance runtime — il peut donc être importé des deux côtés sans embarquer du code Node dans le bundle.

### `server/core/fiscal.ts`

Les données DGFiP sont simulées (pas d'accès réel). Pour chaque bien, un hash FNV-1a de l'invariant modulo 10 détermine le scénario : `< 6` = apparié sans écart, `6-7` = écart de surface (le fisc compte plus de m²), `8` = écart de catégorie, `9` = bien absent du fisc. Le modèle de taxe : `surface × tarif(catégorie) × TAUX_TF (0.35)`. C'est déterministe — les mêmes données donnent toujours les mêmes résultats.

### `server/core/reconcile.ts`

Apparie chaque bien ERP à une fiche fiscale via l'invariant normalisé (upper + trim). Calcule les deltas surface et catégorie, les convertit en euros, et signe le dégrèvement : négatif = économie (trop-perçu récupérable), positif = surcoût (sous-évaluation). `canGenerateReport = (unresolved === 0)` — c'est le verrou qui bloque l'accès à l'étape 2.

### `server/store.ts`

Stockage en mémoire des uploads entre les appels. TTL 30 minutes, 50 entrées max avec éviction des plus anciennes. Volatile : tout est perdu au redémarrage. En production ça se remplacerait par Redis sans toucher au reste du code.

### `src/lib/entity.ts`

Regroupe les biens en entités pour le tableau arborescent. Logique : si `nomImmeuble` est renseigné, c'est la clé de regroupement. Sinon, repli sur `rue + ville`. Un bien sans ces infos reste autonome. Deux biens ou plus avec la même clé forment un nœud "entité" avec un chevron dépliable.

### `App.tsx`

Toute la navigation passe par `view` (`'import' | 'mapping' | 'parc' | 'form' | 'anomalies'`). Les données globales (`apartments`, `reconcileData`, `anomalyReport`) vivent ici et descendent en props. `returnView` mémorise d'où on vient quand on ouvre le formulaire d'édition (parc ou anomalies) pour y revenir au retour.

---

## API Express

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/upload` | Lit le fichier, renvoie en-têtes + aperçu + suggestions de mapping |
| POST | `/api/process` | Applique le mapping confirmé, valide, renvoie les biens |
| POST | `/api/reconcile` | Rapproche le parc aux fiches fiscales |
| POST | `/api/reconcile/resolve` | Résout un cas ERP-seul ou Fisc-seul (unitaire) |
| POST | `/api/reconcile/resolve-bulk` | Idem, en lot |
| POST | `/api/biens/edit` | Modifie un ou plusieurs biens + recalcule le rapprochement |
| POST | `/api/report/generate` | Génère le rapport d'anomalies (vérifie le verrou d'abord) |
| POST | `/api/anomalies/status` | Met à jour le statut d'une ou plusieurs anomalies |

Toutes les erreurs sont renvoyées en JSON `{ error, details? }` — jamais de crash silencieux.

---

## Stack technique

- **React 19** + **Vite 8** + **TypeScript 6** + **Tailwind 4**
- **Express 4** côté serveur, lancé avec `tsx watch` (reload à chaud)
- **concurrently** pour lancer front + serveur en une commande
- **xlsx** pour la lecture Excel, **csv-parse** pour le CSV
- **oxlint** pour le lint
- **Node 24** requis
