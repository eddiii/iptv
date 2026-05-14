import { readFile, writeFile } from 'node:fs/promises';

const SRC = 'onstv.m3u';
const OUT = 'edtv.m3u';

// Drop channels not in English / Arabic / Hebrew / German
const EXCLUDE_TVG_ID = new Set([
  'Boni-Records.com.us',  // Music Channel — Bulgarian/Roma music
  'Channel9.il',          // 9 канал — Russian-language Israeli
]);

// Replace dead/YouTube URLs in the source with direct HLS streams
const URL_OVERRIDES = {
  'France24Arabic.fr':  'https://static.france24.com/live/F24_AR_LO_HLS/live_web.m3u8',
  'EuronewsGerman.fr':  'https://jmp2.uk/plu-6639d7d4b18d700008da5316.m3u8',
  'Kan11.il':           'https://kancdn.medonecdn.net/livehls/oil/kancdn-live/live/kan11/live.livx/playlist.m3u8',
  'Makan33.il':         'https://kancdn.medonecdn.net/livehls/oil/kancdn-live/live/makan/live.livx/playlist.m3u8',
  'Now14.il':           'https://r.il.cdn-redge.media/livehls/oil/ch14/live/ch14/live.livx/playlist.m3u8',
};

const text = await readFile(SRC, 'utf8');
const lines = text.split(/\r?\n/);

const channels = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.startsWith('#EXTINF:')) continue;
  let url = '';
  const extras = [];
  for (let j = i + 1; j < lines.length; j++) {
    const t = lines[j].trim();
    if (!t) continue;
    if (t.startsWith('#')) { extras.push(lines[j]); continue; }
    url = t; break;
  }
  const grp = (line.match(/group-title="([^"]*)"/) || [])[1] || '';
  const tvgId = (line.match(/tvg-id="([^"]*)"/) || [])[1] || '';
  channels.push({ extinf: line, extras, url, group: grp, tvgId });
}

// Gulf country suffixes to drop from News (AR)
const GULF = new Set(['qa', 'ae', 'sa', 'bh', 'kw', 'om']);
const isGulf = (id) => {
  const m = (id || '').toLowerCase().match(/\.([a-z]{2})$/);
  return m ? GULF.has(m[1]) : false;
};

const replaceGroup = (extinf, newGroup) =>
  extinf.replace(/group-title="[^"]*"/, `group-title="${newGroup}"`);

const out = ['#EXTM3U'];
const stripYouTubeMark = (extinf) => extinf.replace(/\s*Ⓨ/g, '');
const push = (extinf, extras, url, group) => {
  out.push(replaceGroup(stripYouTubeMark(extinf), group));
  for (const e of extras) out.push(e);
  const tvgId = (extinf.match(/tvg-id="([^"]*)"/) || [])[1] || '';
  out.push(URL_OVERRIDES[tvgId] || url);
};

