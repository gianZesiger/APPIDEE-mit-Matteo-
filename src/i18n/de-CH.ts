// Alle Texte von Weniger. Schweizer Rechtschreibung (nie scharfes S), du-Form, CHF mit Apostroph.
//
// Glossar, überall gleich: Gewohnheit (nicht «Ziel»), guter Tag (nicht «Gewinn-Tag»),
// Serie (nicht «am Stück»), Ausrutscher (nicht «Rückfall»), gespart, Sparziel, Training,
// Wochenziel, Ruhetag, Meilenstein. Keine Abkürzungen: «25 Tage», «1 Stunde», «Woche 1».
//
// Getrennte Exporte, damit die Landingpage nur ihre eigenen Texte lädt.

// ---------- Gemeinsam: Zahlen und Zeiten in Worten ----------

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const words = {
  days: (n: number) => plural(n, 'Tag', 'Tage'),
  /** Dativ: «seit 25 Tagen» */
  daysDat: (n: number) => plural(n, 'Tag', 'Tagen'),
  hours: (n: number) => plural(n, 'Stunde', 'Stunden'),
  hoursDat: (n: number) => plural(n, 'Stunde', 'Stunden'),
  minutes: (n: number) => plural(n, 'Minute', 'Minuten'),
  minutesDat: (n: number) => plural(n, 'Minute', 'Minuten'),
  seconds: (n: number) => plural(n, 'Sekunde', 'Sekunden'),
  weeks: (n: number) => plural(n, 'Woche', 'Wochen'),
  week: (n: number) => `Woche ${n}`,
  trainings: (n: number) => plural(n, 'Training', 'Trainings'),
  goodDays: (n: number) => plural(n, 'guter Tag', 'gute Tage'),
  /** Nach «deine»: «deine 7 guten Tage», «dein 1 guter Tag» */
  goodDaysYour: (n: number) => (n === 1 ? 'Dein 1 guter Tag' : `Deine ${n} guten Tage`),
  /** Datum kurz und ohne Abkürzung: «Donnerstag, 5. November» */
  date(day: string): string {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' });
  },

  /** «2 Stunden 35 Minuten», «45 Minuten», «3 Stunden» */
  minutesLong(total: number): string {
    const m = Math.max(0, Math.round(total));
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h === 0) return words.minutes(r);
    return r ? `${words.hours(h)} ${words.minutes(r)}` : words.hours(h);
  },

  /** Zeit seit einem Zeitpunkt, grob: «25 Tagen», «3 Stunden», «12 Minuten» (Dativ, für «seit …») */
  sinceDat(ms: number): string {
    const min = Math.floor(ms / 60_000);
    const h = Math.floor(min / 60);
    const d = Math.floor(h / 24);
    if (d >= 1) return words.daysDat(d);
    if (h >= 1) return words.hoursDat(h);
    return words.minutesDat(Math.max(0, min));
  },

  /** Genau, mit Sekunden: «25 Tage, 3 Stunden, 14 Minuten, 7 Sekunden» */
  exact(ms: number): string {
    const s = Math.floor(Math.max(0, ms) / 1000);
    const parts: string[] = [];
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d) parts.push(words.days(d));
    if (d || h) parts.push(words.hours(h));
    parts.push(words.minutes(m), words.seconds(s % 60));
    return parts.join(', ');
  },

  /** Bis zum nächsten Meilenstein: «46 Minuten», «5 Stunden», «3 Tage» */
  until(ms: number): string {
    const min = Math.ceil(Math.max(0, ms) / 60_000);
    if (min < 60) return words.minutes(min);
    const h = Math.ceil(min / 60);
    if (h < 48) return words.hours(h);
    return words.days(Math.ceil(h / 24));
  },
};

/** CHF in Alltag übersetzen: [eins, mehrere]. Richtwerte zum Vorstellen, keine Preisangaben. */
export const things: Record<string, [string, string]> = {
  gipfeli: ['ein Gipfeli', 'Gipfeli'],
  kafi: ['ein Kafi im Café', 'Kafi im Café'],
  kino: ['ein Kinoeintritt', 'Kinoeintritte'],
  velo: ['ein Velo-Service', 'Velo-Services'],
  schuhe: ['ein Paar Laufschuhe', 'Paar Laufschuhe'],
  berge: ['ein Wochenende in den Bergen', 'Wochenenden in den Bergen'],
};

// ---------- App ----------

