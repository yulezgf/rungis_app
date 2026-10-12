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
| `/` | `app/page.tsx` | Accueil client : liste des grossistes (nom + spécialités), lien « Mon compte » |
| `/commande/[id]` | `app/commande/[id]/page.tsx` | Catalogue et formulaire de commande d'un grossiste |
| `/grossiste` | `app/grossiste/page.tsx` | Ne fait que rediriger (équipe → sa file, client → `/`) |
| `/grossiste/[id]` | `app/grossiste/[id]/page.tsx` | File d'attente partagée d'un grossiste, réservée à son équipe ; « #23 · Boucherie Martin » |
| `/suivi/[id]` | `app/suivi/[id]/page.tsx` | Suivi en direct d'une commande (`[id]` = id de la commande), « Votre commande chez … » |
| `/connexion` | `app/connexion/page.tsx` | Connexion par lien email, profil (nom de boutique / prénom), déconnexion. Après le clic sur le lien (`?code=` dans l'URL) ou la saisie du nom : redirection client → `/`, équipe → `/grossiste/[son id]` (`homeFor()`) |

Composants : `components/OrderForm.tsx` (formulaire client + récapitulatif après envoi), `components/OrderQueue.tsx` (file d'attente grossiste, en temps réel).

Utilitaires :
- `lib/supabase.ts` : client Supabase **navigateur** (`createBrowserClient`), pour les composants `'use client'`.
- `lib/supabase-server.ts` : `createSupabaseServer()` (client **serveur**, lit les cookies, à créer à chaque requête), `requireProfile()` (à appeler en haut de chaque page protégée : renvoie `{ supabase, profile }` ou redirige vers `/connexion`) et `teamHome(profile)`.
- **Protection des pages** : `proxy.ts` redirige toute personne non connectée vers `/connexion` ; chaque page vérifie le rôle via `requireProfile()`. Client : `/`, `/commande/…`, `/suivi/…`. Équipe : uniquement `/grossiste/[son id]` (tout le reste la renvoie à sa file). Protège les **pages**, pas encore les **données** (RLS, étape 5).
- `proxy.ts` (racine) : s'exécute avant chaque page, rafraîchit la session Supabase dans les cookies et renvoie les non-connectés vers `/connexion` (en Next 16, `middleware.ts` s'appelle `proxy.ts`).
- `lib/productName.ts` : `productName()`, `productUnit()`, `customerName()` (acceptent une relation Supabase sous forme d'objet ou de tableau ; `productName()` sert aussi pour `grossistes ( name )`), `formatQty()` (« 3 unités », « 2 carcasses », « 2,5 kg »).
- `lib/orderStatus.ts` : statut global d'une commande calculé à partir de ses lignes (voir règle 9).

Particularités Next.js 16 :
- Dans les pages serveur dynamiques, `params` est une **Promise** (`const { id } = await params`). Dans les pages client (`'use client'`), on utilise `useParams()`.
- Une page serveur sans `params` ni cookies est **générée une seule fois au build**. Les pages serveur utilisent `createSupabaseServer()`, qui lit les cookies : elles sont donc dynamiques (relues à chaque visite). Si une page serveur n'en a pas besoin, utiliser `await connection()` (de `next/server`).
- **Lien magique et PKCE** : `@supabase/ssr` impose le flux PKCE, donc le lien de l'email doit être ouvert **dans le même navigateur** que celui où il a été demandé (le navigateur intégré de l'app Gmail peut échouer). Contournement possible plus tard : modèle d'email Supabase avec `token_hash` + route `/auth/confirm`.
- `next build` ne lance plus ESLint : lancer aussi `npm run lint` avant de pousser.
- Les fichiers dans `node_modules/next/dist/docs/` font foi pour cette version.

### Base de données (Supabase / Postgres)

| Table | Colonnes principales |
|---|---|
| `grossistes` | `id`, `name`, `pavillon` (vide), `cutoff_time` (vide, non utilisé), `specialites` |
| `products` | `id`, `grossiste_id`, `name`, `category` (rempli mais pas encore affiché), `unit` |
| `orders` | `id`, `grossiste_id`, `created_at`, `status` (**obsolète** : jamais écrit par le code, vaut toujours `'envoyée'` ; remplacé par le statut calculé), `order_number` (serial, global), `assigned_to` (texte), `assigned_at`, `customer_id` (→ `profiles.id`, rempli automatiquement par `default auth.uid()` ; null pour les 22 anciennes commandes de test) |
| `order_lines` | `id`, `order_id`, `product_id`, `quantity`, `status`, `substitution_mode`, `substitution_list` (text[]), `substituted_name` |
| `assignment_history` | `id`, `order_id`, `assigned_to`, `assigned_at` |
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
- **RLS (Row Level Security) désactivée** sur `orders`, `order_lines` et `assignment_history`, pour avancer vite en phase de test. C'est de la dette de sécurité assumée, à traiter avant le pilote (voir plus bas).
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

Une session de travail typique a aussi produit : un cahier des charges (`cahier-des-charges-rungis-app(1).md` + version PDF, en partie dépassé par ce qui est construit), et des wireframes de 3 écrans mobiles (`rungis_app_wireframes.html`, `3 ecran wireframe.odt/.pdf` : commande client, file d'attente grossiste, suivi en direct). Les wireframes montrent aussi des onglets par catégorie et le nom du client sur chaque commande, pas encore faits.

---

## Idée à discuter plus tard : navigation de l'accueil (du plus large au plus détaillé)

Vision de l'utilisateur (2026-10-12), pas encore conçue ni planifiée :
- Accueil par **métier** (Boucherie, Fruits et légumes…) → **spécialité / pavillon** (Bœuf, Volaille, Tripes…) → **grossiste** → commande.
- Personnalisation : un client qui commande toujours en boucherie arrive **directement** dans la boucherie, sans repasser par le choix du métier.
- En base : `grossistes.pavillon` existe (vide) ; il manquera un champ « métier » et probablement une relation grossiste ↔ spécialités (un grossiste peut couvrir plusieurs spécialités). La personnalisation nécessite `customer_id` (étape 3c).

## Trouver un produit dans un grand catalogue (décidé)

Problème : un vrai catalogue fait 200 à 500 références, une liste à faire défiler est inutilisable. Solutions validées, qui se complètent (dans l'ordre de la roadmap) :

1. **Recherche + onglets par catégorie** dans le formulaire : recherche sans accents ni majuscules, dans le milieu des noms (« toul » → « Saucisse de Toulouse ») ; onglets à partir de `products.category`.
2. **« Mes produits habituels »** en tête de liste (+ « recommander comme la dernière fois ») : nécessite `customer_id` (étape 3c).
3. **Saisie libre avec IA** (validée par l'utilisateur le 2026-10-12, remplace l'ancienne idée « par règles, sans IA ») : le boucher écrit ou dicte sa commande comme un SMS (« 10 côtes de bœuf, 5 poulets, toulouse 3 ») et l'IA la transforme en lignes du catalogue. Règles :
   - **L'IA propose, le boucher valide** : écran de vérification obligatoire avant l'envoi, chaque ligne corrigeable.
   - **L'IA ne choisit que dans le catalogue du grossiste** : sortie structurée (structured outputs) limitée aux `id` des produits ; sinon ligne « hors catalogue » conservée avec le texte d'origine (la colonne `custom_name` n'existe pas encore ; `product_id` nullable non vérifié).
   - Modèle : **Claude Haiku 5.5** (`claude-haiku-5-5`), via le SDK officiel `@anthropic-ai/sdk`. Estimation : ~0,07 centime par commande (catalogue de 500 produits), quelques dollars par mois au pilote ; à mesurer sur de vraies commandes.
   - **Appel côté serveur uniquement** (route / Server Action Next.js), clé `ANTHROPIC_API_KEY` dans `.env.local` et Vercel, jamais `NEXT_PUBLIC_`.
   - La recherche classique reste disponible en secours (latence 1-3 s, service externe).

---

## Dette technique et risques connus

- **Aucune authentification, RLS désactivée** : toute personne qui connaît une URL peut lire ou modifier des commandes, et l'espace grossiste est ouvert à tous. Acceptable en test solo, **bloquant avant le pilote**.
- **Piège RLS** : activer la RLS sans écrire de policies fait renvoyer des résultats vides **sans erreur**. Écris les policies en même temps, table par table, et teste après chaque table.
- **Les règles de substitution ne sont imposées que par l'interface**, pas par la base. Un appel direct à l'API pourrait les contourner. À verrouiller côté serveur (policies / fonction / trigger Postgres) avec l'authentification.
- **Typage Supabase** : un cast `as unknown as` reste dans `app/suivi/[id]/page.tsx`, et la relation `products` est typée `unknown` (lue via les helpers de `lib/productName.ts`). Piste : générer les types avec `supabase gen types`.
- La colonne `orders.status` est obsolète (voir la base) : à supprimer un jour.
- `/suivi/[id]` est lisible par n'importe quel compte connecté qui connaît l'id de la commande (à fermer avec la RLS, étape 5).
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
   5. RLS table par table, avec policies, test après chaque table (piège des résultats vides). Vérifier que Realtime marche encore.
   6. Trigger Postgres qui impose les règles de substitution côté base.
   7. Passage au SMS (Supabase Auth + Twilio) une fois tout validé par email.
   - Décider du sort des 22 commandes de test (sans `customer_id`) avant la RLS.
   - Puis : **recherche + catégories**, puis **produits habituels**, puis **saisie libre avec IA** (voir « Trouver un produit »). Calendrier visé (démo vers le 2026-11-10) : semaines 1-2 connexion 1 à 4 ; semaine 3 recherche/catégories + saisie IA (à la place d'une partie de la passe de design) ; semaine 4 étapes 5 à 7 et tests. Si retard, l'étape 7 (SMS) saute.
   - Ensuite : **sauvegarder des listes de substituts par produit** (« toujours saucisse algérienne si pas de Toulouse »), table du type `substitution_rules`.
2. **Alertes WhatsApp** (Twilio ou API WhatsApp Business) : sur rupture sans substitut valide, et sur commande non prise en charge trop longtemps. Les démarches de validation côté Twilio/Meta (templates de messages) prennent du temps : l'utilisateur peut les lancer en parallèle du code.
3. **Vrais catalogues** des 4 grossistes : demander leurs tarifs (Excel ou PDF), importer en CSV dans `products` (Supabase → Table Editor → Import).
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