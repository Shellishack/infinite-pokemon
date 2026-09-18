// Central copy for the marketing site and guide articles, in English and
// Simplified Chinese. Game dialogue itself stays English; this covers the
// website, demo entry/exit prompts, and guide content.

export type Locale='en'|'zh-CN';
export const LOCALES:Locale[]=['en','zh-CN'];
export const localePath=(locale:Locale,path:string)=>locale==='en'?path:`/zh-CN${path}`;

export const LINKS={
  github:'https://github.com/Shellishack/infinite-pokemon',
  skillsRelease:'https://github.com/Shellishack/infinite-pokemon/releases/tag/skills-v0.2.0',
  discord:'https://discord.gg/kKbY8xaVxG',
  skills:{
    quickStart:'https://skills.sh/shellishack/infinite-pokemon/infinite-pokemon',
    region:'https://skills.sh/shellishack/infinite-pokemon/infinite-pokemon-region',
    npc:'https://skills.sh/shellishack/infinite-pokemon/infinite-pokemon-npc',
    interior:'https://skills.sh/shellishack/infinite-pokemon/infinite-pokemon-interior',
  },
  docs:{
    setup:'https://github.com/Shellishack/infinite-pokemon#readme',
    systems:'https://github.com/Shellishack/infinite-pokemon/blob/main/docs/DESIGN.md',
    architecture:'https://github.com/Shellishack/infinite-pokemon/blob/main/TECHNICAL_ARCHITECTURE.md',
    technicalReport:'https://github.com/Shellishack/infinite-pokemon/tree/main/docs/technical-report',
  },
} as const;

export type GuideSlug='getting-started'|'battles-catching-healing'|'playing-with-friends'|'saves-and-continuing-world';
export const GUIDE_SLUGS:GuideSlug[]=['getting-started','battles-catching-healing','playing-with-friends','saves-and-continuing-world'];

export interface GuideCopy{slug:GuideSlug;title:string;description:string;question:string;sections:{heading:string;body:string[];list?:string[]}[];stumbling:string[];related:GuideSlug[];}
export interface Copy{
  locale:Locale;
  htmlLang:string;
  siteName:string;
  tagline:string;
  meta:{home:{title:string;description:string};game:{title:string;description:string};guides:{title:string;description:string};notFound:{title:string;description:string}};
  nav:{playDemo:string;guides:string;download:string;github:string;discord:string;switchTo:string};
  hero:{title:string;subtitle:string;primary:string;download:string;github:string};
  showcase:{heading:string;intro:string;demoNote:string;items:{title:string;body:string;image:string;alt:string}[]};
  guidesPreview:{heading:string;intro:string;readGuide:string};
  downloads:{heading:string;intro:string;skillsHeading:string;skillsIntro:string;skills:{name:string;description:string;url:string}[];releaseNote:string};
  docs:{heading:string;items:{name:string;description:string;url:string}[]};
  community:{heading:string;body:string;discord:string;github:string;disclaimer:string;credits:string};
  footer:{disclaimer:string};
  notFound:{heading:string;body:string;home:string};
  game:{heading:string;instructions:string[];boundary:string;lang:string};
  guidesIndex:{heading:string;intro:string};
  guides:Record<GuideSlug,GuideCopy>;
  relatedHeading:string;
  stumblingHeading:string;
  backToGuides:string;
}