export const app = {
  name: 'Weniger',
  docTitle: (tab: string) => `${tab} · Weniger`,
  nav: { label: 'Hauptnavigation', heute: 'Heute', sport: 'Sport', ziele: 'Ziele', profil: 'Profil' },
  common: {
    back: 'Zurück',
    next: 'Weiter',
    cancel: 'Abbrechen',
    close: 'Schliessen',
    done: 'Fertig',
    save: 'Speichern',
    delete: 'Löschen',
    undo: 'Rückgängig',
    less: 'Weniger',
    more: 'Mehr',
    chf: 'CHF',
    loading: 'Wird geladen …',
    optional: 'optional',
  },
  validation: {
    number: 'Bitte eine Zahl eingeben, z. B. 3 oder 1.50.',
    perDay: (min: number, max: number) => `Bitte zwischen ${min} und ${max} pro Tag.`,
    price: (max: number) => `Bitte zwischen CHF 0 und ${max} pro Einheit.`,
    target: 'Das Ziel muss kleiner sein als die Menge pro Tag.',
    date: 'Bitte ein Datum wählen.',
    future: 'Das Startdatum kann nicht in der Zukunft liegen.',
    tooOld: 'Bitte ein Datum in den letzten 5 Jahren wählen.',
    longAgo: (days: number) => `Das ist ${words.days(days)} her. Stimmt das? Alle Tage seither zählen als gut, solange du nichts nachträgst.`,
  },

  banner: {
    demo: 'Beispiel',
    demoNote: 'Beispieldaten werden nicht gespeichert.',
    demoAction: 'Eigene starten →',
    saveError: 'Speichern hat gerade nicht geklappt. Lade im Profil zur Sicherheit eine Sicherung herunter.',
    update: 'Neue Version da. Neu laden?',
    updateAction: 'Neu laden',
  },

  onboarding: {
    title: 'Was möchtest du weniger?',
    titleMore: 'Neue Gewohnheit',
    pickFirst: 'Tipp zuerst an, was du weniger möchtest.',
    adultNote: 'Weniger ist für Erwachsene. Mit «Los geht’s» bestätigst du, dass du 18 oder älter bist.',
    start: 'Los geht’s',
    example: 'Erst Beispiel ansehen',
    nameLabel: 'Wie heisst deine Gewohnheit?',
    namePlaceholder: 'z.B. Nägelkauen',
    perDay: (unit: string) => `${unit} an einem normalen Tag`,
    priceLabel: 'Was kostet eine Einheit?',
    priceHint: (hint: string) => `${hint}. Passe es an deinen Preis an.`,
    reduceLink: 'Lieber schrittweise reduzieren',
    quitLink: 'Doch lieber ganz aufhören',
    reduceWeeks: 'In wie vielen Wochen ans Ziel?',
    target: 'Ziel pro Tag am Ende',
    targetHint: 'Muss nicht 0 sein, z. B. 1 Tasse am Morgen.',
    alcoholHint: 'Bei viel Alkohol täglich zuerst mit Hausärztin, Hausarzt oder einer Fachstelle reden.',
    reduceHint: 'Am Anfang können Kopfschmerzen oder Reizbarkeit auftreten. Wenn es zu viel wird, darfst du eine Stufe verlängern.',
    startLabel: 'Seit wann?',
    startHint: 'Heute, oder ein Tag in der Vergangenheit, falls du schon angefangen hast.',
    restore: 'Sicherung laden',
    tileYear: (name: string, amount: string) => `${name}: rund CHF ${amount} im Jahr`,
    tileHours: (name: string, hours: string) => `${name}: rund ${hours} Stunden im Jahr`,
    reducePlan: (steps: string) => `Dein Plan pro Tag: ${steps}`,
    ahaEyebrow: 'In einem Jahr',
    ahaTitle: 'So viel holst du dir zurück',
    ahaUnits: (n: string, unit: string) => `und ${n} ${unit} weniger`,
    ahaHours: (days: number) => `Das sind rund ${words.days(days)} pro Jahr.`,
    ahaBasis: (perDay: string, unit: string, price: string | null) => `Gerechnet mit ${perDay} ${unit} pro Tag${price ? ` zu CHF ${price}` : ''}.`,
    whyLabel: 'Dein Warum (optional, nur für dich)',
    whyPlaceholder: 'z.B. Mehr Luft beim Velofahren',
    go: 'Jetzt starten',
    startedTitle: 'Los. Du bist dabei.',
    startedSince: (t: string) => `seit ${t}`,
    startedNote: 'Das war der schwierigste Schritt.',
    challengeTitle: (name: string, days: number) => `Challenge: ${words.days(days)} weniger ${name}`,
  },

  heute: {
    h1: 'Heute',
    addHabit: '＋ Gewohnheit',
    habits: 'Gewohnheiten',
    saved: 'Bisher gespart',
    timeBack: 'Zeit zurückgewonnen',
    avoided: 'Bisher vermieden',
    sinceQuit: (days: number, name: string) => `Seit ${words.daysDat(days)} ohne ${name}`,
    sinceReduce: (days: number) => `Seit ${words.daysDat(days)} im Plan`,
    streakZero: 'Heute ein Ausrutscher. Ab morgen zählt die Serie wieder.',
    streakZeroReduce: 'Heute über dem Plan. Ab morgen zählt die Serie wieder.',
    exactHint: 'Antippen für Sekunden',
    savedSpeech: (amount: string) => `${amount} gespart`,
    ringLabel: 'Fortschritt bis zum nächsten Meilenstein',
    nextMilestone: (label: string, left: number) => `Nächster Meilenstein: ${label}, noch ${words.days(left)}`,
    allMilestones: 'Alle Meilensteine erreicht',
    reduceToday: (n: string, max: string) => `Heute ${n} von höchstens ${max}`,
    plusOne: (unitOne: string) => `+1 ${unitOne}`,
    undoLast: 'Letzten Eintrag von heute rückgängig machen',
    planWeek: (week: number, weeks: number, max: string) => `${words.week(week)} von ${weeks} · heute höchstens ${max}`,
    planExtended: (week: number, until: string) => `${words.week(week)}, verlängert bis ${until}`,
    inPlan: (good: number, of: number) => `${good} von ${words.daysDat(of)} im Plan`,
    overLimit: 'Heute wird es mehr. Morgen ist ein neuer Tag, deine guten Tage bleiben.',
    checkinTitle: 'Wie geht’s dir heute?',
    moods: { 1: 'Zäh', 2: 'Geht gut', 3: 'Stark' } as Record<1 | 2 | 3, string>,
    checkinThanks: 'Danke fürs Einchecken.',
    checkinChange: 'Ändern',
    checkinChangeLabel: 'Stimmung von heute ändern',
    toughAsk: 'Willst du kurz etwas dagegen tun?',
    toughYes: 'Ja, gern',
    toughNo: 'Nein, danke',
    journalLabel: 'Ein Satz für dich (optional)',
    journalPlaceholder: 'Was hat heute geholfen?',
    journalSaved: 'Festgehalten.',
    sos: 'Schwierig gerade?',
    sosHint: 'Atmen, kurz bewegen, dein Warum, Hilfe',
    slipLink: 'Ausrutscher festhalten',
    strip: 'Letzte 14 Tage',
    stripHint: 'Tag antippen, um die Menge zu korrigieren.',
    dayLabel: (date: string, state: string) => `${date}: ${state}`,
    dayGood: 'guter Tag',
    dayMiss: 'kein guter Tag',
    dayRunning: 'läuft noch',
    stripSummary: (good: number, streak: number) => `${words.goodDays(good)} insgesamt · Serie ${words.days(streak)}`,
    stripSpeech: (good: number, of: number) => `In den letzten ${of} Tagen ${words.goodDays(good)}`,
    day1: 'Dein erster Tag läuft. Morgen ist das erste Feld gefüllt.',
    savingsLine: (name: string, left: string) => `${name}: noch CHF ${left}`,
    savingsDone: (name: string) => `${name}: geschafft`,
    toastSaved: 'Festgehalten. Weiter geht’s.',
    toastMoved: 'Verlangen überstanden. Gut gemacht.',
    toastCorrected: 'Korrigiert.',
    momentShare: 'Als Karte teilen',
    backupTitle: 'Zeit für eine Sicherung?',
    backupText: 'Deine Einträge liegen nur auf diesem Gerät. Eine Sicherung schützt sie, falls das Handy verloren geht.',
    backupGo: 'Zum Export',
    later: 'Später',
    installTitle: 'Weniger als App',
    installText: 'Dann startet Weniger wie eine App, auch offline.',
    installIos: 'Tippe unten auf «Teilen» und dann auf «Zum Home-Bildschirm».',
    installButton: 'Installieren',
    installLater: 'Nicht jetzt',
    challenge: (left: number, total: number) => `Challenge: noch ${words.days(left)} von ${total}`,
    challengeDone: 'Challenge geschafft.',
  },

  slip: {
    title: 'Passiert. Und jetzt?',
    eyebrow: 'Nur für dich, niemand sonst sieht das',
    text: 'Ein Ausrutscher ist kein Neustart bei null.',
    keep: (good: number) => (good > 1 ? `${words.goodDaysYour(good)} bleiben.` : good === 1 ? `${words.goodDaysYour(good)} bleibt.` : 'Alles, was du geschafft hast, bleibt.'),
    when: 'Wann?',
    howMany: (unit: string) => `Wie viele ${unit}?`,
    trigger: 'Was war los? (optional)',
    go: 'Weiter geht’s',
  },

  dayEdit: {
    title: (date: string) => date,
    howMany: (unit: string) => `${unit} an diesem Tag`,
    hint: 'Ersetzt alle Einträge dieses Tages.',
    save: 'Speichern',
  },

  triggers: ['Stress', 'Langeweile', 'Gesellschaft', 'Müdigkeit', 'Nach dem Essen', 'Anderes'],

  sos: {
    title: 'Ein paar Minuten nur für dich',
    eyebrow: 'Schwierig gerade?',
    breathe: 'Atmen',
    breatheHint: '60 Sekunden, dem Kreis folgen',
    move: 'Kurz bewegen',
    moveHint: '2 bis 3 Minuten, ganz locker',
    why: 'Dein Warum',
    whyHint: 'Wofür du das machst',
    plans: 'Wenn-dann-Pläne',
    plansHint: 'Was du dir vorgenommen hast',
    help: 'Fachstelle',
    helpHint: 'Reden kann entlasten. Vertraulich.',
    helpCall: (name: string, phone: string) => `${name} anrufen: ${phone}`,
    moveNote: 'Kurze Bewegung kann helfen. Probier es aus und schau, wie es dir danach geht.',
    noWhy: 'Du hast noch kein Warum notiert. Du kannst es in «Ziele» bei deiner Gewohnheit eintragen.',
    noPlans: 'Noch keine Wenn-dann-Pläne. Leg einen in «Ziele» an.',
  },

  breathe: {
    eyebrow: '60 Sekunden für dich',
    inhale: 'Einatmen',
    exhale: 'Ausatmen',
    done: 'Geschafft',
    guide: '4 Sekunden ein, 6 Sekunden aus.',
    after: 'Eine Minute nur für dich. Wie fühlt es sich jetzt an?',
    back: 'Zurück zu Heute',
    later: 'Später weiter',
  },

  move: {
    where: 'Wo bist du gerade?',
    places: { sitzend: 'Sitzend', stehend: 'Stehend', draussen: 'Draussen' } as Record<string, string>,
    safety: 'Hör auf bei Schmerz, Schwindel, Atemnot oder Druck auf der Brust. Bei Herz-, Lungen- oder anderen Erkrankungen vorher ärztlich abklären.',
    step: (i: number, n: number) => `Schritt ${i} von ${n}`,
    seconds: 'Sekunden',
    done: 'Geschafft',
    craving: 'Wie stark ist das Verlangen jetzt?',
    cravingLow: 'kaum',
    cravingHigh: 'sehr stark',
    log: 'Fertig, Verlangen überstanden',
    steps: {
      sitzend: ['Ruhig atmen, Schultern locker', 'Schultern kreisen, vorwärts und rückwärts', 'Arme nach oben strecken, langsam', 'Beine abwechselnd strecken'],
      stehend: ['Ruhig atmen, Füsse hüftbreit', 'Auf der Stelle gehen', 'Fersen heben und senken', 'Arme kreisen, gross und langsam'],
      draussen: ['Tür auf, ein paar tiefe Atemzüge', 'Zügig gehen, ohne Ziel', 'Langsamer werden und umschauen'],
    } as Record<string, string[]>,
  },

  sport: {
    h1: 'Sport',
    add: 'Training eintragen',
    last7: 'Letzte 7 Tage',
    ofGoal: (goal: number) => `von ${words.minutes(goal)}`,
    weekGoalReached: 'Wochenziel erreicht. Ruhe zählt jetzt auch.',
    weekStart: (last: string, reached: boolean) => `Neue Woche, frischer Start. Letzte Woche: ${last}${reached ? ' ✓' : ''}`,
    remaining: (min: number) => `Noch ${words.minutes(min)} bis zum Wochenziel.`,
    firstSteps: 'Jede Minute zählt. Ein Spaziergang auch.',
    restToday: 'Heute Ruhetag',
    restSaved: 'Ruhetag eingetragen. Erholung gehört dazu.',
    highLoad: 'Heute schon über 3 Stunden. Gönn dir auch Erholung.',
    dots: (active: number, rest: number) => `${plural(active, 'aktiver Tag', 'aktive Tage')}, ${plural(rest, 'Ruhetag', 'Ruhetage')}`,
    sinceQuit: (name: string) => `Seit du weniger ${name}`,
    sinceQuitText: (n: number, craving: number) => `${words.trainings(n)}${craving > 0 ? ` und ${craving}× Verlangen überstanden` : ''}`,
    history: 'Letzte 8 Wochen',
    goalLink: (goal: number) => `Wochenziel: ${words.minutes(goal)}`,
    goalLabel: 'Wochenziel in Minuten',
    goalLine: 'Wochenziel',
    who: 'Orientierung: Die WHO nennt für Erwachsene 150 bis 300 Minuten moderate Bewegung pro Woche. Du kannst dein Wochenziel anpassen.',
    source: 'Quelle',
    records: 'Rekorde',
    longest: 'längstes Training',
    bestWeek: 'beste Woche',
    recent: 'Zuletzt',
    nothing: 'Noch nichts eingetragen. Ein Spaziergang zählt auch.',
    rest: 'Ruhetag',
    removeLabel: (name: string) => `${name} löschen`,
    removed: 'Eintrag gelöscht.',
    saved: (sport: string, minutes: string) => `${sport}, ${minutes} eingetragen.`,
    weekReached: 'Wochenziel erreicht. Stark, und Ruhe zählt jetzt auch.',
    sheetTitle: 'Training eintragen',
    again: 'Wie letztes Mal',
    sportLabel: 'Sportart',
    duration: 'Dauer',
    minus5: '5 Minuten weniger',
    plus5: '5 Minuten mehr',
    when: 'Wann',
    today: 'Heute',
    yesterday: 'Gestern',
    day: 'Tag',
    duplicate: 'Diesen Eintrag gibt es an diesem Tag schon (gleiche Sportart und Dauer). Nochmals tippen, um ihn trotzdem zu speichern.',
    restBlocked: 'Heute hast du schon trainiert. Ruhetag und Training am selben Tag schliessen sich aus.',
    more: 'Mehr Angaben (optional)',
    distance: 'Distanz in Kilometern',
    distancePlaceholder: 'z.B. 5.2',
    effort: 'Anstrengung',
    efforts: { 1: 'locker', 2: 'mittel', 3: 'streng' } as Record<1 | 2 | 3, string>,
    feeling: 'Wie fühlst du dich danach?',
    feelings: { 1: 'Leer', 2: 'Okay', 3: 'Gut', 4: 'Stark' } as Record<1 | 2 | 3 | 4, string>,
    km: (n: string) => `${n} km`,
    minutesUnit: (n: number) => (n === 1 ? 'Minute' : 'Minuten'),
  },

  ziele: {
    h1: 'Ziele',
    total: 'Insgesamt gespart',
    compare: (count: number, thing: [string, string]) => (count === 1 ? `Das ist schon ${thing[0]}.` : `Das sind schon ${count} ${thing[1]}.`),
    habits: 'Deine Gewohnheiten',
    add: '＋ Gewohnheit',
    quit: 'Ganz aufhören',
    reduce: 'Schrittweise reduzieren',
    goodDays: 'gute Tage',
    saved: 'gespart',
    avoided: (unit: string) => `${unit} vermieden`,
    bestStreak: 'längste Serie',
    plan: 'Reduktionsplan',
    planText: (before: string, steps: string[]) => `bisher ${before} pro Tag → ${steps.join(' → ')}`,
    planStep: (week: number, max: string) => `${words.week(week)}: höchstens ${max}`,
    planNow: (week: number) => `Du bist in ${words.week(week)}.`,
    extend: 'Stufe verlängern',
    extendHint: 'Hält deine jetzige Stufe ab heute 7 Tage länger. Höchstens einmal pro Woche.',
    extendDone: (until: string) => `Verlängert bis ${until}.`,
    extendWait: (from: string) => `Wieder möglich ab ${from}.`,
    extendLast: 'Du bist in der letzten Stufe.',
    target: 'Ziel pro Tag am Ende',
    targetHint: 'Muss nicht 0 sein.',
    why: 'Dein Warum',
    whyEmpty: 'Noch kein Warum. Wofür machst du das?',
    edit: 'Bearbeiten',
    perDayBefore: 'Menge pro Tag (normal)',
    price: 'Preis pro Einheit (CHF)',
    editTitle: (name: string) => `${name} bearbeiten`,
    rateHint: 'Neue Menge und neuer Preis gelten ab heute. Was vorher war, bleibt.',
    retro: 'Rückwirkend korrigieren (Tippfehler)',
    retroHint: 'Ändert die Werte auch für die Tage, an denen sie schon galten.',
    preview: (before: string, after: string) => `Gespart: vorher CHF ${before}, neu CHF ${after}`,
    rateHistory: 'Bisherige Werte',
    rateFrom: (date: string, perDay: string, price: string) => `ab ${date}: ${perDay} pro Tag zu CHF ${price}`,
    startDate: 'Startdatum',
    deleteHabit: 'Gewohnheit löschen',
    deleteConfirm: 'Wirklich löschen? Einträge, Check-ins und Meilensteine dieser Gewohnheit gehen mit.',
    deleteYes: 'Ja, löschen',
    pots: 'Sparziele',
    potsHint: 'Dein Gespartes füllt die Sparziele der Reihe nach.',
    potLeft: (left: string) => `noch CHF ${left}`,
    potDone: 'geschafft',
    potOf: (amount: string) => `von CHF ${amount}`,
    potUp: (name: string) => `${name} nach oben`,
    potDown: (name: string) => `${name} nach unten`,
    potRemove: (name: string) => `${name} entfernen`,
    potName: 'Wofür sparst du?',
    potNamePlaceholder: 'z.B. Laufschuhe',
    potAmount: 'Betrag in CHF',
    potAdd: 'Sparziel hinzufügen',
    potNew: '+ Sparziel',
    potNameMissing: 'Bitte einen Namen eingeben.',
    potAmountInvalid: 'Bitte einen Betrag zwischen CHF 1 und 1’000’000 eingeben.',
    potEmpty: 'Ein Konzertticket, neue Laufschuhe, ein Wochenende weg?',
    badges: 'Meilensteine',
    badgesHint: 'Tage zählen deine längste Serie. Fällt ein Wert durch eine Korrektur unter die Grenze, wird später wieder gefeiert.',
    patterns: 'Deine Muster',
    patternsPrivate: 'Nur für dich, aus deinen Ausrutschern und deinem Verlangen.',
    patternsEmpty: 'Noch zu wenig Einträge für ein Muster. Das ist eine gute Nachricht.',
    plans: 'Wenn-dann-Pläne',
    plansHint: 'Ein Plan für den Moment, in dem es schwierig wird.',
    planWhen: 'Wenn …',
    planThen: 'dann …',
    planAdd: 'Plan speichern',
    planNew: '+ Wenn-dann-Plan',
    planRemove: 'Plan löschen',
    planSuggest: 'Vorschläge aus deinen Auslösern',
    challenge: 'Fordere einen Freund heraus',
    challengeText: 'Schick einen Link. Dein Freund startet die Challenge auf seinem eigenen Handy, ohne Konto.',
    challengeDays: 'Wie lange?',
    challengeShare: 'Link teilen',
    challengeCopied: 'Link kopiert.',
    challengeSoon: 'Der Link folgt, sobald Weniger veröffentlicht ist.',
    challengeMessage: (name: string, days: number, url: string) => `Machst du mit? ${words.days(days)} weniger ${name}, mit der App Weniger: ${url}`,
  },

  profil: {
    h1: 'Profil',
    help: 'Hilfe',
    helpText: 'Weniger ist ein Tagebuch, keine Therapie. Fachstellen sind kostenlos und vertraulich für dich da:',
    safezone: 'SafeZone.ch',
    safezoneText: 'Anonyme Online-Suchtberatung, unterstützt vom BAG',
    stopline: 'Rauchstopplinie',
    stoplinePhone: '0848 000 181',
    stoplineWeb: 'stopsmoking.ch',
    open: 'Öffnen',
    phone: 'Telefon',
    settings: 'Einstellungen',
    fx: 'Effekte',
    fxHint: 'An: Lichtspiel und Funken. Aus: keine Bewegung. Automatisch richtet sich nach deinem Gerät und deinen Einstellungen.',
    fxChoices: { auto: 'Automatisch', hoch: 'An', mittel: 'Ruhig', tief: 'Aus' },
    fxAuto: (level: string) => `Automatisch heisst auf diesem Gerät: ${level}`,
    weeklyReview: 'Wochenrückblick am Montag',
    weeklyReviewHint: 'Eine Karte mit deiner letzten Woche',
    install: 'Als App installieren',
    installHint: 'Weniger auf dem Startbildschirm, auch offline.',
    data: 'Daten',
    dataText: 'Alles bleibt auf diesem Gerät. Kein Konto, kein Tracking. Handy weg heisst Daten weg, ausser du lädst eine Sicherung herunter.',
    backup: 'Sicherung herunterladen',
    backupText: 'Sicherung als Text',
    backupCopied: 'Sicherung erstellt und in die Zwischenablage kopiert.',
    backupManual: 'Sicherung erstellt. Falls keine Datei kommt: Text unten markieren und aufbewahren.',
    restore: 'Sicherung laden',
    tileYear: (name: string, amount: string) => `${name}: rund CHF ${amount} im Jahr`,
    tileHours: (name: string, hours: string) => `${name}: rund ${hours} Stunden im Jahr`,
    restorePaste: 'Oder Sicherung hier einfügen',
    restorePasteGo: 'Eingefügte Sicherung laden',
    imported: (dropped: number) =>
      `Sicherung geladen.${dropped === 1 ? ' 1 ungültiger Eintrag wurde weggelassen.' : dropped > 1 ? ` ${dropped} ungültige Einträge wurden weggelassen.` : ''}`,
    importErrors: {
      tooBig: 'Diese Sicherung ist grösser als 2 MB.',
      invalid: 'Dieser Text ist keine gültige Sicherung.',
      foreign: 'Das ist keine Sicherung aus Weniger.',
      noHabit: 'In dieser Sicherung ist keine gültige Gewohnheit.',
    },
    csv: 'Tage als CSV',
    csvTrainings: 'Trainings als CSV',
    export: 'Export',
    exportTitle: 'Was möchtest du exportieren?',
    exportJson: 'Sicherung (alles, zum Wiederherstellen)',
    exportGo: 'Exportieren',
    exportNone: 'Bitte mindestens eine Datei wählen.',
    restorePreview: (goals: number, goodDays: number) => `${plural(goals, 'Gewohnheit', 'Gewohnheiten')}, ${words.goodDays(goodDays)} – ersetzen?`,
    restoreWarn: 'Deine jetzigen Daten auf diesem Gerät werden dabei ersetzt.',
    restoreYes: 'Ersetzen',
    wipe: 'Alle Daten löschen',
    wipeText: 'Alle Gewohnheiten, Tage und Trainings werden auf diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.',
    wipeYes: 'Alles löschen',
    about: 'Über Weniger',
    aboutText: 'Für Erwachsene ab 18. Keine Heilversprechen. Bei gesundheitlichen Fragen: Hausärztin, Hausarzt oder eine Fachstelle.',
    privacy: 'Datenschutz',
    imprint: 'Impressum',
  },

  desktop: {
    title: 'Weniger auf dem Handy',
    text: 'Weniger ist für unterwegs gemacht. Scanne den Code und öffne die App auf deinem Handy, oder probier sie hier im Rahmen aus.',
    points: ['Live sehen, wie viel du sparst', 'Notfall-Knopf, wenn es schwierig wird', 'Alles bleibt auf deinem Gerät'],
    qrAlt: 'QR-Code zur App',
    linkSoon: 'Link folgt',
  },

  milestones: {
    days: (n: number) => (n === 365 ? '1 Jahr' : words.days(n)),
    text: {
      1: 'Dein erster guter Tag. Der Anfang ist gemacht.',
      7: 'Eine Woche. Das ist mehr als ein Anfang.',
      30: 'Ein Monat. Schau mal, wie viel du gespart hast.',
      100: '100 Tage. Das trägt.',
      365: 'Ein Jahr. Du hast es durchgezogen.',
    } as Record<number, string>,
    money: (n: number) => `CHF ${n} gespart. Das ist echtes Geld.`,
    craving: 'Verlangen überstanden. Gut gemacht.',
  },

  badges: {
    days: (n: number) => (n === 365 ? '1 Jahr' : words.days(n)),
    money: (n: number) => `CHF ${n}`,
    craving: 'Verlangen überstanden',
    locked: 'noch offen',
  },

  things,

  csv: {
    days: ['Datum', 'Gewohnheit', 'Menge', 'Höchstens', 'Guter Tag', 'Stimmung'],
    workouts: ['Datum', 'Sportart', 'Minuten', 'Distanz km', 'Anstrengung', 'Ruhetag'],
    yes: 'ja',
    no: 'nein',
    running: 'läuft',
  },

  review: {
    title: 'Deine letzte Woche',
    line: (name: string, good: number, of: number, reduce: boolean) => `${name}: ${good} von ${of}${reduce ? ' im Plan' : ''}`,
    lines: (parts: string[]) => parts.join(' · '),
    saved: 'gespart',
    training: 'Bewegung',
    share: 'Teilen',
    dismiss: 'Ausblenden',
    off: 'Den Rückblick kannst du im Profil ausschalten.',
  },

  patternsText: {
    parts: { morgen: 'am Morgen', mittag: 'über Mittag', nachmittag: 'am Nachmittag', abend: 'am Abend', nacht: 'in der Nacht' } as Record<string, string>,
    weekdays: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
    weekdaysShort: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    trigger: 'Häufigster Auslöser',
    part: 'Tageszeit',
    weekday: 'Wochentag',
    times: (n: number) => `${n}×`,
    basis: (n: number) => `Aus ${n} Einträgen. Nur auf diesem Gerät.`,
    none: 'kein klares Muster',
  },

  // Wenn-dann-Pläne: Vorschläge je Auslöser
  planIdeas: {
    when: {
      Stress: 'Wenn ich Stress habe',
      Langeweile: 'Wenn mir langweilig ist',
      Gesellschaft: 'Wenn andere konsumieren',
      Müdigkeit: 'Wenn ich müde bin',
      'Nach dem Essen': 'Nach dem Essen',
      Anderes: 'Wenn das Verlangen kommt',
    } as Record<string, string>,
    then: {
      Stress: 'atme ich eine Minute ruhig durch',
      Langeweile: 'gehe ich fünf Minuten raus',
      Gesellschaft: 'bestelle ich etwas ohne',
      Müdigkeit: 'trinke ich ein grosses Glas Wasser',
      'Nach dem Essen': 'putze ich die Zähne',
      Anderes: 'drücke ich «Schwierig gerade?»',
    } as Record<string, string>,
    joined: (when: string, then: string) => `${when}, dann ${then}.`,
  },

  share: {
    open: 'Teilen',
    title: 'Teilen-Karte',
    preview: 'Nur das siehst du im Bild. Sonst wird nichts geteilt.',
    format: 'Format',
    story: 'Story (9:16)',
    square: 'Quadrat (1:1)',
    showHabit: 'Gewohnheit zeigen',
    showAmount: 'Betrag zeigen',
    showDays: 'Gute Tage zeigen',
    go: 'Bild teilen',
    download: 'Bild herunterladen',
    headline: 'Ich mache weniger.',
    days: (n: number) => words.goodDays(n),
    habit: (name: string) => `weniger ${name}`,
    amount: (chf: string) => `CHF ${chf} gespart`,
    reviewHeadline: 'Meine Woche',
    footer: 'Weniger · Gewohnheiten loswerden',
    done: 'Bild bereit.',
  },

  templates: {
    zig: { name: 'Zigaretten', unit: 'Zigaretten', unitOne: 'Zigarette', question: 'Wie viele Zigaretten an einem normalen Tag?', priceHint: 'Pro Zigarette, grob geschätzt' },
    snus: { name: 'Snus', unit: 'Portionen', unitOne: 'Portion', question: 'Wie viele Portionen Snus an einem normalen Tag?', priceHint: 'Pro Portion, grob geschätzt' },
    vape: { name: 'Vape', unit: 'Vapes', unitOne: 'Vape', question: 'Wie viele Einweg-Vapes oder Pods an einem normalen Tag?', priceHint: 'Pro Vape oder Pod' },
    mate: { name: 'Mate', unit: 'Mate', unitOne: 'Mate', question: 'Wie viele Mate an einem normalen Tag?', priceHint: 'Pro Flasche' },
    energy: { name: 'Energy', unit: 'Dosen', unitOne: 'Dose', question: 'Wie viele Dosen Energy an einem normalen Tag?', priceHint: 'Pro Dose' },
    kaffee: { name: 'Kaffee', unit: 'Tassen', unitOne: 'Tasse', question: 'Wie viele Tassen Kaffee an einem normalen Tag?', priceHint: 'Pro Tasse, zuhause eher weniger' },
    zucker: { name: 'Süsses', unit: 'Süssigkeiten', unitOne: 'Süssigkeit', question: 'Wie viele Süssigkeiten oder Süssgetränke an einem normalen Tag?', priceHint: 'Pro Stück oder Flasche' },
    alkohol: { name: 'Alkohol', unit: 'Getränke', unitOne: 'Getränk', question: 'Wie viele alkoholische Getränke an einem normalen Tag?', priceHint: 'Pro Getränk' },
    social: { name: 'Social Media', unit: 'Stunden', unitOne: 'Stunde', question: 'Wie viele Stunden Social Media an einem normalen Tag?', priceHint: '' },
    eigene: { name: 'Eigene', unit: 'Mal', unitOne: 'Mal', question: 'Wie oft an einem normalen Tag?', priceHint: 'Falls es etwas kostet' },
  } as Record<string, { name: string; unit: string; unitOne: string; question: string; priceHint: string }>,

  sports: {
    laufen: 'Laufen',
    velo: 'Velo',
    wandern: 'Wandern',
    gehen: 'Spazieren',
    schwimmen: 'Schwimmen',
    kraft: 'Kraft',
    fussball: 'Fussball',
    unihockey: 'Unihockey',
    ski: 'Ski/Board',
    langlauf: 'Langlauf',
    klettern: 'Bouldern',
    yoga: 'Yoga',
    bewegung: 'Kurz bewegt',
    andere: 'Anderes',
  } as Record<string, string>,
};

