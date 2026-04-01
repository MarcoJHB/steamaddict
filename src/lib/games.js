// Central game list — add/remove games here
// Find appId from the Steam store URL: store.steampowered.com/app/APPID/

const GAMES = [
  { name: "Rimworld",              appId: "294100",  genre: "colony"     },
  { name: "Factorio",              appId: "427520",  genre: "automation" },
  { name: "Subnautica",            appId: "264710",  genre: "survival"   },
  { name: "Grounded",              appId: "962130",  genre: "survival"   },
  { name: "Abiotic Factor",        appId: "1182480", genre: "survival"   },
  { name: "ASKA",                  appId: "1898300", genre: "survival"   },
  { name: "Enshrouded",            appId: "1203220", genre: "survival"   },
  { name: "Satisfactory",          appId: "526870",  genre: "automation" },
  { name: "Dwarf Fortress",        appId: "975370",  genre: "colony"     },
  { name: "Oxygen Not Included",   appId: "457140",  genre: "colony"     },
  { name: "Dyson Sphere Program",  appId: "1366540", genre: "automation" },
  { name: "Valheim",               appId: "892970",  genre: "survival"   },
  { name: "Civilization VI",       appId: "289070",  genre: "strategy"   },
  { name: "Vampire Survivors",     appId: "1794680", genre: "rpg"        },
];

module.exports = { GAMES };
