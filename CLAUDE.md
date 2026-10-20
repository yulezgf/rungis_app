@AGENTS.md
# CLAUDE.md — App de commande chez les grossistes de Rungis

**Nom officiel de l'app : « Le Carreau des Halles »** (choisi par l'utilisateur le 2026-10-12). À utiliser dans l'interface (titre, en-tête), les emails (nom d'expéditeur) et les documents. Le dépôt et l'URL Vercel gardent pour l'instant le nom technique `rungis-app`.

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
- **Supabase** : Postgres + Realtime + Auth, via `@supabase/ssr` (version épinglée 0.12.7). Deux clients, tous deux avec la clé `anon` : `lib/supabase.ts` (navigateur) et `lib/supabase-server.ts` (pages serveur). La session est dans un **cookie**, lisible des deux côtés.
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
| `/` | `app/page.tsx` | Accueil client : grossistes avec l'état du compte (accepté → carte cliquable ; sinon grisé : « Demander l'ouverture d'un compte », ⏳ en attente, refusé), lien « Mon compte » |
| `/compte/[id]` | `app/compte/[id]/page.tsx` | Demande d'ouverture de compte chez un grossiste (`AccountRequestForm` : « J'ai déjà un compte, n° … ») |
| `/grossiste/[id]/clients` | `app/grossiste/[id]/clients/page.tsx` | Équipe : demandes en attente (accepter avec n° client / refuser), clients acceptés, refusées (`AccountRequests`). Bandeau jaune « N demandes en attente » en haut de la file |
| `/commande/[id]` | `app/commande/[id]/page.tsx` | Formulaire de commande : champ de recherche intelligent, « Produits fréquents » (top 10), « Ajoutés à ma commande », « Un mot pour le préparateur ». Charge le référentiel, l'assortiment du grossiste et `rpc('top_products')` |
| `/grossiste` | `app/grossiste/page.tsx` | Ne fait que rediriger (équipe → sa file, client → `/`) |
| `/grossiste/[id]` | `app/grossiste/[id]/page.tsx` | File d'attente partagée d'un grossiste, réservée à son équipe ; « #23 · Boucherie Martin » |
| `/suivi/[id]` | `app/suivi/[id]/page.tsx` | Suivi en direct d'une commande (`[id]` = id de la commande), « Votre commande chez … » |
| `/commandes` | `app/commandes/page.tsx` | « Mes commandes » du client (50 dernières, numéro, grossiste, date heure de Paris, statut) → lien vers le suivi. Pas de filtre client dans le code : la RLS ne renvoie que les siennes. Liens depuis l'accueil, le suivi et la confirmation |
| `/connexion` | `app/connexion/page.tsx` | **Email + mot de passe** (`components/AuthForms.tsx` : onglets « Se connecter » / « Créer un compte », « Mot de passe oublié ? », lien par email en secours ; messages traduits en français), puis profil (nom de boutique / prénom), déconnexion. Après connexion (mot de passe ou `?code=`) ou saisie du nom : redirection client → `/`, équipe → sa file (`homeFor()`) |
| `/connexion/nouveau-mot-de-passe` | `app/connexion/nouveau-mot-de-passe/page.tsx` | Arrivée du lien « Mot de passe oublié » : choisir un mot de passe (8 caractères min.) ; « Lien expiré » sinon. Sert aussi aux anciens comptes créés par lien, sans mot de passe |