// 1) News — curated international English news + ALL News (AR) + dedicated news channels in ME
const NEW_NEWS = [
  ['Reuters', 'ReutersTV.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Reuters_logo.svg/512px-Reuters_logo.svg.png',
   'https://amg00453-reuters-amg00453c1-rakuten-uk-2110.playouts.now.amagi.tv/playlist/amg00453-reuters-reuters-rakutenuk/playlist.m3u8'],
  ['DW English', 'DWEnglish.de', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/DeutscheWelle-Logo.svg/512px-DeutscheWelle-Logo.svg.png',
   'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8'],
  ['DW Deutsch', 'DW.de', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/DeutscheWelle-Logo.svg/512px-DeutscheWelle-Logo.svg.png',
   'https://dwamdstream101.akamaized.net/hls/live/2015524/dwstream101/index.m3u8'],
  ['France 24 English', 'France24English.fr', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/FRANCE24.png/250px-FRANCE24.png',
   'https://static.france24.com/live/F24_EN_LO_HLS/live_web.m3u8'],
  ['Euronews English', 'EuronewsEnglish.fr', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Euronews_2022_alternative_logo.svg/512px-Euronews_2022_alternative_logo.svg.png',
   'https://jmp2.uk/plu-5ca1da6c593a5d78f0e7edce.m3u8'],
  ['ABC News Live', 'ABCNewsLive.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/ABC_News_logo_2021.svg/512px-ABC_News_logo_2021.svg.png',
   'https://aegis-cloudfront-1.tubi.video/d6cbb0de-68e4-4f3b-82f9-bf5d526e0bde/index.m3u8'],
  ['CBS News', 'CBSNews.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/CBS_News_logo_2020.svg/512px-CBS_News_logo_2020.svg.png',
   'https://cbsn-us-vtt.cbsnstream.cbsnews.com/out/v1/ef868690d34144509eda696884bf1619/master.m3u8'],
  ['NBC News Now', 'NBCNewsNOW.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/NBC_News_2023_%28Alternative%29.svg/512px-NBC_News_2023_%28Alternative%29.svg.png',
   'https://xumo-drct-nbcnn-ir8ze.fast.nbcuni.com/live/master.m3u8'],
  ['CNN Headlines', 'CNNHeadlines.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/CNN.svg/512px-CNN.svg.png',
   'https://jmp2.uk/plu-5421f71da6af422839419cb3.m3u8'],
  ['Cheddar News', 'CheddarNews.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Cheddar_News_2020.svg/250px-Cheddar_News_2020.svg.png',
   'https://aegis-cloudfront-1.tubi.video/27ff1997-507a-41c4-8433-08875fe5f40f/playlist.m3u8'],
  ['Newsy', 'Newsy.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Newsy_logo.svg/250px-Newsy_logo.svg.png',
   'https://547f72e6652371c3.mediapackage.us-east-1.amazonaws.com/out/v1/e3e6e29095844c4ba7d887f01e44a5ef/index.m3u8'],
];
for (const [name, id, logo, url] of NEW_NEWS) {
  out.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" tvg-id="${id}" group-title="News",${name}`);
  out.push(url);
}

// 1b) News — ALL News (AR) + dedicated news channels currently in ME
const NEWS_FROM_ME = new Set([
  // Pan-Arab / national news networks
  'AlMamlakaTV.jo@SD',     // Jordan state news
  'AlManar.lb@SD',         // Hezbollah news
  'AlMayadeenTV.lb@SD',    // Pan-Arab news
  'ALWifakNewsTV.lb@SD',   // Lebanese news
  'NBN.lb@SD',             // National Broadcasting Network (Lebanon)
  // Palestinian news
  'AlNajahNews.ps@SD',
  'PalestineAlYawm.lb@SD',
  'PalestineToday.ps@SD',
  // Israeli political/news
  'Knesset.il',            // Parliament TV
  'Now14.il',              // Channel 14 — political/news
]);
const news = channels.filter(c => c.group === 'News');
const arabicNews = channels.filter(c => c.group === 'News (AR)');
const meNews = channels.filter(c => NEWS_FROM_ME.has(c.tvgId));
for (const c of [...news, ...arabicNews, ...meNews]) push(c.extinf, c.extras, c.url, 'News');

// 2) Documentary — new entries
const NEW_DOC = [
  ['CGTN Documentary', 'CGTNDocumentary.cn', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/CGTN_Documentary_logo.png/512px-CGTN_Documentary_logo.png',
   'https://amg00405-rakutentv-cgtndocumentary-rakuten-0ql8j.amagi.tv/master.m3u8'],
  ['BBC Earth', 'BBCEarth.uk', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/BBC_Earth_2019.svg/512px-BBC_Earth_2019.svg.png',
   'https://jmp2.uk/plu-656535fc2c46f30008870fae.m3u8'],
  ['Curiosity', 'CuriosityChannel.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/CuriosityStream-Logo.png/512px-CuriosityStream-Logo.png',
   'https://jmp2.uk/plu-6576c20fb3801200084786c9.m3u8'],
  ['NASA TV Public', 'NASATV.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/512px-NASA_logo.svg.png',
   'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8'],
  ['Red Bull TV', 'RedBullTV.at', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Red_Bull_TV_logo.svg/512px-Red_Bull_TV_logo.svg.png',
   'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8'],
  ['Bloomberg Originals', 'BloombergOriginals.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Bloomberg_Originals_logo.svg/512px-Bloomberg_Originals_logo.svg.png',
   'https://www.bloomberg.com/media-manifest/streams/originals-global.m3u8'],
];
for (const [name, id, logo, url] of NEW_DOC) {
  out.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" tvg-id="${id}" group-title="Documentary",${name}`);
  out.push(url);
}
// Pull NASA TV Media from onstv USA group into Documentary
const nasaMedia = channels.find(c => c.tvgId === 'NASATVMedia.us');
if (nasaMedia) push(nasaMedia.extinf, nasaMedia.extras, nasaMedia.url, 'Documentary');

