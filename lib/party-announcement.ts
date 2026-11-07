import type { PartyLanguage } from "./party-i18n";

type Recommendation = { title: string; paragraphs: string[] };

type PartyAnnouncement = {
  title: string;
  eventName: string;
  facts: { label: string; value: string }[];
  intro: string[];
  recommendationsTitle: string;
  recommendations: Recommendation[];
  closingTitle: string;
  closing: string[];
  scripture: string;
  continueLabel: string;
  closeLabel: string;
  languageLabel: string;
};

export const PARTY_ANNOUNCEMENTS: Record<PartyLanguage, PartyAnnouncement> = {
  lt: {
    title: "Brangūs draugai, jau šį šeštadienį susitiksime!",
    eventName: "Mūsų ilgai lauktas vakarėlis „TAUTOS. Aplink pasaulį per 360 minučių“ jau visai čia pat!",
    facts: [
      { label: "Vieta", value: "Priekulės kultūros namai" },
      { label: "Data", value: "lapkričio 7 d. (šeštadienis)" },
      { label: "Atvykimas", value: "nuo 16:30 val." },
      { label: "Programos pradžia", value: "17:00 val." },
    ],
    intro: [
      "Labai prašome neatvykti anksčiau nei 16:30 val. Išimtis – savanoriai, norintys padėti puošti salę ir pasiruošti renginiui.",
      "Taip pat prašome nevėluoti į programos pradžią, nes viskas kruopščiai suplanuota pagal laiką.",
      "Mūsų laukia turiningas vakaras: bendri šokiai, smagūs žaidimai, pasirodymai, vaizdo siužetai, bendravimas, vaišės ir, žinoma, diskoteka!",
    ],
    recommendationsTitle: "Keletas svarbių rekomendacijų",
    recommendations: [
      {
        title: "Suneštinės vaišės",
        paragraphs: [
          "Kaip ir planavome, vaišės bus suneštinės. Labai kviečiame pagal savo galimybes atsivežti vaisių, užkandžių, pyragų, mišrainių, sotesnio maisto ar gaiviųjų gėrimų. Kiekvienas prisideda tiek, kiek gali.",
          "Vandeniu, kava ir arbata bus pasirūpinta.",
          "Mažas prašymas dėl vaisių: jei planuojate jų atsivežti, labai prašome iš anksto nuplauti ir, jei reikia, supjaustyti, kad atvykus būtų galima iškart padėti ant bendro stalo.",
        ],
      },
      {
        title: "Sėdimos vietos",
        paragraphs: [
          "Šį kartą mūsų susirinks tikrai nemažai – apie 140 suaugusiųjų!",
          "Salėje yra apie 100 kėdžių, todėl jeigu turite sulankstomą kėdę ir norite užsitikrinti sėdimą vietą, galite ją įsidėti į automobilį ir atsivežti.",
        ],
      },
      {
        title: "Grynas oras ir poilsis",
        paragraphs: [
          "Patalpos turi vidinį kiemelį – terasą. Kadangi mūsų laukia ilgas ir aktyvus vakaras, rekomenduojame retkarčiais išeiti į gryną orą, atsikvėpti.",
        ],
      },
      {
        title: "Būkime aktyvūs programos dalyviai!",
        paragraphs: [
          "Mūsų šauniosios vedėjos Brigita ir Rita įdėjo labai daug širdies, laiko ir pastangų ruošdamos šią programą!",
          "Todėl labai kviečiame visus nelikti vien stebėtojais – aktyviai įsitraukime į bendrus šokius, žaidimus ir kitas veiklas! Juk gražiausi prisiminimai gimsta tada, kai visi kartu juos kuriame!",
          "Bendrus šokius ves Tomas ir Aurelija Rankauskai! Tad drąsiai junkimės, net jei kai kurie šokio žingsneliai bus visiškai nauji!",
        ],
      },
      {
        title: "Diskoteka – nuo apie 20:30 val. (priklauso nuo programos eigos)",
        paragraphs: [
          "Apie 20:30 val. prasidės diskoteka!",
          "Grojaraštis jau paruoštas – jame skambės įvairių šalių hitai, smagios ir energingos dainos.",
          "Tačiau jei dar turite dainų, kurios jus ir kitus tiesiog verčia pakilti nuo kėdžių ir šokti, drąsiai siųskite pasiūlymus!",
          "Tel. +370 663 52281",
        ],
      },
      {
        title: "Vakaro nominacijos ir balsavimas",
        paragraphs: [
          "Vakaro metu jūsų lauks ir smagus balsavimas! Visi kartu rinksime šių nominacijų laimėtojus:",
          "🏆 „Įdomiausia apranga“ · „Vakaro energija“ · „Netikėčiausias vakaro akcentas“",
          "Balsavimas vyks internetu per www.klaipedosvakaras.fun. Tiksli nuoroda ir balsavimo instrukcijos bus pateiktos vakarėlio metu.",
        ],
      },
    ],
    closingTitle: "Mes jūsų labai laukiame!",
    closing: [
      "Šį vakarą kartu su mumis bus ne tik draugai iš Klaipėdos krašto, bet ir broliai bei sesės iš kitų Lietuvos miestų ir net Latvijos!",
      "Kokia nuostabi proga plačiai atverti savo širdis, susipažinti su naujais draugais, sustiprinti senas draugystes ir tiesiog džiaugtis buvimu kartu su mūsų dvasine šeima!",
      "Tad atsivežkime ne tik vaišių, gražių drabužių ir gerą nuotaiką, bet ir plačias šypsenas, atviras širdis bei norą pradžiuginti kitus!",
    ],
    scripture: "Romiečiams 1:11, 12",
    continueLabel: "Toliau naršyti svetainėje",
    closeLabel: "Uždaryti pranešimą",
    languageLabel: "Pranešimo kalba",
  },
  lv: {
    title: "Dārgie draugi, jau šo sestdien mēs tiksimies!",
    eventName: "Mūsu ilgi gaidītais pasākums „TAUTAS. Apkārt pasaulei 360 minūtēs” jau pavisam drīz būs klāt!",
    facts: [
      { label: "Vieta", value: "Priekules kultūras nams (Lietuvā)" },
      { label: "Datums", value: "7. novembris (sestdiena)" },
      { label: "Ierašanās", value: "no plkst. 16.30" },
      { label: "Programmas sākums", value: "plkst. 17.00" },
    ],
    intro: [
      "Ļoti lūdzam neierasties agrāk par plkst. 16.30. Izņēmums ir brīvprātīgie, kuri vēlas palīdzēt izrotāt zāli un sagatavoties pasākumam.",
      "Tāpat lūdzam nekavēt programmas sākumu, jo viss ir rūpīgi saplānots un saskaņots ar laiku.",
      "Mūs gaida aizraujošs vakars: kopīgas dejas, jautras spēles, priekšnesumi, videomateriāli, sarunas, cienasts un, protams, diskotēka!",
    ],
    recommendationsTitle: "Daži svarīgi ieteikumi",
    recommendations: [
      {
        title: "Kopīgs cienasts",
        paragraphs: [
          "Kā jau plānojām, cienastu veidosim visi kopā. Aicinām katru pēc savām iespējām paņemt līdzi augļus, uzkodas, kūkas, salātus, sātīgākus ēdienus vai atspirdzinošus dzērienus. Katrs dod savu ieguldījumu tik, cik var.",
          "Ūdens, kafija un tēja būs nodrošināti.",
          "Neliels lūgums attiecībā uz augļiem: ja plānojat tos ņemt līdzi, lūdzu, jau iepriekš nomazgājiet un, ja nepieciešams, sagrieziet, lai pēc ierašanās tos varētu uzreiz novietot uz kopīgā galda.",
        ],
      },
      {
        title: "Sēdvietas",
        paragraphs: [
          "Šoreiz mēs būsim patiešām kuplā skaitā – aptuveni 140 pieaugušie!",
          "Zālē ir aptuveni 100 krēslu, tāpēc, ja jums ir saliekamais krēsls un vēlaties nodrošināt sev sēdvietu, varat to ielikt automašīnā un paņemt līdzi.",
        ],
      },
      {
        title: "Svaigs gaiss un atpūta",
        paragraphs: [
          "Telpām ir iekšpagalms – terase. Tā kā mūs gaida garš un aktīvs vakars, iesakām ik pa laikam iziet svaigā gaisā un nedaudz atvilkt elpu.",
        ],
      },
      {
        title: "Būsim aktīvi programmas dalībnieki!",
        paragraphs: [
          "Mūsu lieliskās vakara vadītājas Brigita un Rita ir ieguldījušas ļoti daudz sirds, laika un pūļu, gatavojot šo programmu!",
          "Tāpēc aicinām visus nepalikt tikai skatītāju lomā – aktīvi piedalīsimies kopīgajās dejās, spēlēs un citās aktivitātēs! Skaistākās atmiņas taču rodas tad, kad mēs visi tās veidojam kopā!",
          "Kopīgās dejas vadīs Tomas un Aurelija Rankauskai! Tāpēc droši pievienojieties, pat ja daži deju soļi jums būs pavisam jauni!",
        ],
      },
      {
        title: "Diskotēka – aptuveni no plkst. 20.30 (atkarībā no programmas norises)",
        paragraphs: [
          "Aptuveni plkst. 20.30 sāksies diskotēka!",
          "Mūzikas atskaņošanas saraksts jau ir sagatavots – tajā skanēs dažādu valstu populāri hiti, jautras un enerģiskas dziesmas.",
          "Tomēr, ja jums vēl ir kādas dziesmas, kas liek jums un citiem piecelties no krēsliem un dejot, droši sūtiet savus ieteikumus!",
          "Tālr. +370 663 52281",
        ],
      },
      {
        title: "Vakara nominācijas un balsošana",
        paragraphs: [
          "Vakara gaitā notiks arī jautra balsošana! Visi kopā izvēlēsimies uzvarētājus šādās nominācijās:",
          "🏆 „Interesantākais tērps” · „Vakara enerģija” · „Negaidītākais vakara pārsteigums”",
          "Balsošana notiks internetā vietnē www.klaipedosvakaras.fun. Precīza saite un balsošanas instrukcijas tiks sniegtas pasākuma laikā.",
        ],
      },
    ],
    closingTitle: "Mēs jūs ļoti gaidām!",
    closing: [
      "Šajā vakarā kopā ar mums būs ne tikai draugi no Klaipēdas apkārtnes, bet arī brāļi un māsas no citām Lietuvas pilsētām un pat Latvijas!",
      "Cik brīnišķīga iespēja plaši atvērt savas sirdis, iepazīt jaunus draugus, stiprināt jau esošās draudzības un vienkārši priecāties par kopā būšanu ar mūsu garīgo ģimeni!",
      "Tāpēc ņemsim līdzi ne tikai cienastu, skaistus tērpus un labu garastāvokli, bet arī platus smaidus, atvērtas sirdis un vēlmi iepriecināt citus!",
    ],
    scripture: "Romiešiem 1:11, 12",
    continueLabel: "Turpināt pārlūkot vietni",
    closeLabel: "Aizvērt paziņojumu",
    languageLabel: "Paziņojuma valoda",
  },
  ru: {
    title: "Дорогие друзья, уже в эту субботу мы встретимся!",
    eventName: "Наш долгожданный вечер «НАРОДЫ. Вокруг света за 360 минут» уже совсем близко!",
    facts: [
      { label: "Место", value: "Дом культуры в Прекуле (Литва)" },
      { label: "Дата", value: "7 ноября (суббота)" },
      { label: "Прибытие", value: "с 16:30" },
      { label: "Начало программы", value: "в 17:00" },
    ],
    intro: [
      "Очень просим вас не приезжать раньше 16:30. Исключение — добровольцы, которые хотят помочь с украшением зала и подготовкой к мероприятию.",
      "Также просим не опаздывать к началу программы, поскольку всё тщательно спланировано по времени.",
      "Нас ждёт насыщенный вечер: совместные танцы, весёлые игры, выступления, видеосюжеты, общение, угощения и, конечно же, дискотека!",
    ],
    recommendationsTitle: "Несколько важных рекомендаций",
    recommendations: [
      {
        title: "Угощения — общий стол",
        paragraphs: [
          "Как мы и планировали, у нас будет общий стол, который мы накроем все вместе. Приглашаем каждого по своим возможностям привезти фрукты, закуски, пироги, салаты, более сытные блюда или прохладительные напитки. Каждый может внести свой вклад по мере возможностей.",
          "Вода, кофе и чай будут предоставлены.",
          "Небольшая просьба относительно фруктов: если вы планируете их привезти, пожалуйста, заранее помойте и, если необходимо, нарежьте их, чтобы по прибытии можно было сразу поставить на общий стол.",
        ],
      },
      {
        title: "Сидячие места",
        paragraphs: [
          "В этот раз нас соберётся действительно немало — около 140 взрослых!",
          "В зале имеется примерно 100 стульев. Поэтому, если у вас есть складной стул и вы хотите обеспечить себе сидячее место, можете положить его в машину и привезти с собой.",
        ],
      },
      {
        title: "Свежий воздух и отдых",
        paragraphs: [
          "В здании есть внутренний дворик — терраса. Поскольку нас ждёт долгий и активный вечер, рекомендуем время от времени выходить на свежий воздух, чтобы немного отдохнуть и перевести дух.",
        ],
      },
      {
        title: "Будем активными участниками программы!",
        paragraphs: [
          "Наши замечательные ведущие Бригита и Рита вложили очень много души, времени и сил в подготовку этой программы!",
          "Поэтому сердечно приглашаем всех не оставаться просто зрителями, а активно участвовать в совместных танцах, играх и других мероприятиях! Ведь самые прекрасные воспоминания рождаются тогда, когда мы создаём их все вместе!",
          "Совместные танцы будут проводить Томас и Аурелия Ранкаускай! Поэтому смело присоединяйтесь, даже если некоторые танцевальные движения будут для вас совершенно новыми!",
        ],
      },
      {
        title: "Дискотека — примерно с 20:30 (в зависимости от хода программы)",
        paragraphs: [
          "Примерно в 20:30 начнётся дискотека!",
          "Музыкальный плейлист уже подготовлен — в нём будут звучать популярные хиты разных стран, весёлые и энергичные песни.",
          "Но если у вас есть любимые песни, под которые вам и другим просто невозможно усидеть на месте, смело присылайте свои предложения!",
          "Тел. +370 663 52281",
        ],
      },
      {
        title: "Номинации вечера и голосование",
        paragraphs: [
          "В течение вечера нас ждёт также весёлое голосование! Все вместе мы выберем победителей в следующих номинациях:",
          "🏆 «Самый интересный наряд» · «Энергия вечера» · «Самый неожиданный сюрприз вечера»",
          "Голосование будет проходить онлайн на сайте www.klaipedosvakaras.fun. Точная ссылка и инструкции по голосованию будут предоставлены во время мероприятия.",
        ],
      },
    ],
    closingTitle: "Мы вас очень ждём!",
    closing: [
      "В этот вечер с нами будут не только друзья из Клайпедского края, но и братья и сёстры из других городов Литвы и даже из Латвии!",
      "Какая прекрасная возможность широко открыть свои сердца, познакомиться с новыми друзьями, укрепить уже существующие дружбы и просто насладиться временем, проведённым вместе с нашей духовной семьёй!",
      "Поэтому давайте привезём с собой не только угощения, красивую одежду и хорошее настроение, но и широкие улыбки, открытые сердца и искреннее желание порадовать других!",
    ],
    scripture: "Римлянам 1:11, 12",
    continueLabel: "Продолжить просмотр сайта",
    closeLabel: "Закрыть объявление",
    languageLabel: "Язык объявления",
  },
};
