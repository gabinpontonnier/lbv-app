# 🗺️ LBV App — Roadmap

Application de suivi de blanchisserie pour clients professionnels (Conciergerie & Résidences sénior).
Stack : **React + Vite + Supabase + Vercel (PWA)**

---

## PHASE 0 — Setup & Infrastructure
> Durée estimée : 1 jour

- [ ] Initialiser le projet React + Vite + TailwindCSS
- [ ] Installer vite-plugin-pwa (installable sur écran d'accueil)
- [ ] Créer le projet Supabase (base de données + auth)
- [ ] Créer le schéma de base de données (voir ci-dessous)
- [ ] Déploiement initial vide sur Vercel
- [ ] Configurer les variables d'environnement

---

## PHASE 1 — MVP Core (Interface Manager)
> Durée estimée : 1 semaine

### 1.1 Authentification
- [ ] Page de connexion (email + mot de passe)
- [ ] Protection des routes (manager uniquement)
- [ ] Déconnexion

### 1.2 Configuration initiale (paramètres)
- [ ] Gestion des clients (créer / modifier : Conciergerie, Résidence 1, Résidence 2)
- [ ] Gestion des résidents par résidence (nom, chambre)
- [ ] Configuration des kits conciergerie :
  - **Petit kit** : contenu en articles (ex: 1 drap 2p, 2 taies, 2 serviettes bain...)
  - **Grand kit** : contenu en articles
  - Articles ponctuels hors-kit (peignoirs, nappes...)
- [ ] Catalogue articles résidences + grille tarifaire par résidence

### 1.3 Saisie livraison — Conciergerie
- [ ] Sélecteur de date (défaut : aujourd'hui)
- [ ] Compteur Petit kit (+/-)
- [ ] Compteur Grand kit (+/-)
- [ ] Calcul automatique des articles (affichage récap)
- [ ] Saisie poids total (kg)
- [ ] Articles ponctuels hors-kit (optionnel)
- [ ] Notes libres
- [ ] Bouton Valider → enregistrement Supabase

### 1.4 Saisie livraison — Résidences
- [ ] Sélecteur de date + sélecteur client (Résidence 1 ou 2)
- [ ] Sélection du résident (liste + recherche)
- [ ] Saisie articles +/- par article
- [ ] Vêtements (toggle optionnel + description libre)
- [ ] Notes libres
- [ ] Bouton Valider → enregistrement Supabase

### 1.5 Tableau de bord (accueil manager)
- [ ] Résumé du jour : livraisons effectuées par client
- [ ] Bouton accès rapide "Nouvelle livraison"
- [ ] Indicateur livraisons de la semaine (mini-calendrier)

---

## PHASE 2 — Récapitulatifs & Exports
> Durée estimée : 1 semaine

### 2.1 Récap Conciergerie
- [ ] Vue mensuelle : liste de toutes les livraisons du mois
- [ ] Par livraison : date, kits (P/G), articles calculés, poids
- [ ] Totaux du mois : nb kits, poids total
- [ ] Export PDF propre (prêt pour saisie facture Excel)

### 2.2 Récap Résidence 1
- [ ] Consommation globale de la résidence sur le mois
- [ ] Consommation par résident (tableau : résident × article × quantité)
- [ ] Export PDF (deux sections : résidence + résidents)

### 2.3 Récap Résidence 2
- [ ] Liste des commandes effectuées par résident sur le mois
- [ ] Total mensuel de consommation par résident
- [ ] Export PDF (par résident + synthèse)

### 2.4 Navigation récaps
- [ ] Sélecteur mois / client
- [ ] Aperçu avant export
- [ ] Bouton télécharger PDF

---

## PHASE 3 — Portail Client (Vue professionnels)
> Durée estimée : 1 semaine

### 3.1 Authentification client
- [ ] Compte par client (email + mot de passe)
- [ ] Chaque client voit uniquement ses données

### 3.2 Vue client — Conciergerie
- [ ] Historique des livraisons (date, kits, articles, poids)
- [ ] Filtre par mois

### 3.3 Vue client — Résidence
- [ ] Historique global de la résidence
- [ ] Vue par résident (recherche par nom)
- [ ] Filtre par mois

### 3.4 Demandes client
- [ ] Formulaire "Nouvelle demande" (texte libre + date souhaitée)
- [ ] Notification manager (email via Brevo)
- [ ] Liste des demandes en cours / traitées

---

## PHASE 4 — PWA & Polish
> Durée estimée : 3-4 jours

- [ ] Manifest PWA complet (icône, nom, couleurs)
- [ ] Cache offline (données récentes consultables sans réseau)
- [ ] Splash screen + icône sur écran d'accueil iOS/Android
- [ ] Design mobile-first soigné (saisie rapide 1 main)
- [ ] Animations légères (feedback visuel à la validation)
- [ ] Tests sur iPhone + Android

---

## SCHÉMA BASE DE DONNÉES (Supabase)

```
clients          : id, name, type (conciergerie|residence), billing_type (weight|article)
residents        : id, client_id, name, room, active
articles         : id, name, category
kit_compositions : id, kit_type (petit|grand), article_id, quantity
client_prices    : id, client_id, article_id, price_per_unit
deliveries       : id, client_id, date, total_weight, notes, created_at
delivery_items   : id, delivery_id, article_id, resident_id (nullable), quantity
requests         : id, client_id, message, requested_date, status, created_at
```

---

## ORDRE DE CONSTRUCTION RECOMMANDÉ

```
Phase 0 → Phase 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → Phase 2 → Phase 3 → Phase 4
```

On commence par ce qui vous fait gagner du temps IMMÉDIATEMENT :
la saisie quotidienne remplace le papier dès la Phase 1.

---

## PROCHAINE ÉTAPE

Pour démarrer Phase 0, il me faut :
1. ✅ Ce dossier LBV App créé
2. ⏳ Votre URL Supabase + clé anon (compte gratuit sur supabase.com)
3. ⏳ Contenu exact des kits (Petit kit / Grand kit en articles)
4. ⏳ Liste des articles pour les résidences
