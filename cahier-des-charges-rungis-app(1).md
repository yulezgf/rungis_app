# Cahier des Charges / PRD — Application de commande Rungis

**Statut :** MVP en cours de développement (solo, non-dev en apprentissage)
**Dernière mise à jour :** à compléter

---

## 1. Contexte et problème

L'utilisateur (boucher, client des grossistes de Rungis) passe ses commandes la nuit par SMS/WhatsApp. Problèmes récurrents constatés :

- La personne responsable de la commande côté grossiste est parfois absente le matin, et personne d'autre dans l'équipe n'a connaissance de la commande → **commande perdue ou non préparée**.
- Le client découvre sur place, trop tard, qu'il ne reçoit que 7 produits sur 10 → **impossible de recommander ailleurs à temps**.
- Aucune visibilité en temps réel sur l'avancement de la préparation pendant la nuit.

Ce problème a été confirmé par plusieurs bouchers (pain point partagé) et par des vendeurs côté grossiste eux-mêmes, qui ont exprimé le souhait d'un tel outil.

## 2. Utilisateurs cibles

| Utilisateur | Rôle |
|---|---|
| Petit commerçant (boucher, épicier, primeur) | Passe commande le soir, suit son statut, reçoit le bon de commande et le bon de livraison |
| Équipe du grossiste | Reçoit la commande dans une file partagée, prépare, met à jour le statut ligne par ligne |

## 3. Objectif du MVP

Remplacer la commande WhatsApp/téléphone "invisible et dépendante d'une seule personne" par une commande structurée, visible par toute l'équipe du grossiste, avec un statut fiable en temps réel — pour que le client sache **avant d'arriver** si sa commande est complète, en cours, ou en rupture.

## 4. Périmètre fonctionnel — MVP (in scope)

1. **Catalogue produit** par grossiste, organisé par catégorie (bœuf, volaille, agneau, etc.)
2. **Commande de nuit, style chat** — simple, rapide, proche de l'usage WhatsApp actuel
3. **Bon de commande auto-généré**, avec numéro unique et horodatage
4. **File d'attente partagée** côté grossiste — visible par toute l'équipe, pas une seule personne
5. **Statut par ligne de commande** :
   - À préparer
   - En cours
   - Prêt
   - Rupture (sans substitut disponible)
   - Substitué (avec indication du produit de remplacement)
6. **Confirmation partielle en temps réel**, dès que le grossiste commence à préparer (pas seulement le matin)
7. **Trois modes de substitution, définis par ligne de produit** :
   - **Aucune substitution** : si rupture, la ligne reste flaguée, rien n'est remplacé automatiquement
   - **Substitution ouverte** : le vendeur choisit librement un remplaçant, marque la ligne "substitué"
   - **Liste restreinte classée** : le client pré-approuve 2-3 alternatives classées par ordre de préférence ; le vendeur ne peut pas sortir de cette liste
   - Dans tous les cas : traitement **asynchrone**, pas d'approbation en direct requise — le client consulte après coup
8. **Notification WhatsApp** en cas de rupture sans substitut valide (le seul cas qui justifie une alerte active)
9. **Confirmation de retrait / bon de livraison** à la clôture de la commande
10. **Assignation dynamique d'un préparateur par commande** — un membre de l'équipe "prend" une commande en cours de préparation ; visible par tous, jamais exclusive, réassignable à tout moment par n'importe qui

## 5. Hors périmètre — explicitement exclu du MVP

- Gestion réelle du stock du grossiste (le MVP suit le *statut de la commande*, pas l'inventaire)
- Paiement intégré dans l'app
- Logistique multi-entrepôt / multi-tournée
- Prédiction ou recommandation automatique (ex : anticiper les ruptures)
- Application mobile native (le MVP démarre en PWA/web)

## 6. Règles métier détaillées

- **Numéro de bon de commande** : généré automatiquement à la création de la commande, unique, séquentiel ou horodaté.
- **Comportement des substitutions** : toujours asynchrone. Le vendeur agit, marque la ligne, le client voit après coup — pas de notification bloquante pendant la nuit, sauf rupture sans solution.
- **Escalade** : seule la rupture sans substitut valide déclenche une alerte active (WhatsApp). Tout le reste est consultable, pas poussé en urgence — pour éviter la fatigue de notification.
- **Visibilité de la file** : tout membre de l'équipe du grossiste peut voir et mettre à jour n'importe quelle commande en attente — condition essentielle pour éviter le problème initial ("la personne n'est pas venue").
- **Assignation d'un préparateur** : dynamique, non exclusive. Un membre de l'équipe "prend" (claim) une commande en commençant à la préparer — affiché mais jamais verrouillé. N'importe qui peut reprendre une commande à tout moment, notamment si elle reste non prise en charge trop longtemps avant le cutoff. Le nom du préparateur peut être visible côté client (relation de confiance), mais reste une information d'affichage, jamais une réservation technique — pour ne pas recréer la dépendance à une seule personne à l'origine du problème initial.

## 7. Modèle de données — aperçu

| Table | Contenu principal |
|---|---|
| `users` | Comptes clients (bouchers) et comptes grossistes/équipe |
| `grossistes` | Fiche de chaque grossiste (nom, pavillon, cutoff horaire) |
| `products` | Catalogue par grossiste, catégorie, unité |
| `orders` | Commande : numéro, client, grossiste, horodatage, statut global, `assigned_to` (préparateur actuel, modifiable) |
| `assignment_history` | Historique des changements de préparateur par commande (qui, quand) — utile pour la confiance et pour détecter les commandes livrées à l'abandon |
| `order_lines` | Chaque ligne : produit, quantité, statut, mode de substitution, produit substitué le cas échéant |
| `substitution_rules` | Liste restreinte classée par produit, définie par le client |

## 8. Flux utilisateur — résumé

Commande envoyée (nuit) → Bon de commande créé → File d'équipe partagée → Statut par ligne (prêt / en cours / rupture → substitution) → Mise à jour en direct côté client → Confirmation de retrait.

*(Diagramme détaillé déjà produit plus tôt dans la conversation de conception.)*

## 9. Stack technique retenue

- **Langage :** JavaScript/TypeScript
- **Frontend :** Next.js + React + Tailwind CSS (PWA)
- **Backend / base de données :** Supabase (Postgres, temps réel, auth par téléphone)
- **Notifications :** WhatsApp Business API (Twilio)
- **PDF (bon de commande) :** pdf-lib ou @react-pdf/renderer
- **Hébergement :** Vercel (frontend) + Supabase Cloud

## 10. Roadmap de build (ordre des fonctionnalités)

1. Catalogue produit statique par grossiste
2. Formulaire de commande → écriture en base
3. Génération du numéro de bon de commande + PDF
4. Vue file d'attente côté grossiste, mise à jour du statut par ligne
5. Synchronisation temps réel vers le client
6. Modes de substitution (aucune / ouverte / liste restreinte)
7. Notification WhatsApp en cas de rupture sans solution

## 11. Critères de succès du pilote

- Le client sait, **avant d'arriver**, si sa commande est complète, en cours ou en rupture
- Aucune commande perdue en cas d'absence de la personne habituelle côté grossiste
- Adoption réelle par au moins 2-3 grossistes et une poignée de commerçants sur plusieurs semaines de test

## 12. Prochaine étape suggérée

Wireframe / maquette des trois écrans clés : écran de commande (client), file d'attente (grossiste), écran de suivi en direct (client).
