# Parking à idées — Le Carreau des Halles

Toutes les idées qui passent par la tête, notées ici pour libérer l'esprit.
Rien ici n'est décidé ni planifié : on les relit ensemble à la semaine design (ou après la démo).
Une idée notée n'est jamais perdue.

## Parcours et écrans

- **Barre de recherche dans « Mes commandes »** (côté client) : retrouver une commande par numéro, par date ou par grossiste. (2026-10-23)
- **Bouton « Nouvelle commande » bien visible en haut de l'espace client** (accueil / profil), pour lancer une commande en un geste. (2026-10-23)
- **Écrans d'accueil en « murs » successifs** : un écran pour s'identifier (email ou téléphone), puis un écran pour choisir un grossiste et créer un compte chez lui. (2026-10-20)
- **Affichage des produits** : en cartes avec images, façon FoodFlow, ou bien la liste actuelle (top 10 + recherche + IA) ? À trancher avec des maquettes sous les yeux. (2026-10-20)
- Navigation de l'accueil du plus large au plus détaillé : métier → spécialité / pavillon → grossiste (voir CLAUDE.md). (2026-10-12)

## Fonctionnalités

- **Prévenir le client si sa commande n'est toujours pas prise au bout de ~1 h** (malgré l'alerte d'équipe à 30 min) : « Ta commande chez Eurodis n'est pas encore prise en charge », pour qu'il puisse appeler ou commander ailleurs à temps (règle 6 : on ne dérange le client que pour une décision que lui seul peut prendre). (2026-10-23)
- **Modifier sa commande après l'envoi** (côté client), avec une **heure limite de modification réglée par chaque grossiste** (« après 1h, je ne prends plus de changements ») : fonctionnalité à proposer aux grossistes. Lien avec l'heure limite de commande et avec l'annulation (question en attente : jusqu'à quand annuler). (2026-10-23)
- **Heure limite de commande** : le site d'Eurodis dit 20h, mais **en réalité les commandes arrivent entre 22h et 1h du matin**, par SMS directement aux préparateurs (terrain, 2026-10-20). Donc heure limite **réglable par grossiste et indicative** (jamais bloquante), ou absente. La colonne `grossistes.cutoff_time` existe déjà.
- **Rayon Halal** chez les volaillers (Avigros et d'autres) : différencier le halal. (2026-10-21)
- Rayon ou catégorie « Viandes d'exception » (Wagyu, Angus…) chez Eurodis. (2026-10-20)
- Les clients des grossistes sont aussi des **restaurants** : « nom de ta boutique » → « nom de ton établissement ». (2026-10-20)
- « Recommander comme la dernière fois ». (2026-10-14)
- Proposer au grossiste d'ajouter à son catalogue les produits souvent commandés en ligne libre. (2026-10-14)

- **Isoler les rayons + rôle manager** : chaque vendeur rattaché à son ou ses rayons (Moussa → Agneau) ne voit que les siens ; un manager voit tous les rayons. Plus tard : verrouiller un rayon à ses seuls vendeurs. En général 2 ou 3 vendeurs par rayon, donc une absence ne bloque rien. Ne concerne sans doute pas les volaillers (Avigros). (2026-10-20)

- Remplacer les émojis des rayons (🐂 🐑 📦…) par de vraies icônes dessinées, identiques sur tous les téléphones. (2026-10-20)

## Paiement, facturation, concurrence (réflexion du 2026-10-23)

- **Paiement dans l'app (prioritaire sur la facture, après la démo)** — douleur terrain : jusqu'à **1 h perdue chaque matin** à la caisse (10-15 min, parfois 30, chez 3-4 grossistes), plafond de carte dépassé → virement, réseau qui ne capte pas. Version simple : la caisse saisit **le montant** (pas besoin de prix au kg ni de facture), le client reçoit « À payer : 1 248,30 € », paie **en un geste** (coordonnées enregistrées, **virement instantané / payer par sa banque** pour éviter le plafond carte, ou carte), et l'équipe voit **« ✅ PAYÉ » au retrait** : plus de file. La facture peut suivre après.
  - Technique : un prestataire de paiement (type Stripe Connect) ; **l'app ne touche jamais l'argent** (chaque grossiste a son compte, l'argent va directement chez lui, commission possible) ; aucune donnée bancaire dans notre base. **Mode test** possible pour une démo sans vrai argent.
- **Écran « Caisse »** (rôle caisse dans l'équipe du grossiste) : liste des commandes prêtes, la caissière tape **le montant** et peut **joindre la facture PDF** (sortie de leur système), « Envoyer au client » → le client est notifié (« À payer chez Eurodis : 1 248,30 € · voir la facture ») → il paie → « ✅ PAYÉ » côté caisse et préparateur. Transmettre un PDF dans l'app est permis comme par email **tant que la réforme ne s'applique pas au grossiste** ; ensuite, la facture officielle passe par sa plateforme agréée et le PDF dans l'app devient une copie (à faire valider par un comptable). Un montant seul = une **demande de paiement**, pas une facture. Besoin : stockage privé (le même que pour les documents de la fiche d'ouverture), notifications aux clients (même mécanisme que les vendeurs). (2026-10-23)
- **Capter les factures envoyées par email** : chaque client a une adresse dédiée (ex. `boucherie-martin@factures.carreaudeshalles.fr`) ; il crée **une règle de transfert automatique dans son Gmail** (ou le grossiste nous met en copie) ; un service de réception d'emails envoie l'email à notre serveur, l'app reconnaît le grossiste (expéditeur) et le client (adresse), range le PDF en privé et le rattache à la commande du jour ; **l'IA lit le PDF** (montant, date, n° de facture). Ne pas lire directement la boîte Gmail du client (audits Google très lourds). Besoin : un nom de domaine (déjà prévu pour les emails de connexion). Ordre : Caisse + paiement → capture email → IA qui lit les factures. (2026-10-23)
- **Service d'analyse des achats** (vision forte de l'utilisateur, 2026-10-23 ; raison pour laquelle **les factures sont indispensables**) : l'app devient la **mémoire des achats** du commerçant. Historique des prix par produit et par grossiste, comparaison entre grossistes, alertes de hausse, budget par semaine / grossiste / rayon, saisonnalité ; **questions en français à l'IA** (« Où ai-je acheté mes cuisseaux en mars 2027 et à quel prix ? ») sur SES données. Conséquence : capter et ranger les factures **tôt** après la démo (l'historique prend de la valeur avec le temps) ; la facture électronique (données structurées, 2027) rendra la collecte plus fiable que la lecture de PDF.
  - Vigilance : chaque client ne voit que ses achats (RLS). Un **« prix moyen du marché »** calculé sur tous les clients serait puissant mais délicat (grossistes, **droit de la concurrence** sur l'échange d'informations de prix) : seulement anonymisé, agrégé, décalé dans le temps, avec avis d'un juriste.
- **Deux sortes de clients chez un grossiste** : ceux qui paient tout de suite, et ceux qui paient à **2 semaines ou plus**, contre un **dépôt de garantie de 10 000 €** (trop d'arnaques et d'impayés : des commerces qui achètent beaucoup puis ferment sans payer). 10 000 € bloque la plupart des petits commerçants. Piste : **paiement différé B2B** (le grossiste est payé tout de suite par un partenaire, le boucher paie à 15-30 jours, le partenaire prend le risque d'impayé) → remplace le dépôt. Acteurs à vérifier le moment venu (couverture France, alimentaire).
- **Facture électronique (étape 3 ou 4)** : l'app prépare la facture (Factur-X) et la confie à une **plateforme agréée partenaire** (devenir soi-même plateforme agréée est hors de portée : immatriculation par l'État, audits, certifications). Prérequis : prix au kg dans l'assortiment, **pesée à la préparation** (poids réel saisi au moment de « Prêt »), infos légales des deux côtés (SIREN, TVA, adresse : apportées par la fiche d'ouverture de compte), **série de numérotation propre** (ex. APP-2027-000123, à valider avec l'expert-comptable du grossiste), contrat avec la plateforme. Calendrier légal (à vérifier) : réception obligatoire pour tous depuis sept. 2026, émission PME/TPE en sept. 2027. Ne couvre que les ventes passées par l'app.
- **Contexte Eurodis** : système de gestion sur **écran vert (terminal, type COBOL/RPG)**, en difficulté avec la facture électronique. Brancher l'app dessus serait très difficile ; ne pas toucher à leur système, le compléter.
- **Concurrence : Choco** (Allemagne, très financé) : d'abord app de commande pour restaurants, devenue outil d'**IA pour distributeurs** (capte les commandes vocales / email et les envoie dans l'ERP). **Eux reçoivent la commande, nous la préparons** (équipe, rayons, statuts en direct, substitutions, escalade) : c'est notre différence. La saisie par IA n'est donc pas un argument suffisant à elle seule.
- **Ordre envisagé après la démo** : paiement simple (montant + payer en un geste + PAYÉ au retrait) → prix + pesée → facture électronique via plateforme partenaire → paiement différé sans dépôt.

## ✅ Déjà faits

- **Notifications aux préparateurs** (2026-10-21 → 23) : app installable, « Je suis de service », « Mes rayons » (filtre + notifications), envoi automatique aux vendeurs du bon rayon (sinon toute l'équipe), escalade unique à toute l'équipe après 30 min sans « Je prends » (ronde toutes les 5 min). Vendeur habituel refusé.
- Retrait sur place ou livraison (2026-10-21).
- Fiche client côté grossiste (2026-10-21).
- Principe « ce qui vient de se passer · Annuler · et ensuite » côté grossiste (2026-10-21).

## Plus tard / autres projets

- C to B : les clients particuliers commandent chez leur boucher (projet séparé, copie de celui-ci). (2026-10-14)
