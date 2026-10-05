/**
 * JEDINI izvor sadržaja za prototip.
 * Sve što je označeno s TODO ili `confirmed: false` mora potvrditi klijent
 * prije objave — ništa izmišljeno ne smije ići van.
 */
import type { ImageMetadata } from 'astro';

import imgZalazak from '@/assets/projects/krov-crijep-lim-zalazak.jpg';
import imgSnjegobrani from '@/assets/projects/krov-crijep-lim-snjegobrani.jpg';
import imgSnjegobraniOdozgo from '@/assets/projects/krov-crijep-lim-snjegobrani-odozgo.jpg';
import imgSnjegobranCijev from '@/assets/projects/krov-crijep-lim-snjegobran-cijev.jpg';
import imgUvalaRadnik from '@/assets/projects/krov-crijep-lim-uvala-radnik.jpg';
import imgSpojRadnik from '@/assets/projects/krov-crijep-lim-spoj-radnik.jpg';
import imgFalcIzlaz from '@/assets/projects/falcani-krov-izlaz.jpg';
import imgFalcZid from '@/assets/projects/falcani-krov-zid.jpg';
import imgTrapezGromobran from '@/assets/projects/ravni-krov-trapez-atika-gromobran.jpg';
import imgTrapezMedvednica from '@/assets/projects/ravni-krov-trapez-medvednica.jpg';
import imgAtikaSljunak from '@/assets/projects/atika-opsav-sljunak.jpg';
import imgAtikaKutLjestve from '@/assets/projects/atika-opsav-kut-ljestve.jpg';
import imgAtikaKutDetalj from '@/assets/projects/atika-opsav-kut-detalj.jpg';
import imgAtikaSusjed from '@/assets/projects/atika-opsav-susjedni-krov.jpg';
import imgAtikaAlat from '@/assets/projects/atika-opsav-alat.jpg';
import imgAtikaAlatSiroko from '@/assets/projects/atika-opsav-alat-siroko.jpg';
import imgDimnjak from '@/assets/projects/dimnjak-oblaganje-kapa.jpg';

/** Prototip: prikazuje oznaku "PROTOTIP" i "primjer" uz nepotvrđene podatke. */
export const PROTOTYPE = true;

export const site = {
  name: 'Limarija Karamatić',
  legalName: 'Limarija Karamatić', // TODO: puni naziv obrta / d.o.o.
  oib: '00000000000', // TODO
  tagline: 'Sedam puta mjerimo. Jednom savijemo.',
  phoneDisplay: '091 000 0000', // TODO: stvarni broj
  phoneE164: '+385910000000', // TODO
  whatsapp: '385910000000', // TODO (bez +)
  viber: '+385910000000', // TODO
  email: 'info@limarija-karamatic.hr', // TODO
  city: 'Zagreb', // TODO: potvrditi sjedište
  area: 'Zagreb i okolica',
  hours: 'Pon–Pet 7–17 h · Sub 8–13 h', // TODO
  hoursShort: 'Pon–Sub od 7 h', // TODO
  responseTime: 'Javljamo se isti radni dan', // TODO: potvrditi
  googleReviewsUrl: '', // TODO: link na Google Business profil (prazno = link se ne prikazuje)
} as const;

export const telHref = `tel:${site.phoneE164}`;
export const waHref = (text = 'Pozdrav, trebam procjenu krova. Lokacija: ') =>
  `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
export const viberHref = `viber://chat?number=${encodeURIComponent(site.viber)}`;

/* ── Kotna linija (dokazi) ─────────────────────────────────── */
export type Stat = {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label: string;
  confirmed: boolean;
};
export const stats: Stat[] = [
  { value: 15, suffix: '+', label: 'godina u limariji', confirmed: false },
  { value: 600, suffix: '+', label: 'izvedenih krovova i opšava', confirmed: false },
  { value: 4.9, decimals: 1, suffix: ' / 5', label: 'Google ocjena', confirmed: false },
  { value: 10, suffix: ' god.', label: 'pisano jamstvo na izvedbu', confirmed: false },
];

/* ── Usluge ────────────────────────────────────────────────── */
/** Presjek profila lima koji se crta u ikoni usluge */
export type Profile = 'crijep' | 'falc' | 'uvala' | 'atika' | 'dimnjak' | 'oluk' | 'trapez';

export type Service = {
  slug: string;
  title: string;
  /** kratko ime za čipove u formi */
  chip: string;
  short: string;
  intro: string;
  includes: string[];
  profile: Profile;
  image: ImageMetadata;
  imageAlt: string;
  gallery: ImageMetadata[];
  seoTitle: string;
  seoDescription: string;
  /** H1 servisne stranice — sadrži uslugu + grad (podudaranje s Google upitom / Ads) */
  h1: string;
  /** opcionalni uvodni red ispod H1 (npr. obećanje) — inače se koristi `short` */
  lead?: string;
  /** naslovi sekcija na servisnoj stranici (inače zadani) */
  includesTitle?: string;
  galleryTitle?: string;
  galleryLead?: string;
  relatedTitle?: string;
  faqTitle?: string;
  faq: { q: string; a: string }[];
};