// 3) World perspectives
const NEW_WORLD = [
  ['TRT World', 'TRTWorld.tr', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/TRT_World_logo.svg/512px-TRT_World_logo.svg.png',
   'https://tv-trtworld.medya.trt.com.tr/master.m3u8'],
  ['CGTN English', 'CGTN.cn', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/CGTN_logo.svg/512px-CGTN_logo.svg.png',
   'https://english-livebkali.cgtn.com/live/encgtn.m3u8'],
  ['Africanews English', 'AfricanewsEnglish.fr', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Africanews-logo.png/512px-Africanews-logo.png',
   'https://c3c275b999764df8a2dd55ffe2996818.mediatailor.eu-west-1.amazonaws.com/v1/master/0547f18649bd788bec7b67b746e47670f558b6b2/production-LiveChannel-6576/bitok/eyJzdGlkIjoiOTU0NDAyODQtOTU0My00Yzc2LThmZjQtNDRhY2YwYmQxYTYwIiwibWt0IjoicGwiLCJjaCI6NjYwNiwicHRmIjo1fQ==/26036/africanews-en.m3u8'],
  ['Arirang TV', 'ArirangTV.kr', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Arirang_TV_logo.svg/512px-Arirang_TV_logo.svg.png',
   'https://amdlive-ch01-ctnd-com.akamaized.net/arirang_1ch/smil:arirang_1ch.smil/playlist.m3u8'],
];
for (const [name, id, logo, url] of NEW_WORLD) {
  out.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" tvg-id="${id}" group-title="World",${name}`);
  out.push(url);
}

// 4) Independent
const NEW_INDEP = [
  ['Free Speech TV', 'FreeSpeechTV.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Free_Speech_TV_logo.png/512px-Free_Speech_TV_logo.png',
   'https://edge.fstv-live-linear-channel.top.comcast.net/Content/HLS_HLSv3/Live/channel(b168a609-19c1-2203-ae1d-6b9726f05e67)/index.m3u8'],
  ['Vice News', 'ViceNews.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Vice_News_logo.svg/512px-Vice_News_logo.svg.png',
   'https://vicetv-vicefast2-firetv.amagi.tv/playlist.m3u8'],
  ['Telesur English', 'TelesurEnglish.ve', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Telesur-logo-english.png/512px-Telesur-logo-english.png',
   'https://mblenmain01.telesur.ultrabase.net/mblivev3/480p/playlist.m3u8'],
];
for (const [name, id, logo, url] of NEW_INDEP) {
  out.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" tvg-id="${id}" group-title="Independent",${name}`);
  out.push(url);
}

// 5) Music — onstv music channels (working ones) + new MTV/Trace
const MUSIC_FROM_ONSTV = new Set([
  'Now70s.uk', 'Now80s.uk', 'NowRock.uk',
  'DeluxeMusic.de', 'DeluxeMusicDanceByKontor.de', 'DeLuxeMusicRap.de',
  'Boni-Records.com.us',
]);
const musicFromOnstv = channels.filter(c => MUSIC_FROM_ONSTV.has(c.tvgId) && !EXCLUDE_TVG_ID.has(c.tvgId));
for (const c of musicFromOnstv) push(c.extinf, c.extras, c.url, 'Music');