Composants : `components/OrderForm.tsx` (formulaire client : `QtyStepper`, `LineEditor`, panier `CartLine[]` ; récapitulatif après envoi), `components/OrderQueue.tsx` (file d'attente grossiste, en temps réel).

Utilitaires :
- `lib/supabase.ts` : client Supabase **navigateur** (`createBrowserClient`), pour les composants `'use client'`.
- `lib/supabase-server.ts` : `createSupabaseServer()` (client **serveur**, lit les cookies, à créer à chaque requête), `requireProfile()` (à appeler en haut de chaque page protégée : renvoie `{ supabase, profile }` ou redirige vers `/connexion`) et `teamHome(profile)`.
- **Protection des pages** : `proxy.ts` redirige toute personne non connectée vers `/connexion` ; chaque page vérifie le rôle via `requireProfile()`. Client : `/`, `/commande/…`, `/suivi/…`. Équipe : uniquement `/grossiste/[son id]` (tout le reste la renvoie à sa file). Les **données** sont protégées en plus par la RLS (étape 5).
- `proxy.ts` (racine) : s'exécute avant chaque page, rafraîchit la session Supabase dans les cookies et renvoie les non-connectés vers `/connexion` (en Next 16, `middleware.ts` s'appelle `proxy.ts`).
- `lib/productName.ts` : `productName()`, `productUnit()`, `customerName()` (acceptent une relation Supabase sous forme d'objet ou de tableau ; `productName()` sert aussi pour `grossistes ( name )`), `formatQty()` (« 3 unités », « 2 carcasses », « 2,5 kg »).
- `lib/search.ts` : `normalize()` (sans accents ni majuscules, « œ » → « oe ») et `searchProducts()` (contient la saisie, dès 2 lettres ; assortiment du grossiste d'abord, puis ce qui commence par la saisie).
- `lib/orderStatus.ts` : statut global d'une commande calculé à partir de ses lignes (voir règle 9).

Particularités Next.js 16 :
- Dans les pages serveur dynamiques, `params` est une **Promise** (`const { id } = await params`). Dans les pages client (`'use client'`), on utilise `useParams()`.
- Une page serveur sans `params` ni cookies est **générée une seule fois au build**. Les pages serveur utilisent `createSupabaseServer()`, qui lit les cookies : elles sont donc dynamiques (relues à chaque visite). Si une page serveur n'en a pas besoin, utiliser `await connection()` (de `next/server`).
- **Connexion** : email + mot de passe (décidé le 2026-10-20, l'email à chaque connexion était pénible). Un seul email de confirmation à la création du compte ; session de plusieurs semaines. Le lien par email reste en secours (`shouldCreateUser: false`). Les modèles d'emails Supabase (Authentication → Emails → Templates) sont à traduire en français.
- **Lien magique et PKCE** : `@supabase/ssr` impose le flux PKCE, donc le lien de l'email doit être ouvert **dans le même navigateur** que celui où il a été demandé (le navigateur intégré de l'app Gmail peut échouer). Contournement possible plus tard : modèle d'email Supabase avec `token_hash` + route `/auth/confirm`.
- `next build` ne lance plus ESLint : lancer aussi `npm run lint` avant de pousser.
- Les fichiers dans `node_modules/next/dist/docs/` font foi pour cette version.

### Base de données (Supabase / Postgres)

| Table | Colonnes principales |
|---|---|
| `grossistes` | `id`, `name`, `pavillon` (vide), `cutoff_time` (vide, non utilisé), `specialites` |
| `products` | **Référentiel commun** : `id`, `name` (unique, sans tenir compte des majuscules), `metier` (défaut `Boucherie`), `category`, `unit` ; `grossiste_id` **obsolète** (remplacé par `assortiments`) |
| `assortiments` | `grossiste_id`, `product_id`, `created_at` : « tel grossiste vend tel produit » (clé = les deux) |
| `orders` | `id`, `grossiste_id`, `created_at`, `status` (**obsolète** : jamais écrit par le code, vaut toujours `'envoyée'` ; remplacé par le statut calculé), `order_number` (serial, global), `assigned_to` (texte), `assigned_at`, `customer_id` (→ `profiles.id`, rempli automatiquement par `default auth.uid()`), `comment` (« Un mot pour le préparateur », 500 car. max) |
| `order_lines` | `id`, `order_id`, `product_id` (facultatif), `custom_name` + `custom_unit` (ligne libre), `quantity`, `status`, `substitution_mode`, `substitution_list` (text[]), `substituted_name` |
| `assignment_history` | `id`, `order_id`, `assigned_to`, `assigned_at` |
| `customer_accounts` | `customer_id` (défaut `auth.uid()`), `grossiste_id`, `status` (`en attente` / `accepté` / `refusé`), `existing_number` (déclaré par le client), `account_number` (confirmé par le grossiste), `requested_at`, `decided_at` |
| `profiles` | `id` (= `auth.users.id`), `role` (`'client'` défaut / `'grossiste'`), `display_name`, `grossiste_id` (obligatoire si `grossiste`), `created_at` |

- Les scripts SQL lancés à la main dans Supabase sont gardés dans `sql/` (numérotés, à lancer une seule fois). `sql/01_profiles.sql` : table `profiles` **avec RLS active** (chacun lit son profil et ne peut modifier que `display_name`), trigger `on_auth_user_created` qui crée un profil client à chaque nouveau compte. `sql/02_customer_id.sql` : colonne `orders.customer_id`, fonction `my_grossiste_id()` (security definer, évite la récursion RLS) et policy « l'équipe voit ses clients » (l'équipe lit le profil des clients ayant commandé chez elle).
- **Tester à deux comptes** : deux navigateurs (ex. Chrome client, Edge grossiste) ; copier le lien de l'email et le coller dans le bon navigateur (PKCE). Tout nouveau compte est client : passer le second en grossiste par SQL (avec `display_name` = prénom).
- **Tester le rôle grossiste sans nouvel email** : passer son propre compte en grossiste par SQL (`update profiles set role = 'grossiste', grossiste_id = … where id = (select id from auth.users where email = '…')`), recharger, puis le remettre en client (`role = 'client', grossiste_id = null`).
- **Rattacher un membre d'équipe** (fait par l'utilisateur dans le SQL Editor, après que la personne s'est connectée une première fois, sinon l'`update` ne touche aucune ligne) :
  `update profiles set role = 'grossiste', grossiste_id = (select id from grossistes where name = 'Eurodis') where id = (select id from auth.users where email = '...');`