export const services: Service[] = [
  {
    slug: 'limeni-krovovi',
    title: 'Limeni krovovi',
    chip: 'Novi krov',
    short: 'Crijep-lim i trapez u antracitu ili boji po želji. Novi krov ili zamjena starog crijepa.',
    intro:
      'Limeni krov je lagan, ne puca od mraza i traje desetljećima. Radimo cijeli krov, sloj po sloj — od provjere konstrukcije i folije do zadnjeg vijka i snjegobrana — tako da na kraju ne ostane nijedno „to ćemo poslije“.',
    includes: [
      'Pregled i po potrebi sanacija drvene konstrukcije',
      'Paropropusna folija, letve i kontraletve',
      'Crijep-lim ili trapezni lim, antracit RAL 7016 ili boja po izboru',
      'Sljeme, uvale, zabatni i dimnjački opšavi',
      'Snjegobrani i priprema za oluke',
    ],
    profile: 'crijep',
    image: imgSnjegobrani,
    imageAlt: 'Novi limeni krov u antracitu s redovima snjegobrana, Zagreb',
    gallery: [imgSnjegobrani, imgZalazak, imgSnjegobraniOdozgo, imgSpojRadnik],
    seoTitle: 'Limeni krovovi Zagreb | Limarija Karamatić',
    seoDescription:
      'Novi limeni krovovi i zamjena crijepa limom u Zagrebu i okolici. Crijep-lim i trapez, antracit RAL 7016. Besplatna procjena.',
    h1: 'Limeni krovovi u Zagrebu',
    includesTitle: 'Cijeli krov, sloj po sloj.',
    galleryTitle: 'Crijep-lim u antracitu.',
    galleryLead: 'Fotografije s naših krovova u Zagrebu i okolici.',
    relatedTitle: 'Krovovi koje smo pokrili.',
    faqTitle: 'Pitanja o limenom krovu.',
    faq: [
      {
        q: 'Može li lim ići preko starog crijepa?',
        a: 'Ne preporučujemo. Stari crijep skidamo, provjeravamo konstrukciju i tek onda postavljamo foliju, letve i lim. Tako znate što je ispod krova.',
      },
      {
        q: 'Je li limeni krov bučan kad pada kiša?',
        a: 'Uz ispravnu podlogu, letvanje i izolaciju potkrovlja razlika je mala. Kod stambenih potkrovlja preporučujemo dodatnu zvučnu izolaciju — kažemo vam to već na procjeni.',
      },
      {
        q: 'Koje boje lima nudite?',
        a: 'Najčešće radimo antracit RAL 7016, a ostale RAL boje dogovaramo prema ponudi proizvođača lima.',
      },
    ],
  },
  {
    slug: 'falcani-krovovi',
    title: 'Falcani krovovi',
    chip: 'Falcani krov',
    short: 'Dvostruki stojeći falc bez vidljivih vijaka. Čiste linije za moderne kuće i nadstrešnice.',
    intro:
      'Falcani (stojeći) spoj je najčišće rješenje u limu: trake se spajaju preklopom koji se savija na krovu, bez vijaka kroz pokrov. Idealno za niske nagibe, moderne kuće, garaže i nadstrešnice.',
    includes: [
      'Trake krojene po mjeri krova, bez poprečnih spojeva gdje je moguće',
      'Klizne i fiksne kopče za toplinsko rastezanje',
      'Izlazi na krov, prodori i opšavi zidova',
      'Odvodnja i opšav strehe',
    ],
    profile: 'falc',
    image: imgFalcIzlaz,
    imageAlt: 'Falcani limeni krov s izlazom na krov',
    gallery: [imgFalcIzlaz, imgFalcZid],
    seoTitle: 'Falcani krovovi Zagreb | Limarija Karamatić',
    seoDescription:
      'Falcani limeni krovovi (stojeći falc) u Zagrebu i okolici. Bez vidljivih vijaka, za niske nagibe i moderne kuće.',
    h1: 'Falcani krovovi u Zagrebu',
    includesTitle: 'Što radimo na falcanom krovu.',
    galleryTitle: 'Trake bez poprečnih spojeva.',
    galleryLead: 'Čiste linije, bez vijaka kroz pokrov.',
    relatedTitle: 'Falcani krovovi koje smo napravili.',
    faqTitle: 'Pitanja o falcanom krovu.',
    faq: [
      {
        q: 'Koji je minimalni nagib za falcani krov?',
        a: 'Ovisi o sustavu i vrsti falca. Točan nagib i rješenje predlažemo nakon mjerenja na terenu.',
      },
      {
        q: 'Je li falcani krov skuplji od crijep-lima?',
        a: 'Najčešće jest, jer traži preciznije krojenje i više rada na krovu. Ako krov dopušta oba rješenja, u ponudi vidite razliku crno na bijelo.',
      },
      {
        q: 'Može li falc na garažu ili nadstrešnicu?',
        a: 'Može. Niski nagibi i manje plohe upravo su mjesto gdje falc najbolje izgleda.',
      },
    ],
  },
  {
    slug: 'popravak-krova',
    title: 'Popravak i sanacija krova',
    chip: 'Popravak',
    short: 'Krov pušta? Nađemo uzrok, a ne samo mrlju. Uvale, sljeme, spojevi i dimnjaci.',
    intro:
      'Većina krovova ne curi „posred krova“, nego na spojevima: u uvalama, na sljemenu, oko dimnjaka i uz zidove. Najprije nađemo stvarni uzrok, pokažemo vam ga na fotografiji, a onda predložimo popravak koji traje.',
    includes: [
      'Pregled krova i fotodokumentacija uzroka',
      'Zamjena uvala, sljemena i opšava',
      'Sanacija oko dimnjaka i prodora',
      'Hitne intervencije nakon nevremena',
    ],
    profile: 'uvala',
    image: imgUvalaRadnik,
    imageAlt: 'Limar na krovu montira opšav uvale na limenom krovu',
    gallery: [imgUvalaRadnik, imgSpojRadnik],
    seoTitle: 'Popravak krova Zagreb — krov pušta? | Limarija Karamatić',
    seoDescription:
      'Popravak i sanacija krova u Zagrebu: uvale, sljeme, opšavi i dimnjaci. Nađemo uzrok prokišnjavanja. Nazovite ili pošaljite slike na WhatsApp.',
    h1: 'Popravak krova u Zagrebu',
    lead: 'Krov više neće puštati. Nađemo uzrok, a ne samo mrlju — uvale, sljeme, spojevi i dimnjaci.',
    includesTitle: 'Kako popravljamo krov.',
    galleryTitle: 'Ovako izgleda sanirano.',
    galleryLead: 'Uvale, sljemena i spojevi koje smo zamijenili.',
    relatedTitle: 'Sanirani krovovi.',
    faqTitle: 'Pitanja kad krov pušta.',
    faq: [
      {
        q: 'Dolazite li hitno nakon nevremena?',
        a: 'Da, prioritet imaju krovovi koji trenutno puštaju. Pošaljite slike na WhatsApp da odmah procijenimo što treba.',
      },
      {
        q: 'Može li se popraviti samo dio krova?',
        a: 'Često može: uvala, sljeme ili opšav dimnjaka mijenjaju se bez diranja ostatka krova. Ako je pokrov na kraju vijeka, reći ćemo vam to otvoreno.',
      },
      {
        q: 'Pokažete li mi gdje je curilo?',
        a: 'Da. Uzrok fotografiramo prije popravka i pokažemo vam ga, a nakon popravka dobivate fotografije gotovog stanja.',
      },
    ],
  },
  {
    slug: 'opsav-atike',
    title: 'Opšav atike i ravni krovovi',
    chip: 'Opšav atike',
    short: 'Kape atika s pravim kutovima i preklopima koji ne puštaju. Trapez za ravne krovove.',
    intro:
      'Atika je zid koji najviše trpi — kiša, sunce i mraz rade na svakom spoju. Krojimo kape po mjeri, kutove savijamo i spajamo na licu mjesta, a preklope radimo tako da voda nema kamo ući.',
    includes: [
      'Kape atika krojene po mjeri, s okapnicom',
      'Kutovi na geru i preklopni spojevi',
      'Trapezni lim za ravne krovove i nadogradnje',
      'Vođenje gromobranske instalacije po opšavu',
    ],
    profile: 'atika',
    image: imgTrapezGromobran,
    imageAlt: 'Ravni krov s trapeznim limom i opšavom atike u antracitu',
    gallery: [imgTrapezGromobran, imgAtikaKutDetalj, imgAtikaSljunak, imgTrapezMedvednica],
    seoTitle: 'Opšav atike Zagreb | Limarija Karamatić',
    seoDescription:
      'Opšav atike i limarija ravnih krovova u Zagrebu. Kape atika po mjeri, kutovi na geru, trapezni lim. Besplatna procjena.',
    h1: 'Opšav atike u Zagrebu',
    lead: 'Kape atika s pravim kutovima i preklopima koji ne puštaju. Trapezni lim za ravne krovove.',
    includesTitle: 'Što uključuje opšav atike.',
    galleryTitle: 'Kutovi savijeni na licu mjesta.',
    galleryLead: 'Ravni krovovi i atike u Zagrebu.',
    relatedTitle: 'Atike i ravni krovovi.',
    faqTitle: 'Pitanja o opšavu atike.',
    faq: [
      {
        q: 'Radite li opšav atike na stambenim zgradama?',
        a: 'Da, za stambene zgrade i poslovne objekte. Za upravitelje pripremamo ponudu i dokumentaciju za plaćanje iz pričuve.',
      },
      {
        q: 'Koliko traje izrada opšava atike?',
        a: 'Ovisi o duljini atike i broju kutova. Kape krojimo po izmjerama, pa je montaža na krovu brza. Točan rok piše u ponudi.',
      },
      {
        q: 'Što je s gromobranskom žicom na atici?',
        a: 'Postojeću gromobransku žicu vraćamo na nosače po novom opšavu, kao na fotografijama naših ravnih krovova.',
      },
    ],
  },
  {
    slug: 'dimnjaci',
    title: 'Opšav i oblaganje dimnjaka',
    chip: 'Dimnjak',
    short: 'Opšav uz krov, oblaganje cijelog dimnjaka limom i kape koje stoje desetljećima.',
    intro:
      'Dimnjak je najčešće mjesto prokišnjavanja. Radimo stepenasti opšav uz krov, oblažemo cijeli dimnjak limom u boji krova i postavljamo limene kape.',
    includes: [
      'Stepenasti opšav dimnjaka uz pokrov',
      'Oblaganje dimnjaka limom u boji krova',
      'Limene kape i pokrovne ploče',
    ],
    profile: 'dimnjak',
    image: imgDimnjak,
    imageAlt: 'Dimnjak obložen antracit limom s limenom kapom',
    gallery: [imgDimnjak],
    seoTitle: 'Opšav dimnjaka Zagreb | Limarija Karamatić',
    seoDescription:
      'Opšav i oblaganje dimnjaka limom u Zagrebu, limene kape dimnjaka. Rješavamo prokišnjavanje oko dimnjaka.',
    h1: 'Opšav dimnjaka u Zagrebu',
    includesTitle: 'Od opšava do kape.',
    galleryTitle: 'Najčešće mjesto curenja, riješeno.',
    galleryLead: 'Dimnjak obložen limom u boji krova.',
    relatedTitle: 'Obloženi dimnjaci.',
    faqTitle: 'Pitanja o dimnjaku.',
    faq: [
      {
        q: 'Može li se dimnjak obložiti bez skidanja krova?',
        a: 'U većini slučajeva da. Opšav uz krov spajamo s postojećim pokrovom, a o detaljima odlučujemo nakon pregleda.',
      },
      {
        q: 'Treba li dimnjaku limena kapa?',
        a: 'Kapa štiti dimnjak od kiše i snijega i produljuje mu vijek. Oblik i veličinu prilagođavamo dimnjaku i vrsti loženja.',
      },
      {
        q: 'U kojoj boji oblažete dimnjak?',
        a: 'Najčešće u boji krova, antracitu RAL 7016, da dimnjak izgleda kao dio krova, a ne kao zakrpa.',
      },
    ],
  },
  {
    slug: 'oluci-snjegobrani',
    title: 'Oluci i snjegobrani',
    chip: 'Oluci / snjegobrani',
    short: 'Polukružni i četvrtasti oluci, vertikale i snjegobrani da snijeg ostane na krovu.',
    intro:
      'Oluci moraju odvesti svu vodu, a snjegobrani zadržati snijeg na krovu, a ne na autu ispod. Radimo oluke, vertikale, kotliće i sve vrste snjegobrana za limene krovove.',
    includes: [
      'Polukružni i četvrtasti oluci, kuke i kotlići',
      'Vertikale i spoj na odvodnju',
      'Trokutasti i cijevni snjegobrani',
    ],
    profile: 'oluk',
    image: imgSnjegobraniOdozgo,
    imageAlt: 'Limeni krov sa snjegobranima, gledan odozgo',
    gallery: [imgSnjegobraniOdozgo, imgSnjegobranCijev, imgSnjegobrani],
    seoTitle: 'Oluci i snjegobrani Zagreb | Limarija Karamatić',
    seoDescription:
      'Montaža oluka, vertikala i snjegobrana u Zagrebu i okolici. Za nove i postojeće limene krovove.',
    h1: 'Oluci i snjegobrani u Zagrebu',
    includesTitle: 'Odvodnja i zaštita od snijega.',
    galleryTitle: 'Snijeg ostaje na krovu.',
    galleryLead: 'Snjegobrani na limenim krovovima.',
    relatedTitle: 'Krovovi sa snjegobranima.',
    faqTitle: 'Pitanja o olucima i snjegobranima.',
    faq: [
      {
        q: 'Koliko redova snjegobrana treba?',
        a: 'Ovisi o duljini i nagibu krova te o tome što je ispod (ulaz, parking). Raspored predlažemo na procjeni.',
      },
      {
        q: 'Mijenjate li samo oluke, bez krova?',
        a: 'Da. Oluke, kotliće i vertikale mijenjamo i na postojećim krovovima.',
      },
      {
        q: 'Mogu li snjegobrani na postojeći limeni krov?',
        a: 'U pravilu mogu. Vrstu i raspored biramo prema profilu lima i nagibu krova.',
      },
    ],
  },
];