const NEW_MUSIC = [
  ['MTV', 'MTVPlutoTV.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/MTV_2021_%28brand_version%29.svg/512px-MTV_2021_%28brand_version%29.svg.png',
   'https://jmp2.uk/plu-5caf325764025859afdd6c4d.m3u8'],
  ["MTV Spankin' New", 'MTVSpankinNew.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/MTV_2021_%28brand_version%29.svg/512px-MTV_2021_%28brand_version%29.svg.png',
   'https://jmp2.uk/plu-5d14fdb8ca91eedee1633117.m3u8'],
  ['MTV Biggest Pop', 'MTVBiggestPop.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/MTV_2021_%28brand_version%29.svg/512px-MTV_2021_%28brand_version%29.svg.png',
   'https://jmp2.uk/plu-6047fbdbbb776a0007e7f2ff.m3u8'],
  ['Trace Urban', 'TraceUrban.fr', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Trace_Urban_logo_2024.svg/512px-Trace_Urban_logo_2024.svg.png',
   'https://lightning-traceurban-samsungau.amagi.tv/playlist.m3u8'],
];
for (const [name, id, logo, url] of NEW_MUSIC) {
  out.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" tvg-id="${id}" group-title="Music",${name}`);
  out.push(url);
}

// 6) Travel — all new
const NEW_TRAVEL = [
  ['BBC Travel', 'BBCTravel.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/BBC_Travel_logo_2019.svg/512px-BBC_Travel_logo_2019.svg.png',
   'https://jmp2.uk/plu-60e4519e6873180007d3cddb.m3u8'],
  ['Outside TV', 'OutsideTV.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Outside_TV_logo.svg/512px-Outside_TV_logo.svg.png',
   'https://d35j504z0x2vu2.cloudfront.net/v1/master/0bc8e8376bd8417a1b6761138aa41c26c7309312/outsidetv/playlist.m3u8?ads.vf=_zniV8aeQY4'],
  ['China Travel', 'ChinaTravel.cn', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/CGTN_logo.svg/512px-CGTN_logo.svg.png',
   'https://amg01314-amg01314c7-distrotv-us-10219.playouts.now.amagi.tv/playlist/amg01314-cgtn-cgtnchinatravel-distrotvus/playlist.m3u8'],
];
for (const [name, id, logo, url] of NEW_TRAVEL) {
  out.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" tvg-id="${id}" group-title="Travel",${name}`);
  out.push(url);
}

// 7) Movies / Kids / Anime / Comedy / Sports / Lifestyle — popular free brands
const NEW_MOVIES = [
  ['Pluto Movies', 'PlutoTVMovies.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Pluto_TV_2020_logo.svg/512px-Pluto_TV_2020_logo.svg.png',
   'https://jmp2.uk/plu-5c5c3b948002db3c3e0b262e.m3u8'],
  ['Hallmark Movies & More', 'HallmarkMoviesMore.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Hallmark_Channel.svg/512px-Hallmark_Channel.svg.png',
   'https://jmp2.uk/plu-628e685ba3811100070551a8.m3u8'],
  ['FilmRise Western', 'FilmRiseWestern.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/FilmRise_logo.svg/512px-FilmRise_logo.svg.png',
   'https://dz05z8iljgvbe.cloudfront.net/master.m3u8'],
  ['DUST', 'DUST.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/DUST_logo.svg/512px-DUST_logo.svg.png',
   'https://dqi7ayt2o24fn.cloudfront.net/playlist.m3u8'],
];
for (const [name, id, logo, url] of NEW_MOVIES) {
  out.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" tvg-id="${id}" group-title="Movies",${name}`);
  out.push(url);
}

const NEW_KIDS = [
  ['PBS Kids', 'PBSKids.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/PBS_Kids_logo_2022.svg/512px-PBS_Kids_logo_2022.svg.png',
   'https://livestream.pbskids.org/out/v1/14507d931bbe48a69287e4850e53443c/est.m3u8'],
  ['Forever Kids', 'ForeverKids.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Pluto_TV_2020_logo.svg/512px-Pluto_TV_2020_logo.svg.png',
   'https://jmp2.uk/plu-56171fafada51f8004c4b40f.m3u8'],
  ['Mr Bean (Live Action)', 'MrBeanLiveAction.uk', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Mr_Bean_2007_logo.png/512px-Mr_Bean_2007_logo.png',
   'https://amg00627-amg00627c40-rakuten-uk-5725.playouts.now.amagi.tv/playlist/amg00627-banijayfast-mrbeanpopupcc-rakutenuk/playlist.m3u8'],
  ['ABC Kids (Australia)', 'ABCKids.au', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/ABC_KIDS_2024.svg/512px-ABC_KIDS_2024.svg.png',
   'https://c.mjh.nz/abc-kids.m3u8'],
];
for (const [name, id, logo, url] of NEW_KIDS) {
  out.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" tvg-id="${id}" group-title="Kids",${name}`);
  out.push(url);
}

