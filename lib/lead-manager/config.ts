export const LEAD_SCORING_CONFIG = {
  weights: {
    zic: 25,
    specificInterest: 25,
    genericInterest: 10,
    appointment: 20,
    show: 10,
    quote: 15,
    contract: 5,
  },
  temperatures: {
    hot: 70,
    warm: 40,
  },
  zic: {
    regions: ["Umbria", "Marche"],
    provinces: ["Arezzo", "Siena", "Viterbo"],
    cities: ["Cortona", "Sansepolcro", "Orte", "Civitavecchia"],
  },
  genericInterests: [
    "auto",
    "usato",
    "usata",
    "suv",
    "utilitaria",
    "berlina",
    "station wagon",
    "gpl",
    "diesel",
    "benzina",
    "ibrida",
    "elettrica",
    "non indicata",
  ],
} as const;

export const LEAD_MANAGER_SELLERS = [
  "Caironi",
  "Grandolini",
  "Liguori",
  "Monacelli",
  "Bordini",
  "Pagliara",
] as const;