- **Emails de connexion** : ✅ SMTP **Gmail** branché dans Supabase (mot de passe d'application, expéditeur « Le Carreau des Halles »), limite Supabase relevée à 500/heure (Gmail plafonne lui-même à ~500/jour). Supabase avertit que Gmail n'est pas fait pour l'envoi transactionnel : risque de spams, acceptable pour le dev et la démo. **Avant le pilote** : service dédié (Brevo/Resend) avec un nom de domaine, puis SMS.

- Les valeurs de `order_lines.status` sont des **chaînes en français** : `'à préparer'` (défaut), `'en cours'`, `'prêt'`, `'rupture'`, `'substitué'`.
- `substitution_mode` : `'none'` (défaut), `'open'`, `'restricted'`.
- `products.unit` : les produits se vendent surtout au carton, à poids variable (un carton de basse côte sous vide fait 15 à 25 kg) : on commande donc **à l'unité**. Valeurs : `'unité'` (tous les produits actuels), `'carcasse'` pour les pièces entières (agneau entier, demi-veau, demi-bœuf, cuisseau… à ajouter plus tard), `'kg'` réservé à d'autres métiers (fruits et légumes). Si la base refuse `'carcasse'`, vérifier une contrainte `check` sur `products.unit`.
- Realtime activé (publication `supabase_realtime`) sur `order_lines` et `orders`. Utilisé dans `/suivi/[id]` **et** dans la file grossiste (`OrderQueue.tsx` écoute les INSERT et UPDATE). `order_lines` n'ayant pas de `grossiste_id`, la file reçoit les changements de lignes de tous les grossistes et ignore ceux des commandes qu'elle n'affiche pas.
- **RLS active sur toutes les tables** (étape 5, scripts `sql/04` à `sql/07`). Non connecté : rien de lisible. Catalogue (`grossistes`, `products`) : lecture pour les connectés, aucune écriture depuis l'app (Table Editor / SQL Editor / import CSV passent outre). `orders` : le client lit et crée les siennes, l'équipe lit et modifie celles de son grossiste. `order_lines` : visible si la commande l'est ; le client n'ajoute des lignes qu'à sa commande et avec un produit de ce grossiste ; l'équipe met à jour. `assignment_history` : l'équipe lit et écrit, sous son propre nom uniquement. Aucune suppression depuis l'app. **Trigger `check_order_line_update`** (`sql/08_regles_substitution.sql`, avant chaque update de `order_lines`) : refuse de modifier les choix du client (produit, quantité, mode et liste de substitution), refuse `substitué` en mode `none`, sans remplaçant, hors liste en `restricted`, ou hors catalogue du grossiste en `open` ; efface `substituted_name` quand la ligne n'est pas `substitué`. Ses messages d'erreur s'affichent tels quels dans l'app. `sql/09` : lignes libres. `sql/10` : référentiel commun (doublons fusionnés), `assortiments` (RLS : lecture pour les connectés), une ligne peut utiliser **n'importe quel** produit du référentiel chez n'importe quel grossiste, « Substitut libre » = un produit du référentiel, fonction `top_products(grossiste, limite)` (security definer : habitudes du client, puis meilleures ventes du grossiste, puis reste de l'assortiment ; ne révèle jamais qui a commandé quoi). `sql/11` : `orders.comment` et **droits par colonne** : l'équipe ne peut modifier que `assigned_to` / `assigned_at` d'une commande. `sql/12` : `customer_accounts` (RLS : le client lit et crée ses demandes, colonnes `grossiste_id` / `existing_number` seulement, statut forcé « en attente » ; l'équipe lit et décide, colonnes `status` / `account_number` / `decided_at` seulement), policy « l'équipe voit ses demandeurs » sur `profiles`, et **verrou sur `orders`** : on ne crée une commande que chez un grossiste où son compte est `accepté`. ⚠️ Depuis `customer_accounts`, il existe **deux chemins** entre `profiles` et `grossistes` : préciser la relation (`grossistes!grossiste_id ( name )`), sinon erreur « more than one relationship ». **Un script SQL lancé dans l'éditeur Supabase ne doit pas utiliser de table temporaire** (non conservée d'une instruction à l'autre) ; écrire des scripts relançables (`if not exists`, `on conflict do nothing`). Les policies s'appuient sur `my_grossiste_id()` (sql/02) et sur la RLS de `orders` (une sous-requête sur `orders` ne voit que les commandes autorisées).
- Chaque nouvelle commande est rattachée à son client (`customer_id`). Le préparateur est le compte connecté (`display_name`, enregistré en texte dans `assigned_to`).

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
7. **Assignation du préparateur — visible, jamais exclusive.** Un membre de l'équipe « prend » une commande (`assigned_to`, `assigned_at`, trace dans `assignment_history`). N'importe qui peut la **reprendre** à tout moment. Le nom s'affiche aussi côté client (« Préparée par … ») : c'est de l'information, pas un verrou. Si une commande n'est pas prise en charge depuis 30 minutes (`ALERT_AFTER_MINUTES` dans `OrderQueue.tsx`), elle s'affiche en rouge côté grossiste (alerte visuelle seulement pour l'instant). Le préparateur est le **compte connecté** : `assigned_to` reçoit son `display_name` (texte, pas l'id du compte : deux préparateurs au même prénom ne sont pas distingués).
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
17. Connexion par lien email (étape 1 du chantier connexion).
18. Table `profiles`, nom de boutique / prénom, rattachement manuel d'un membre d'équipe (étape 2).
19. Session en cookie (`@supabase/ssr`, `proxy.ts`, client serveur), redirection après connexion (étape 3a).
20. Pages protégées selon le rôle (étape 3b).
21. Nom du grossiste dans le suivi, boutons + et − pour les quantités (nombres entiers), produit sur deux lignes dans le formulaire.
22. `orders.customer_id` et nom du client dans la file (étape 3c).
23. Préparateur = compte connecté, champ prénom et `localStorage` supprimés (étape 4). Testé à deux comptes (Chrome client / Edge grossiste).
24. Base des commandes remise à zéro avant la RLS (`sql/03_reset_commandes.sql`).
25. RLS sur toutes les tables, table par table, testée à deux comptes et vérifiée en anonyme (étape 5).
26. Page « Mes commandes » (le suivi n'était accessible qu'une fois, juste après l'envoi). Testée à deux sur téléphone.
27. Règles de substitution imposées par la base (trigger, étape 6), vérifiées par une tentative de triche dans le SQL Editor.
28. Lignes libres : commander un produit absent du référentiel, sans mention « hors catalogue » (`sql/09`).
29. Référentiel commun + assortiments, top 10, recherche intelligente à double comportement (suggère, sinon « Ajouter tel quel ») (`sql/10`).
30. Commentaire du client pour le préparateur, encadré jaune dans la file ; droits par colonne sur `orders` (`sql/11`).
31. Comptes clients chez un grossiste, étape A : demande / validation, verrou des commandes (`sql/12`). Un « Grossiste Test » existe en base pour les essais.
32. Connexion par email + mot de passe, création de compte, mot de passe oublié.

**Idées en vrac de l'utilisateur** : `IDEES.md` (« parking à idées »). Y noter toute nouvelle idée au lieu de l'implémenter tout de suite ; à relire à la semaine design.

Une session de travail typique a aussi produit : un cahier des charges (`cahier-des-charges-rungis-app(1).md` + version PDF, en partie dépassé par ce qui est construit), et des wireframes de 3 écrans mobiles (`rungis_app_wireframes.html`, `3 ecran wireframe.odt/.pdf` : commande client, file d'attente grossiste, suivi en direct). Les wireframes montrent aussi des onglets par catégorie et le nom du client sur chaque commande, pas encore faits.

---

## Vision produit (décidée le 2026-10-14)

- **À terme : un outil de prise de commande en ligne, ouvert à tout grossiste en France, utilisé en autonomie.** Le grossiste s'y inscrit pour augmenter ses ventes : il crée son entreprise, construit son catalogue, invite son équipe (code d'invitation), règle son heure limite. Chaque décision technique doit rester compatible avec ça.
- **Référentiel commun + assortiment par vendeur** (remplace la liste de produits par grossiste) :
  - **Référentiel** : chaque produit existe une seule fois (nom, **métier** : Boucherie / Fruits et légumes / …, **catégorie**, unité). Construit aujourd'hui par l'utilisateur (Rungis + internet) : les grossistes ne fournissent pas leurs fichiers.
  - **Assortiment** : table de liaison « ce vendeur vend ce produit » (plus tard : nom maison, référence, prix, disponibilité). Rempli par l'utilisateur pendant le pilote, par le grossiste lui-même ensuite (« Mon catalogue » : il coche dans le référentiel et ajoute ses produits).
  - Le client voit l'assortiment du grossiste en onglets ; en secours, « Autres produits de la liste » et la **ligne libre** : rien ne bloque jamais une commande (ex. réel : Avigros, grossiste volaille, vend depuis peu du bœuf et de l'agneau).
  - Les lignes libres fréquentes pourront être proposées au grossiste pour enrichir son catalogue.
  - Catégories communes proposées (à ajuster) : Bœuf · Veau · Agneau · Porc · Volaille · Lapin · Gibier · Charcuterie · Abats · Triperie · Autres. Fruits et légumes = un autre métier dans la même table (vendus au kg, décimales à gérer le moment venu).
- **Comptes clients chez un grossiste (à faire AVANT la démo : les grossistes y tiennent absolument)** : pas de compte accepté, pas de commande, comme au comptoir.
  - Côté client : fiche entreprise remplie une fois (raison sociale, SIRET, adresse, documents : Kbis, pièce d'identité, éventuellement RIB) ; bouton « Demander l'ouverture d'un compte » chez un grossiste ; cas « j'ai déjà un compte, n° … » (confirmé en un clic).
  - Côté grossiste : rubrique « Demandes de compte » : consulter, accepter (avec son numéro client interne) ou refuser.
  - Technique : table du type `customer_accounts` (client, grossiste, statut en attente / accepté / refusé, numéro client) ; RLS des commandes : on ne commande que chez un grossiste où son compte est accepté ; documents dans un bucket Supabase Storage **privé** (client + équipes des grossistes sollicités) ; données sensibles (RGPD) : strict nécessaire, durée de conservation. Bonus : vérification du SIRET via l'API Sirene de l'INSEE (gratuite).
- **C to B (clients particuliers d'un boucher) : plus tard, dans un projet séparé**, qui partira d'une copie de celui-ci (connexion, RLS, file en temps réel, statuts, substitutions). Produits, unités (grammes, portions), prix affichés et paiement y sont différents. Ne pas l'intégrer ici.
- Plus tard (après la démo) : raisonner en **vendeurs / acheteurs** plutôt que grossistes / bouchers dans le code et la base.

## Idée à discuter plus tard : navigation de l'accueil (du plus large au plus détaillé)

Vision de l'utilisateur (2026-10-12), pas encore conçue ni planifiée :
- Accueil par **métier** (Boucherie, Fruits et légumes…) → **spécialité / pavillon** (Bœuf, Volaille, Tripes…) → **grossiste** → commande.
- Personnalisation : un client qui commande toujours en boucherie arrive **directement** dans la boucherie, sans repasser par le choix du métier.
- En base : `grossistes.pavillon` existe (vide) ; il manquera un champ « métier » et probablement une relation grossiste ↔ spécialités (un grossiste peut couvrir plusieurs spécialités). La personnalisation nécessite `customer_id` (étape 3c).

## Trouver un produit dans un grand catalogue (décidé)

Problème : un vrai catalogue fait 200 à 500 références, une liste à faire défiler est inutilisable. Solutions validées, qui se complètent (dans l'ordre de la roadmap) :

1. ✅ **Recherche** (les onglets par catégorie ont été abandonnés au profit du top 10 + recherche, idée de l'utilisateur) dans le formulaire : recherche sans accents ni majuscules, dans le milieu des noms (« toul » → « Saucisse de Toulouse ») ; onglets à partir des catégories du référentiel (voir « Vision produit »).
0. ✅ **Lignes libres** (`sql/09_lignes_libres.sql`) : une ligne de commande est soit un produit du référentiel (`product_id`), soit un nom saisi (`custom_name` + `custom_unit` unité/carcasse), jamais les deux (contrainte `produit_ou_nom_saisi`). **Aucune mention « hors catalogue »** à l'écran : c'est notre liste, pas celle du grossiste. Affichage via `lineName()` / `lineUnit()`. Modes de substitution proposés pour une ligne libre : « Pas de substitut » et « Substitut libre ».
2. ✅ **« Produits fréquents »** : top 10 = habitudes du client chez ce grossiste, puis meilleures ventes du grossiste (`top_products`). Reste à faire : « recommander comme la dernière fois ».
3. **Saisie libre avec IA** (validée par l'utilisateur le 2026-10-12, remplace l'ancienne idée « par règles, sans IA ») : le boucher écrit ou dicte sa commande comme un SMS (« 10 côtes de bœuf, 5 poulets, toulouse 3 ») et l'IA la transforme en lignes du catalogue. Règles :
   - **L'IA propose, le boucher valide** : écran de vérification obligatoire avant l'envoi, chaque ligne corrigeable.
   - **L'IA rapproche du référentiel** : sortie structurée (structured outputs) limitée aux `id` des produits ; ce qu'elle ne reconnaît pas devient une **ligne libre** avec le texte d'origine (mécanisme déjà en place).
   - Modèle : **Claude Haiku 5.5** (`claude-haiku-5-5`), via le SDK officiel `@anthropic-ai/sdk`. Estimation : ~0,07 centime par commande (catalogue de 500 produits), quelques dollars par mois au pilote ; à mesurer sur de vraies commandes.
   - **Appel côté serveur uniquement** (route / Server Action Next.js), clé `ANTHROPIC_API_KEY` dans `.env.local` et Vercel, jamais `NEXT_PUBLIC_`.
   - La recherche classique reste disponible en secours (latence 1-3 s, service externe).

---

## Dette technique et risques connus

- **Piège RLS** : une table sous RLS sans policy adaptée renvoie des résultats vides **sans erreur**. Toute nouvelle table ou colonne lue par l'app doit venir avec ses policies, testées à deux comptes.
- `orders.assigned_to` est du texte : la policy d'update de `orders` n'empêche pas un membre d'équipe de mettre le prénom d'un collègue via l'API (l'historique, lui, est protégé). Faible risque, à durcir si besoin (stocker l'id du compte).
- **Typage Supabase** : un cast `as unknown as` reste dans `app/suivi/[id]/page.tsx`, et la relation `products` est typée `unknown` (lue via les helpers de `lib/productName.ts`). Piste : générer les types avec `supabase gen types`.
- La colonne `orders.status` est obsolète (voir la base) : à supprimer un jour.
- `alert()` est utilisé pour afficher les erreurs : à remplacer par de vrais messages dans l'interface.
- `cutoff_time` existe sur `grossistes` mais n'est pas utilisé : aucune logique d'heure limite pour l'instant.
- Les catalogues de produits sont des données de test inventées.
- Le numéro de bon de commande est global à toute la base (pas par grossiste) : acceptable.

---

## Roadmap, dans l'ordre conseillé

1. **Connexion et sécurité (RLS)** — le plus gros chantier, nécessaire avant tout pilote. **Ordre validé avec l'utilisateur, à suivre tel quel**, une étape testée et poussée à la fois :
   1. ✅ Connexion seule : page `/connexion` par **email** (lien magique, gratuit) + déconnexion. Rien d'autre ne change.
   2. ✅ Table `profiles` (`id`, `role` client/grossiste, `display_name`, `grossiste_id`) ; écran « nom de ta boutique » pour les clients ; rattachement d'un membre d'équipe à son grossiste **fait à la main par l'utilisateur** dans Supabase (pas d'auto-déclaration ; code d'invitation plus tard).
   3. ✅ Pages protégées : file grossiste réservée à l'équipe, commander exige d'être connecté ; `orders.customer_id` enregistré (permet « #4521 · Boucherie Martin » dans la file). Session via cookies avec `@supabase/ssr` pour que les pages serveur lisent au nom de l'utilisateur. Découpage prévu : ✅ **3a** session en cookie + redirection après connexion (client → accueil, équipe → sa file) ; **3b** pages protégées (non connecté → `/connexion`, équipe limitée à sa file) ; **3c** `customer_id` sur les commandes et nom du client dans la file.
   4. ✅ Préparateur = compte connecté ; le champ prénom (`localStorage`) disparaît.
   5. ✅ RLS table par table, avec policies, test après chaque table (piège des résultats vides). Vérifier que Realtime marche encore.
   6. ✅ Trigger Postgres qui impose les règles de substitution côté base.
   7. Passage au SMS (Supabase Auth + Twilio) une fois tout validé par email.
   - ✅ Commandes de test effacées le 2026-10-12 (`sql/03_reset_commandes.sql`, numérotation repartie à #1). **Ne jamais relancer ce script pendant le pilote.**
   - **Ordre jusqu'à la démo (vers le 2026-11-10), décidé le 2026-10-14** : ✅ lignes libres → ✅ référentiel commun + assortiment + top 10/recherche → ✅ commentaire → **comptes clients chez un grossiste** (✅ A demande/validation ; **B fiche d'ouverture de compte** ; C documents : Kbis de moins de 3 mois, pièce d'identité, RIB) → ✅ connexion par mot de passe → saisie libre avec IA → passe de design. Étape 7 (SMS) et produits habituels après la démo si le temps manque.
   - Ensuite : **sauvegarder des listes de substituts par produit** (« toujours saucisse algérienne si pas de Toulouse »), table du type `substitution_rules`.
2. **Alertes WhatsApp** (Twilio ou API WhatsApp Business) : sur rupture sans substitut valide, et sur commande non prise en charge trop longtemps. Les démarches de validation côté Twilio/Meta (templates de messages) prennent du temps : l'utilisateur peut les lancer en parallèle du code.
3. **Référentiel et assortiments réels** : les grossistes ne fournissent pas leurs fichiers ; l'utilisateur construit le référentiel lui-même (ce qu'il voit à Rungis + internet) et coche les assortiments. Import CSV possible (Supabase → Table Editor → Import).
4. **Avant le pilote** :
   - page « mes commandes du jour » regroupant les commandes d'un même client chez plusieurs grossistes (un boucher commande souvent chez 3 ou 4 grossistes la même nuit) ;
   - PDF du bon de commande (`pdf-lib` ou `@react-pdf/renderer`) ;
   - confirmation de retrait / bon de livraison à la clôture ;
   - heure limite de commande propre à chaque grossiste ;
   - nettoyage des données de test.
5. ~~Optionnel : saisie libre~~ → décidée, avec IA (voir « Trouver un produit »).
6. **Plus tard** : polish de l'interface (voir wireframes : cartes mobiles avec badges de statut), nouveaux grossistes et corps de métier, fruits et légumes, autres MIN, statistiques (quels produits partent le plus souvent en rupture, quels substituts sont acceptés).

**Hors périmètre du MVP** (ne pas proposer sans qu'il le demande) : gestion de stock réel, paiement intégré, logistique multi-entrepôt, prédiction (anticiper les ruptures, recommandations), application mobile native. L'IA est **uniquement** utilisée pour la saisie libre de commande.

---

## Définition de « fini » pour une étape

1. Ça marche en local (`npm run dev`) et le build passe (`npm run build`).
2. Testé à la main sur le scénario réel (client qui commande, grossiste qui met à jour, client qui voit le changement en direct).
3. Commit + `git push`, puis vérification que la version Vercel fonctionne aussi (variables d'environnement comprises) et sur téléphone.