export const serviceBySlug = (slug: string) => services.find((s) => s.slug === slug);

/* ── Radovi (projekti) ─────────────────────────────────────── */
export type ProjectKind = 'krov' | 'falc' | 'atika' | 'ravni' | 'dimnjak' | 'snjegobrani';
export type Project = {
  slug: string;
  title: string;
  kind: ProjectKind;
  service: string; // slug usluge
  location: string; // TODO: kvart / mjesto potvrditi s klijentom
  material: string;
  year: number; // TODO
  image: ImageMetadata;
  alt: string;
  gallery: ImageMetadata[];
  featured?: boolean;
  /** kratak naslov za H1 kad je title predug */
  heroTitle?: string;
  /** opis rada (nacrt teksta prema fotografijama — klijent potvrđuje) */
  note: string;
  /** što je izvedeno — stavke za tablicu na stranici projekta */
  scope: string[];
};

export const projectKinds: Record<ProjectKind, string> = {
  krov: 'Limeni krov',
  falc: 'Falcani krov',
  atika: 'Opšav atike',
  ravni: 'Ravni krov',
  dimnjak: 'Dimnjak',
  snjegobrani: 'Snjegobrani',
};

export const projects: Project[] = [
  {
    slug: 'ravni-krov-trapez-medvednica',
    title: 'Ravni krov s pogledom na Sljeme',
    kind: 'ravni',
    service: 'opsav-atike',
    location: 'Zagreb',
    material: 'Trapez + opšav atike · RAL 7016',
    year: 2025,
    image: imgTrapezMedvednica,
    alt: 'Ravni krov s trapeznim limom i opšavom atike, u pozadini Medvednica',
    gallery: [imgTrapezMedvednica, imgTrapezGromobran],
    featured: true,
    heroTitle: 'Ravni krov pod Sljemenom',
    note: 'Ravni krov nadogradnje pokriven trapeznim limom, zatvoren opšavom atike s kutovima savijenim na licu mjesta. Gromobranska žica vraćena je na nosače po novom opšavu.',
    scope: ['Trapezni lim RAL 7016', 'Opšav atike s okapnicom', 'Gromobranska žica na nosačima'],
  },
  {
    slug: 'falcani-krov-izlaz',
    title: 'Falcani krov s izlazom',
    kind: 'falc',
    service: 'falcani-krovovi',
    location: 'Zagreb',
    material: 'Stojeći falc · RAL 7016',
    year: 2025,
    image: imgFalcIzlaz,
    alt: 'Falcani limeni krov s izlazom na krov',
    gallery: [imgFalcIzlaz, imgFalcZid],
    featured: true,
    note: 'Falcani krov na niskom nagibu, s izlazom na krov i sigurnosnom kukom. Trake su krojene u jednom komadu po dužini krova, bez poprečnih spojeva.',
    scope: ['Stojeći falc RAL 7016', 'Izlaz na krov', 'Sigurnosna kuka'],
  },
  {
    slug: 'dimnjak-oblaganje',
    title: 'Dimnjak obložen limom',
    kind: 'dimnjak',
    service: 'dimnjaci',
    location: 'Zagreb',
    material: 'Oblaganje + kapa · RAL 7016',
    year: 2025,
    image: imgDimnjak,
    alt: 'Dimnjak obložen antracit limom s limenom kapom',
    gallery: [imgDimnjak],
    featured: true,
    note: 'Dimnjak je obložen limom u boji krova, a na vrh je postavljena limena kapa. Stepenasti opšav uz crijep-lim zatvara spoj na kojem krovovi najčešće procure.',
    scope: ['Oblaganje dimnjaka limom', 'Limena kapa dimnjaka', 'Stepenasti opšav uz pokrov'],
  },
  {
    slug: 'atika-kut-na-geru',
    title: 'Kut atike na geru',
    kind: 'atika',
    service: 'opsav-atike',
    location: 'Zagreb',
    material: 'Kapa atike · RAL 7016',
    year: 2025,
    image: imgAtikaKutDetalj,
    alt: 'Detalj kuta opšava atike spojenog na geru',
    gallery: [imgAtikaKutDetalj, imgAtikaKutLjestve],
    featured: true,
    note: 'Kut atike spojen na geru, krojen i savijen na licu mjesta po stvarnom kutu zida. Preklopi idu u smjeru vode, a vijci imaju EPDM brtvu u boji lima.',
    scope: ['Kapa atike RAL 7016', 'Kut na geru', 'Preklopi u smjeru vode'],
  },
  {
    slug: 'krov-crijep-lim-zalazak',
    title: 'Crijep-lim sa snjegobranima',
    kind: 'krov',
    service: 'limeni-krovovi',
    location: 'Zagreb',
    material: 'Crijep-lim · RAL 7016',
    year: 2025,
    image: imgZalazak,
    alt: 'Limeni krov u antracitu sa snjegobranima u zalasku sunca',
    gallery: [imgZalazak, imgSnjegobrani],
    featured: true,
    note: 'Novi pokrov od crijep-lima u antracitu, s tri reda trokutastih snjegobrana iznad ulaza i dvorišta. Spoj sa susjednim krovom od crijepa riješen je opšavom uz zid.',
    scope: ['Crijep-lim RAL 7016', 'Trokutasti snjegobrani u tri reda', 'Opšav uz susjedni krov'],
  },
  {
    slug: 'krov-uvala',
    title: 'Uvala i sljeme na složenom krovu',
    kind: 'krov',
    service: 'popravak-krova',
    location: 'Zagreb',
    material: 'Crijep-lim · RAL 7016',
    year: 2025,
    image: imgUvalaRadnik,
    alt: 'Limar montira opšav uvale na limenom krovu',
    gallery: [imgUvalaRadnik, imgSpojRadnik],
    featured: true,
    heroTitle: 'Uvala i sljeme',
    note: 'Na krovu s dvije plohe uvala je najosjetljivije mjesto. Opšav uvale i sljeme montirani su prije završnog pokrova, a spoj s drugim krilom kuće zatvoren je stepenastim opšavom.',
    scope: ['Opšav uvale', 'Sljeme', 'Spoj dva krova'],
  },
  {
    slug: 'snjegobrani-odozgo',
    title: 'Snjegobrani iznad dvorišta',
    kind: 'snjegobrani',
    service: 'oluci-snjegobrani',
    location: 'Zagreb',
    material: 'Trokutasti snjegobrani · RAL 7016',
    year: 2025,
    image: imgSnjegobraniOdozgo,
    alt: 'Limeni krov sa snjegobranima gledan odozgo',
    gallery: [imgSnjegobraniOdozgo],
    featured: true,
    note: 'Redovi trokutastih snjegobrana postavljeni su iznad dvorišta i prolaza, tako da snijeg ostaje na krovu, a ne pada na ljude i aute ispod.',
    scope: ['Trokutasti snjegobrani', 'Raspored iznad prolaza', 'Crijep-lim RAL 7016'],
  },
  {
    slug: 'ravni-krov-gromobran',
    title: 'Ravni krov s gromobranom',
    kind: 'ravni',
    service: 'opsav-atike',
    location: 'Zagreb',
    material: 'Trapez + atika · RAL 7016',
    year: 2025,
    image: imgTrapezGromobran,
    alt: 'Trapezni lim na ravnom krovu unutar opšava atike s gromobranskom žicom',
    gallery: [imgTrapezGromobran],
    featured: true,
    note: 'Unutarnje polje ravnog krova pokriveno je trapeznim limom i zatvoreno širokom kapom atike. Gromobranska instalacija vodi se po opšavu na nosačima.',
    scope: ['Trapezni lim RAL 7016', 'Kapa atike', 'Gromobranska žica na nosačima'],
  },
  {
    slug: 'atika-sljunak',
    title: 'Opšav atike na šljunčanom krovu',
    kind: 'atika',
    service: 'opsav-atike',
    location: 'Zagreb',
    material: 'Kapa atike · RAL 7016',
    year: 2025,
    image: imgAtikaSljunak,
    alt: 'Novi opšav atike na ravnom krovu sa šljunkom',
    gallery: [imgAtikaSljunak, imgAtikaSusjed, imgAtikaAlatSiroko, imgAtikaAlat],
    featured: true,
    heroTitle: 'Atika na šljunku',
    note: 'Nove kape atike na ravnom krovu sa šljunkom, s preklopnim spojevima i okapnicom prema fasadi. Kape su krojene po izmjerama i montirane bez skidanja šljunka.',
    scope: ['Kape atike RAL 7016', 'Preklopni spojevi', 'Okapnica prema fasadi'],
  },
  {
    slug: 'snjegobran-cijev',
    title: 'Cijevni snjegobran',
    kind: 'snjegobrani',
    service: 'oluci-snjegobrani',
    location: 'Zagreb',
    material: 'Crijep-lim · RAL 7016',
    year: 2025,
    image: imgSnjegobranCijev,
    alt: 'Limeni krov s cijevnim snjegobranom',
    gallery: [imgSnjegobranCijev],
    note: 'Cijevni snjegobran na crijep-limu, uz zid susjedne kuće. Takav snjegobran zadržava snijeg u cijeloj širini krova.',
    scope: ['Cijevni snjegobran', 'Crijep-lim RAL 7016'],
  },
  {
    slug: 'falc-uz-zid',
    title: 'Falc uz zid kuće',
    kind: 'falc',
    service: 'falcani-krovovi',
    location: 'Zagreb',
    material: 'Stojeći falc · RAL 7016',
    year: 2025,
    image: imgFalcZid,
    alt: 'Falcani krov uz zid kuće',
    gallery: [imgFalcZid],
    note: 'Falcani krov uz zid kuće, s opšavom zida i čistim linijama traka. Spoj uz zid zatvoren je bez vidljivih vijaka kroz pokrov.',
    scope: ['Stojeći falc RAL 7016', 'Opšav uz zid'],
  },
  {
    slug: 'atika-uz-susjedni-krov',
    title: 'Atika uz susjedni krov',
    kind: 'atika',
    service: 'opsav-atike',
    location: 'Zagreb',
    material: 'Kapa atike · RAL 7016',
    year: 2025,
    image: imgAtikaSusjed,
    alt: 'Opšav atike uz susjedni limeni krov',
    gallery: [imgAtikaSusjed, imgAtikaAlatSiroko],
    note: 'Opšav atike uz susjedni limeni krov, s kapom i preklopima koji vode vodu prema van. Spoj sa susjednom zgradom riješen je bez oštećenja njihova pokrova.',
    scope: ['Kapa atike RAL 7016', 'Spoj sa susjednim krovom'],
  },
];

