# Parking à idées — Le Carreau des Halles

Toutes les idées qui passent par la tête, notées ici pour libérer l'esprit.
Rien ici n'est décidé ni planifié : on les relit ensemble à la semaine design (ou après la démo).
Une idée notée n'est jamais perdue.

## Parcours et écrans

- **Écrans d'accueil en « murs » successifs** : un écran pour s'identifier (email ou téléphone), puis un écran pour choisir un grossiste et créer un compte chez lui. (2026-10-20)
- **Affichage des produits** : en cartes avec images, façon FoodFlow, ou bien la liste actuelle (top 10 + recherche + IA) ? À trancher avec des maquettes sous les yeux. (2026-10-20)
- Navigation de l'accueil du plus large au plus détaillé : métier → spécialité / pavillon → grossiste (voir CLAUDE.md). (2026-10-12)

## Fonctionnalités

- **Heure limite de commande** : le site d'Eurodis dit 20h, mais **en réalité les commandes arrivent entre 22h et 1h du matin**, par SMS directement aux préparateurs (terrain, 2026-10-20). Donc heure limite **réglable par grossiste et indicative** (jamais bloquante), ou absente. La colonne `grossistes.cutoff_time` existe déjà.
- **Prévenir le préparateur à chaque nouvelle commande, à toute heure** (le vrai besoin : remplacer le SMS dans la poche du vendeur). Prévenir le vendeur du bon rayon. Pistes : notifications web push (gratuites, app « installée » sur l'écran d'accueil ; Android, iPhone iOS 16.4+), puis SMS Twilio en secours (payant). (2026-10-20)
- Rayon ou catégorie « Viandes d'exception » (Wagyu, Angus…) chez Eurodis. (2026-10-20)
- Les clients des grossistes sont aussi des **restaurants** : « nom de ta boutique » → « nom de ton établissement ». (2026-10-20)
- « Recommander comme la dernière fois ». (2026-10-14)
- Proposer au grossiste d'ajouter à son catalogue les produits souvent commandés en ligne libre. (2026-10-14)

- **Isoler les rayons + rôle manager** : chaque vendeur rattaché à son ou ses rayons (Moussa → Agneau) ne voit que les siens ; un manager voit tous les rayons. Plus tard : verrouiller un rayon à ses seuls vendeurs. En général 2 ou 3 vendeurs par rayon, donc une absence ne bloque rien. Ne concerne sans doute pas les volaillers (Avigros). (2026-10-20)

- Remplacer les émojis des rayons (🐂 🐑 📦…) par de vraies icônes dessinées, identiques sur tous les téléphones. (2026-10-20)

## ✅ Déjà faits

- Retrait sur place ou livraison (2026-10-21).
- Fiche client côté grossiste (2026-10-21).
- Principe « ce qui vient de se passer · Annuler · et ensuite » côté grossiste (2026-10-21).

## Plus tard / autres projets

- C to B : les clients particuliers commandent chez leur boucher (projet séparé, copie de celui-ci). (2026-10-14)