export const en:Copy={
  locale:'en',
  htmlLang:'en',
  siteName:'Infinite Pokémon',
  tagline:'A Pokémon-style adventure where AI helps write what comes next—and your world remembers.',
  meta:{
    home:{title:'Infinite Pokémon — a persistent AI adventure you can play in your browser',description:'Play a free browser demo of Infinite Pokémon: a Pokémon-style adventure where AI helps write what comes next and your world remembers. Export your progress and continue locally.'},
    game:{title:'Play the Infinite Pokémon browser demo',description:'Explore five hand-crafted maps, battle and catch companions, and finish the tutorial—no account or setup needed. Export your progress to continue in the full game.'},
    guides:{title:'Gameplay guides — Infinite Pokémon',description:'Practical guides for Infinite Pokémon: getting started, battles and catching, local multiplayer, and how saves and the continuing world work.'},
    notFound:{title:'Page not found — Infinite Pokémon',description:'That route does not exist. Head back to the Infinite Pokémon homepage or play the browser demo.'},
  },
  nav:{playDemo:'Play the demo',guides:'Guides',download:'Download & setup',github:'GitHub',discord:'Discord',switchTo:'中文'},
  hero:{title:'A Pokémon-style adventure where AI helps write what comes next—and your world remembers.',subtitle:'Explore, battle, and build a team in a world that keeps growing. Start in the browser demo; take your save with you into the full game.',primary:'Play the demo',download:'Download & setup',github:'GitHub'},
  showcase:{
    heading:'What playing actually looks like',
    intro:'Real gameplay from the current build: overworld exploration, turn-based battles, interiors with their own stories, and a world that stays changed after you leave.',
    demoNote:'The browser demo ships five prepared maps (Willow Valley) with fixed layouts. In the full local game, new regions are generated by AI as you travel—prepared maps are the demo, generation is the full game.',
    items:[
      {title:'Exploration',body:'Walk between meadows, forest trails, ruins, and a coast. Signs, waystones, and NPCs give each map its own hook.',image:'/showcase/exploration.png',alt:'Exploring the overworld in Infinite Pokémon'},
      {title:'Battles and catching',body:'Turn-based battles with moves, PP, and type-free matchups. Weaken a wild companion and throw a ball to add it to your party.',image:'/showcase/battle.png',alt:'A turn-based battle in Infinite Pokémon'},
      {title:'Interiors',body:'Pokémon centers, shops, and homes are furnished spaces with NPCs that remember you.',image:'/showcase/interior.png',alt:'Inside a building in Infinite Pokémon'},
      {title:'A world that remembers',body:'Events, journals, and NPC memory persist through checkpoints, so the world you return to is the one you left.',image:'/showcase/continuity.png',alt:'World continuity and checkpoints in Infinite Pokémon'},
    ],
  },
  guidesPreview:{heading:'Learn the game',intro:'Short, practical guides written against the current build—controls, teams, friends, and saves.',readGuide:'Read the guide'},
  downloads:{
    heading:'Downloads and skills',
    intro:'Get the full game from GitHub and the four published skills from the skills registry. Direct links only—setup instructions live in the repository docs.',
    skillsHeading:'The four skills',
    skillsIntro:'Skills are instruction packs the AI harness uses to run and grow the game. All four are published:',
    skills:[
      {name:'Quick Start',description:'Install and run the game end-to-end.',url:LINKS.skills.quickStart},
      {name:'Region generation',description:'How new maps, stories, and economies are generated.',url:LINKS.skills.region},
      {name:'NPC generation',description:'Dialogue, memory, and behavior for the people you meet.',url:LINKS.skills.npc},
      {name:'Interior generation',description:'Furnished interiors and how objects are placed.',url:LINKS.skills.interior},
    ],
    releaseNote:'Bundled skill downloads are published on the skills-v0.2.0 release tag.',
  },
  docs:{heading:'Documentation',items:[
    {name:'Setup and installation',description:'Run the game locally with Node and connect Codex.',url:LINKS.docs.setup},
    {name:'Game systems',description:'Design notes for battles, economy, tutorial, and continuity.',url:LINKS.docs.systems},
    {name:'Architecture',description:'How the server, engine, client, and harness fit together.',url:LINKS.docs.architecture},
    {name:'Technical report',description:'The deeper write-up behind the project.',url:LINKS.docs.technicalReport},
  ]},
  community:{
    heading:'Community',
    body:'Questions, feedback, and generated-world stories are welcome. Infinite Pokémon is a fan-made, non-commercial project.',
    discord:'Join the Discord',
    github:'Star the original GitHub project',
    disclaimer:'Infinite Pokémon is an unofficial fan project and is not affiliated with, endorsed, or sponsored by Nintendo, Game Freak, or The Pokémon Company.',
    credits:'Sprites, tiles, and audio are original procedural assets created for this project; the classic tileset references are used for layout prototyping only.',
  },
  footer:{disclaimer:'Unofficial fan project. Not affiliated with Nintendo, Game Freak, or The Pokémon Company.'},
  notFound:{heading:'404 — tall grass, no path',body:'This page does not exist. It may have moved, or the link is wrong.',home:'Back to the homepage'},
  game:{
    heading:'Browser demo — Willow Valley',
    instructions:[
      'Move with WASD or the arrow keys. Press E or Space to talk, read signs, and use doors.',
      'The demo contains five prepared maps. Everything you do autosaves in this browser.',
      'At the edge of the demo you can export your progress and continue in the full local game.',
      'The game below loads in your browser; no account, no setup, no network gameplay services.',
    ],
    boundary:'You have reached the edge of the demo. Export your progress, download the full game, or keep exploring Willow Valley.',
    lang:'Switch language',
  },
  guidesIndex:{heading:'Gameplay guides',intro:'Each guide is written against the current build and links to the demo or download where it helps.'},
  relatedHeading:'Related guides',
  stumblingHeading:'Common stumbling points',
  backToGuides:'All guides',
  guides:{
    'getting-started':{
      slug:'getting-started',title:'Getting started: demo, controls, and continuing locally',description:'How to play the Infinite Pokémon browser demo, the full control list, and how to carry your progress into the local game.',
      question:'How do I play the demo, use the controls, and continue locally?',
      sections:[
        {heading:'Play the demo',body:['Open the /game page and press Play. The demo loads five prepared maps collectively called Willow Valley—no account, no provider credentials, no server of your own. Your progress autosaves in the browser after every settled action, so closing the tab and coming back resumes where you stopped.','The first thing the game asks you to do is meet your guide. You cannot leave the starting map until you have talked to them—follow the objective checklist in the corner of the screen.']},
        {heading:'Controls',body:['The game is keyboard-first.'],list:['Move: WASD or arrow keys (hold to keep walking)','Interact / talk / read signs / use doors: E or Space','Battle menus: arrow keys to move the cursor, E or Space to confirm','Music and sound: the audio panel in the corner; browsers require one click or key press before sound can start']},
        {heading:'What the demo includes',body:['All five Willow Valley maps and their interiors, the full six-lesson tutorial, wild encounters, battles, catching, healing, shops, and checkpoints. What it does not include: AI generation of new regions, accounts, and hosted multiplayer. The demo world is fixed and hand-authored.']},
        {heading:'Continue locally',body:['When you reach the edge of the demo maps—or finish the tutorial—the game offers three choices: Export progress, Download & setup, or Keep exploring the demo. Export downloads a portable JSON save. Install the game locally (see the repository README), start it, and use the host-only import action to bring your trainer, party, inventory, tutorial progress, and world history into a fresh local run. Importing never overwrites an existing local save—it always creates a new run.','The full game connects to Codex to generate new regions as you travel. Provider limits and generation time apply: a new map takes real time to create, which is why the game streams it in the background while you keep playing.']},
      ],
      stumbling:['Sound is silent until your first click or key press—this is a browser rule, not a bug.','If the game cannot write to browser storage (private windows, blocked storage), it says so and runs in temporary-session mode; export your progress before closing.','Two tabs playing at once: the second tab is told the save is busy, so tabs cannot overwrite each other.'],
      related:['battles-catching-healing','saves-and-continuing-world'],
    },
    'battles-catching-healing':{
      slug:'battles-catching-healing',title:'Battles, catching, and healing: building and caring for your team',description:'How battles work in Infinite Pokémon, how to catch wild companions, and how to heal, revive, and manage PP for your party.',
      question:'How do I build and care for my team?',
      sections:[
        {heading:'How battles work',body:['Battles are turn-based. You and your opponent each pick a move; moves cost PP, and when both moves of a companion run out you must switch or use an Ether. Wild encounters happen in tall grass and similar terrain; trainer battles start by talking to trainers like Trainer Rowan on the first map.','Winning battles is how companions grow. Losing is not fatal: your party is healed back at the last center, but you lose the battle and any progress toward catching that wild companion.']},
        {heading:'Catching companions',body:['Weaken a wild companion first—lower HP means a better catch chance—then throw a ball from your bag. Poké Balls are the cheap option; Great Balls catch more reliably. You get your first balls from the tutorial, and shops in town sell more.','Caught companions join your party if there is room, otherwise they go to storage. You can reorganize your party from the menu between battles.']},
        {heading:'Healing and care',body:['Pokémon centers heal your whole party for free—walk in and talk to the attendant. Potions (24 HP), Super Potions (50 HP), and Hyper Potions (120 HP) heal in the field or mid-battle; Revive wakes a fainted companion at half HP; Ether restores 10 PP to both moves.','Repel keeps wild encounters away for 100 steps when you are low on supplies and just want to cross a map.']},
        {heading:'Sensible early team',body:['Pick your starter from the guide, catch two or three wild companions on the first two maps, and keep one companion with a status or utility move in the front. Buy a few Potions and at least one Revive before pushing into the ruins or the coast.']},
      ],
      stumbling:['Running out of PP mid-route is the most common wipe cause—carry an Ether.','Throwing balls at full-HP wild companions wastes money; weaken first.','Export is blocked during an active battle; finish the battle, then export.'],
      related:['getting-started','saves-and-continuing-world'],
    },
    'playing-with-friends':{
      slug:'playing-with-friends',title:'Playing with friends: local multiplayer and who needs Codex',description:'How local multiplayer works in Infinite Pokémon: hosting, joining, what each player needs, and why only the host needs Codex.',
      question:'How does local multiplayer work, and who needs Codex?',
      sections:[
        {heading:'The shape of multiplayer',body:['Multiplayer is hosted, not matchmade. One person runs the game locally—that machine is the server—and friends join over the local network or a tunnel through the join link the host shares. Everyone plays in the same world, sees each other move in real time, and shares the world\'s history.']},
        {heading:'Hosting',body:['Install and start the game locally (see Getting started). The host console shows a join link; send it to your friends. The host machine holds the world: the SQLite save, the checkpoints, and—if you want new regions—the Codex connection.']},
        {heading:'Joining',body:['Players who join need nothing but a browser. No install, no account, and no Codex: generation runs only on the host. Joining players get a persistent identity stored in their own browser, so leaving and rejoining brings back the same trainer.']},
        {heading:'Who needs Codex',body:['Only the host, and only for generating new content. Playing on the prepared maps, battling, catching, and multiplayer itself never call Codex. The host explicitly consents before generation starts, and the agent panel shows what the generator is doing.']},
      ],
      stumbling:['Friends cannot connect? Check that they are on the same network or that your tunnel points at the host port shown in the console.','The browser demo on the website is single-player; multiplayer needs the local build.','Everyone shares one world—checkpoints are world-wide, so coordinate before rolling back.'],
      related:['getting-started','saves-and-continuing-world'],
    },
    'saves-and-continuing-world':{
      slug:'saves-and-continuing-world',title:'Saves and a continuing world: what persists, checkpoints, and demo transfer',description:'What Infinite Pokémon saves, how checkpoints and runs work, and how to transfer browser demo progress into the full game.',
      question:'What persists, how do checkpoints work, and how do I transfer demo progress?',
      sections:[
        {heading:'What persists',body:['Everything that matters to your story: your trainer, party and storage, inventory, tutorial progress, the places you have visited, world changes, and the continuity history the AI uses to keep new content consistent with what already happened. Credentials and session tokens are never part of a portable save.']},
        {heading:'Autosave and checkpoints',body:['The game autosaves after every settled action—there is no save button you must remember. On top of that, checkpoints are named snapshots you create deliberately (before a risky fight, before promoting the preview, before inviting friends). A run is one continuing world; checkpoints let you fork it or roll back without losing the main line.','In the browser demo, autosave lives in IndexedDB and resumes in the same browser. If storage is unavailable the game tells you it is in temporary-session mode—export before closing.']},
        {heading:'Transferring demo progress',body:['From the demo\'s edge-of-world or tutorial-complete prompt, choose Export progress to download a versioned JSON save. In the local game, the host uses the import action, picks the file, and the game validates it—file size, schema, versions, references, and gameplay bounds—then creates a new isolated run. Your existing local saves are never touched, and a corrupt or unsupported file changes nothing.','Imported maps are recreated from the bundled Willow Valley pack the file was exported from, so the local game does not need the browser\'s copy of anything. You get fresh local credentials, can keep playing the five maps immediately, and unlock full generation through the normal Codex consent flow.']},
        {heading:'What does not transfer',body:['Accounts (there are none), other players, and anything machine-local: credentials, tokens, and filesystem paths never leave the exporting browser. Multiplayer worlds belong to the host machine and are shared by playing, not by exporting.']},
      ],
      stumbling:['Export during a battle is refused—finish the battle first, then export from a settled state.','Import is host-only; players who joined over the network cannot import.','An imported run is a new run. Look in the save browser if the world does not open automatically.'],
      related:['getting-started','playing-with-friends'],
    },
  },
};

