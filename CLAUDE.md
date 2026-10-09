@AGENTS.md
# CLAUDE.md — App de commande chez les grossistes de Rungis

## À lire en premier (instructions pour Claude Code)

- **Langue** : réponds en français. L'utilisateur écrit vite, avec des fautes de frappe : comprends l'intention, ne le reprends jamais là-dessus. Les termes techniques peuvent rester en anglais.
- **Le code est la source de vérité.** Ce fichier a été écrit à partir d'une longue conversation de conception, pas à partir d'une lecture du code. Si le code et ce fichier divergent, signale-le clairement et propose de mettre ce fichier à jour. Ne devine pas.
- **Premier réflexe suggéré** : avant toute modification, parcours le projet et fais un état des lieux (ce qui est conforme à ce fichier, ce qui diverge). Voir la section « Points à vérifier » plus bas.
- **Qui est l'utilisateur** : un boucher qui travaille à Rungis. Expert du métier, pas développeur de formation, il apprend à coder en construisant cette app seul. Il a de bonnes bases JS/React et progresse vite, mais il veut **comprendre** son code, pas seulement qu'il marche.
- **Comment travailler avec lui** :
  - Explique ce que tu changes et pourquoi, surtout sur la logique des commandes, des statuts et des substitutions. Une phrase ou deux suffisent, pas de cours.
  - Une tâche à la fois, par petites étapes. Pas de refonte non demandée.
  - Chaque étape qui marche se termine par un commit et un `git push`. Propose un message de commit court.
  - Avant de pousser, lance `npm run lint` puis `npm run build` : le build Vercel est plus strict que `npm run dev` sur TypeScript, et a déjà cassé une fois.
  - Préviens avant toute action destructive (SQL `delete`/`drop`, réinitialisation de données), et avant tout ce qui pourrait casser la version en ligne.
  - Ne committe jamais de clés ou de fichiers `.env*`.
  - Sois honnête quand tu n'es pas sûr, et dis quand un choix est un compromis.
- **Préférences techniques de l'utilisateur** : vrai code full-stack, pas d'outils no-code. Budget minimal (hébergement gratuit autant que possible). Il a envisagé Python (Django) et a finalement gardé JS/TS : ne propose pas de changer de stack.

---

## Le produit en une page

**Problème réel (vécu par l'utilisateur et d'autres bouchers).** Un boucher commande chez ses grossistes de Rungis la nuit, par SMS ou WhatsApp. Le matin :
- la personne qui a reçu la commande n'est pas venue, et personne d'autre dans l'équipe du grossiste ne sait qu'il y a une commande ;
- il arrive et ne reçoit que 7 produits sur 10, trop tard pour commander ailleurs.

**Solution.** Remplacer la commande « invisible, dépendante d'une seule personne » par un objet structuré, visible par toute l'équipe du grossiste, avec un numéro et un statut ligne par ligne, mis à jour en direct. Le client sait **avant d'arriver** si sa commande est complète, en cours ou en rupture.

**Validation du besoin.** Le problème est confirmé par l'utilisateur (c'est son quotidien), par d'autres bouchers, et par des vendeurs côté grossiste qui ont dit qu'ils voulaient un tel outil. Ne propose donc pas de « valider d'abord avec un Google Sheet / un groupe WhatsApp » : les grossistes ne le feraient pas, et ça a été écarté.

**Positionnement.** Rungis a déjà une marketplace officielle (rungismarket.com, opérée par Califrais / STEF / Webhelp) et certains grossistes ont leurs propres apps. Cette app ne cherche pas à les concurrencer frontalement : elle vise les **petits commerçants indépendants** (bouchers, épiciers, primeurs), avec une interface très simple, une visibilité d'équipe côté grossiste, et des règles de substitution fines.