/* ── Kako radimo ───────────────────────────────────────────── */
export const steps = [
  {
    n: '01',
    title: 'Javite se',
    text: 'Nazovite ili pošaljite 3 slike krova na WhatsApp. Često već iz slika znamo o čemu se radi.',
  },
  {
    n: '02',
    title: 'Dolazimo izmjeriti',
    text: 'Besplatno izlazimo na teren, mjerimo i fotografiramo krov. Pokažemo vam gdje je problem.',
  },
  {
    n: '03',
    title: 'Pisana ponuda',
    text: 'Ponuda stavku po stavku: materijal, boja, debljina lima, rok. Bez „to ćemo vidjeti“.',
  },
  {
    n: '04',
    title: 'Izvedba',
    text: 'Lim krojimo i savijamo po mjeri. Radimo uredno i za sobom čistimo svaki dan.',
  },
  {
    n: '05',
    title: 'Primopredaja i jamstvo',
    text: 'Prolazimo krov zajedno, dobivate fotodokumentaciju i pisano jamstvo.',
  },
];

/* ── Standard izvedbe / jamstvo (sastavnica) ───────────────── */
export const standard = [
  { k: 'Materijal', v: 'Pocinčani čelični lim s plastifikacijom', confirmed: false },
  { k: 'Debljina lima', v: '0,5–0,6 mm', confirmed: false },
  { k: 'Boja', v: 'Antracit RAL 7016 · ostale RAL boje po dogovoru', confirmed: true },
  { k: 'Spojni materijal', v: 'Vijci s EPDM brtvom u boji lima', confirmed: false },
  { k: 'Dokumentacija', v: 'Fotografije prije, tijekom i nakon radova', confirmed: false },
  { k: 'Jamstvo na izvedbu', v: '10 godina, pisano', confirmed: false, highlight: true },
  { k: 'Račun', v: 'R1 račun · plaćanje iz pričuve za zgrade', confirmed: false },
];