export const zhCN:Copy={
  locale:'zh-CN',
  htmlLang:'zh-CN',
  siteName:'Infinite Pokémon',
  tagline:'一个由 AI 续写冒险、让世界记住你的宝可梦风格游戏。',
  meta:{
    home:{title:'Infinite Pokémon — 可在浏览器中游玩的持久 AI 冒险',description:'免费游玩 Infinite Pokémon 浏览器试玩版:宝可梦风格冒险,AI 续写后续内容,世界会记住你的一切。可导出进度,在本地完整游戏中继续。'},
    game:{title:'游玩 Infinite Pokémon 浏览器试玩版',description:'探索五张精心制作的地图,战斗、收服伙伴并完成教程——无需账号或安装。可导出进度,在完整游戏中继续冒险。'},
    guides:{title:'玩法指南 — Infinite Pokémon',description:'Infinite Pokémon 实用指南:入门、战斗与收服、本地多人,以及存档与持续世界的运作方式。'},
    notFound:{title:'页面未找到 — Infinite Pokémon',description:'该地址不存在。返回 Infinite Pokémon 首页或游玩浏览器试玩版。'},
  },
  nav:{playDemo:'游玩试玩版',guides:'指南',download:'下载与安装',github:'GitHub',discord:'Discord',switchTo:'English'},
  hero:{title:'一个由 AI 续写冒险、让世界记住你的宝可梦风格游戏。',subtitle:'在不断生长的世界中探索、战斗、组建队伍。从浏览器试玩版开始,把存档带进完整游戏。',primary:'游玩试玩版',download:'下载与安装',github:'GitHub'},
  showcase:{
    heading:'实际游玩画面',
    intro:'来自当前版本的真实玩法:原野探索、回合制战斗、有自己故事的室内场景,以及你离开后依然保持变化的世界。',
    demoNote:'浏览器试玩版包含五张预先制作的地图(Willow Valley),布局固定。在本地完整游戏中,新区域会随你的旅行由 AI 生成——预制地图属于试玩版,生成内容属于完整游戏。',
    items:[
      {title:'探索',body:'在草甸、林间小径、遗迹与海岸之间穿行。告示牌、旅石和 NPC 为每张地图带来自己的引子。',image:'/showcase/exploration.png',alt:'在 Infinite Pokémon 中探索原野'},
      {title:'战斗与收服',body:'回合制战斗,招式消耗 PP。削弱野生伙伴后投球,即可把它加入队伍。',image:'/showcase/battle.png',alt:'Infinite Pokémon 中的回合制战斗'},
      {title:'室内场景',body:'宝可梦中心、商店和民居都是有陈设的空间,里面的 NPC 会记得你。',image:'/showcase/interior.png',alt:'Infinite Pokémon 中的建筑内部'},
      {title:'会记住你的世界',body:'事件、日志与 NPC 记忆通过检查点持久保存,你回到的世界正是你离开时的样子。',image:'/showcase/continuity.png',alt:'Infinite Pokémon 中的世界延续与检查点'},
    ],
  },
  guidesPreview:{heading:'了解玩法',intro:'对照当前版本撰写的简短实用指南——操作、队伍、朋友与存档。',readGuide:'阅读指南'},
  downloads:{
    heading:'下载与技能',
    intro:'从 GitHub 获取完整游戏,从技能注册表获取四个已发布的技能。此处只提供直接链接——安装说明见仓库文档。',
    skillsHeading:'四个技能',
    skillsIntro:'技能是 AI 运行与扩展游戏所使用的指令包。四个技能均已发布:',
    skills:[
      {name:'快速上手',description:'端到端安装并运行游戏。',url:LINKS.skills.quickStart},
      {name:'区域生成',description:'新地图、故事与经济如何生成。',url:LINKS.skills.region},
      {name:'NPC 生成',description:'你遇到的人们的对话、记忆与行为。',url:LINKS.skills.npc},
      {name:'室内生成',description:'带陈设的室内场景与物件摆放方式。',url:LINKS.skills.interior},
    ],
    releaseNote:'打包的技能下载发布在 skills-v0.2.0 版本标签上。',
  },
  docs:{heading:'文档',items:[
    {name:'安装与设置',description:'用 Node 在本地运行游戏并连接 Codex。',url:LINKS.docs.setup},
    {name:'游戏系统',description:'战斗、经济、教程与世界延续的设计说明。',url:LINKS.docs.systems},
    {name:'架构',description:'服务器、引擎、客户端与生成器如何协同工作。',url:LINKS.docs.architecture},
    {name:'技术报告',description:'项目背后的深入技术文章。',url:LINKS.docs.technicalReport},
  ]},
  community:{
    heading:'社区',
    body:'欢迎提问、反馈和分享你生成的世界故事。Infinite Pokémon 是非商业的同人项目。',
    discord:'加入 Discord',
    github:'为 GitHub 原项目点星',
    disclaimer:'Infinite Pokémon 是非官方同人项目,与任天堂、Game Freak 或宝可梦公司无任何关联,亦未获得其认可或赞助。',
    credits:'精灵图、图块与音频均为本项目原创的程序化素材;经典图块参考仅用于布局原型。',
  },
  footer:{disclaimer:'非官方同人项目。与任天堂、Game Freak 或宝可梦公司无关联。'},
  notFound:{heading:'404 — 草丛深处,没有路',body:'这个页面不存在。它可能已被移动,或者链接有误。',home:'返回首页'},
  game:{
    heading:'浏览器试玩版 — Willow Valley',
    instructions:[
      '用 WASD 或方向键移动。按 E 或空格对话、阅读告示牌、进出房门。',
      '试玩版包含五张预制地图。你的一切操作都会自动保存在此浏览器中。',
      '到达试玩版边界时,可以导出进度并在本地完整游戏中继续。',
      '下方游戏在你的浏览器中运行;无需账号、无需安装、无需联网游戏服务。',
    ],
    boundary:'你已到达试玩版的边界。可以导出进度、下载完整游戏,或继续探索 Willow Valley。',
    lang:'切换语言',
  },
  guidesIndex:{heading:'玩法指南',intro:'每篇指南都对照当前版本撰写,并在合适处链接试玩版或下载。'},
  relatedHeading:'相关指南',
  stumblingHeading:'常见问题',
  backToGuides:'全部指南',
  guides:{
    'getting-started':{
      slug:'getting-started',title:'入门:试玩版、操作与本地继续',description:'如何游玩 Infinite Pokémon 浏览器试玩版、完整操作说明,以及如何把进度带入本地游戏。',
      question:'我该如何玩试玩版、使用操作,并在本地继续?',
      sections:[
        {heading:'开始试玩',body:['打开 /game 页面并点击开始。试玩版加载五张预制地图,合称 Willow Valley——无需账号、无需任何服务凭据、无需自己的服务器。每个稳定操作后进度都会自动保存在浏览器中,关闭标签页再打开会从上次停下的地方继续。','游戏要求你做的第一件事是见到你的向导。在与向导对话之前无法离开起始地图——跟着屏幕角落的目标清单走即可。']},
        {heading:'操作方式',body:['游戏以键盘操作为主。'],list:['移动:WASD 或方向键(按住可持续行走)','互动 / 对话 / 读告示牌 / 进门:E 或空格','战斗菜单:方向键移动光标,E 或空格确认','音乐与音效:角落的音频面板;浏览器要求先点击或按一次键才能出声']},
        {heading:'试玩版包含什么',body:['全部五张 Willow Valley 地图及其室内、完整的六课教程、野外遭遇、战斗、收服、治疗、商店与检查点。不包含:AI 生成新区域、账号与托管多人。试玩版世界是固定、手工制作的。']},
        {heading:'在本地继续',body:['当你到达试玩版地图边缘——或完成教程——游戏会给出三个选择:导出进度、下载与安装,或继续探索试玩版。导出会下载一个可移植的 JSON 存档。在本地安装游戏(见仓库 README),启动后使用仅主机可用的导入功能,把你的训练家、队伍、背包、教程进度与世界历史带入一个全新的本地存档。导入永远不会覆盖已有的本地存档——它总是创建新存档。','完整游戏会连接 Codex,在你旅行时生成新区域。服务商限额与生成耗时仍然适用:一张新地图需要真实的时间来创建,所以游戏会在后台流式生成,让你继续游玩。']},
      ],
      stumbling:['首次点击或按键之前没有声音——这是浏览器规则,不是故障。','如果游戏无法写入浏览器存储(隐私窗口、存储被禁用),它会明确提示并进入临时会话模式;关闭前请导出进度。','两个标签页同时游玩:后打开的标签页会被告知存档正忙,避免互相覆盖。'],
      related:['battles-catching-healing','saves-and-continuing-world'],
    },
    'battles-catching-healing':{
      slug:'battles-catching-healing',title:'战斗、收服与治疗:组建并照料你的队伍',description:'Infinite Pokémon 的战斗机制、如何收服野生伙伴,以及如何为队伍治疗、复活和管理 PP。',
      question:'我该如何组建并照料我的队伍?',
      sections:[
        {heading:'战斗如何进行',body:['战斗是回合制的。你与对手各选一个招式;招式消耗 PP,当一个伙伴的两个招式都耗尽时,必须换人或使用 Ether。野外遭遇发生在草丛等地形;训练家对战通过与训练家对话开始,比如第一张地图上的 Trainer Rowan。','胜利是伙伴成长的方式。失败并不致命:队伍会在最近的中心恢复,但你输掉这场战斗,以及收服那只野生伙伴的进度。']},
        {heading:'收服伙伴',body:['先削弱野生伙伴——HP 越低收服率越高——然后从背包投球。精灵球便宜;超级球更可靠。教程会给你第一批球,镇上商店有售。','收服的伙伴在队伍有空位时入队,否则进入仓库。战斗间隙可以在菜单中调整队伍顺序。']},
        {heading:'治疗与照料',body:['宝可梦中心免费治疗全队——走进去与工作人员对话即可。伤药(24 HP)、好伤药(50 HP)、厉害伤药(120 HP)可在野外或战斗中使用;复活药以一半 HP 唤醒濒死伙伴;Ether 为两个招式各恢复 10 点 PP。','补给不足、只想穿过地图时,Repel 可以在 100 步内避免野外遭遇。']},
        {heading:'稳妥的前期队伍',body:['从向导处选择初始伙伴,在前两张地图收服两三只野生伙伴,把一只带状态或辅助招式的伙伴放在队首。进入遗迹或海岸之前,买几瓶伤药和至少一个复活药。']},
      ],
      stumbling:['半路 PP 耗尽是最常见的团灭原因——随身带一个 Ether。','对满血野生伙伴投球是浪费钱;先削弱。','战斗进行中无法导出;先结束战斗再导出。'],
      related:['getting-started','saves-and-continuing-world'],
    },
    'playing-with-friends':{
      slug:'playing-with-friends',title:'与朋友同玩:本地多人与谁需要 Codex',description:'Infinite Pokémon 本地多人的运作方式:主机、加入、每位玩家需要什么,以及为什么只有主机需要 Codex。',
      question:'本地多人如何运作,谁需要 Codex?',
      sections:[
        {heading:'多人模式的形态',body:['多人是主机制的,不是匹配制。一个人在本地运行游戏——那台机器就是服务器——朋友们通过主机分享的加入链接,经局域网或隧道加入。所有人处于同一个世界,实时看到彼此移动,并共享世界的历史。']},
        {heading:'作为主机',body:['在本地安装并启动游戏(见「入门」)。主机控制台会显示加入链接;把它发给朋友。主机机器持有整个世界:SQLite 存档、检查点,以及——如果你想要新区域——Codex 连接。']},
        {heading:'作为加入者',body:['加入的玩家只需要浏览器。无需安装、无需账号,也无需 Codex:生成只在主机上运行。加入者的持久身份保存在自己的浏览器中,离开再回来仍是同一个训练家。']},
        {heading:'谁需要 Codex',body:['只有主机,且仅用于生成新内容。在预制地图上游玩、战斗、收服以及多人本身都不会调用 Codex。主机在生成开始前需要明确同意,代理面板会显示生成器正在做什么。']},
      ],
      stumbling:['朋友连不上?确认他们在同一网络,或你的隧道指向控制台显示的主机端口。','网站上的浏览器试玩版是单人的;多人需要本地版本。','所有人共享一个世界——检查点是全世界的,回滚前先协调。'],
      related:['getting-started','saves-and-continuing-world'],
    },
    'saves-and-continuing-world':{
      slug:'saves-and-continuing-world',title:'存档与持续的世界:什么会被保存、检查点与试玩版转移',description:'Infinite Pokémon 保存什么、检查点与存档的运作方式,以及如何把浏览器试玩版进度转移到完整游戏。',
      question:'什么会被保存,检查点如何运作,如何转移试玩版进度?',
      sections:[
        {heading:'什么会被保存',body:['对你的故事重要的一切:训练家、队伍与仓库、背包、教程进度、到访过的地点、世界变化,以及 AI 用来让新内容与既有历史保持一致的延续记录。凭据与会话令牌永远不会进入可移植存档。']},
        {heading:'自动保存与检查点',body:['游戏在每个稳定操作后自动保存——没有你必须记得按的保存按钮。在此之上,检查点是你主动创建的命名快照(在艰难的战斗前、在升级试玩版前、在邀请朋友前)。一个存档(run)是一个持续的世界;检查点让你可以分叉或回滚,而不丢失主线。','在浏览器试玩版中,自动保存存放在 IndexedDB,并在同一浏览器中恢复。如果存储不可用,游戏会告知你处于临时会话模式——关闭前请导出。']},
        {heading:'转移试玩版进度',body:['在试玩版的世界边缘或教程完成提示中,选择「导出进度」即可下载带版本的 JSON 存档。在本地游戏中,主机使用导入功能选择该文件,游戏会验证它——文件大小、结构、版本、引用与玩法边界——然后创建一个全新的独立存档。你已有的本地存档不会被触碰;损坏或不支持的文件不会改变任何东西。','导入的地图会根据导出时对应的内置 Willow Valley 地图包重新创建,因此本地游戏不需要浏览器里的任何副本。你会获得新的本地凭据,可以立刻继续游玩这五张地图,并通过正常的 Codex 同意流程解锁完整生成。']},
        {heading:'什么不会被转移',body:['账号(本来就没有)、其他玩家,以及任何机器本地的东西:凭据、令牌与文件系统路径永远不会离开导出的浏览器。多人世界属于主机机器,通过一起游玩来共享,而不是通过导出。']},
      ],
      stumbling:['战斗中无法导出——先结束战斗,在稳定状态下导出。','导入仅限主机;通过网络加入的玩家不能导入。','导入的存档是全新的存档。如果世界没有自动打开,请在存档浏览器中查看。'],
      related:['getting-started','playing-with-friends'],
    },
  },
};

export const copyFor=(locale:Locale):Copy=>locale==='en'?en:zhCN;
