type SongSection = { title: string; chorus?: boolean; lines: string[] };
type Song = { label: string; name: string; title: string; sections: SongSection[] };

const ltChorus = [
  "Ar matai? Ar girdi?",
  "Atsiliepk širdimi.",
  "Lyg šviesa, žiburys nakty",
  "Šviečia mums tiesa – tiesa ryški.",
];

const lvChorus = [
  "Vārdus šos uzklausām,",
  "sirdi tiem atdarām,",
  "tāpēc mēs esam laimīgi —",
  "”mūsu acis redz un ausis dzird”.",
];

const ruChorus = [
  "Бог глаза мне открыл,",
  "Светом жизнь озарил,",
  "Указал путь к свободе мне.",
  "Как же счастлив я, что вижу свет!",
];

export const SECOND_COMMON_SONGS: Record<"lt" | "lv" | "ru", Song> = {
  lt: {
    label: "LT",
    name: "Lietuvių",
    title: "Laimingos akys, reginčios tave",
    sections: [
      {
        title: "1.",
        lines: [
          "Ten pašlaitėje, tolumoj,",
          "Saulės spindulių nušviestoj,",
          "Jėzaus klausosi nuščiuvusi minia.",
          "Kiek jo žodžiuose išminties!",
          "Sminga jie giliai lig širdies.",
          "„Ak, laimingos akys, reginčios tave!“",
        ],
      },
      { title: "PRIEGIESMIS:", chorus: true, lines: ltChorus },
      {
        title: "2.",
        lines: [
          "Gal širdis sunki, prislėgta?",
          "Kas įvyks rytoj, nežinia.",
          "Dar neprašius, ko mums reikia, žino jis.",
          "Jeigu taip gražiai aprengta",
          "Paprasta laukų lelija,",
          "Mūsų Tėvas pasirūpins ir mumis.",
        ],
      },
      { title: "PRIEGIESMIS:", chorus: true, lines: ltChorus },
      {
        title: "3.",
        lines: [
          "Nebijok liūties nei audros,",
          "Tik stovėk tvirtai ant uolos.",
          "Dievo Žodį vykdyk, kliaukis jo galia.",
          "Tik siauru keliu eidami,",
          "Pro ankštus vartus žengdami",
          "Pamatysim: žemėj Dievo bus valia.",
        ],
      },
      { title: "PRIEGIESMIS:", chorus: true, lines: ltChorus },
    ],
  },
  lv: {
    label: "LV",
    name: "Latviešu",
    title: "Mūsu acis redz un ausis dzird",
    sections: [
      {
        title: "1.",
        lines: [
          "Kalna nogāzē apsēdies,",
          "sejās gaidpilnās pavēries,",
          "Jēzus sāka mācīt, laimīgiem kā kļūt:",
          "”Dievu lūgšanās slavējiet,",
          "ja jūs aizvaino — piedodiet,",
          "vērsiet skatienu uz Dieva valstību.”",
        ],
      },
      { title: "PIEDZIEDĀJUMS", chorus: true, lines: lvChorus },
      {
        title: "2.",
        lines: [
          "Tad, kad raizes mūs piemeklē,",
          "Jēzus vārdi spēj palīdzēt:",
          "”Katrai dienai diezgan savu bēdu ir.",
          "Skaistā rotā Dievs ziedus tērpj,",
          "nedz tie nopūlas, nedz tie vērpj.",
          "Vai gan nedos Dievs jums to, kas vajadzīgs?”",
        ],
      },
      { title: "PIEDZIEDĀJUMS", chorus: true, lines: lvChorus },
      {
        title: "3.",
        lines: [
          "Ja uz stipras klints celts ir nams,",
          "vētras nevarēs kaitēt tam.",
          "Jēzus mācībām ir gudri paklausīt.",
          "Lai gan šaurais ceļš liekas grūts,",
          "ejot to, mums Dievs līdzās būs,",
          "vadīs mūs uz jaunu, drošu pasauli.",
        ],
      },
      { title: "PIEDZIEDĀJUMS", chorus: true, lines: lvChorus },
    ],
  },
  ru: {
    label: "RU",
    name: "Русский",
    title: "Я счастлив, что вижу свет",
    sections: [
      {
        title: "1.",
        lines: [
          "Божий Сын принёс миру свет.",
          "Его жизнь — пример, ярче нет:",
          "Был смиренным и врагов своих прощал.",
          "Обучал людей на горе.",
          "Щедро лился свет по земле,",
          "Чтобы каждый, кто хотел, счастливым стал.",
        ],
      },
      { title: "ПРИПЕВ", chorus: true, lines: ruChorus },
      {
        title: "2.",
        lines: [
          "Новый день начну без тревог.",
          "В чём нуждаюсь я, знает Бог.",
          "Верю, мой Отец всегда помочь готов.",
          "Нежность лилии полевой",
          "Мне напомнит мысль: Бог со мной.",
          "Я в его глазах ценнее всех цветов!",
        ],
      },
      { title: "ПРИПЕВ", chorus: true, lines: ruChorus },
      {
        title: "3.",
        lines: [
          "На скале свой дом возведём,",
          "И не дрогнет он даже в шторм.",
          "Мы исполним всё, что Бог нам говорит.",
          "Хоть непрост порой узкий путь,",
          "Жизнь и мир на нём всех нас ждут.",
          "Вечной жизнью Бог всех верных наградит.",
        ],
      },
      { title: "ПРИПЕВ", chorus: true, lines: ruChorus },
    ],
  },
};

export type SecondSongLanguage = keyof typeof SECOND_COMMON_SONGS;

export const SECOND_SONG_LANGUAGE_OPTIONS = (Object.entries(SECOND_COMMON_SONGS) as [SecondSongLanguage, Song][])
  .map(([id, song]) => ({ id, label: song.label, name: song.name }));