**Utilisateurs.**
- **Client** : petit commerçant (boucher d'abord). Commande le soir, suit sa commande en direct.
- **Équipe du grossiste** : plusieurs personnes, toutes voient toutes les commandes de leur grossiste.

**Grossistes réels du pilote** (les noms sont réels, les catalogues en base sont des données de test inventées) :
- **Eurodis** : bœuf, agneau, veau
- **Courtin Hervouet** : volaille, charcuterie
- **Avigros** : volaille, charcuterie
- **Nadaud-Delahaye** : abats, produits tripiers

Plus tard : fruits et légumes, d'autres grossistes de viande, d'autres corps de métier de Rungis (marée, produits laitiers, fleurs), d'autres MIN en France. Rien dans l'architecture ne l'empêche : un grossiste est une ligne dans `grossistes`, ses produits sont dans `products`.

**Glossaire.** *Grossiste* : fournisseur en gros à Rungis. *Bon de commande* : la commande, avec son numéro. *Rupture* : produit indisponible. *Cutoff* : heure limite pour commander chez un grossiste. *Préparateur* : la personne de l'équipe qui prépare une commande. *MIN* : Marché d'Intérêt National (Rungis en est le plus grand). *Pavillon* : zone du marché (viande, marée, fruits et légumes…).

---

## Stack et déploiement

- **Next.js 16** (App Router, Turbopack), **TypeScript**, **Tailwind CSS**. Alias d'import `@/` (ex : `@/lib/supabase`).
- **Supabase** : Postgres + Realtime. Un seul client dans `lib/supabase.ts`, avec la clé `anon`.
- **Vercel** : hébergement, déploiement automatique à chaque `git push` sur `main`. URL de prod : `rungis-app.vercel.app`.
- **GitHub** : dépôt `rungis-app`. Dossier local : `rungis_app`.
- Variables d'environnement : `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dans `.env.local` (ignoré par git via `.env*`) **et** dans Vercel (Settings → Environment Variables). Après avoir changé `.env.local`, il faut redémarrer `npm run dev`.
- Commandes : `npm run dev` (local, port 3000), `npm run build` (à lancer avant de pousser).

Pas d'app native : l'interface est pensée mobile d'abord (l'utilisateur teste sur son téléphone), éventuellement installable en PWA plus tard.

---

## Architecture actuelle

### Pages (`app/`)

| Route | Fichier | Rôle |
|---|---|---|
| `/` | `app/page.tsx` | Accueil : liste des grossistes (nom + spécialités) |
| `/commande/[id]` | `app/commande/[id]/page.tsx` | Catalogue et formulaire de commande d'un grossiste |
| `/grossiste` | `app/grossiste/page.tsx` | Espace équipe : liste des grossistes |
| `/grossiste/[id]` | `app/grossiste/[id]/page.tsx` | File d'attente partagée d'un grossiste |
| `/suivi/[id]` | `app/suivi/[id]/page.tsx` | Suivi en direct d'une commande (`[id]` = id de la commande) |