/* ── Recenzije — PRIMJERI, zamijeniti stvarnim Google recenzijama ── */
export const reviews = [
  {
    name: 'Primjer recenzije',
    place: 'Zagreb',
    text: 'Došli su izmjeriti dan nakon poziva, ponuda je bila jasna i rok je ispoštovan. Krov izgleda odlično, a dvorište su ostavili čišće nego što je bilo.',
    stars: 5,
    example: true,
  },
  {
    name: 'Primjer recenzije',
    place: 'Zagreb',
    text: 'Godinama nam je curilo oko dimnjaka. Našli su uzrok, obložili cijeli dimnjak i od tada mir.',
    stars: 5,
    example: true,
  },
  {
    name: 'Primjer recenzije',
    place: 'Zagreb',
    text: 'Kao upravitelj zgrade trebao sam ponudu za opšav atike i dokumentaciju za pričuvu — sve je stiglo složeno, bez natezanja.',
    stars: 5,
    example: true,
  },
  {
    name: 'Primjer recenzije',
    place: 'Zagreb',
    text: 'Majstori koji znaju što rade. Kutovi na atici su savršeni, susjedi su odmah pitali za broj.',
    stars: 5,
    example: true,
  },
];

/* ── Područje rada ─────────────────────────────────────────── */
// TODO: potvrditi s klijentom
export const areas = [
  'Zagreb',
  'Novi Zagreb',
  'Sesvete',
  'Dubrava',
  'Velika Gorica',
  'Samobor',
  'Zaprešić',
  'Sveta Nedelja',
  'Dugo Selo',
  'Jastrebarsko',
  'Ivanić-Grad',
  'Vrbovec',
  'Sveti Ivan Zelina',
  'Brdovec',
  'Stupnik',
];

