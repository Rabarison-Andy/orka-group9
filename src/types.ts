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

export type FieldType = 'text' | 'number' | 'date' | 'ouinon' | 'binaire' | 'select'

export type FieldGroup =
  | 'Identification & adresse'
  | 'Caractéristiques'
  | 'Coefficients'
  | 'Équipements & raccordements'
  | 'Sanitaires'

export interface FieldDef {
  key: ApartmentKey
  /** Libellé exact (trimé) de la colonne dans le fichier source. */
  excel: string
  /** Libellé affiché dans l'UI. */
  label: string
  group: FieldGroup
  type: FieldType
  options?: readonly string[]
  /** Colonne obligatoire : doit être mappée et renseignée. */
  required?: boolean
  /**
   * Synonymes/variantes de libellés rencontrés dans les fichiers clients.
   * Servent au moteur de mapping automatique (en plus du libellé `excel`).
   */
  aliases?: readonly string[]
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
  { key: 'invariant', excel: 'Invariant', label: 'Invariant', group: 'Identification & adresse', type: 'text', required: true, aliases: ['Numéro invariant', 'N° invariant', 'Invariant cadastral', 'Identifiant fiscal', 'Identifiant cadastral', 'Référence cadastrale', 'Réf cadastrale', 'Parcelle', 'Référence', 'Ref', 'ID'] },
  { key: 'rue', excel: 'Rue', label: 'Rue', group: 'Identification & adresse', type: 'text', required: true, aliases: ['Adresse', 'Adresse du bien', 'Voie', 'Libellé voie', 'Numéro et rue', 'Numéro et voie'] },
  { key: 'depcom', excel: 'DEPCOM', label: 'Code commune (DEPCOM)', group: 'Identification & adresse', type: 'text', aliases: ['Code commune', 'Code INSEE', 'Code INSEE commune', 'INSEE', 'Code DEPCOM'] },
  { key: 'ville', excel: 'Ville', label: 'Ville', group: 'Identification & adresse', type: 'text', required: true, aliases: ['Commune', 'Localité', 'Cité'] },
  { key: 'nomImmeuble', excel: "Nom de l'immeuble", label: "Nom de l'immeuble", group: 'Identification & adresse', type: 'text', aliases: ['Immeuble', 'Bâtiment', 'Résidence', 'Nom immeuble', 'Code immeuble', 'Code bâtiment'] },

  { key: 'natureBien', excel: 'Nature du bien', label: 'Nature du bien', group: 'Caractéristiques', type: 'select', options: NATURE_OPTIONS, aliases: ['Nature', 'Type de bien', 'Type', 'Catégorie de bien'] },
  { key: 'ponderation', excel: 'Pondération en fonction de la nature', label: 'Pondération (nature)', group: 'Caractéristiques', type: 'number', aliases: ['Pondération', 'Coefficient de pondération', 'Ponderation'] },
  { key: 'etage', excel: 'Étage', label: 'Étage', group: 'Caractéristiques', type: 'text', aliases: ['Niveau', 'Etage'] },
  { key: 'categorie', excel: 'Catégorie', label: 'Catégorie', group: 'Caractéristiques', type: 'number', aliases: ['Cat', 'Categorie', 'Classe'] },
  { key: 'surface', excel: 'Surface (mur à mur) m²', label: 'Surface mur à mur (m²)', group: 'Caractéristiques', type: 'number', required: true, aliases: ['Surface', 'Surface m2', 'Surface (mur à mur)', 'Superficie', 'Surface habitable', 'Surface (m²)', 'SHON', 'SHAB', 'Surface utile', 'Surf', 'm2'] },
  { key: 'nbPieces', excel: 'Nombre de pièces', label: 'Nombre de pièces', group: 'Caractéristiques', type: 'number', aliases: ['Pièces', 'Nb pièces', 'Nombre de pieces', 'Nb de pièces', 'Typologie'] },

  { key: 'coefEntretien', excel: "Coefficient d'entretien", label: "Coefficient d'entretien", group: 'Coefficients', type: 'number', aliases: ['Coef entretien', 'Entretien'] },
  { key: 'coefSituationParticuliere', excel: 'Coefficient de situation particulière', label: 'Coef. situation particulière', group: 'Coefficients', type: 'number', aliases: ['Coef situation particulière', 'Situation particulière'] },
  { key: 'coefSituationGenerale', excel: 'Coefficient de situation générale', label: 'Coef. situation générale', group: 'Coefficients', type: 'number', aliases: ['Coef situation générale', 'Situation générale'] },

  { key: 'ascenseur', excel: 'Ascenseur (Oui/Non)', label: 'Ascenseur', group: 'Équipements & raccordements', type: 'ouinon', aliases: ['Ascenseur', 'Avec ascenseur'] },
  { key: 'eauCourante', excel: 'Eau courante (1/0)', label: 'Eau courante', group: 'Équipements & raccordements', type: 'binaire', aliases: ['Eau courante', 'Eau'] },
  { key: 'gaz', excel: 'Raccordement au gaz (1/0)', label: 'Raccordement au gaz', group: 'Équipements & raccordements', type: 'binaire', aliases: ['Gaz', 'Raccordement gaz'] },
  { key: 'electricite', excel: "Raccordement à l'électricité (1/0)", label: "Raccordement à l'électricité", group: 'Équipements & raccordements', type: 'binaire', aliases: ['Électricité', 'Electricite', 'Raccordement électricité'] },
  { key: 'egout', excel: "Raccordement à l'égout (1/0)", label: "Raccordement à l'égout", group: 'Équipements & raccordements', type: 'binaire', aliases: ['Égout', 'Egout', 'Tout à l’égout', 'Assainissement'] },
  { key: 'nbVideOrdures', excel: 'Nombre de vide-ordures', label: 'Nombre de vide-ordures', group: 'Équipements & raccordements', type: 'number', aliases: ['Vide-ordures', 'Vide ordures'] },

  { key: 'nbBaignoires', excel: 'Nombre de baignoires', label: 'Baignoires', group: 'Sanitaires', type: 'number', aliases: ['Baignoires', 'Baignoire'] },
  { key: 'nbDouches', excel: 'Nombre de receveurs de douche', label: 'Receveurs de douche', group: 'Sanitaires', type: 'number', aliases: ['Douches', 'Receveurs de douche', 'Douche'] },
  { key: 'nbBidets', excel: 'Nombre de bidets', label: 'Bidets', group: 'Sanitaires', type: 'number', aliases: ['Bidets', 'Bidet'] },
  { key: 'nbWc', excel: 'Nombre de WC', label: 'WC', group: 'Sanitaires', type: 'number', aliases: ['WC', 'Toilettes', 'W.-C.'] },
  { key: 'nbEviers', excel: "Nombre d'éviers", label: 'Éviers', group: 'Sanitaires', type: 'number', aliases: ['Éviers', 'Eviers', 'Evier'] },
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

/** Champs obligatoires (colonne devant être mappée + valeur attendue). */
export const REQUIRED_FIELDS: readonly ApartmentKey[] = FIELDS.filter(
  (f) => f.required,
).map((f) => f.key)

/** Crée un bien vide (toutes valeurs à ''). */
export function emptyApartment(): Apartment {
  return FIELDS.reduce((acc, f) => {
    acc[f.key] = ''
    return acc
  }, {} as Apartment)
}

/** Vrai si la valeur est considérée « renseignée » (non vide). */
export function isFilled(value: CellValue): boolean {
  return value !== '' && value !== null && value !== undefined
}
