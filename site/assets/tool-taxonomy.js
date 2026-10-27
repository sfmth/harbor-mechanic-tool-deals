/* Practical tool types for browsing and explicit any-brand ownership choices. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToolTaxonomy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const GROUPS = [
    ['sockets','Sockets'], ['wrenches','Wrenches'], ['ratchets','Ratchets & torque tools'],
    ['drivers','Screwdrivers & hex keys'], ['bits','Bits, drilling & threading'], ['pliers','Pliers & wire tools'],
    ['striking','Hammers, punches & pry bars'], ['cutting','Cutting & shaping hand tools'], ['measuring','Measuring & inspection'],
    ['lifting','Jacks, lifting & support'], ['brakes','Brake service'], ['engine','Engine, drivetrain & A/C'],
    ['fluids','Oil, grease & fluid service'], ['diagnostics','Diagnostics & vehicle electrical'], ['tires','Tire & wheel service'],
    ['air-tools','Air tools'], ['power-tools','Electric power tools'], ['air-equipment','Compressors & air accessories'],
    ['storage','Tool storage & organization'], ['lighting','Lighting & power'], ['garage','Garage, bodywork & cleaning']
  ].map(([id,label])=>Object.freeze({id,label}));
  const TYPES = [];
  function add(group, family, definitions) {
    for (const [id,label,words] of definitions) TYPES.push(Object.freeze({id,label,group,family,keywords:Object.freeze((words||'').split('|').filter(Boolean))}));
  }
  add('sockets','sockets',[
    ['chrome-sockets','Chrome hand socket sets','shallow|deep|standard|metric|sae'],
    ['chrome-shallow-sockets','Shallow chrome socket sets','standard|hand|metric|sae'],
    ['chrome-deep-sockets','Deep chrome socket sets','hand|metric|sae'],
    ['impact-sockets','Impact socket sets · unspecified depth','metric|sae'],
    ['impact-shallow-sockets','Shallow impact socket sets','standard|metric|sae'],
    ['impact-deep-sockets','Deep impact socket sets','metric|sae'],
    ['swivel-sockets','Swivel / universal socket sets','flex'],
    ['torx-sockets','TORX / external TORX socket sets','star|e torx|e socket'],
    ['hex-bit-sockets','Hex / Allen bit socket sets','allen|hex bit'],
    ['specialty-sockets','Specialty & vehicle socket sets','spark plug|axle|lug|oxygen|sensor'],
    ['mixed-socket-sets','Socket & ratchet / mechanic sets','mechanics|master|pass through']
  ]);
  add('sockets','socket-accessories',[
    ['socket-extensions','Socket extension bars','extension'], ['socket-adapters','Socket adapters & universal joints','reducer|swivel|wobble'],
  ]);
  add('wrenches','wrenches',[
    ['combination-wrenches','Combination wrench sets','open box end|metric|sae'],
    ['ratcheting-wrenches','Ratcheting wrench sets','gear|reversible'],
    ['flex-ratcheting-wrenches','Flex-head ratcheting wrench sets','flexible'],
    ['flare-nut-wrenches','Flare-nut / line wrench sets','brake|line'],
    ['crowfoot-wrenches','Crowfoot wrench sets','crow foot'],
    ['open-end-wrenches','Open-end / service wrench sets','thin|service'],
    ['box-end-wrenches','Box-end / offset wrench sets','double box|offset'],
    ['specialty-wrenches','Specialty fixed-size wrench sets','obstruction|s type|stubby']
  ]);
  add('wrenches','adjustable-wrenches',[
    ['adjustable-wrenches','Adjustable wrenches','crescent'], ['pipe-wrenches','Pipe / strap wrenches','plumbing|strap']
  ]);
  add('ratchets','ratchets',[
    ['hand-ratchets','Standard hand ratchets','quick release'], ['flex-ratchets','Flex-head / swivel hand ratchets','articulating'],
  ]);
  add('ratchets','torque-wrenches',[
    ['torque-wrenches','Torque wrenches','click|digital|beam'], ['torque-adapters','Torque adapters & multipliers','digital|multiplier']
  ]);
  add('ratchets','breaker-bars',[['breaker-bars','Breaker bars','flex handle']]);
  add('drivers','hex-keys',[['hex-keys','Hex / Allen key sets','allen|ball end|folding|t handle'], ['torx-keys','TORX key sets','star|security']]);
  add('drivers','other-tools',[
    ['screwdrivers','Screwdrivers & screwdriver sets','phillips|slotted|precision'], ['impact-screwdrivers','Manual impact screwdrivers','striking|impact driver'], ['nut-drivers','Hand nut-driver sets','nut setter']
  ]);
  add('bits','drill-bits',[
    ['twist-drill-bits','Twist drill-bit sets','cobalt|titanium|hss|black oxide'], ['step-drill-bits','Step drill-bit sets','unibit'], ['hole-saws','Hole-saw sets','bi metal|hole cutter']
  ]);
  add('bits','driver-bits',[['driver-bits','Driver-bit / nut-setter sets','screwdriver bits|impact bits']]);
  add('bits','other-tools',[
    ['taps-dies','Tap, die & thread-repair sets','threading|drill tap|thread chaser'], ['extractors','Screw / bolt extractor sets','broken screw|stud remover'], ['metal-cutting-bits','End mills & metalworking cutter sets','milling|metalworking bits'], ['drill-accessories','Drill chucks, guides & accessories','arbor|mandrel|drill adapter']
  ]);
  add('pliers','pliers',[
    ['combination-pliers','Pliers sets / slip-joint pliers','lineman|combination|assortment'],
    ['needle-nose-pliers','Needle-nose / long-reach pliers','long nose|bent nose'], ['locking-pliers','Locking pliers','vise grip'],
    ['groove-joint-pliers','Groove-joint / water-pump pliers','tongue groove|adjustable joint'],
    ['cutting-pliers','Diagonal / end-cutting pliers','side cutters|end nipper'], ['snap-ring-pliers','Snap-ring / retaining-ring pliers','circlip'],
    ['wire-strippers-crimpers','Wire strippers, crimpers & terminal tools','electrical|terminal'], ['specialty-pliers','Hose, clamp & specialty pliers','pinch off|hose clamp|fencing']
  ]);
  add('striking','hammers',[
    ['ball-peen-hammers','Ball-peen / mechanic hammer sets','ball pein|cross peen'], ['dead-blow-hammers','Dead-blow hammers','shot filled'],
    ['mallets','Rubber / soft-face mallets','soft face'], ['other-hammers','Sledge, drilling & other hammers','engineer|claw|sledge']
  ]);
  add('striking','other-tools',[
    ['punches-chisels','Punch, chisel & stamping sets','center punch|pin punch|cold chisel|number stamps'], ['pry-bars','Pry bars & alignment tools','rolling head|heel bar'], ['picks-scrapers','Picks, hooks & scrapers','gasket|seal pick']
  ]);
  add('cutting','other-tools',[
    ['hand-cutters','Snips, shears & bolt cutters','aviation|metal shears'], ['hand-saws-knives','Hand saws & utility knives','hacksaw|knife'],
    ['files-deburring','Files, reamers & deburring tools','rasp|metal file'], ['abrasives-accessories','Abrasives, grinding & polishing accessories','flap|sanding|buffing|rotary accessory']
  ]);
  add('measuring','other-tools',[
    ['precision-measuring','Calipers, micrometers & gauges','dial indicator|feeler|thread gauge|bore gauge'], ['measuring-layout','Measuring & layout tools','tape|ruler|square|level'], ['inspection-retrieval','Inspection mirrors & retrieval tools','magnetic pickup|borescope|inspection camera']
  ]);
  add('lifting','jacks',[['floor-jacks','Floor / trolley jacks','low profile|racing jack'], ['bottle-jacks','Bottle jacks','hydraulic'], ['transmission-jacks','Transmission / specialty jacks','motorcycle|atv|scissor|farm']]);
  add('lifting','jack-stands',[['jack-stands','Jack stands & support stands','axle stand']]);
  add('lifting','ramps',[['vehicle-ramps','Vehicle service ramps','car ramp|lifting ramp']]);
  add('lifting','other-tools',[
    ['hoists-cranes','Engine hoists, shop cranes & lifting gear','chain hoist|lift table|load leveler'], ['engine-stands','Engine stands & support bars','engine support'], ['creepers-seats','Creepers & mechanic seats','rolling stool']
  ]);
  add('brakes','other-tools',[
    ['brake-bleeders','Brake bleeding & vacuum kits','bleeder|vacuum pump'], ['brake-caliper-tools','Caliper piston / disc-brake tools','rewind|piston compressor'], ['brake-line-tools','Brake-line flaring, bending & cutting tools','tubing|tube cutter|double flare'], ['brake-service-tools','Drum-brake & other brake tools','brake spring|brake service']
  ]);
  add('engine','other-tools',[
    ['pullers-bearing-tools','Pullers, bearing & ball-joint service','gear puller|hub|press|bushing'], ['suspension-steering-tools','Suspension, steering & spring-compressor tools','tie rod|strut|front end'], ['engine-service-tools','Engine & timing service tools','compression|leak down|harmonic balancer|valve|fuel injection'],
    ['drivetrain-exhaust-tools','Drivetrain, axle & exhaust service','clutch|cv joint|exhaust|transmission'], ['ac-service-tools','A/C service & refrigerant tools','manifold gauge|refrigerant|air conditioning|vacuum pump']
  ]);
  add('fluids','other-tools',[
    ['oil-drain-containers','Oil drain pans, tanks & fluid collection','drip pan|drain bucket'], ['oil-filter-tools','Oil-filter wrenches & service tools','filter cap|oil filter'],
    ['fluid-transfer','Fluid pumps, extractors & funnels','transfer|siphon|fluid evacuator|fuel can'], ['grease-guns','Grease guns & lubrication tools','coupler|grease injector']
  ]);
  add('diagnostics','diagnostics',[
    ['scan-tools','OBD code readers & scan tools','obd2|obd ii|scanner'], ['multimeters-testers','Multimeters & electrical testers','voltmeter|circuit|continuity|test light'],
    ['battery-testers','Battery / charging-system testers','load tester|battery analyzer'], ['vehicle-diagnostic-tools','Other vehicle diagnostic tools','stethoscope|timing light|noid|fuel pressure']
  ]);
  add('diagnostics','other-tools',[
    ['battery-service-tools','Vehicle battery terminal & service tools','terminal cleaner|terminal brush|terminal puller|battery disconnect'], ['battery-chargers','Vehicle battery chargers & maintainers','tender|engine starter'], ['jump-starters-cables','Jump starters & booster cables','jump pack|booster']
  ]);
  add('tires','other-tools',[
    ['tire-inflators-gauges','Tire inflators & pressure gauges','air chuck|digital tire'], ['tire-service-tools','Tire repair & changing tools','bead breaker|tire spoon|valve core|tire changer'], ['wheel-service-tools','Wheel, lug & balancing tools','wheel balancer|wheel weight|lug nut']
  ]);
  add('air-tools','air-tools',[
    ['air-impact-wrenches','Air impact wrenches','pneumatic|air powered'], ['air-ratchets','Air ratchet wrenches','pneumatic'], ['air-hammers','Air hammers, chisels & scalers','needle scaler'],
    ['air-grinders','Air die / angle grinders','pneumatic|die grinder'], ['air-sanders-polishers','Air sanders & polishers','pneumatic|orbital'], ['air-drills','Air drills & screwdrivers','pneumatic'],
    ['air-cutting-tools','Air saws, shears & nibblers','pneumatic|cut off'], ['air-spray-guns','Paint spray guns & airbrushes','hvlp|sprayer'], ['air-riveters','Air riveters','pneumatic'], ['other-air-tools','Other air-powered tools','pneumatic']
  ]);
  add('power-tools','power-tools',[
    ['electric-impact-wrenches','Electric / cordless impact wrenches','battery|corded'], ['electric-ratchets','Electric / cordless ratchets','powered ratchet'],
    ['electric-drills','Electric drills & drill presses','cordless|corded|hammer drill'], ['electric-impact-drivers','Electric impact drivers & screwdrivers','cordless screwdriver'],
    ['electric-grinders','Electric grinders & rotary tools','angle grinder|die grinder|bench grinder|engraver'], ['electric-sanders-polishers','Electric sanders, polishers & buffers','orbital|palm|belt|disc'],
    ['electric-saws','Electric saws & oscillating tools','reciprocating|jig|band|cut off|multi tool'], ['heat-guns','Heat guns','hot air'], ['power-batteries-chargers','Power-tool batteries & chargers','battery pack|lithium|starter kit'], ['electric-combo-kits','Electric power-tool combo kits','cordless combo'], ['other-electric-tools','Other electric power tools','corded|cordless']
  ]);
  add('air-equipment','other-tools',[
    ['air-compressors-tanks','Air compressors & portable tanks','airbrush compressor'], ['air-hoses-reels','Air hoses & hose reels','pneumatic hose'],
    ['air-filters-regulators','Air filters, regulators & lubricators','water separator|desiccant|air dryer'], ['air-fittings-accessories','Air fittings, couplers & accessory kits','quick connect|connector'], ['air-blow-guns','Air blow guns & cleaning tools','pneumatic|blowgun']
  ]);
  add('storage','storage',[
    ['tool-chests-carts','Tool chests, cabinets & carts','rolling|drawers'], ['tool-bags-boxes','Tool bags, cases & boxes','backpack|tote'], ['tool-organizers','Socket, wrench & tool organizers','rail|rack|holder|drawer'], ['shelving-parts-storage','Shelving, bins & parts storage','shelf|bin|parts case']
  ]);
  add('lighting','lighting',[['work-lights','Work / garage lights','shop light|flood|underhood'], ['flashlights','Flashlights & headlamps','torch|headlight']]);
  add('lighting','other-tools',[['garage-power','Extension cords, outlets & inverters','power strip|electrical distribution|inverter']]);
  add('garage','other-tools',[
    ['metal-forming-tools','Shop presses, benders & metal-forming tools','arbor|hydraulic ram|ring roller|shrinker'], ['sealant-guns','Caulking & sealant guns','adhesive'], ['clamps-vises','Clamps, vises & anvils','bench vise|c clamp'], ['workbenches-handling','Workbenches & shop material handling','dolly|hand truck|work stand'],
    ['bodywork-tools','Auto body & glass service tools','dent|suction|windshield|panel'], ['welding-tools','Welding, soldering & torch equipment','welder|brazing|oxygen acetylene'],
    ['vacuum-cleaning','Vacuums, parts washers & cleaning equipment','wet dry|parts cleaner|pressure washer|steam|blaster'], ['detailing-supplies','Detailing brushes, towels & supplies','car wash|sponge|microfiber'],
    ['garage-safety','Garage protective gear & safety equipment','gloves|glasses|goggles|respirator|ventilator|fan|recovery|restraint'], ['miscellaneous-tools','Other mechanic & shop tools','miscellaneous']
  ]);
  const typeMap = new Map(TYPES.map(t=>[t.id,t]));
  const getType = id => typeMap.get(String(id||''))||null;
  const clean = v=>String(v==null?'':v).toLowerCase().replace(/[‐‑–—]/g,'-').replace(/&/g,' and ').replace(/[^a-z0-9/]+/g,' ').trim();
  function classify(row) {
    row=row||{};
    const n=clean(row.Product||row.label||row.name), c=clean(row.Category||row.category), t=`${n} ${c}`;
    function result(id) { const type=getType(id); return {group:type.group,type:type.id,label:type.label,family:type.family}; }
    // Extraction describes several different jobs. Resolve the object before socket/drill keywords.
    if (/fluid extract|fluid evacuat|oil extract|oil evacuat|fluid.*dispenser|siphon pump|fluid siphon/.test(n)) return result('fluid-transfer');
    if (/extractor sets/.test(c)||/(?:screw|bolt|stud|fastener).*extract|extract.*(?:screw|bolt|stud|fastener)|stud remov/.test(n)) return result('extractors');
    if (/dent puller/.test(n)) return result('bodywork-tools');
    if (/slide hammer.*(?:puller|bearing)|puller.*slide hammer/.test(n)) return result('pullers-bearing-tools');
    // Accessories are routed before their powered tool; an impact socket is not an impact wrench.
    if (/socket (?:holder|organizer|rail)|wrench (?:organizer|rack)|tool organizer|drawer organizer/.test(t)) return result('tool-organizers');
    if (/socket extension|extension bar|extension set/.test(t)) return result('socket-extensions');
    if (/socket adapter|socket.*universal joint|universal joint.*socket|drive adapter|socket driver/.test(t)) return result('socket-adapters');
    if (/socket and ratchet|mechanics? tool set|master socket|pass thru|pass through|modular general service/.test(t)) return result('mixed-socket-sets');
    if (/socket/.test(t)&&!/electrical socket|socket wrench.*air|air.*socket wrench/.test(t)) {
      if (/spark plug|oxygen sensor|axle nut|lug nut|sensor socket|strut nut/.test(n)) return result('specialty-sockets');
      if (/torx|\be socket\b|star bit/.test(n)) return result('torx-sockets');
      if (/hex.*bit|hex.*socket|triple square|bit socket/.test(n)) return result('hex-bit-sockets');
      if (/swivel|universal.*socket/.test(n)) return result('swivel-sockets');
      if (/impact/.test(t)) return result(/\bdeep\b/.test(n)?'impact-deep-sockets':/shallow|standard/.test(n)?'impact-shallow-sockets':'impact-sockets');
      return result(/\bdeep\b/.test(n)?'chrome-deep-sockets':/shallow|standard/.test(n)?'chrome-shallow-sockets':'chrome-sockets');
    }
    if (/torque wrench/.test(t)) return result('torque-wrenches');
    if (/torque adapter|torque multiplier/.test(t)) return result('torque-adapters');
    if (/breaker bar/.test(t)) return result('breaker-bars');
    // Vehicle battery equipment must win over incidental batteries, lamps or compressors.
    if (/jump start|booster cable/.test(t)) return result('jump-starters-cables');
    if (/battery chargers and maintainers/.test(c)||/battery maintainer|float charger|charger.*engine start|battery charger.*(?:microprocessor|automatic)/.test(n)) return result('battery-chargers');
    if (/battery.*(?:test|checker|analyz)|(?:alternator|load).*test/.test(n)) return result('battery-testers');
    if (/battery terminal|terminal (?:brush|cleaner|puller)|battery disconnect|battery service/.test(n)||/battery testers tools and accessories/.test(c)) return result('battery-service-tools');
    // A storage cart's wheels and a work light's clamp are features, not their tool type.
    if (/^(?:work lights|flashlights|ultra bright flashlights|job site lighting|motion activated lights|portable work lights)$/.test(c)) return result(/flashlights/.test(c)?'flashlights':'work-lights');
    if (/^(?:tool boxes|tool bags|tool carts|tool organizers|drawer organizers|organizers|garage shelving and storage|parts bins and racks|parts cases|storage accessories)$/.test(c)) {
      if (/tool carts/.test(c)||/tool chest|tool cabinet|rolling cabinet/.test(n)) return result('tool-chests-carts');
      if (/tool boxes|tool bags/.test(c)) return result('tool-bags-boxes');
      if (/organizers/.test(c)) return result('tool-organizers');
      return result('shelving-parts-storage');
    }
    if (/air compressor|portable air tank|airbrush compressor/.test(n)&&!/accessor|connector|coupler|filter|regulator/.test(t)) return result('air-compressors-tanks');
    if (/air hose|hose reel/.test(t)) return result('air-hoses-reels');
    if (/air filter|air regulator|filter and regulator|air dryer|water separator|air lubricator/.test(t)) return result('air-filters-regulators');
    if (/air.*(?:coupler|connector|fitting|accessory)|compressor accessory/.test(t)) return result('air-fittings-accessories');
    if (/air blow gun|air.*blowgun/.test(t)) return result('air-blow-guns');
    if (/tire|inflator|air chuck/.test(t)&&!/tire.*impact wrench|tire.*socket/.test(n)) {
      if (/inflator|pressure gauge|air chuck/.test(t)) return result('tire-inflators-gauges');
      return result('tire-service-tools');
    }
    if (/pressure washer/.test(t)) return result('vacuum-cleaning');
    if (/spray gun|airbrush/.test(t)) return result('air-spray-guns');
    const isAir=/\b(?:air|pneumatic)\b/.test(t)&&!/air conditioning|air conditioner|heat gun/.test(t);
    if (isAir && /impact wrench|ratchet|hammer|chisel|scaler|scraper|grinder|sander|polisher|drill|screwdriver|nibbler|shear|cutter|cut off|saw|riveter|air tools/.test(t)) {
      if (/impact wrench/.test(t)) return result('air-impact-wrenches');
      if (/ratchet/.test(t)) return result('air-ratchets');
      if (/hammer|chisel|scaler|scraper|file/.test(t)) return result('air-hammers');
      if (/grinder/.test(t)) return result('air-grinders');
      if (/sander|polisher/.test(t)) return result('air-sanders-polishers');
      if (/drill|screwdriver/.test(t)) return result('air-drills');
      if (/saw|nibbler|shear|cutter|cut off/.test(t)) return result('air-cutting-tools');
      if (/riveter/.test(t)) return result('air-riveters');
      return result('other-air-tools');
    }
    if (/grease gun|lubrication|grease and grease/.test(t)) return result('grease-guns');
    if (/drill bit|step drill|hole saw|drill tap|tap and die|thread repair|thread chaser/.test(t)) {
      if (/hole saw/.test(t)) return result('hole-saws');
      if (/tap|die|thread repair|thread chaser/.test(n)||/tap and die/.test(c)) return result('taps-dies');
      if (/step/.test(t)) return result('step-drill-bits');
      return result('twist-drill-bits');
    }
    if (/end mill|metalworking bit/.test(t)) return result('metal-cutting-bits');
    if (/driver bit|nut setter|drill adapter/.test(t)) return result('driver-bits');
    if (/hex.*key|allen.*key|torx.*key/.test(t)) return result(/torx|star/.test(n)?'torx-keys':'hex-keys');
    if (/polishing.*(?:pad|wheel|accessor|backing|tool)|buffing wheel|bonnet|grinder.*accessor|rotary tool accessor|die grinder abrasive|surface cleaning and abrasive|surface conditioning|sanding.*(?:disc|belt)|abrasive/.test(t)) return result('abrasives-accessories');
    if (/drill accessor|drill chuck|drill guide|drill arbor|drill mandrel/.test(t)) return result('drill-accessories');
    if (/battery|charger/.test(n)&&!/drill|driver|saw|grinder|rotary|oscillating|sander|polisher|blower|ratchet|wrench|vacuum|fan|light\b|grease gun|caulk|inverter|pump|terminal|jump|maintainer|tester|checker|analyz|engine start/.test(n)&&(/(?:bauer|hercules) battery system/.test(c)||/lithium|\d ah\b|battery bundle|rapid charger|battery and.*starter kit/.test(n))) return result('power-batteries-chargers');
    if (/clamp|vise|anvil/.test(n)) return result('clamps-vises');
    if (/caulk|sealant application|adhesive gun/.test(t)) return result('sealant-guns');
    if (/inverter|power source battery/.test(n)) return result('garage-power');
    if (/combo kit|(?:2|3|4|5|6) tool.*kit/.test(n)) return result('electric-combo-kits');
    if (/work light|shop light|underhood light|headlamp|flashlight/.test(n)&&!/drill|screwdriver|rotary tool|oscillating/.test(n)) return result(/headlamp|flashlight/.test(n)?'flashlights':'work-lights');
    if (/combo kit/.test(t)) return result('electric-combo-kits');
    if (/impact wrench/.test(t)) return result('electric-impact-wrenches');
    if (/ratchet/.test(t)&&/cordless|electric|volt|powered|\b(?:12v|20v)\b/.test(t)) return result('electric-ratchets');
    if (/impact driver|cordless.*screwdriver/.test(n)&&!/manual|hand impact|drill/.test(n)) return result('electric-impact-drivers');
    if (/cordless drill|corded drill|hammer drill|drill press|cordless.*drill|corded.*drill/.test(t)) return result('electric-drills');
    if (/angle grinder|die grinder|bench grinder|rotary tool|engraver/.test(t)) return result('electric-grinders');
    if (/sander|polisher|bench buffer/.test(t)) return result('electric-sanders-polishers');
    if (/reciprocating saw|jig saw|band saw|scroll saw|cut off saw|oscillating multi/.test(t)) return result('electric-saws');
    if (/heat gun/.test(t)) return result('heat-guns');
    if (/\b(?:corded|cordless)\b/.test(t)) return result('other-electric-tools');
    if (/ratchet/.test(t)&&!/wrench/.test(t)) return result(/flex|swivel|articulating/.test(n)?'flex-ratchets':'hand-ratchets');
    if (/oil filter/.test(t)) return result('oil-filter-tools');
    if (/pipe wrench|strap wrench/.test(n)) return result('pipe-wrenches');
    if (/adjustable.*wrench/.test(t)) return result('adjustable-wrenches');
    if (/wrench/.test(t)) {
      if (/crowfoot|crow foot/.test(t)) return result('crowfoot-wrenches');
      if (/flare nut|line wrench/.test(t)) return result('flare-nut-wrenches');
      if (/ratchet/.test(t)) return result(/flex/.test(n)?'flex-ratcheting-wrenches':'ratcheting-wrenches');
      if (/obstruction|s type|s shaped/.test(n)) return result('specialty-wrenches');
      if (/combination/.test(n)) return result('combination-wrenches');
      if (/open end|service wrench/.test(n)) return result('open-end-wrenches');
      if (/box end|offset/.test(n)) return result('box-end-wrenches');
      return result('specialty-wrenches');
    }
    if (/manual impact|hand impact/.test(t)) return result('impact-screwdrivers');
    if (/nut driver/.test(t)) return result('nut-drivers');
    if (/screwdriver/.test(t)) return result('screwdrivers');
    if (/wire stripper|crimper|terminal tool|wire tools/.test(t)&&!/pliers/.test(n)) return result('wire-strippers-crimpers');
    if (/plier|nipper|wire cutter/.test(t)) {
      if (/snap ring|retaining ring|circlip/.test(n)) return result('snap-ring-pliers');
      if (/hose|clamp|pinch off|fencing/.test(n)) return result('specialty-pliers');
      if (/locking/.test(n)) return result('locking-pliers');
      if (/needle|long nose|bent nose|long reach/.test(n)) return result('needle-nose-pliers');
      if (/groove|tongue|water pump|adjustable joint/.test(n)) return result('groove-joint-pliers');
      if (/diagonal|side cut|end cut|nipper/.test(n)) return result('cutting-pliers');
      if (/stripper|crimp/.test(n)) return result('wire-strippers-crimpers');
      return result('combination-pliers');
    }
    if (/hammer|mallet/.test(t)) {
      if (/dead blow/.test(n)) return result('dead-blow-hammers');
      if (/mallet|soft face|rubber/.test(n)) return result('mallets');
      return result(/ball peen|ball pein/.test(n)?'ball-peen-hammers':'other-hammers');
    }
    if (/jack stand|support stand/.test(n)) return result('jack-stands');
    if (/engine stand|engine support/.test(n)) return result('engine-stands');
    if (/floor jack|trolley jack|racing jack/.test(n)) return result('floor-jacks');
    if (/bottle jack/.test(n)) return result('bottle-jacks');
    if (/\bjack\b/.test(n)) return result('transmission-jacks');
    if (/lifting ramp|vehicle ramp|automotive ramp|car ramp|service ramp/.test(t)) return result('vehicle-ramps');
    if (/creeper|mechanic.*seat|rolling.*stool|shop seat/.test(t)) return result('creepers-seats');
    if (/crane|hoist|load leveler|lift table|lifts cranes|lifting and/.test(t)) return result('hoists-cranes');
    if (/brake bleed|bleeder/.test(t)) return result('brake-bleeders');
    if (/brake line|flar(?:e|ing) tool|tubing|tube (?:bender|cutter)/.test(t)) return result('brake-line-tools');
    if (/caliper.*(?:piston|tool)|disc brake/.test(t)) return result('brake-caliper-tools');
    if (/brake/.test(t)) return result('brake-service-tools');
    if (/tie rod|spring compressor|front end service|strut/.test(n)) return result('suspension-steering-tools');
    if (/shop press|arbor press|pipe bender|short body ram|pull back ram|compact bender|ring roller|shrinker|stretcher/.test(n)) return result('metal-forming-tools');
    if (/air conditioning|refrigerant|manifold gauge|ac service|a c service/.test(t)) return result('ac-service-tools');
    if (/puller|bearing|ball joint|bushing|hydraulic.*press/.test(t)) return result('pullers-bearing-tools');
    if (/transmission|drivetrain|clutch|cv joint|axle|exhaust/.test(t)) return result('drivetrain-exhaust-tools');
    if (/engine|timing belt|valve spring|compression test|leak down|fuel injector/.test(t)) return result('engine-service-tools');
    if (/transfer pump|liquid transfer|fluid extractor|siphon|evacuat/.test(n)) return result('fluid-transfer');
    if (/fluid collection|drain pan|oil drain|drip pan|drain container/.test(t)) return result('oil-drain-containers');
    if (/fluid|fuel can|funnel|transfer pump|siphon|evacuat/.test(t)) return result('fluid-transfer');
    if (/jump start|booster cable/.test(t)) return result('jump-starters-cables');
    if (/battery charger|battery maintainer/.test(t)) return result('battery-chargers');
    if (/battery test|load tester|battery analyzer/.test(t)) return result('battery-testers');
    if (/scan tool|code reader|obd/.test(t)) return result('scan-tools');
    if (/multimeter|electrical test|circuit test|test light|voltmeter/.test(t)) return result('multimeters-testers');
    if (/diagnostic|timing light|stethoscope|fuel pressure|noid/.test(t)) return result('vehicle-diagnostic-tools');
    if (/wheel|lug nut|lug wrench/.test(t)) return result('wheel-service-tools');
    if (/punch|chisel|metal stamping/.test(t)) return result('punches-chisels');
    if (/pry bar|alignment tool/.test(t)) return result('pry-bars');
    if (/inspection|retrieval|pickup tool|magnetic pick/.test(t)) return result('inspection-retrieval');
    if (/pick|hook|scraper/.test(t)) return result('picks-scrapers');
    if (/file|reamer|deburr/.test(t)) return result('files-deburring');
    if (/snip|shear|cutter|cutting hand tool/.test(t)) return result('hand-cutters');
    if (/knife|utility blade|hack ?saw|hand saw/.test(t)) return result('hand-saws-knives');
    if (/precision measuring|caliper|micrometer|dial indicator|feeler|gauge/.test(t)) return result('precision-measuring');
    if (/measur|thermometer|scale|layout|level|ruler/.test(t)) return result('measuring-layout');
    if (/flashlight|headlamp/.test(t)) return result('flashlights');
    if (/work light|lighting|shop light|motion activated light/.test(t)) return result('work-lights');
    if (/electrical power|extension cord|power strip|inverter|outlet/.test(t)) return result('garage-power');
    if (/tool chest|tool cabinet|tool cart|rolling cabinet/.test(t)) return result('tool-chests-carts');
    if (/tool bag|tool box|parts case|tool case|backpack/.test(t)) return result('tool-bags-boxes');
    if (/storage|shelving|parts bin|parts rack/.test(t)) return result('shelving-parts-storage');
    if (/organizer/.test(t)) return result('tool-organizers');
    if (/protective|safety|glove|goggle|respirator|ventilator|fan|floor blower|portable blower|fender.*mat|load restraint|recovery/.test(t)) return result('garage-safety');
    if (/weld|solder|torch|oxygen acetylene/.test(t)) return result('welding-tools');
    if (/auto body|windshield|window|dent|body repair|suction cup/.test(t)) return result('bodywork-tools');
    if (/vacuum|parts wash|parts clean|steam clean|blasting|pressure wash/.test(t)) return result('vacuum-cleaning');
    if (/detailing|car wash|cleaning towel|brush|sponge|pad|vehicle cleaning/.test(t)) return result('detailing-supplies');
    if (/clamp|vise|anvil/.test(t)) return result('clamps-vises');
    if (/workbench|material handling|doll(?:y|ies)|hand truck/.test(t)) return result('workbenches-handling');
    return result('miscellaneous-tools');
  }
  function searchTypes(query, group) {
    const terms=clean(query).split(/\s+/).filter(Boolean);
    return TYPES.filter(type=>(!group||type.group===group)&&terms.every(term=>clean(`${type.label} ${type.keywords.join(' ')} ${GROUPS.find(g=>g.id===type.group)?.label}`).includes(term)));
  }
  return Object.freeze({GROUPS:Object.freeze(GROUPS),TYPES:Object.freeze(TYPES),classify,getType,searchTypes});
});
