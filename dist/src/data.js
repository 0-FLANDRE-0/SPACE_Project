import { JPL_ELEMENTS, IAU_POLES, SATELLITE_ELEMENTS } from './astronomy-data.js';

// A single metric coordinate space: one world unit is exactly one AU.
export const AU_KM = 149597870.7;
export const EPOCH = '2026-10-29T00:00:00Z';
export const J2000_DAYS_AT_EPOCH = (Date.parse(EPOCH) - Date.parse('2000-01-01T12:00:00Z')) / 86400000;
export const BASE_DAYS_PER_SECOND = 0.02;
const texture = name => './assets/textures/2k_' + name;
export const SURFACE_FILES = {
  sun:texture('sun.jpg'), mercury:texture('mercury.jpg'), venus:texture('venus_atmosphere.jpg'),
  earth:texture('earth_daymap.jpg'), clouds:texture('earth_clouds.jpg'), mars:texture('mars.jpg'),
  jupiter:texture('jupiter.jpg'), saturn:texture('saturn.jpg'), rings:texture('saturn_ring_alpha.png'),
  uranus:texture('uranus.jpg'), neptune:texture('neptune.jpg'), moon:texture('moon.jpg'),
};
const physical = b => ({...b, radius:b.realRadius / AU_KM, pole:IAU_POLES[b.id], spinHours:360 / IAU_POLES[b.id].pm[1] * 24});
export const SUN = physical({
  "id": "sun",
  "name": "태양",
  "english": "SUN",
  "type": "G2V · 황색 주계열성",
  "color": "#f7be65",
  "realRadius": 696340,
  "description": "모항성계의 중심. 여덟 행성과 수많은 작은 천체가 이 황색 항성 주위를 공전합니다.",
  "period": 25.38
});
export const PLANETS = [
  {
    "id": "mercury",
    "name": "수성",
    "english": "MERCURY",
    "type": "암석형 행성",
    "color": "#b8afa4",
    "realRadius": 2439.7,
    "au": 0.387,
    "period": 87.97,
    "description": "태양에 가장 가까운 작은 암석 행성. 크레이터로 덮인 표면과 기울어진 궤도를 가지고 있습니다."
  },
  {
    "id": "venus",
    "name": "금성",
    "english": "VENUS",
    "type": "암석형 행성",
    "color": "#dbb97d",
    "realRadius": 6051.8,
    "au": 0.723,
    "period": 224.7,
    "description": "두꺼운 구름에 둘러싸인 암석 행성. 천천히 자전하며 다른 대부분의 행성과 반대 방향으로 회전합니다."
  },
  {
    "id": "earth",
    "name": "지구",
    "english": "EARTH",
    "type": "암석형 행성 · 모행성",
    "color": "#7fb9f4",
    "realRadius": 6371,
    "au": 1,
    "period": 365.256,
    "description": "푸른 바다와 대륙, 얇은 대기를 가진 모행성. 달과 함께 태양 주위를 공전합니다."
  },
  {
    "id": "mars",
    "name": "화성",
    "english": "MARS",
    "type": "암석형 행성",
    "color": "#d88664",
    "realRadius": 3389.5,
    "au": 1.524,
    "period": 686.98,
    "description": "산화철로 붉게 물든 차가운 암석 행성. 두 개의 작은 위성 포보스와 데이모스를 거느립니다."
  },
  {
    "id": "jupiter",
    "name": "목성",
    "english": "JUPITER",
    "type": "가스형 거대 행성",
    "color": "#d3b699",
    "realRadius": 69911,
    "au": 5.203,
    "period": 4332.59,
    "description": "태양계에서 가장 큰 행성. 줄무늬 구름층과 대적점, 갈릴레이 위성들이 작은 행성계 같은 풍경을 만듭니다."
  },
  {
    "id": "saturn",
    "name": "토성",
    "english": "SATURN",
    "type": "가스형 거대 행성",
    "color": "#dfc99d",
    "realRadius": 58232,
    "au": 9.537,
    "period": 10759.22,
    "description": "얼음과 암석 입자로 이루어진 넓은 고리를 가진 거대 행성. 타이탄과 엔셀라두스가 주변을 공전합니다."
  },
  {
    "id": "uranus",
    "name": "천왕성",
    "english": "URANUS",
    "type": "얼음형 거대 행성",
    "color": "#a2d5d7",
    "realRadius": 25362,
    "au": 19.19,
    "period": 30688.5,
    "description": "청록색 대기를 가진 얼음 거대 행성. 크게 기울어진 자전축이 특징입니다."
  },
  {
    "id": "neptune",
    "name": "해왕성",
    "english": "NEPTUNE",
    "type": "얼음형 거대 행성",
    "color": "#6489df",
    "realRadius": 24622,
    "au": 30.07,
    "period": 60182,
    "description": "태양계 바깥쪽의 짙푸른 거대 행성. 긴 공전 주기로 항성계를 천천히 돌고 있습니다."
  }
].map(body => {
  const elements=JPL_ELEMENTS[body.id];
  return physical({...body, orbit:elements.base[0], au:elements.base[0], eccentricity:elements.base[1], inclination:elements.base[2], node:elements.base[5], elements});
});
export const MOONS = [
  {
    "id": "moon",
    "name": "달",
    "english": "MOON",
    "parent": "earth",
    "color": "#c6c7c4",
    "realRadius": 1737.4,
    "period": 27.32,
    "type": "자연 위성",
    "description": "지구 주위를 공전하는 위성입니다. 위성 궤도는 모행성과 함께 항성계 안에서 이동합니다."
  },
  {
    "id": "phobos",
    "name": "포보스",
    "english": "PHOBOS",
    "parent": "mars",
    "color": "#a89b8f",
    "realRadius": 11.1,
    "period": 0.319,
    "type": "자연 위성",
    "description": "화성 주위를 공전하는 위성입니다. 위성 궤도는 모행성과 함께 항성계 안에서 이동합니다."
  },
  {
    "id": "deimos",
    "name": "데이모스",
    "english": "DEIMOS",
    "parent": "mars",
    "color": "#b6aca1",
    "realRadius": 6.2,
    "period": 1.263,
    "type": "자연 위성",
    "description": "화성 주위를 공전하는 위성입니다. 위성 궤도는 모행성과 함께 항성계 안에서 이동합니다."
  },
  {
    "id": "io",
    "name": "이오",
    "english": "IO",
    "parent": "jupiter",
    "color": "#dcc37a",
    "realRadius": 1821.6,
    "period": 1.769,
    "type": "자연 위성",
    "description": "목성 주위를 공전하는 위성입니다. 위성 궤도는 모행성과 함께 항성계 안에서 이동합니다."
  },
  {
    "id": "europa",
    "name": "유로파",
    "english": "EUROPA",
    "parent": "jupiter",
    "color": "#d6cfc0",
    "realRadius": 1560.8,
    "period": 3.551,
    "type": "자연 위성",
    "description": "목성 주위를 공전하는 위성입니다. 위성 궤도는 모행성과 함께 항성계 안에서 이동합니다."
  },
  {
    "id": "ganymede",
    "name": "가니메데",
    "english": "GANYMEDE",
    "parent": "jupiter",
    "color": "#a99e91",
    "realRadius": 2634.1,
    "period": 7.155,
    "type": "자연 위성",
    "description": "목성 주위를 공전하는 위성입니다. 위성 궤도는 모행성과 함께 항성계 안에서 이동합니다."
  },
  {
    "id": "callisto",
    "name": "칼리스토",
    "english": "CALLISTO",
    "parent": "jupiter",
    "color": "#92887c",
    "realRadius": 2410.3,
    "period": 16.689,
    "type": "자연 위성",
    "description": "목성 주위를 공전하는 위성입니다. 위성 궤도는 모행성과 함께 항성계 안에서 이동합니다."
  },
  {
    "id": "titan",
    "name": "타이탄",
    "english": "TITAN",
    "parent": "saturn",
    "color": "#d6ae61",
    "realRadius": 2574.7,
    "period": 15.945,
    "type": "자연 위성",
    "description": "토성 주위를 공전하는 위성입니다. 위성 궤도는 모행성과 함께 항성계 안에서 이동합니다."
  },
  {
    "id": "enceladus",
    "name": "엔셀라두스",
    "english": "ENCELADUS",
    "parent": "saturn",
    "color": "#e5e7e8",
    "realRadius": 252.1,
    "period": 1.37,
    "type": "자연 위성",
    "description": "토성 주위를 공전하는 위성입니다. 위성 궤도는 모행성과 함께 항성계 안에서 이동합니다."
  },
  {
    "id": "titania",
    "name": "티타니아",
    "english": "TITANIA",
    "parent": "uranus",
    "color": "#b4b9b8",
    "realRadius": 788.9,
    "period": 8.706,
    "type": "자연 위성",
    "description": "천왕성 주위를 공전하는 위성입니다. 위성 궤도는 모행성과 함께 항성계 안에서 이동합니다."
  },
  {
    "id": "triton",
    "name": "트리톤",
    "english": "TRITON",
    "parent": "neptune",
    "color": "#c5c5c3",
    "realRadius": 1353.4,
    "period": -5.877,
    "type": "자연 위성",
    "description": "해왕성 주위를 공전하는 위성입니다. 위성 궤도는 모행성과 함께 항성계 안에서 이동합니다."
  }
].map(body => {
  const orbit=SATELLITE_ELEMENTS[body.id];
  return physical({...body, orbit:orbit.semiMajorKm/AU_KM, period:orbit.periodSeconds/86400, eccentricity:orbit.eccentricity, inclination:orbit.inclination, node:orbit.node, argument:orbit.argument, phase:orbit.phase});
});
export const BELTS = [
  {
    "id": "asteroid-belt",
    "name": "소행성대",
    "english": "ASTEROID BELT",
    "type": "소천체 밀집 영역",
    "color": "#b7a48c",
    "inner": 2.1,
    "outer": 3.3,
    "count": 1800,
    "au": "2.1–3.3",
    "description": "화성과 목성 사이에 분포하는 암석 천체들. 폭과 수직 두께를 가진 영역으로 표현했습니다. 입자 수와 크기는 관찰을 위해 조정했습니다."
  },
  {
    "id": "kuiper-belt",
    "name": "카이퍼대",
    "english": "KUIPER BELT",
    "type": "외곽 소천체 영역",
    "color": "#7f96b1",
    "inner": 30,
    "outer": 50,
    "count": 1400,
    "au": "30–50",
    "description": "해왕성 궤도 바깥의 얼음 천체 영역. 바깥 경계를 둘러싼 입체적인 띠로 표현했습니다."
  }
];
export const ALL_BODIES = [SUN, ...PLANETS, ...MOONS, ...BELTS];
export const BODY_BY_ID = new Map(ALL_BODIES.map(body => [body.id,body]));