export type AppTexts = typeof app;

// ---------- Rechtliches (vorgerenderte Seiten /datenschutz und /impressum) ----------

/** Platzhalter: vor dem Veröffentlichen ausfüllen, nie raten. */
/** Installierte App: Manifest, Kurzbefehle und Update-Hinweis */
export const pwa = {
  name: 'Weniger',
  description: 'Gewohnheiten loswerden, Geld sparen, in Bewegung bleiben. Alles bleibt auf deinem Gerät.',
  shortcuts: {
    checkin: { name: 'Check-in', description: 'Wie geht’s dir heute?' },
    training: { name: 'Training', description: 'Training eintragen' },
  },
  screenshots: {
    heute: 'Heute: bisher gespart, Serie und Check-in',
    sos: 'Hilfe in schwierigen Momenten',
    ziele: 'Sparziele und Wenn-dann-Pläne',
    sport: 'Sport: Wochenziel und Trainings',
    desktop: 'Weniger auf dem Computer',
  },
  update: { text: 'Neue Version da. Neu laden?', reload: 'Neu laden', later: 'Später' },
};

export const TODO = '[[BITTE AUSFÜLLEN]]';

export const legal = {
  site: 'Weniger',
  back: 'Zur Startseite',
  notFound: {
    title: 'Seite nicht gefunden',
    description: 'Diese Adresse gibt es bei Weniger nicht.',
    text: 'Diese Adresse gibt es nicht. Deine Einträge sind davon nicht betroffen, sie liegen in der App auf deinem Gerät.',
  },
  openApp: 'App öffnen',
  footer: { privacy: 'Datenschutz', imprint: 'Impressum', contact: 'Kontakt', made: 'Ein Projekt von Gian und Matteo aus Bern', help: 'Hilfe: SafeZone.ch und Rauchstopplinie 0848 000 181' },
  imprint: {
    title: 'Impressum',
    description: 'Impressum von Weniger.',
    sections: [
      { h: 'Verantwortlich', p: [`Name: ${TODO}`, `Ort: ${TODO}`, `E-Mail: ${TODO}`] },
      { h: 'Ein Projekt von Gian und Matteo aus Bern', p: ['Weniger ist ein privates Projekt und kostenlos. Es gibt keine Werbung und kein Konto.'] },
      {
        h: 'Kein Ersatz für Beratung',
        p: [
          'Weniger ist ein Tagebuch, keine Therapie. Die App macht keine Heilversprechen und gibt keine medizinischen Ratschläge.',
          'Hilfe bekommst du kostenlos und vertraulich bei SafeZone.ch (Online-Suchtberatung) und bei der Rauchstopplinie 0848 000 181 (stopsmoking.ch).',
        ],
      },
      { h: 'Links zu anderen Seiten', p: ['Für Inhalte von verlinkten Seiten sind deren Betreiberinnen und Betreiber verantwortlich.'] },
    ],
  },
  privacy: {
    title: 'Datenschutz',
    description: 'Datenschutzerklärung von Weniger: Alles bleibt auf deinem Gerät. Kein Konto, kein Tracking in der App.',
    intro: 'Kurz gesagt: Deine Einträge bleiben auf deinem Gerät. Wir sehen sie nie. Kein Konto, kein Tracking in der App.',
    sections: [
      { h: 'Verantwortlich', p: [`Name: ${TODO}`, `Ort: ${TODO}`, `E-Mail: ${TODO}`] },
      {
        h: 'Deine Daten in der App',
        p: [
          'Gewohnheiten, Einträge, Check-ins, Trainings und Notizen speichert die App nur im Speicher deines Browsers auf deinem Gerät (IndexedDB). Sie werden nie an uns oder andere übertragen.',
          'Handy weg heisst Daten weg, ausser du lädst im Profil eine Sicherung herunter. Die Sicherung ist eine Datei, die nur du hast.',
          'Löschen kannst du alles jederzeit im Profil unter «Alle Daten löschen» oder indem du die Websitedaten im Browser löschst.',
        ],
      },
      {
        h: 'Teilen und Challenge-Links',
        p: [
          'Teilen-Karten entstehen auf deinem Gerät. Du siehst vorher genau, was im Bild steht. Ausrutscher, Notizen und Auslöser sind nie darauf. Die App selbst verschickt nichts.',
          'Ein Challenge-Link enthält nur die Gewohnheit und die Anzahl Tage, zum Beispiel «mate-30». Keine Namen, keine Einträge, nichts über dich.',
        ],
      },
      { h: 'Keine externen Dienste in der App', p: ['Die App lädt nichts von fremden Servern: keine Werbung, kein Tracking, keine Schriftdienste, keine Karten.'] },
      {
        h: 'Hosting',
        p: [`Die Website wird bei ${TODO} (Hosting-Anbieter) betrieben. Beim Aufruf verarbeitet der Anbieter technisch nötige Angaben wie IP-Adresse, Zeitpunkt und Browser in Server-Protokollen (Logs), um die Seite auszuliefern und vor Missbrauch zu schützen.`],
      },
      {
        h: 'Reichweitenmessung auf der Startseite',
        p: [
          'Nur auf der Startseite, nicht in der App, und nur falls eingeschaltet: Cloudflare Web Analytics zählt ohne Cookies, wie oft die Seite aufgerufen wird. Es entstehen keine Profile. Ist die Messung ausgeschaltet, wird nichts gezählt.',
        ],
      },
      { h: 'Schriften', p: ['Die Schriften liegen auf unserem Server. Es gibt keine Verbindung zu Google Fonts oder anderen Schriftdiensten.'] },
      { h: 'Deine Rechte', p: ['Du kannst nach dem Datenschutzgesetz Auskunft, Berichtigung und Löschung verlangen. Weil die App-Daten nur auf deinem Gerät liegen, haben wir keine Einträge von dir.'] },
      { h: 'Stand', p: [TODO] },
    ],
  },
};