const NEW_TALK = [
  // UK talk / comedy
  ['Top Gear', 'TopGear.uk', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Top_Gear_logo.svg/512px-Top_Gear_logo.svg.png',
   'https://jmp2.uk/plu-636adc255bcf470007d6e0e2.m3u8'],
  ['The Graham Norton Show', 'TheGrahamNortonShow.uk', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/The_Graham_Norton_Show_logo.png/512px-The_Graham_Norton_Show_logo.png',
   'https://amg00654-itv-amg00654c35-rakuten-gb-7598.playouts.now.amagi.tv/playlist.m3u8'],
  ['The Chat Show Channel', 'TheChatShowChannel.uk', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Pluto_TV_2020_logo.svg/512px-Pluto_TV_2020_logo.svg.png',
   'https://amg00426-lds-amg00426c11-rakuten-uk-3888.playouts.now.amagi.tv/playlist.m3u8'],
  ['TalkTV', 'TalkTV.uk', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/TalkTV_logo.svg/512px-TalkTV_logo.svg.png',
   'https://live-talktv-ssai.simplestreamcdn.com/v1/master/774d979dd66704abea7c5b62cb34c6815fda0d35/talktv-live/index.m3u8'],
  ['talkSPORT', 'talkSPORT.uk', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/TalkSport_2016.svg/512px-TalkSport_2016.svg.png',
   'https://af7a8b4e.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctZ2JfdGFsa1NQT1JUX0hMUw/playlist.m3u8'],
  // US talk / classic / game
  ['SNL Vault', 'SNLVault.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Saturday_Night_Live_logo.svg/512px-Saturday_Night_Live_logo.svg.png',
   'https://d4whmvwm0rdvi.cloudfront.net/10007/99993017/hls/master.m3u8?ads.xumo_channelId=99993017'],
  ['Entertainment Tonight', 'EntertainmentTonight.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Entertainment_Tonight_logo.png/512px-Entertainment_Tonight_logo.png',
   'https://enterbcef94b.airspace-cdn.cbsivideo.com/master.m3u8'],
  ['The Carol Burnett Show', 'TheCarolBurnettShow.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Tubi_logo.png/512px-Tubi_logo.png',
   'https://aegis-cloudfront-1.tubi.video/e17b8de5-e8b7-415a-8377-5707a2f9a727/playlist.m3u8'],
  ['Judge Judy', 'TheJudgeJudyChannel.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Pluto_TV_2020_logo.svg/512px-Pluto_TV_2020_logo.svg.png',
   'https://jmp2.uk/plu-622f498d119b4c000719c0b7.m3u8'],
  ['Game Show Central', 'GameShowCentral.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Pluto_TV_2020_logo.svg/512px-Pluto_TV_2020_logo.svg.png',
   'https://jmp2.uk/plu-5e54187aae660e00093561d6.m3u8'],
  ['Game Show Network', 'GameShowNetwork.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Game_Show_Network_logo.svg/512px-Game_Show_Network_logo.svg.png',
   'https://a-cdn.klowdtv.com/live2/gsn_720p/playlist.m3u8'],
  ['Antiques Roadshow', 'PBSAntiquesRoadshow.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Antiques_Roadshow_logo.png/512px-Antiques_Roadshow_logo.png',
   'https://amg00953-pbsusa-antiroadshow-xumo-x6ud5.amagi.tv/playlist.m3u8'],
];
for (const [name, id, logo, url] of NEW_TALK) {
  out.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" tvg-id="${id}" group-title="Talk & Variety",${name}`);
  out.push(url);
}