Composants : `components/OrderForm.tsx` (formulaire client + récapitulatif après envoi), `components/OrderQueue.tsx` (file d'attente grossiste, en temps réel).

Utilitaires :
- `lib/supabase.ts` : le client Supabase.
- `lib/productName.ts` : `productName()` et `productUnit()` (acceptent la relation `products` sous forme d'objet ou de tableau), `formatQty()` (« 3 unités », « 2 carcasses », « 2,5 kg »).
- `lib/orderStatus.ts` : statut global d'une commande calculé à partir de ses lignes (voir règle 9).

Particularités Next.js 16 :
- Dans les pages serveur dynamiques, `params` est une **Promise** (`const { id } = await params`). Dans les pages client (`'use client'`), on utilise `useParams()`.
- Une page serveur sans `params` ni cookies est **générée une seule fois au build**. `app/page.tsx` et `app/grossiste/page.tsx` appellent donc `await connection()` (de `next/server`) pour relire la base à chaque visite.
- `next build` ne lance plus ESLint : lancer aussi `npm run lint` avant de pousser.
- Les fichiers dans `node_modules/next/dist/docs/` font foi pour cette version.

### Base de données (Supabase / Postgres)

| Table | Colonnes principales |
|---|---|
| `grossistes` | `id`, `name`, `pavillon` (vide), `cutoff_time` (vide, non utilisé), `specialites` |
| `products` | `id`, `grossiste_id`, `name`, `category` (rempli mais pas encore affiché), `unit` |
| `orders` | `id`, `grossiste_id`, `created_at`, `status` (**obsolète** : jamais écrit par le code, vaut toujours `'envoyée'` ; remplacé par le statut calculé), `order_number` (serial, global), `assigned_to` (texte), `assigned_at` |
| `order_lines` | `id`, `order_id`, `product_id`, `quantity`, `status`, `substitution_mode`, `substitution_list` (text[]), `substituted_name` |
| `assignment_history` | `id`, `order_id`, `assigned_to`, `assigned_at` |

- Les valeurs de `order_lines.status` sont des **chaînes en français** : `'à préparer'` (défaut), `'en cours'`, `'prêt'`, `'rupture'`, `'substitué'`.
- `substitution_mode` : `'none'` (défaut), `'open'`, `'restricted'`.
- `products.unit` : les produits se vendent surtout au carton, à poids variable (un carton de basse côte sous vide fait 15 à 25 kg) : on commande donc **à l'unité**. Valeurs : `'unité'` (tous les produits actuels), `'carcasse'` pour les pièces entières (agneau entier, demi-veau, demi-bœuf, cuisseau… à ajouter plus tard), `'kg'` réservé à d'autres métiers (fruits et légumes). Si la base refuse `'carcasse'`, vérifier une contrainte `check` sur `products.unit`.
- Realtime activé (publication `supabase_realtime`) sur `order_lines` et `orders`. Utilisé dans `/suivi/[id]` **et** dans la file grossiste (`OrderQueue.tsx` écoute les INSERT et UPDATE). `order_lines` n'ayant pas de `grossiste_id`, la file reçoit les changements de lignes de tous les grossistes et ignore ceux des commandes qu'elle n'affiche pas.
- **RLS (Row Level Security) désactivée** sur `orders`, `order_lines` et `assignment_history`, pour avancer vite en phase de test. C'est de la dette de sécurité assumée, à traiter avant le pilote (voir plus bas).
- Il n'y a **pas de notion d'utilisateur** : une commande n'est rattachée à aucun client, un préparateur est un simple texte.

### Couleurs des statuts
- Par ligne (suivi client) : `à préparer` gris · `en cours` bleu · `prêt` vert · `rupture` rouge · `substitué` ambre (avec « Remplacé par … »).
- Par commande (suivi client et file grossiste) : `à préparer` gris · `en préparation par …` bleu · `complète` vert · `partielle` et `en rupture` rouge.

---

## Règles métier (à respecter dans toute modification)

1. **Numéro de bon de commande** : généré automatiquement par la base (`serial`), affiché à la création.
2. **Statut par ligne**, pas seulement par commande : chaque produit a son propre statut. Le grossiste peut mettre à jour les lignes à tout moment, y compris pendant la nuit : le client doit avoir une **confirmation partielle en continu**, pas seulement le matin.
3. **Visibilité d'équipe** : tout membre de l'équipe d'un grossiste voit et peut mettre à jour toutes les commandes de ce grossiste. C'est la condition qui évite le problème d'origine (« la personne n'est pas venue »). Ne jamais réintroduire un verrou qui lie une commande à une seule personne.
4. **Trois modes de substitution, choisis par le client pour chaque ligne** :
   - `none` : aucune substitution. Si le produit manque, la ligne passe en `rupture`, rien n'est remplacé. L'interface refuse le statut `substitué`.
   - `open` : le grossiste choisit lui-même le remplaçant (parmi les produits de son catalogue).
   - `restricted` : le client pré-approuve jusqu'à 3 alternatives **classées par ordre de préférence** (exemple : saucisse de Toulouse, sinon algérienne, sinon nature). Le grossiste ne voit que cette liste, numérotée, et ne peut rien proposer en dehors. Si aucune n'est disponible : `rupture`.
5. **Substitution asynchrone** : pas d'approbation en direct, pas de notification bloquante. Le grossiste substitue et marque la ligne `substitué` avec le nom du remplaçant ; le client le voit après coup, clairement distinct d'une ligne livrée telle que commandée.
6. **Escalade** : seule une **rupture sans substitut valide** doit déclencher une alerte active (WhatsApp, voir roadmap). Tout le reste est consultable, pas poussé. Principe : silencieux par défaut, bruyant seulement quand une décision que seul le client peut prendre est nécessaire (par exemple recommander ailleurs avant qu'il soit trop tard).
7. **Assignation du préparateur — visible, jamais exclusive.** Un membre de l'équipe « prend » une commande (`assigned_to`, `assigned_at`, trace dans `assignment_history`). N'importe qui peut la **reprendre** à tout moment. Le nom s'affiche aussi côté client (« Préparée par … ») : c'est de l'information, pas un verrou. Si une commande n'est pas prise en charge depuis 30 minutes (`ALERT_AFTER_MINUTES` dans `OrderQueue.tsx`), elle s'affiche en rouge côté grossiste (alerte visuelle seulement pour l'instant). Aujourd'hui le prénom du préparateur est saisi à la main et mémorisé dans `localStorage` ; ce sera remplacé par de vrais comptes.
8. **Pas de gestion de stock** : on suit l'état d'une commande, pas l'inventaire du grossiste. Ce choix est volontaire.
9. **Statut global de la commande, calculé à partir des lignes** (`lib/orderStatus.ts`, jamais stocké en base) :
   - `à préparer` : personne n'a pris la commande et aucune ligne n'a bougé ;
   - `en préparation par [préparateur]` : la commande est prise ou des lignes avancent ; une rupture déjà connue s'affiche tout de suite en note rouge (« 1 produit en rupture »), sans attendre la fin ;
   - `complète` : toutes les lignes sont `prêt` ou `substitué` (une substitution compte comme livrée, la ligne reste signalée en ambre) ;
   - `partielle` : tout est traité mais au moins une rupture (« 8/10 produits — 2 produits en rupture ») ;
   - `en rupture` : toutes les lignes sont en rupture.
   Le détail ligne par ligne se consulte via le lien « Suivre ma commande en direct ».
10. **File grossiste** : commandes les plus récentes en premier.

---

## Historique de construction

Dans l'ordre, tout fonctionne en local et en ligne, et a été testé de bout en bout à deux personnes (un « client », un « grossiste ») :

1. Environnement : Node, VS Code, comptes GitHub / Vercel / Supabase.
2. Première page statique déployée sur Vercel.
3. Connexion Supabase, catalogue dynamique.
4. Formulaire de commande qui écrit `orders` + `order_lines`, numéro de bon de commande automatique.
5. File d'attente grossiste avec statut par ligne.
6. Suivi en direct côté client (Supabase Realtime), avec lien affiché après l'envoi de la commande.
7. Substitution : d'abord 2 modes, puis liste restreinte classée (3 modes).
8. Séparation par grossiste : accueil → choix du grossiste → catalogue / file propres à ce grossiste.
9. Vrais noms des 4 grossistes, catalogues de test remplacés (données de test et numérotation remises à zéro).
10. Assignation dynamique du préparateur, historique, alerte rouge à 30 minutes.
11. Helper `productName` et récapitulatif après envoi.
12. Accueil et espace grossiste relus à chaque visite (ils étaient figés au build).
13. File d'attente grossiste en temps réel.
14. Nettoyage : lint à zéro, `as any` retiré, 404 si grossiste inconnu, page en français.
15. Statut global calculé (règle 9).
16. Unités affichées partout avec pluriel ; produits passés de `kg` à `unité` en base.

Une session de travail typique a aussi produit : un cahier des charges (`cahier-des-charges-rungis-app(1).md` + version PDF, en partie dépassé par ce qui est construit), et des wireframes de 3 écrans mobiles (`rungis_app_wireframes.html`, `3 ecran wireframe.odt/.pdf` : commande client, file d'attente grossiste, suivi en direct). Les wireframes montrent aussi des onglets par catégorie et le nom du client sur chaque commande, pas encore faits.

---

## Fonctionnalités conçues mais pas décidées

- **Saisie libre de commande** (champ texte « 10 côtes de bœuf », transformé en lignes de commande avec rapprochement automatique au catalogue, sinon « hors catalogue ») : **conçue mais l'utilisateur n'a pas décidé de l'implémenter** pour l'instant. La colonne `custom_name` n'existe pas en base (vérifié) ; `product_id` nullable non vérifié. Ne l'implémente que s'il le demande. Si tu le fais : découpage de texte par règles (pas d'IA), rapprochement seulement si la correspondance est non ambiguë, étape de vérification avant l'envoi, lignes hors catalogue conservées avec le texte tel quel.

---

## Dette technique et risques connus

- **Aucune authentification, RLS désactivée** : toute personne qui connaît une URL peut lire ou modifier des commandes, et l'espace grossiste est ouvert à tous. Acceptable en test solo, **bloquant avant le pilote**.
- **Piège RLS** : activer la RLS sans écrire de policies fait renvoyer des résultats vides **sans erreur**. Écris les policies en même temps, table par table, et teste après chaque table.
- **Les règles de substitution ne sont imposées que par l'interface**, pas par la base. Un appel direct à l'API pourrait les contourner. À verrouiller côté serveur (policies / fonction / trigger Postgres) avec l'authentification.
- **Typage Supabase** : un cast `as unknown as` reste dans `app/suivi/[id]/page.tsx`, et la relation `products` est typée `unknown` (lue via les helpers de `lib/productName.ts`). Piste : générer les types avec `supabase gen types`.
- La colonne `orders.status` est obsolète (voir la base) : à supprimer un jour.
- Le client n'est pas identifié (pas de `customer_id` sur `orders`).
- `alert()` est utilisé pour afficher les erreurs : à remplacer par de vrais messages dans l'interface.
- `cutoff_time` existe sur `grossistes` mais n'est pas utilisé : aucune logique d'heure limite pour l'instant.
- Les catalogues de produits sont des données de test inventées.
- Le numéro de bon de commande est global à toute la base (pas par grossiste) : acceptable.

---

## Roadmap, dans l'ordre conseillé

1. **Connexion et sécurité (RLS)** — le plus gros chantier, nécessaire avant tout pilote.
   - Connexion par téléphone avec code SMS (Supabase Auth ; nécessite un fournisseur SMS configuré dans Supabase, type Twilio).
   - Rôles : client (commerçant) et équipe d'un grossiste, rattachée à un `grossiste_id` (table de profils).
   - Réactiver la RLS avec des policies : un client ne voit que ses commandes ; l'équipe d'un grossiste ne voit que les commandes de son grossiste ; Realtime doit continuer à fonctionner sous RLS.
   - Imposer les règles de substitution côté base.
   - Remplacer le prénom saisi à la main par le vrai compte du préparateur.
   - Rattacher chaque commande à son client ; permettre de **sauvegarder des listes de substituts par produit** (« toujours saucisse algérienne si pas de Toulouse »), table du type `substitution_rules`.
2. **Alertes WhatsApp** (Twilio ou API WhatsApp Business) : sur rupture sans substitut valide, et sur commande non prise en charge trop longtemps. Les démarches de validation côté Twilio/Meta (templates de messages) prennent du temps : l'utilisateur peut les lancer en parallèle du code.
3. **Vrais catalogues** des 4 grossistes : demander leurs tarifs (Excel ou PDF), importer en CSV dans `products` (Supabase → Table Editor → Import).
4. **Avant le pilote** :
   - page « mes commandes du jour » regroupant les commandes d'un même client chez plusieurs grossistes (un boucher commande souvent chez 3 ou 4 grossistes la même nuit) ;
   - PDF du bon de commande (`pdf-lib` ou `@react-pdf/renderer`) ;
   - confirmation de retrait / bon de livraison à la clôture ;
   - heure limite de commande propre à chaque grossiste ;
   - nettoyage des données de test.
5. **Optionnel, à décider avec l'utilisateur** : saisie libre de commande (voir plus haut).
6. **Plus tard** : polish de l'interface (voir wireframes : cartes mobiles avec badges de statut), nouveaux grossistes et corps de métier, fruits et légumes, autres MIN, statistiques (quels produits partent le plus souvent en rupture, quels substituts sont acceptés).

**Hors périmètre du MVP** (ne pas proposer sans qu'il le demande) : gestion de stock réel, paiement intégré, logistique multi-entrepôt, prédiction / IA, application mobile native.

---

## Définition de « fini » pour une étape

1. Ça marche en local (`npm run dev`) et le build passe (`npm run build`).
2. Testé à la main sur le scénario réel (client qui commande, grossiste qui met à jour, client qui voit le changement en direct).
3. Commit + `git push`, puis vérification que la version Vercel fonctionne aussi (variables d'environnement comprises) et sur téléphone.