/* ── Česta pitanja ─────────────────────────────────────────── */
export const faq = [
  {
    q: 'Koliko košta limeni krov po m²?',
    a: 'Cijena ovisi o vrsti lima, složenosti krova (uvale, dimnjaci, prozori) i stanju konstrukcije. Nakon besplatnog mjerenja dobivate pisanu ponudu stavku po stavku, bez skrivenih troškova. Ponudu šaljemo nekoliko dana nakon mjerenja.',
  },
  {
    q: 'Je li procjena stvarno besplatna?',
    a: 'Da. Dolazimo, mjerimo, fotografiramo i dajemo ponudu bez ikakve obveze. Za brzu orijentaciju pošaljite slike krova na WhatsApp.',
  },
  {
    q: 'Koliko traje izrada novog krova?',
    a: 'Obiteljska kuća najčešće je gotova za nekoliko radnih dana, ovisno o veličini i vremenu. Točan rok piše u ponudi.',
  },
  {
    q: 'Radite li po kiši i zimi?',
    a: 'Limarske radove ne izvodimo po kiši, snijegu ni jakom vjetru. Hitne zaštite krova nakon nevremena radimo čim je sigurno izaći na krov.',
  },
  {
    q: 'Može li se lim staviti preko starog crijepa?',
    a: 'Ne preporučujemo. Stari crijep skidamo i provjeravamo konstrukciju — tako znate da je krov dobar i ispod lima.',
  },
  {
    q: 'Je li limeni krov bučan po kiši?',
    a: 'Uz ispravnu podlogu i izolaciju potkrovlja razlika je mala. Ako je potkrovlje stambeno, preporučit ćemo dodatnu zvučnu izolaciju.',
  },
  {
    q: 'Dajete li jamstvo?',
    a: 'Da, na izvedbu dajemo pisano jamstvo, a na materijal vrijedi jamstvo proizvođača. Sve piše u ponudi i na računu.',
  },
  // TODO: potvrditi s klijentom (predujam, osiguranje)
  {
    q: 'Tražite li predujam?',
    a: 'Način plaćanja i eventualni predujam za materijal piše u ponudi, prije nego što išta potpišete.',
  },
  {
    q: 'Pomažete li kod prijave štete osiguranju?',
    a: 'Da. Nakon nevremena snimimo oštećenja i napišemo nalaz koji možete priložiti osiguravatelju.',
  },
  {
    q: 'Moram li biti kod kuće dok mjerite?',
    a: 'Nije nužno ako je krov dostupan, ali dobro je da budete tu — odmah vam pokažemo što smo vidjeli.',
  },
  {
    q: 'Radite li za stambene zgrade i upravitelje?',
    a: 'Da. Pripremamo ponudu i dokumentaciju za odluku suvlasnika, R1 račun i plaćanje iz pričuve, uz fotodokumentaciju prije i poslije radova.',
  },
];

