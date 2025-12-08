# Admin i Regular Account Setup Guide

## Kako funkcionira sistem uloga

Aplikacija koristi `team_members` tabelu za upravljanje ulogama. Svaki korisnik ima ulogu (`role`) koja može biti:
- **`admin`** - Administrator koji može upravljati članovima tima
- **`member`** - Regularni član tima (default)

## Kako se kreiraju računi

### 1. Regular Account (Član tima)

**Automatski proces:**
- Kada se korisnik registruje preko `/register` stranice
- Nakon registracije, korisnik je automatski dodan u `team_members` tabelu sa ulogom `"member"`
- Ovo se dešava u `app/setup/page.tsx` funkciji `ensureTeamMembership()`

**Kod:**
```typescript
// app/setup/page.tsx - linija 88-105
async function ensureTeamMembership(userId: string) {
  // Provjerava da li korisnik već postoji u timu
  const { data: existing } = await supabaseBrowser
    .from("team_members")
    .select("user_id")
    .eq("team_id", STUDIO_DIRECTION_TEAM_ID)
    .eq("user_id", userId)
    .single();

  if (!existing) {
    // Dodaje korisnika u tim kao "member"
    await supabaseBrowser.from("team_members").insert({
      team_id: STUDIO_DIRECTION_TEAM_ID,
      user_id: userId,
      role: "member",  // ← Default uloga
    });
  }
}
```

### 2. Admin Account (Administrator)

**Metoda 1: Preko Supabase Dashboard (SQL)**

1. Otvori Supabase Dashboard → SQL Editor
2. Izvrši ovaj SQL upit (zamijeni `USER_EMAIL` sa email adresom korisnika):

```sql
-- Pronađi user_id korisnika po email-u
UPDATE team_members
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'USER_EMAIL@example.com'
)
AND team_id = '92e8f38d-5161-4d70-bbdd-772d23cc7373';
```

**Metoda 2: Preko Team stranice (ako si već admin)**

1. Login kao postojeći admin
2. Idi na `/team` stranicu
3. Klikni na člana tima
4. Klikni na ⚙️ ikonu pored role badge-a
5. Promijeni ulogu na "Admin"

**Metoda 3: Direktno u bazi podataka**

```sql
-- Provjeri trenutne članove
SELECT 
  tm.user_id,
  tm.role,
  p.full_name,
  u.email
FROM team_members tm
JOIN profiles p ON p.user_id = tm.user_id
JOIN auth.users u ON u.id = tm.user_id
WHERE tm.team_id = '92e8f38d-5161-4d70-bbdd-772d23cc7373';

-- Promijeni ulogu na admin
UPDATE team_members
SET role = 'admin'
WHERE user_id = 'USER_ID_HERE'
AND team_id = '92e8f38d-5161-4d70-bbdd-772d23cc7373';
```

## Šta admin može raditi

Admin ima pristup sljedećim funkcionalnostima:

1. **Promjena uloga članova** - Može promijeniti bilo kog člana iz "member" u "admin" ili obrnuto
2. **Uklanjanje članova** - Može ukloniti članove iz tima (osim sebe)
3. **Zaštita**: 
   - Ne može ukloniti posljednjeg admina
   - Ne može ukloniti samog sebe
   - Ne može promijeniti svoju ulogu ako je posljednji admin

## Provjera uloge u kodu

```typescript
// Provjeri da li je korisnik admin
const { role } = await getCurrentUserRole();
const isAdmin = role === 'admin';
```

## Važne napomene

- **Prvi admin**: Prvi korisnik koji se registruje treba biti postavljen kao admin ručno (preko SQL-a)
- **Bezbednost**: Samo admini mogu mijenjati uloge i uklanjati članove
- **Default uloga**: Svi novi korisnici automatski dobijaju ulogu "member"

## Troubleshooting

**Problem**: Ne vidim admin opcije na Team stranici
**Rješenje**: Provjeri da li je tvoj `role` u `team_members` tabeli postavljen na `'admin'`

**Problem**: Ne mogu promijeniti ulogu
**Rješenje**: Provjeri da li si ulogovan kao admin i da li korisnik koga mijenjaš nije posljednji admin

**Problem**: Novi korisnik nije automatski dodan u tim
**Rješenje**: Provjeri da li `ensureTeamMembership()` funkcija radi ispravno u setup procesu

