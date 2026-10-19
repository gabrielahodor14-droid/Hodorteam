# Hodor Estates — aplicație pentru telefon

PWA în limba română pentru clienți, bugete, preferințe și vizionări. Aceeași interfață poate fi deschisă pe telefon și laptop. Pe iPhone se adaugă din Safari: Partajare → Adăugați pe ecranul principal → Deschideți ca aplicație web.

## Structură

- GitHub: sursa aplicației, fără datele clienților sau secrete.
- Supabase: autentificare Google și PostgreSQL cu RLS.
- Vercel: Next.js și API-urile aplicației.
- Google Sheets: copie a clienților și vizionărilor.
- Google Calendar: evenimentele vizionărilor, fără invitații trimise altor persoane.

## Stadiu real

Codul este pregătit pentru configurare și publicare. Nu există încă o versiune funcțională publicată pe Vercel. Autentificarea reală, sincronizarea cu Google și instalarea pe iPhone trebuie verificate după configurare. Testele locale folosesc o bază PostgreSQL temporară PGlite și răspunsuri Google simulate; acestea nu probează accesul la contul real.

Versiunea existentă rămâne disponibilă: https://hodor-estates-clienti.gabrielahodor14.chatgpt.site . Datele ei nu au fost șterse. Ele NU au fost importate în noua bază Supabase; importul trebuie efectuat separat înainte de trecerea definitivă.

## Configurare Supabase

Proiectul selectat: `crhwuxgclgsjqkyykewa`, regiunea Frankfurt. Migrațiile urmărite în `supabase/migrations/` creează tabelele CRM, RPC-urile de salvare și politicile de acces. Lista membrilor este într-o schemă privată. Numai contul Google autorizat poate folosi aplicația. Migrațiile au fost aplicate prin integrarea Supabase la 19 octombrie 2026.

În Supabase Dashboard → Authentication → Providers → Google, activează Google și configurează clientul OAuth. În Authentication → URL Configuration, setează adresa finală Vercel și autorizează `<APP_URL>/auth/callback`. Nu folosi wildcard-uri largi pentru callback-uri de producție.

## Configurare Google Cloud

1. Creează sau selectează proiectul Google Cloud destinat aplicației.
2. Activează Google Sheets API și Google Calendar API.
3. Configurează Google Auth Platform și clientul OAuth de tip Web application.
4. Copiază redirect URI-ul Google afișat de Supabase pentru furnizorul Google; acesta se termină în `/auth/v1/callback` la originea proiectului Supabase.
5. Folosește același client ID și secret atât la furnizorul Google din Supabase, cât și în mediul serverului Vercel.
6. Autorizează din aplicație accesul pentru Sheets și pentru evenimentele calendarelor deținute. Conexiunile Google din ChatGPT nu se transferă în această aplicație.

## Configurare Vercel

Importă repository-ul GitHub ca proiect Next.js cu Node.js 22 sau 24. Sunt necesare variabilele din `.env.example`. `SUPABASE_PUBLISHABLE_KEY` este cheia publicabilă a proiectului. Aplicația NU necesită cheia Supabase service_role.

`APP_ENCRYPTION_KEY` trebuie să fie 32 octeți aleatori, codificați base64. Generează și păstrează valoarea în Vercel; nu o pune în GitHub sau în conversații. Schimbarea ei impune reconectarea Google. Clientul OAuth și cheia de criptare rămân exclusiv pe server.

Pentru utilizarea profesională, verifică planul Vercel înainte de lansare: planul Hobby este rezervat utilizării personale necomerciale. Nu a fost activat un abonament cu plată.

## Comenzi

```sh
npm ci
npm test
npm run check
npm run build
```

Pentru dezvoltare locală, creează `.env.local` din exemplu și completează-l privat. Pornește `npm run dev` numai după configurarea serviciilor. Nu aplica migrațiile pe alt proiect decât cel verificat.

## Comportamentul sincronizării

Salvarea în aplicație precedă scrierile Google. Dacă Google refuză sau nu confirmă, datele rămân salvate în Supabase și interfața afișează starea incompletă, cu reîncercare explicită. Un răspuns HTTP reușit de la aplicație nu este prezentat ca dovadă că Google a salvat.

Evenimentele au ID-uri stabile pentru a evita duplicatele după pierderea unui răspuns. Anularea șterge evenimentul aplicației; reprogramarea după anulare folosește o nouă generație de ID. Actualizările verifică identitatea evenimentului și versiunea sa ETag. Nu sunt trimise invitații și nu sunt modificate evenimente fără marcajele aplicației.

Sheets folosește file dedicate `Hodor_Clienti` și `Hodor_Vizionari`, scrieri RAW și identificatori de înregistrare. Numerele de telefon păstrează zero-ul inițial, iar textele nu sunt interpretate ca formule. Se refuză suprascrierea unui rând cu alt ID și se detectează ID-urile duplicate. Evită editarea sau sortarea filelor de date în timpul salvărilor; folosește vizualizări filtrate pentru lucru manual.

Sincronizarea este într-un singur sens: aplicație → Google. Modificările făcute direct în Sheets sau Calendar nu sunt importate. Modificarea unui client marchează vizionările lui pentru resincronizare; acestea se actualizează la următoarea salvare sau reîncercare explicită. Dacă un eveniment este șters direct în Google, aplicația afișează eroarea pentru verificare înainte de reprogramare.

Nu rulează sincronizări nesupravegheate în fundal. În lipsa internetului, nu se fac salvări. Service workerul păstrează doar resurse publice și o pagină offline; fișele clienților și sesiunile nu sunt stocate în cache-ul PWA.

## Verificare după configurare

Autentifică-te cu contul autorizat; confirmă refuzul unui alt cont. Creează apoi un client și o vizionare de test și verifică în toate cele trei locuri. Editează ora, anulează și reprogramează aceeași vizionare. Verifică lipsa duplicatelor, expirarea sesiunii, revenirea din autentificare și instalarea efectivă pe iPhone. Șterge datele de test numai după verificare, printr-o operație autorizată.

Limita acestei versiuni: 10.000 de înregistrări încărcate în interfață; dacă este depășită, API-ul raportează eroare în loc să trunchieze lista în tăcere.
