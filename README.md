# ORKA Groupe 9 — Kadastra

Tunnel complet : import **Excel/CSV** → mapping assisté → validation serveur →
**rapprochement Fisc/ERP** → **gestion des anomalies** de taxe foncière triées
par enjeu financier.

## Démarrage

```bash
npm install
npm run dev     # API Express (:3001) + front Vite (:5173) en parallèle
```

Ouvrir http://localhost:5173. Les appels `/api` sont relayés vers le serveur
par le proxy Vite.

### Autres scripts

| Script | Effet |
|--------|-------|
| `npm run server` | API seule (`:3001`) |
| `npm run client` | Front seul (`:5173`) |
| `npm run typecheck` | Vérification de types front + serveur |
| `npm run lint` | oxlint |
| `npm run build` | Build de production du front |

## Architecture

- `src/` — front React (Vite + Tailwind) : `ImportZone`, `MappingStep`,
  `ParcDashboard` (Page 1), `AnomaliesPage` (Page 2).
- `server/` — API Express : `parse` (xlsx/csv), `mapping` (auto), `validate`
  (2 niveaux), `fiscal` (mock + taxe), `reconcile` (rapprochement + anomalies).
- `src/types.ts` — schéma des champs Kadastra, partagé front/serveur.
- `src/api/contracts.ts` — contrats d'API typés, partagés front/serveur.

> Les données fiscales sont **simulées** de façon déterministe (pas d'accès
> DGFiP) ; voir la note technique §4.1.

Détails des choix techniques, de la logique de mapping et des cas limites :
voir **[NOTE_TECHNIQUE.md](NOTE_TECHNIQUE.md)**.
