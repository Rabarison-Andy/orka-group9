export type ApartmentKey =
  | 'invariant'
  | 'rue'
  | 'depcom'
  | 'ville'
  | 'nomImmeuble'
  | 'natureBien'
  | 'ponderation'
  | 'etage'
  | 'categorie'
  | 'surface'
  | 'coefEntretien'
  | 'coefSituationParticuliere'
  | 'coefSituationGenerale'
  | 'ascenseur'
  | 'eauCourante'
  | 'gaz'
  | 'electricite'
  | 'egout'
  | 'nbPieces'
  | 'nbBaignoires'
  | 'nbDouches'
  | 'nbBidets'
  | 'nbWc'
  | 'nbEviers'
  | 'nbVideOrdures'

export type FieldType = 'text' | 'number' | 'ouinon' | 'binaire' | 'select'

export type FieldGroup =
  | 'Identification & adresse'
  | 'Caractéristiques'
  | 'Coefficients'
  | 'Équipements & raccordements'
  | 'Sanitaires'

export interface FieldDef {
  key: ApartmentKey
  /** Libellé exact (trimé) de la colonne dans le fichier Excel. */
  excel: string
  /** Libellé affiché dans l'UI. */
  label: string
  group: FieldGroup
  type: FieldType
  options?: readonly string[]
}

/** Une valeur de cellule : texte, nombre, ou vide. */
export type CellValue = string | number

/** Un bien = un dictionnaire de valeurs indexé par clé de champ. */
export type Apartment = Record<ApartmentKey, CellValue>

export const NATURE_OPTIONS = [
  'Appartement',
  'Maison',
  'Parking',
  'Cave',
  'Dépendance',
] as const

/**
 * Source de vérité unique : décrit chaque champ une seule fois.
 * Sert à la fois au parsing Excel, au tableau et au formulaire généré.
 */
export const FIELDS: readonly FieldDef[] = [
  { key: 'invariant', excel: 'Invariant', label: 'Invariant', group: 'Identification & adresse', type: 'text' },
  { key: 'rue', excel: 'Rue', label: 'Rue', group: 'Identification & adresse', type: 'text' },
  { key: 'depcom', excel: 'DEPCOM', label: 'Code commune (DEPCOM)', group: 'Identification & adresse', type: 'text' },
  { key: 'ville', excel: 'Ville', label: 'Ville', group: 'Identification & adresse', type: 'text' },
  { key: 'nomImmeuble', excel: "Nom de l'immeuble", label: "Nom de l'immeuble", group: 'Identification & adresse', type: 'text' },

  { key: 'natureBien', excel: 'Nature du bien', label: 'Nature du bien', group: 'Caractéristiques', type: 'select', options: NATURE_OPTIONS },
  { key: 'ponderation', excel: 'Pondération en fonction de la nature', label: 'Pondération (nature)', group: 'Caractéristiques', type: 'number' },
  { key: 'etage', excel: 'Étage', label: 'Étage', group: 'Caractéristiques', type: 'text' },
  { key: 'categorie', excel: 'Catégorie', label: 'Catégorie', group: 'Caractéristiques', type: 'number' },
  { key: 'surface', excel: 'Surface (mur à mur) m²', label: 'Surface mur à mur (m²)', group: 'Caractéristiques', type: 'number' },
  { key: 'nbPieces', excel: 'Nombre de pièces', label: 'Nombre de pièces', group: 'Caractéristiques', type: 'number' },

  { key: 'coefEntretien', excel: "Coefficient d'entretien", label: "Coefficient d'entretien", group: 'Coefficients', type: 'number' },
  { key: 'coefSituationParticuliere', excel: 'Coefficient de situation particulière', label: 'Coef. situation particulière', group: 'Coefficients', type: 'number' },
  { key: 'coefSituationGenerale', excel: 'Coefficient de situation générale', label: 'Coef. situation générale', group: 'Coefficients', type: 'number' },

  { key: 'ascenseur', excel: 'Ascenseur (Oui/Non)', label: 'Ascenseur', group: 'Équipements & raccordements', type: 'ouinon' },
  { key: 'eauCourante', excel: 'Eau courante (1/0)', label: 'Eau courante', group: 'Équipements & raccordements', type: 'binaire' },
  { key: 'gaz', excel: 'Raccordement au gaz (1/0)', label: 'Raccordement au gaz', group: 'Équipements & raccordements', type: 'binaire' },
  { key: 'electricite', excel: "Raccordement à l'électricité (1/0)", label: "Raccordement à l'électricité", group: 'Équipements & raccordements', type: 'binaire' },
  { key: 'egout', excel: "Raccordement à l'égout (1/0)", label: "Raccordement à l'égout", group: 'Équipements & raccordements', type: 'binaire' },
  { key: 'nbVideOrdures', excel: 'Nombre de vide-ordures', label: 'Nombre de vide-ordures', group: 'Équipements & raccordements', type: 'number' },

  { key: 'nbBaignoires', excel: 'Nombre de baignoires', label: 'Baignoires', group: 'Sanitaires', type: 'number' },
  { key: 'nbDouches', excel: 'Nombre de receveurs de douche', label: 'Receveurs de douche', group: 'Sanitaires', type: 'number' },
  { key: 'nbBidets', excel: 'Nombre de bidets', label: 'Bidets', group: 'Sanitaires', type: 'number' },
  { key: 'nbWc', excel: 'Nombre de WC', label: 'WC', group: 'Sanitaires', type: 'number' },
  { key: 'nbEviers', excel: "Nombre d'éviers", label: 'Éviers', group: 'Sanitaires', type: 'number' },
]

/** Accès rapide à un champ par sa clé. */
export const FIELD_BY_KEY: Readonly<Record<ApartmentKey, FieldDef>> = FIELDS.reduce(
  (acc, f) => {
    acc[f.key] = f
    return acc
  },
  {} as Record<ApartmentKey, FieldDef>,
)

/** Ordre d'affichage des sections du formulaire. */
export const FIELD_GROUPS: readonly FieldGroup[] = [
  'Identification & adresse',
  'Caractéristiques',
  'Coefficients',
  'Équipements & raccordements',
  'Sanitaires',
]

/** Colonnes résumées affichées dans le tableau. */
export const TABLE_COLUMNS: readonly ApartmentKey[] = [
  'invariant',
  'rue',
  'ville',
  'natureBien',
  'etage',
  'surface',
  'nbPieces',
]

/** Crée un bien vide (toutes valeurs à ''). */
export function emptyApartment(): Apartment {
  return FIELDS.reduce((acc, f) => {
    acc[f.key] = ''
    return acc
  }, {} as Apartment)
}