const NEW_SPORTS = [
  ['DAZN Combat', 'DAZNCombat.uk', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/DAZN_logo.svg/512px-DAZN_logo.svg.png',
   'https://dazn-combat-rakuten.amagi.tv/hls/amagi_hls_data_rakutenAA-dazn-combat-rakuten/CDN/master.m3u8'],
  ['ESPN8 The Ocho', 'ESPN8TheOcho.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ESPN_wordmark.svg/512px-ESPN_wordmark.svg.png',
   'https://d3b6q2ou5kp8ke.cloudfront.net/ESPNTheOcho.m3u8'],
];
for (const [name, id, logo, url] of NEW_SPORTS) {
  out.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" tvg-id="${id}" group-title="Sports",${name}`);
  out.push(url);
}

const NEW_LIFESTYLE = [
  ['Cops', 'Cops.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Cops_2002_logo.png/512px-Cops_2002_logo.png',
   'https://a7d6af1c184e465db4f39316a5181c1f.mediatailor.us-east-1.amazonaws.com/v1/master/0fb304b2320b25f067414d481a779b77db81760d/RakutenTV-eu_COPS/playlist.m3u8'],
  ['FailArmy', 'FailArmy.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Pluto_TV_2020_logo.svg/512px-Pluto_TV_2020_logo.svg.png',
   'https://jmp2.uk/plu-5f5141c1605ddf000748eb1b.m3u8'],
  ['Pluto Animals', 'PlutoTVAnimals.us', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Pluto_TV_2020_logo.svg/512px-Pluto_TV_2020_logo.svg.png',
   'https://jmp2.uk/plu-5d767ae7b456c8cf265ce922.m3u8'],
];
for (const [name, id, logo, url] of NEW_LIFESTYLE) {
  out.push(`#EXTINF:-1 tvg-name="${name}" tvg-logo="${logo}" tvg-id="${id}" group-title="Lifestyle",${name}`);
  out.push(url);
}

// 8) Germany — copy verbatim from onstv, except channels promoted to Music
const germany = channels.filter(c => c.group === 'Germany' && !MUSIC_FROM_ONSTV.has(c.tvgId) && !EXCLUDE_TVG_ID.has(c.tvgId));
for (const c of germany) push(c.extinf, c.extras, c.url, 'Germany');

// 8) Middle East — Israel + Palestine + Jordan + Lebanon, minus channels promoted to News
const ME_GROUPS = new Set(['Israel', 'Palestine', 'Jordan', 'Lebanon']);
const me = channels.filter(c => ME_GROUPS.has(c.group) && !NEWS_FROM_ME.has(c.tvgId) && !EXCLUDE_TVG_ID.has(c.tvgId));
for (const c of me) push(c.extinf, c.extras, c.url, 'Middle East');

await writeFile(OUT, out.join('\n') + '\n');
console.log(`Wrote ${OUT}`);
const docCount = NEW_DOC.length + (nasaMedia ? 1 : 0);
const musicCount = musicFromOnstv.length + NEW_MUSIC.length;
console.log(`  News:        ${NEW_NEWS.length + arabicNews.length + meNews.length}`);
console.log(`  Documentary: ${docCount}`);
console.log(`  World:       ${NEW_WORLD.length}`);
console.log(`  Independent: ${NEW_INDEP.length}`);
console.log(`  Music:       ${musicCount}`);
console.log(`  Travel:      ${NEW_TRAVEL.length}`);
console.log(`  Movies:      ${NEW_MOVIES.length}`);
console.log(`  Kids:        ${NEW_KIDS.length}`);
console.log(`  Talk & Variety: ${NEW_TALK.length}`);
console.log(`  Sports:      ${NEW_SPORTS.length}`);
console.log(`  Lifestyle:   ${NEW_LIFESTYLE.length}`);
console.log(`  Germany:     ${germany.length}`);
console.log(`  Middle East: ${me.length}`);
const extraNew = NEW_MOVIES.length + NEW_KIDS.length + NEW_TALK.length + NEW_SPORTS.length + NEW_LIFESTYLE.length;
console.log(`  Total: ${NEW_NEWS.length + arabicNews.length + meNews.length + docCount + NEW_WORLD.length + NEW_INDEP.length + musicCount + NEW_TRAVEL.length + extraNew + germany.length + me.length}`);