// ---------- Landingpage (vorgerendert, plus kleiner Rechner im Browser) ----------

export interface CalcItem {
  key: string;
  chip: string;
  /** «Was kostet dich dein Mate im Jahr?» */
  your: string;
  unit: string;
  perDayLabel: string;
  priceLabel: string;
}

const calcItems: CalcItem[] = [
  { key: 'mate', chip: 'Mate', your: 'dein Mate', unit: 'Flaschen', perDayLabel: 'Flaschen pro Tag', priceLabel: 'Preis pro Flasche' },
  { key: 'snus', chip: 'Snus', your: 'dein Snus', unit: 'Portionen', perDayLabel: 'Portionen pro Tag', priceLabel: 'Preis pro Portion' },
  { key: 'vape', chip: 'Vape', your: 'dein Vape', unit: 'Vapes', perDayLabel: 'Vapes oder Pods pro Tag', priceLabel: 'Preis pro Vape oder Pod' },
  { key: 'energy', chip: 'Energy', your: 'dein Energy', unit: 'Dosen', perDayLabel: 'Dosen pro Tag', priceLabel: 'Preis pro Dose' },
  { key: 'zig', chip: 'Zigaretten', your: 'deine Zigaretten', unit: 'Zigaretten', perDayLabel: 'Zigaretten pro Tag', priceLabel: 'Preis pro Zigarette' },
  { key: 'kaffee', chip: 'Kaffee', your: 'dein Kaffee', unit: 'Tassen', perDayLabel: 'Tassen pro Tag', priceLabel: 'Preis pro Tasse' },
  { key: 'alkohol', chip: 'Alkohol', your: 'dein Alkohol', unit: 'Getränke', perDayLabel: 'Getränke pro Tag', priceLabel: 'Preis pro Getränk' },
];