/* ── Navigacija ────────────────────────────────────────────── */
export const nav = [
  { href: '/usluge', label: 'Usluge' },
  { href: '/radovi', label: 'Radovi' },
  { href: '/#kako-radimo', label: 'Kako radimo' },
  { href: '/upravitelji-zgrada', label: 'Za zgrade' },
  { href: '/o-nama', label: 'O nama' },
  { href: '/kontakt', label: 'Kontakt' },
];

/* Vrste posla u formi "Radni nalog" (korak 1) */
export const jobTypes = [
  { id: 'novi-krov', label: 'Novi krov', service: 'limeni-krovovi' },
  { id: 'falc', label: 'Falcani krov', service: 'falcani-krovovi' },
  { id: 'popravak', label: 'Popravak / curi', service: 'popravak-krova' },
  { id: 'atika', label: 'Opšav atike', service: 'opsav-atike' },
  { id: 'dimnjak', label: 'Dimnjak', service: 'dimnjaci' },
  { id: 'oluci', label: 'Oluci / snjegobrani', service: 'oluci-snjegobrani' },
  { id: 'hitno', label: 'Hitno — curi sada', service: 'popravak-krova' },
];

export const roofSizes = ['do 50 m²', '50–120 m²', '120–250 m²', 'više od 250 m²', 'ne znam'];