export interface CalcPage {
  slug: string;
  preset: string;
  title: string;
  description: string;
  intro: string;
}

export const landing = {
  title: 'Weniger – Mate, Snus und Vape reduzieren, Geld sparen | Gratis-App',
  description: 'Rechne aus, was dich Mate, Snus, Vape oder Energy im Jahr kosten, und sieh live, wie viel du sparst. Gratis, ohne Konto, alles bleibt auf deinem Handy.',
  appName: 'Weniger',
  nav: { how: 'So funktioniert’s', features: 'Funktionen', faq: 'Fragen', open: 'App öffnen', label: 'Seitennavigation' },
  hero: {
    eyebrow: 'Gratis · ohne Konto · ab 18',
    title: 'Weniger. Und du siehst, was es bringt.',
    lead: 'Mate, Snus, Vape, Alkohol oder Social Media: Sieh live, wie viel du sparst. Ohne Konto, deine Daten bleiben auf deinem Handy.',
    open: 'App öffnen',
    example: 'Beispiel ansehen',
    scan: 'Mit dem Handy scannen',
    linkSoon: 'Link folgt',
    calcTitle: 'Rechne selbst',
    question: (your: string) => `Was kostet dich ${your} im Jahr?`,
    pick: 'Was möchtest du weniger?',
    perDay: 'pro Tag',
    less: 'Weniger pro Tag',
    more: 'Mehr pro Tag',
    priceCurrency: 'CHF',
    resultLabel: 'Im Jahr',
    resultSpeech: (amount: string) => `Im Jahr ${amount}`,
    perMonth: (amount: string) => `CHF ${amount} pro Monat`,
    perYear: (amount: string) => `CHF ${amount} pro Jahr`,
    startWith: 'Mit diesen Werten starten',
    shareResult: 'Ergebnis teilen',
    shareText: (habit: string, year: string) => `${habit} kostet mich rund CHF ${year} im Jahr. Rechne selbst:`,
    shared: 'Link kopiert.',
    compare: (count: number, thing: [string, string]) => `= ${count === 1 ? thing[0] : `${count} ${thing[1]}`}`,
    note: 'Grobe Startwerte. Passe Menge und Preis an deinen Alltag an.',
    cta: 'Kostenlos starten, ohne Konto',
    ctaSub: 'Läuft im Browser. Kein App Store, keine Anmeldung.',
    phoneTitle: 'Die App Weniger mit Beispieldaten',
    phoneLabel: 'Echte App, mit Beispieldaten',
  },
  calc: calcItems,
  how: {
    title: 'So funktioniert’s',
    steps: [
      { img: 'start', h: 'Wählen', p: 'Tipp an, was du weniger möchtest, und gib Menge und Preis ein. Ganz aufhören oder Schritt für Schritt reduzieren.' },
      { img: 'heute', h: 'Zuschauen', p: 'Weniger zählt live mit, wie viel du sparst und wie viele gute Tage du schon hast.' },
      { img: 'sos', h: 'Dranbleiben', p: 'Einmal am Tag einchecken. Wenn es schwierig wird: der Notfall-Knopf.' },
    ],
    alt: (h: string) => `Bildschirm der App beim Schritt «${h}»`,
  },
  features: {
    title: 'Was Weniger kann',
    items: [
      { img: 'sos', h: 'Notfall-Knopf', p: 'Eine Minute atmen, kurz bewegen, dein Warum lesen oder eine Fachstelle anrufen.' },
      { img: 'ziele', h: 'Sparziele', p: 'Laufschuhe, Konzert, Wochenende in den Bergen: dein Gespartes füllt sie der Reihe nach.' },
      { img: 'sport', h: 'Sport', p: 'Trainings eintragen, Wochenziel sehen, Ruhetage zählen auch. Ohne Druck.' },
      { img: 'rueckblick', h: 'Wochenrückblick', p: 'Am Montag ein kurzer Blick auf die letzte Woche, pro Gewohnheit.' },
      { img: 'teilen', h: 'Teilen-Karte', p: 'Ein Bild für deine Story, wenn du willst. Du wählst, was draufsteht. Ausrutscher nie.' },
    ],
    alt: (h: string) => `Bildschirm der App: ${h}`,
  },
  trust: {
    title: 'Deine Daten gehören dir',
    points: [
      'Kein Konto. Deine Einträge bleiben auf deinem Gerät, wir sehen sie nie.',
      'Kein Tracking in der App.',
      'Für Erwachsene ab 18.',
      'Weniger ist ein Tagebuch, keine Therapie.',
    ],
    helpTitle: 'Hilfe, kostenlos und vertraulich',
    help: [
      { name: 'SafeZone.ch', text: 'Anonyme Online-Suchtberatung', href: 'https://www.safezone.ch' },
      { name: 'Rauchstopplinie 0848 000 181', text: 'stopsmoking.ch', href: 'https://www.stopsmoking.ch' },
    ],
  },
  faq: {
    title: 'Fragen',
    items: [
      { q: 'Kostet es etwas?', a: 'Nein. Kein Abo, keine Werbung, kein Konto. Du öffnest die App im Browser und legst los.' },
      { q: 'Wo sind meine Daten?', a: 'Nur auf deinem Gerät. Wir haben keinen Server für deine Einträge und sehen sie nie. Im Profil kannst du eine Sicherung als Datei herunterladen.' },
      { q: 'Was passiert bei einem Ausrutscher?', a: 'Du hältst ihn fest, wenn du willst. Deine guten Tage bleiben, nur die Serie beginnt neu.' },
      { q: 'Muss ich ganz aufhören?', a: 'Nein. Du kannst auch Schritt für Schritt reduzieren. Weniger macht dir einen Wochenplan, zum Beispiel von 4 auf 3, dann 2, dann 1 pro Tag. Das Ziel wählst du selbst.' },
      { q: 'Ersetzt die App eine Beratung?', a: 'Nein. Weniger ist ein Tagebuch, keine Therapie. Hilfe findest du kostenlos und vertraulich bei SafeZone.ch und bei der Rauchstopplinie 0848 000 181.' },
      { q: 'Warum ab 18?', a: 'Weniger ist für Erwachsene gemacht. Für Jugendliche gibt es eigene Angebote, zum Beispiel bei SafeZone.ch.' },
    ],
  },
  install: {
    title: 'Als App installieren',
    intro: 'Weniger braucht keinen App Store. So legst du es auf deinen Startbildschirm:',
    tabs: { iphone: 'iPhone', android: 'Android' },
    iphone: ['Öffne die App in Safari.', 'Tippe unten auf «Teilen».', 'Wähle «Zum Home-Bildschirm».'],
    android: ['Öffne die App in Chrome.', 'Tippe oben rechts auf das Menü (⋮).', 'Wähle «App installieren».'],
    button: 'Jetzt installieren',
  },
  final: {
    title: 'Starte heute. Morgen hast du schon gespart.',
    qr: 'Mit dem Handy scannen und direkt starten',
    qrAlt: 'QR-Code zur App',
  },
  pages: [
    {
      slug: 'snus-kosten-rechner',
      preset: 'snus',
      title: 'Snus-Kosten-Rechner: Was kostet dich Snus im Jahr? | Weniger',
      description: 'Rechne aus, wie viel Geld du im Jahr für Snus ausgibst. Mit Weniger siehst du live, wie viel du sparst, wenn du reduzierst. Gratis, ohne Konto.',
      intro: 'Portionen pro Tag mal Preis mal 365: so viel kostet dich Snus im Jahr. Mit Weniger siehst du jeden Tag, was davon bei dir bleibt.',
    },
    {
      slug: 'vape-kosten-rechner',
      preset: 'vape',
      title: 'Vape-Kosten-Rechner: Was kostet dich Vapen im Jahr? | Weniger',
      description: 'Rechne aus, wie viel Geld du im Jahr für Einweg-Vapes oder Pods ausgibst, und sieh mit Weniger live, wie viel du sparst. Gratis, ohne Konto.',
      intro: 'Wie viele Vapes oder Pods brauchst du an einem normalen Tag? Der Rechner zeigt dir, was das im Jahr ausmacht.',
    },
    {
      slug: 'mate-kosten-rechner',
      preset: 'mate',
      title: 'Mate-Kosten-Rechner: Was kostet dich Mate im Jahr? | Weniger',
      description: 'Rechne aus, wie viel Geld du im Jahr für Mate ausgibst. Mit Weniger siehst du live, wie viel du sparst. Gratis, ohne Konto.',
      intro: 'Eine Flasche hier, eine dort: Rechne aus, was dich Mate im Jahr kostet, und schau mit Weniger zu, wie dein Erspartes wächst.',
    },
    {
      slug: 'energydrink-kosten-rechner',
      preset: 'energy',
      title: 'Energy-Drink-Kosten-Rechner: Was kosten dich Energy Drinks im Jahr? | Weniger',
      description: 'Rechne aus, wie viel Geld du im Jahr für Energy Drinks ausgibst, und sieh mit Weniger live, wie viel du sparst. Gratis, ohne Konto.',
      intro: 'Dosen pro Tag mal Preis mal 365: Rechne aus, was dich Energy Drinks im Jahr kosten.',
    },
  ] as CalcPage[],
  calcLinks: 'Weitere Rechner',
  calcLinkLabel: (chip: string) => `${chip}-Kosten-Rechner`,
  schemaDescription: 'Gratis-App, um Mate, Snus, Vape, Energy und andere Gewohnheiten zu reduzieren und live zu sehen, wie viel Geld du sparst. Alle Daten bleiben auf dem Gerät.',
};
